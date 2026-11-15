"""Rounds M3.1 spike add-on. THROWAWAY: branch m3.1-anki-spike, never merged.

Tools -> Rounds spike: one menu entry per question M3.1 answers. Every probe
writes a JSON report to this add-on's user_files folder and shows a summary.

Never reads note fields (card text): only ids, GUIDs, tags, deck names,
scheduling numbers and the review log (domain rule 6).
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import requests
from anki.collection import Collection, OpChanges
from aqt import gui_hooks, mw
from aqt.operations import CollectionOp, QueryOp
from aqt.qt import QAction, QInputDialog, QMenu
from aqt.utils import askUser, showInfo, showText, showWarning, tooltip

ADDON_DIR = os.path.dirname(__file__)
USER_FILES = os.path.join(ADDON_DIR, "user_files")
MISSED_TAG = "#Rounds::missed"
SYNC_TEST_TAG = "#Rounds::sync_test"


def config() -> dict[str, Any]:
    return mw.addonManager.getConfig(__name__) or {}


def save_config(cfg: dict[str, Any]) -> None:
    mw.addonManager.writeConfig(__name__, cfg)


def write_report(name: str, data: dict[str, Any]) -> str:
    os.makedirs(USER_FILES, exist_ok=True)
    profile = mw.pm.name or "profile"
    path = os.path.join(USER_FILES, f"{name}-{profile}-{time.strftime('%Y%m%d-%H%M%S')}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return path


def show_report(title: str, data: dict[str, Any], path: str) -> None:
    showText(f"{title}\n\nSaved to {path}\n\n{json.dumps(data, indent=2, ensure_ascii=False)}", title=title)


def is_spike_profile() -> bool:
    return "spike" in (mw.pm.name or "").lower()


# ---------------------------------------------------------------- probe 1


def probe_environment(col: Collection) -> dict[str, Any]:
    from anki.buildinfo import version as anki_version

    tags = col.tags.all()
    top_level: dict[str, int] = {}
    for t in tags:
        head = t.split("::")[0]
        top_level[head] = top_level.get(head, 0) + 1
    addons = {
        a.dir_name: {"name": a.human_name(), "enabled": a.enabled}
        for a in mw.addonManager.all_addon_meta()
    }
    ankihub = next((v for v in addons.values() if v["name"] == "AnkiHub"), None)
    ankihub_version = None
    for a in mw.addonManager.all_addon_meta():
        if a.human_name() == "AnkiHub":
            manifest = os.path.join(mw.addonManager.addonsFolder(a.dir_name), "manifest.json")
            if os.path.exists(manifest):
                with open(manifest, encoding="utf-8") as f:
                    ankihub_version = json.load(f).get("version")
    return {
        "anki_version": anki_version,
        "profile": mw.pm.name,
        "fsrs": bool(col.get_config("fsrs", False)),
        "notes": col.note_count(),
        "cards": col.card_count(),
        "suspended_cards": len(col.find_cards("is:suspended")),
        "decks": sorted(d.name for d in col.decks.all_names_and_ids())[:60],
        "tag_count": len(tags),
        "top_level_tags": dict(sorted(top_level.items(), key=lambda kv: -kv[1])[:25]),
        "ankihub": {"installed": ankihub is not None, "version": ankihub_version},
        "sync": {"logged_in_to_ankiweb": bool(mw.pm.sync_auth())},
    }


# ---------------------------------------------------------------- probe 2


def notes_for_keywords(col: Collection, keywords: list[str], tag_prefix: str) -> tuple[list[str], list[int]]:
    """Tags under tag_prefix with any keyword in their last part, and their notes."""
    kws = [k.lower() for k in keywords]
    matching = [
        t
        for t in col.tags.all()
        if t.lower().startswith(tag_prefix.lower()) and any(k in t.lower() for k in kws)
    ]
    if not matching:
        return [], []
    query = " OR ".join(f'"tag:{t}"' for t in matching)
    return matching, list(col.find_notes(query))


def probe_find_notes(col: Collection) -> dict[str, Any]:
    cfg = config()
    prefix = cfg.get("tag_prefix", "#AK_")
    out: dict[str, Any] = {"tag_prefix": prefix, "scripts": {}}
    all_nids: dict[str, set[int]] = {}
    for script_id, keywords in cfg.get("scripts", {}).items():
        started = time.perf_counter()
        tags, nids = notes_for_keywords(col, keywords, prefix)
        cids = list(col.find_cards(f"nid:{','.join(map(str, nids))}")) if nids else []
        suspended = (
            col.db.scalar(f"select count() from cards where queue = -1 and id in ({','.join(map(str, cids))})")
            if cids
            else 0
        )
        all_nids[script_id] = set(nids)
        # Group tags by their branch so the report stays readable.
        branches: dict[str, int] = {}
        for t in tags:
            branch = "::".join(t.split("::")[:2])
            branches[branch] = branches.get(branch, 0) + 1
        out["scripts"][script_id] = {
            "keywords": keywords,
            "matching_tags": len(tags),
            "tag_branches": branches,
            "example_tags": tags[:8],
            "notes": len(nids),
            "cards": len(cids),
            "suspended_cards": suspended,
            "ms": round((time.perf_counter() - started) * 1000),
        }
    ids = list(all_nids)
    overlaps = {}
    for i, a in enumerate(ids):
        for b in ids[i + 1 :]:
            shared = len(all_nids[a] & all_nids[b])
            if shared:
                overlaps[f"{a} & {b}"] = shared
    out["overlapping_notes"] = overlaps
    return out


def probe_branches(col: Collection) -> dict[str, Any]:
    """One SQL pass over notes.tags (ids and tags only) instead of Anki search.

    Counts notes per tag branch for each script, and the narrower sets a
    clinical student would care about (Step 2 #Subjects, Step 2 B&B).
    """
    cfg = config()
    t0 = time.perf_counter()
    rows = col.db.all("select id, tags from notes where tags like '%#AK_%'")
    t1 = time.perf_counter()
    out: dict[str, Any] = {"notes_scanned": len(rows), "scan_ms": round((t1 - t0) * 1000), "scripts": {}}
    for script_id, keywords in cfg.get("scripts", {}).items():
        kws = [k.lower() for k in keywords]
        sets: dict[str, set[int]] = {}
        subject_tags: set[str] = set()
        for nid, tags in rows:
            for t in tags.split():
                parts = t.split("::")
                # Match on the topic parts, not on resource ids like #AMBOSS::Dka1Jk.
                if parts[1:2] == ["#AMBOSS"]:
                    continue
                if not any(k in p.lower() for p in parts[2:] for k in kws):
                    continue
                sets.setdefault("all", set()).add(nid)
                sets.setdefault("::".join(parts[:2]), set()).add(nid)
                if parts[:2] == ["#AK_Step2_v12", "#Subjects"]:
                    subject_tags.add(t)
        out["scripts"][script_id] = {
            "counts": dict(sorted(((k, len(v)) for k, v in sets.items()), key=lambda kv: -kv[1])),
            "step2_subject_tags": sorted(subject_tags),
        }
    out["match_ms"] = round((time.perf_counter() - t1) * 1000)
    out["card_id_range"] = col.db.first("select min(id), max(id) from cards")
    out["note_id_range"] = col.db.first("select min(id), max(id) from notes")
    return out


# ---------------------------------------------------------------- probe 3


def linked_card_ids(col: Collection) -> list[int]:
    cfg = config()
    prefix = cfg.get("tag_prefix", "#AK_")
    nids: set[int] = set()
    for keywords in cfg.get("scripts", {}).values():
        nids.update(notes_for_keywords(col, keywords, prefix)[1])
    if not nids:
        return []
    return list(col.find_cards(f"nid:{','.join(map(str, nids))}"))


def card_stats(col: Collection, cids: list[int]) -> list[dict[str, Any]]:
    if not cids:
        return []
    ids = ",".join(map(str, cids))
    today = col.sched.today
    last = dict(col.db.all(f"select cid, max(id) from revlog where cid in ({ids}) group by cid"))
    rows = col.db.all(
        f"select c.id, c.nid, n.guid, c.queue, c.type, c.due, c.ivl, c.reps, c.lapses "
        f"from cards c join notes n on n.id = c.nid where c.id in ({ids})"
    )
    stats = []
    for cid, nid, guid, queue, ctype, due, ivl, reps, lapses in rows:
        stats.append(
            {
                "card_id": cid,
                "note_id": nid,
                "note_guid": guid,
                "suspended": queue == -1,
                "queue": queue,
                # Review cards keep due as a day number; others aren't day-based.
                "due_days": (due - today) if ctype == 2 else None,
                "interval_days": max(ivl, 0),
                "reps": reps,
                "lapses": lapses,
                "last_review_ms": last.get(cid),
            }
        )
    return stats


def probe_stats(col: Collection) -> dict[str, Any]:
    t0 = time.perf_counter()
    cids = linked_card_ids(col)
    t1 = time.perf_counter()
    stats = card_stats(col, cids)
    t2 = time.perf_counter()
    # Worst case: every card in the collection.
    all_cids = list(col.find_cards(""))
    t3 = time.perf_counter()
    all_stats = card_stats(col, all_cids)
    t4 = time.perf_counter()
    payload = json.dumps({"cards": stats}).encode()
    return {
        "linked_cards": len(cids),
        "find_linked_ms": round((t1 - t0) * 1000),
        "read_linked_stats_ms": round((t2 - t1) * 1000),
        "linked_payload_bytes": len(payload),
        "all_cards": len(all_cids),
        "read_all_stats_ms": round((t4 - t3) * 1000),
        "all_payload_bytes": len(json.dumps({"cards": all_stats}).encode()),
        "fsrs": bool(col.get_config("fsrs", False)),
        "example": stats[:3],
    }


# ---------------------------------------------------------------- probe 4


def apply_actions(col: Collection, actions: list[dict[str, Any]]) -> tuple[OpChanges, list[dict[str, Any]]]:
    """Unsuspend / tag in one undo step ("Rounds: apply changes")."""
    pos = col.add_custom_undo_entry("Rounds: apply changes")
    applied = []
    changes = OpChanges()
    for action in actions:
        existing = [c for c in action["card_ids"] if col.db.scalar("select 1 from cards where id = ?", c)]
        if action["kind"] == "unsuspend":
            count = len(
                col.db.list(
                    f"select id from cards where queue = -1 and id in ({','.join(map(str, existing)) or '0'})"
                )
            )
            if existing:
                col.sched.unsuspend_cards(existing)
        else:
            nids = list({col.get_card(c).nid for c in existing})
            count = col.tags.bulk_add(nids, MISSED_TAG).count if nids else 0
        applied.append({"id": action.get("id"), "kind": action["kind"], "count": count})
    changes = col.merge_undo_entries(pos)
    return changes, applied


def probe_write() -> None:
    if not is_spike_profile():
        showWarning("The write test runs only in a profile whose name contains 'spike'.")
        return
    col = mw.col
    prefix = config().get("tag_prefix", "#AK_")
    cids = col.find_cards(f'is:suspended "tag:{prefix}*"')[:3]
    if not cids:
        showWarning("No suspended AnKing cards found to test on.")
        return
    actions = [
        {"id": "test-unsuspend", "kind": "unsuspend", "card_ids": list(cids)},
        {"id": "test-tag", "kind": "tag_missed", "card_ids": list(cids)},
    ]
    before_usn = col.db.all(f"select id, usn, mod from cards where id in ({','.join(map(str, cids))})")

    def done(result: Any) -> None:
        after = mw.col.db.all(f"select id, usn, mod, queue from cards where id in ({','.join(map(str, cids))})")
        data = {
            "cards": list(cids),
            "applied": applied_holder,
            "before_usn_mod": before_usn,
            "after_usn_mod_queue": after,
            "undo_label": mw.col.undo_status().undo,
        }
        path = write_report("write", data)
        show_report("Write test (now try Edit -> Undo)", data, path)

    applied_holder: list[dict[str, Any]] = []

    def op(c: Collection) -> OpChanges:
        changes, applied = apply_actions(c, actions)
        applied_holder.extend(applied)
        return changes

    CollectionOp(mw, op).success(done).run_in_background()


def sync_test_tag(add: bool) -> None:
    col = mw.col
    if add:
        cfg = config()
        _, nids = notes_for_keywords(col, cfg["scripts"].get("acute-pancreatitis", ["pancreatitis"]), cfg.get("tag_prefix", "#AK_"))
        nids = nids or list(col.find_notes(""))
        if not nids:
            showWarning("No notes in this profile.")
            return
        nid = nids[0]
        if not askUser(f"Tag note {nid} with {SYNC_TEST_TAG} on profile '{mw.pm.name}'?"):
            return
        CollectionOp(mw, lambda c: c.tags.bulk_add([nid], SYNC_TEST_TAG)).success(
            lambda _: showInfo(f"Tagged note {nid}. Sync, then search tag:{SYNC_TEST_TAG} on AnkiWeb or AnkiMobile.")
        ).run_in_background()
    else:
        nids = list(col.find_notes(f'"tag:{SYNC_TEST_TAG}"'))
        CollectionOp(mw, lambda c: c.tags.bulk_remove(nids, SYNC_TEST_TAG)).success(
            lambda _: showInfo(f"Removed the tag from {len(nids)} note(s). Sync again.")
        ).run_in_background()


# ---------------------------------------------------------------- probe 5


def probe_id_dump(col: Collection) -> dict[str, Any]:
    prefix = config().get("tag_prefix", "#AK_")
    nids = list(col.find_notes(f'"tag:{prefix}*"'))
    if not nids:
        return {"error": f"no notes tagged {prefix}*"}
    ids = ",".join(map(str, nids))
    notes = col.db.all(f"select id, guid, mid from notes where id in ({ids})")
    cards = col.db.all(f"select id, nid, ord from cards where nid in ({ids})")
    dump = {
        "profile": mw.pm.name,
        "notes": {guid: {"nid": nid, "mid": mid} for nid, guid, mid in notes},
        "cards": {f"{nid}:{ord_}": cid for cid, nid, ord_ in cards},
    }
    path = write_report("ids", dump)
    return {"notes": len(notes), "cards": len(cards), "dump": path}


def compare_id_dumps() -> None:
    files = sorted(f for f in os.listdir(USER_FILES) if f.startswith("ids-")) if os.path.isdir(USER_FILES) else []
    if len(files) < 2:
        showWarning("Run 'Dump AnKing ids' in two profiles first.")
        return
    a_name, b_name = files[-2], files[-1]
    with open(os.path.join(USER_FILES, a_name), encoding="utf-8") as f:
        a = json.load(f)
    with open(os.path.join(USER_FILES, b_name), encoding="utf-8") as f:
        b = json.load(f)
    shared = set(a["notes"]) & set(b["notes"])
    same_nid = sum(1 for g in shared if a["notes"][g]["nid"] == b["notes"][g]["nid"])
    same_mid = sum(1 for g in shared if a["notes"][g]["mid"] == b["notes"][g]["mid"])
    shared_cards = set(a["cards"]) & set(b["cards"])
    same_cid = sum(1 for k in shared_cards if a["cards"][k] == b["cards"][k])
    data = {
        "a": a_name,
        "b": b_name,
        "notes_a": len(a["notes"]),
        "notes_b": len(b["notes"]),
        "shared_guids": len(shared),
        "same_note_id": same_nid,
        "same_note_type_id": same_mid,
        "shared_note_card_slots": len(shared_cards),
        "same_card_id": same_cid,
    }
    path = write_report("ids-compare", data)
    show_report("Id stability", data, path)


# ---------------------------------------------------------------- pairing and sync


def pair() -> None:
    cfg = config()
    code, ok = QInputDialog.getText(mw, "Connect Rounds", "Enter the code from the Rounds app:")
    if not ok or not code.strip():
        return
    try:
        r = requests.post(cfg["server"], json={"op": "claim", "code": code}, timeout=15)
    except requests.RequestException as e:
        showWarning(f"Couldn't reach Rounds: {e}")
        return
    if r.status_code != 200:
        showWarning(r.json().get("error", f"Error {r.status_code}"))
        return
    cfg["device_token"] = r.json()["token"]
    save_config(cfg)
    tooltip("Connected to Rounds")


def sync_now(quiet: bool = False) -> None:
    cfg = config()
    token = cfg.get("device_token")
    if not token:
        if not quiet:
            showWarning("Connect to Rounds first.")
        return
    timings: dict[str, Any] = {}

    def gather(col: Collection) -> list[dict[str, Any]]:
        t = time.perf_counter()
        stats = card_stats(col, linked_card_ids(col))
        timings["gather_ms"] = round((time.perf_counter() - t) * 1000)
        return stats

    def post(stats: list[dict[str, Any]], applied: list[dict[str, Any]]) -> dict[str, Any]:
        t = time.perf_counter()
        body = json.dumps({"op": "sync", "cards": stats, "applied": applied})
        r = requests.post(
            cfg["server"],
            data=body,
            headers={"content-type": "application/json", "x-rounds-device": token},
            timeout=30,
        )
        timings.setdefault("posts", []).append(
            {"ms": round((time.perf_counter() - t) * 1000), "bytes": len(body), "status": r.status_code}
        )
        r.raise_for_status()
        return r.json()

    def first_post_done(result: dict[str, Any]) -> None:
        actions = result.get("actions", [])
        if not actions:
            finish([])
            return
        holder: list[dict[str, Any]] = []

        def op(c: Collection) -> OpChanges:
            changes, applied = apply_actions(c, actions)
            holder.extend(applied)
            return changes

        CollectionOp(mw, op).success(lambda _: finish(holder)).run_in_background()

    def finish(applied: list[dict[str, Any]]) -> None:
        def second(col: Collection) -> dict[str, Any]:
            # Report what was applied, with fresh stats so the app sees the new state.
            return post(card_stats(col, linked_card_ids(col)), applied) if applied else {}

        def done(_: Any) -> None:
            data = {"applied": applied, "timings": timings}
            path = write_report("sync", data)
            if quiet:
                tooltip(f"Rounds synced ({len(applied)} change(s))")
            else:
                show_report("Rounds sync", data, path)

        QueryOp(parent=mw, op=second, success=done).failure(lambda e: showWarning(str(e))).run_in_background()

    QueryOp(parent=mw, op=lambda col: post(gather(col), []), success=first_post_done).failure(
        lambda e: showWarning(f"Rounds sync failed: {e}")
    ).run_in_background()


# ---------------------------------------------------------------- menu


def run_probe(title: str, fn: Any) -> None:
    def done(data: dict[str, Any]) -> None:
        path = write_report(title.lower().replace(" ", "-"), data)
        show_report(title, data, path)

    QueryOp(parent=mw, op=fn, success=done).failure(lambda e: showWarning(str(e))).run_in_background()


def setup_menu() -> None:
    menu = QMenu("Rounds spike", mw)
    items = [
        ("1. Environment", lambda: run_probe("Environment", probe_environment)),
        ("2. Find script notes by tag", lambda: run_probe("Find notes", probe_find_notes)),
        ("2b. Tag branches (SQL pass)", lambda: run_probe("Branches", probe_branches)),
        ("3. Review stats timing", lambda: run_probe("Stats", probe_stats)),
        ("4. Write test (spike profile only)", probe_write),
        ("4b. Sync test: tag one note", lambda: sync_test_tag(True)),
        ("4c. Sync test: remove tag", lambda: sync_test_tag(False)),
        ("5. Dump AnKing ids", lambda: run_probe("Dump ids", probe_id_dump)),
        ("5b. Compare last two id dumps", compare_id_dumps),
        ("6. Connect to Rounds (code)", pair),
        ("6b. Sync with Rounds now", sync_now),
    ]
    for label, fn in items:
        action = QAction(label, mw)
        action.triggered.connect(fn)
        menu.addAction(action)
    mw.form.menuTools.addMenu(menu)


gui_hooks.main_window_did_init.append(setup_menu)
# Sync shape under test: once when a profile opens (quietly).
gui_hooks.profile_did_open.append(lambda: mw.progress.single_shot(3000, lambda: sync_now(quiet=True)))
