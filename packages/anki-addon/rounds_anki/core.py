"""What the Rounds add-on does to a collection, without Anki's GUI (M3.3).

Pure enough to test with a fake collection (tests/test_core.py): it needs only
`col.db` (all/list), `col.sched` (today, unsuspend_cards), `col.tags.bulk_add`
and Anki's custom undo entries.

Reads ids, tags and scheduling numbers only. Never reads note fields (card
text), and never sends anything but ids and numbers (domain rule 6).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

MISSED_TAG = "#Rounds::missed"
UNDO_LABEL = "Rounds: apply changes"
# SQLite caps bound variables; ids go in as literals in chunks of this size.
CHUNK = 400


def _chunks(ids: Iterable[int]) -> Iterable[list[int]]:
    batch: list[int] = []
    for i in ids:
        batch.append(int(i))
        if len(batch) == CHUNK:
            yield batch
            batch = []
    if batch:
        yield batch


def _id_list(ids: list[int]) -> str:
    # Ids are ints from the server's validated JSON; int() guards the SQL.
    return ",".join(str(int(i)) for i in ids)


def card_stats(db: Any, note_ids: Iterable[int], today: int) -> list[dict[str, Any]]:
    """Per-card numbers for the cards of the given notes. Ids and numbers only."""
    stats: list[dict[str, Any]] = []
    for batch in _chunks(sorted(set(note_ids))):
        rows = db.all(
            "select c.id, c.nid, c.queue, c.type, c.due, c.ivl, c.reps, c.lapses, "
            "(select max(r.id) from revlog r where r.cid = c.id) "
            f"from cards c where c.nid in ({_id_list(batch)}) order by c.id"
        )
        for cid, nid, queue, ctype, due, ivl, reps, lapses, last in rows:
            stats.append(
                {
                    "card_id": int(cid),
                    "note_id": int(nid),
                    "suspended": queue == -1,
                    "queue": int(queue),
                    # Review cards keep due as a day number; others aren't day-based.
                    "due_days": int(due - today) if ctype == 2 else None,
                    "interval_days": max(int(ivl), 0),
                    "reps": int(reps),
                    "lapses": int(lapses),
                    "last_review_ms": int(last) if last else None,
                }
            )
    return stats


def _suspended_cards(db: Any, note_ids: list[int]) -> list[int]:
    out: list[int] = []
    for batch in _chunks(note_ids):
        out.extend(db.list(f"select id from cards where queue = -1 and nid in ({_id_list(batch)})"))
    return [int(c) for c in out]


def _notes_without_tag(db: Any, note_ids: list[int], tag: str) -> list[int]:
    out: list[int] = []
    wanted = tag.lower()
    for batch in _chunks(note_ids):
        for nid, tags in db.all(f"select id, tags from notes where id in ({_id_list(batch)})"):
            if wanted not in (t.lower() for t in tags.split()):
                out.append(int(nid))
    return out


@dataclass
class Plan:
    """The changes a pull asks for, worked out against this collection."""

    # Per action: (action id, kind, card or note ids to change).
    actions: list[tuple[str, str, list[int]]] = field(default_factory=list)
    # Notes that lost #Rounds::missed (AnkiHub updates wipe it).
    retag: list[int] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not self.retag and all(not ids for _, _, ids in self.actions)


def plan_changes(db: Any, pull: dict[str, Any]) -> Plan:
    plan = Plan()
    seen_cards: set[int] = set()
    seen_notes: set[int] = set()
    for action in pull.get("actions", []):
        note_ids = [int(n) for n in action["note_ids"]]
        if action["kind"] == "unsuspend":
            ids = [c for c in _suspended_cards(db, note_ids) if c not in seen_cards]
            seen_cards.update(ids)
        else:
            ids = [n for n in _notes_without_tag(db, note_ids, MISSED_TAG) if n not in seen_notes]
            seen_notes.update(ids)
        plan.actions.append((str(action["id"]), action["kind"], ids))
    plan.retag = [
        n
        for n in _notes_without_tag(db, [int(n) for n in pull.get("tag_note_ids", [])], MISSED_TAG)
        if n not in seen_notes
    ]
    return plan


@dataclass
class Result:
    applied: list[dict[str, Any]]
    unsuspended: int
    tagged: int


def apply_plan(col: Any, plan: Plan) -> tuple[Any, Result]:
    """Applies a plan in one undo step ("Rounds: apply changes").

    Returns Anki's OpChanges (for CollectionOp) and what changed. Every action
    is reported back, with a count of 0 when this collection doesn't have its
    notes, so the server stops sending it.
    """
    pos = col.add_custom_undo_entry(UNDO_LABEL)
    applied: list[dict[str, Any]] = []
    unsuspended = tagged = 0
    for action_id, kind, ids in plan.actions:
        count = 0
        if ids and kind == "unsuspend":
            col.sched.unsuspend_cards(ids)
            count = len(ids)
            unsuspended += count
        elif ids:
            count = col.tags.bulk_add(ids, MISSED_TAG).count
            tagged += count
        applied.append({"id": action_id, "count": count})
    if plan.retag:
        tagged += col.tags.bulk_add(plan.retag, MISSED_TAG).count
    changes = col.merge_undo_entries(pos)
    return changes, Result(applied=applied, unsuspended=unsuspended, tagged=tagged)


def plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


def summary(result: Result) -> str | None:
    """The tooltip after a sync that changed something, or None."""
    parts = []
    if result.unsuspended:
        parts.append(f"unsuspended {plural(result.unsuspended, 'card')}")
    if result.tagged:
        parts.append(f"tagged {plural(result.tagged, 'note')} {MISSED_TAG}")
    if not parts:
        return None
    return "Rounds: " + " and ".join(parts) + ". Edit → Undo puts them back."
