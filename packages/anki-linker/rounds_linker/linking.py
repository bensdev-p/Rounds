"""Pure linking logic for the Rounds linker (no Anki imports, so it can be tested).

Input: (note id, tags) rows from the developer's AnKing collection, and the
scripts in content/scripts. Output: candidate notes per script, each with a
suggested rung, and the links file the developer saves.

Only ids and tags are read, never note fields (card text). Tags are used here
to find candidates and shown in the dialog; they are never written to the
links file, which holds note ids and rungs only (domain rule 6).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable

RUNGS = ("recall", "second_order", "differentiate", "workup", "management", "pearl")
CORE = "core"

# Must match MAX_ANKI_NOTES_PER_RUNG and MAX_ANKI_CORE_NOTES in
# packages/shared/src/schemas/illnessScript.ts (developer's call, M3.2).
MAX_PER_RUNG = 3
MAX_CORE = 5

# AnKing's Step 2 subject tree: #AK_Step2_v12::#Subjects::<system>::...::<topic>::<leaf>.
SUBJECTS_ROOT = re.compile(r"^#AK_Step2_v\d+$", re.IGNORECASE)
SUBJECTS_BRANCH = "#subjects"

# Leaves under a topic that follow a rung (M3.1: ::Management, ::Pathophysiology).
# Anything else under the topic, and the topic itself, counts as core.
LEAF_RUNGS = {
    "management": "management",
    "treatment": "management",
    "therapy": "management",
    "diagnosis": "workup",
    "workup": "workup",
    "work up": "workup",
    "evaluation": "workup",
    "diagnostics": "workup",
    "etiology": "recall",
    "etiologies": "recall",
    "causes": "recall",
    "risk factors": "recall",
    "epidemiology": "recall",
    "pathophysiology": "recall",
    "pathogenesis": "recall",
    "presentation": "recall",
    "clinical presentation": "recall",
    "clinical features": "recall",
    "signs and symptoms": "recall",
}

# When a note sits under several leaves of one script, the more specific rung wins.
RUNG_PRIORITY = {CORE: 0, "recall": 1, "workup": 2, "management": 3}


# Trailing words in script names that AnKing's topic names usually leave out
# ("COPD exacerbation" -> "COPD"). Only safe suffixes: dropping "acute" would
# let "pancreatitis" match chronic pancreatitis.
GENERIC_SUFFIXES = ("exacerbation", "infection")


def normalize(text: str) -> str:
    """'11_Acute_Pancreatitis' -> 'acute pancreatitis'."""
    text = re.sub(r"^\d+[_\s.-]*", "", text)
    text = re.sub(r"[_\-/]+", " ", text)
    text = re.sub(r"[^\w\s']", " ", text.lower())
    return " ".join(text.split())


def _leaf_key(segment: str) -> str:
    # AnKing marks reworked branches "_REDO" ("Management_Redo").
    return re.sub(r" ?\bredo$", "", normalize(segment))


def is_leaf(segment: str) -> bool:
    return _leaf_key(segment) in LEAF_RUNGS


def leaf_rung(segment: str) -> str:
    return LEAF_RUNGS.get(_leaf_key(segment), CORE)


@dataclass
class Script:
    id: str
    name: str
    aliases: list[str]
    links: list[dict[str, str]] = field(default_factory=list)
    # The developer's own search words (kept in the add-on's user_files, never the repo).
    extra: list[str] = field(default_factory=list)

    @staticmethod
    def from_content(data: dict[str, Any]) -> "Script":
        s = data["script"]
        return Script(
            id=s["id"],
            name=s["name"],
            aliases=list(s.get("aliases", [])),
            links=[dict(r) for r in s.get("anki_refs", [])],
        )

    def terms(self) -> set[str]:
        terms = {normalize(x) for x in [self.name, *self.aliases, *self.extra]}
        for t in list(terms):
            words = t.split()
            if len(words) > 1 and words[-1] in GENERIC_SUFFIXES:
                terms.add(" ".join(words[:-1]))
        return {t for t in terms if len(t) >= 2}


@dataclass
class Candidate:
    note_id: int
    rung: str  # suggested: a rung name or CORE
    topic: str  # the matching tag, shown in the dialog only
    score: int  # how many other AnKing tags the note carries (a high-yield proxy)
    selected: bool = False
    # False when the note sits only under a sub-topic of the match (asthma under
    # "Obstructive lung disease" for COPD): listed, but not ticked to start.
    direct: bool = True


def _ngrams(words: list[str]) -> Iterable[str]:
    for i in range(len(words)):
        for j in range(i + 1, len(words) + 1):
            yield " ".join(words[i:j])


def build_term_index(scripts: Iterable[Script]) -> dict[str, set[str]]:
    index: dict[str, set[str]] = {}
    for s in scripts:
        for t in s.terms():
            index.setdefault(t, set()).add(s.id)
    return index


def match_tag(tag: str, index: dict[str, set[str]]) -> dict[str, tuple[str, str, bool]]:
    """Script id -> (rung, topic tag, direct) for one tag, or {} if it isn't a Subjects tag.

    The deepest segment naming a script is its topic; the segment right after it,
    if any, is the leaf that picks the rung. A segment there that isn't a known
    leaf is a sub-topic: core, and not direct.
    """
    parts = tag.split("::")
    if len(parts) < 3 or not SUBJECTS_ROOT.match(parts[0]) or parts[1].lower() != SUBJECTS_BRANCH:
        return {}
    found: dict[str, int] = {}
    for depth in range(2, len(parts)):
        words = normalize(parts[depth]).split()
        for gram in _ngrams(words):
            for script_id in index.get(gram, ()):
                found[script_id] = depth
    out: dict[str, tuple[str, str, bool]] = {}
    for script_id, depth in found.items():
        has_next = depth + 1 < len(parts)
        rung = leaf_rung(parts[depth + 1]) if has_next else CORE
        direct = not has_next or is_leaf(parts[depth + 1])
        out[script_id] = (rung, "::".join(parts[: depth + 2]), direct)
    return out


def find_candidates(
    rows: Iterable[tuple[int, str]], scripts: list[Script]
) -> dict[str, list[Candidate]]:
    """One pass over (note id, space-separated tags). Only #AK_ tags count."""
    index = build_term_index(scripts)
    cache: dict[str, dict[str, tuple[str, str, bool]]] = {}
    by_script: dict[str, dict[int, Candidate]] = {s.id: {} for s in scripts}
    for nid, tags in rows:
        ak = [t for t in tags.split() if t.startswith("#AK_")]
        score = sum(1 for t in ak if "::#subjects::" not in t.lower())
        for tag in ak:
            if tag not in cache:
                cache[tag] = match_tag(tag, index)
            for script_id, (rung, topic, direct) in cache[tag].items():
                current = by_script[script_id].get(nid)
                if current is None:
                    by_script[script_id][nid] = Candidate(nid, rung, topic, score, direct=direct)
                elif (direct, RUNG_PRIORITY.get(rung, 1)) > (current.direct, RUNG_PRIORITY.get(current.rung, 1)):
                    current.rung, current.topic, current.direct = rung, topic, direct
    return {
        sid: sorted(c.values(), key=lambda c: (_rung_order(c.rung), not c.direct, -c.score, c.note_id))
        for sid, c in by_script.items()
    }


def topics_containing(rows: Iterable[tuple[int, str]], word: str, limit: int = 40) -> list[tuple[str, int]]:
    """Subjects topic paths with a segment containing `word`, and how many notes
    sit under each: helps the developer find the name AnKing uses for a topic."""
    needle = normalize(word)
    found: dict[str, set[int]] = {}
    for nid, tags in rows:
        for tag in tags.split():
            parts = tag.split("::")
            if len(parts) < 3 or not SUBJECTS_ROOT.match(parts[0]) or parts[1].lower() != SUBJECTS_BRANCH:
                continue
            for depth in range(2, len(parts)):
                if needle and needle in normalize(parts[depth]):
                    found.setdefault("::".join(parts[2 : depth + 1]), set()).add(nid)
                    break
    ranked = sorted(found.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    return [(topic, len(nids)) for topic, nids in ranked[:limit]]


def _rung_order(rung: str) -> int:
    return 0 if rung == CORE else RUNGS.index(rung) + 1


def cap_for(rung: str) -> int:
    return MAX_CORE if rung == CORE else MAX_PER_RUNG


def preselect(candidates: list[Candidate], links: list[dict[str, str]] | None) -> list[Candidate]:
    """Tick the saved links if there are any, otherwise the top notes per rung.

    Saved links missing from the candidates (tags changed) are kept as rows.
    """
    if links:
        chosen = {int(r["id"]): r.get("rung", CORE) for r in links}
        known = {c.note_id for c in candidates}
        for c in candidates:
            c.selected = c.note_id in chosen
            if c.selected:
                c.rung = chosen[c.note_id]
        extra = [Candidate(nid, rung, "(not found in tags)", 0, True) for nid, rung in chosen.items() if nid not in known]
        return extra + candidates
    taken: dict[str, int] = {}
    for c in candidates:
        if c.direct and taken.get(c.rung, 0) < cap_for(c.rung):
            c.selected = True
            taken[c.rung] = taken.get(c.rung, 0) + 1
        else:
            c.selected = False
    return candidates


def counts(candidates: Iterable[Candidate]) -> dict[str, int]:
    out: dict[str, int] = {}
    for c in candidates:
        if c.selected:
            out[c.rung] = out.get(c.rung, 0) + 1
    return out


def problems_for(script_id: str, candidates: Iterable[Candidate]) -> list[str]:
    return [
        f"{script_id}: {n} {'core notes' if rung == CORE else rung + ' notes'}, at most {cap_for(rung)}"
        for rung, n in counts(candidates).items()
        if n > cap_for(rung)
    ]


def refs_for(candidates: Iterable[Candidate]) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for c in sorted((c for c in candidates if c.selected), key=lambda c: (_rung_order(c.rung), c.note_id)):
        ref = {"kind": "note", "id": str(c.note_id)}
        if c.rung != CORE:
            ref["rung"] = c.rung
        refs.append(ref)
    return refs


def links_file(confirmed: dict[str, list[Candidate]]) -> dict[str, Any]:
    """The file `pnpm content:link-anki` reads: ids and rungs only."""
    return {
        "format": "rounds-anki-links",
        "version": 1,
        "scripts": {sid: refs_for(cands) for sid, cands in sorted(confirmed.items())},
    }
