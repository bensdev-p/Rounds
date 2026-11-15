"""Rounds linker: a developer-only Anki add-on (M3.2). Never given to students.

Tools -> Rounds: link scripts. Proposes AnKing notes for each illness script
and rung from the collection's tags, lets the developer confirm them, and saves
note ids and rungs to user_files/links.json. `pnpm content:link-anki <file>`
then writes them into content/scripts/*.json.

Read-only: it reads note ids and tags only, never note fields (card text), and
changes nothing in the collection.
"""

from __future__ import annotations

import glob
import json
import os
from typing import Any

from anki.collection import Collection
from aqt import dialogs, gui_hooks, mw
from aqt.operations import QueryOp
from aqt.qt import (
    QAction,
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QPushButton,
    QSplitter,
    Qt,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)
from aqt.utils import showInfo, showText, showWarning, tooltip

from . import linking as L

ADDON_DIR = os.path.dirname(__file__)
USER_FILES = os.path.join(ADDON_DIR, "user_files")
LINKS_FILE = os.path.join(USER_FILES, "links.json")
WORDS_FILE = os.path.join(USER_FILES, "search_words.json")
RUNG_CHOICES = [L.CORE, *L.RUNGS]
RUNG_LABELS = {
    L.CORE: "Core",
    "recall": "Recall",
    "second_order": "Next most common",
    "differentiate": "Tell it apart",
    "workup": "Workup",
    "management": "Management",
    "pearl": "Pearl",
}


def config() -> dict[str, Any]:
    return mw.addonManager.getConfig(__name__) or {}


def load_scripts() -> list[L.Script]:
    repo = config().get("repo_path", "")
    files = sorted(glob.glob(os.path.join(repo, "content", "scripts", "*.json")))
    if not files:
        raise RuntimeError(
            f"No scripts found under {repo!r}. Set repo_path in Tools -> Add-ons -> Rounds linker -> Config, "
            "or reinstall with pnpm anki:linker:install."
        )
    scripts = []
    for path in files:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if data["script"].get("status") != "retired":
            scripts.append(L.Script.from_content(data))
    return scripts


def load_saved() -> dict[str, list[dict[str, str]]]:
    if not os.path.exists(LINKS_FILE):
        return {}
    with open(LINKS_FILE, encoding="utf-8") as f:
        return json.load(f).get("scripts", {})


def load_words() -> dict[str, list[str]]:
    if not os.path.exists(WORDS_FILE):
        return {}
    with open(WORDS_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_words(words: dict[str, list[str]]) -> None:
    os.makedirs(USER_FILES, exist_ok=True)
    with open(WORDS_FILE, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(words.items())), f, indent=2)
        f.write("\n")


def gather(col: Collection) -> dict[str, Any]:
    """Background: one SQL pass over note ids and tags (never fields)."""
    scripts = load_scripts()
    words = load_words()
    for s in scripts:
        s.extra = words.get(s.id, [])
    rows = col.db.all("select id, tags from notes where tags like '%#AK_Step2_v%'")
    return {"scripts": scripts, "candidates": L.find_candidates(rows, scripts), "notes": len(rows), "rows": rows}


class LinkDialog(QDialog):
    def __init__(self, data: dict[str, Any]) -> None:
        super().__init__(mw)
        self.setWindowTitle("Rounds: link scripts")
        self.resize(1100, 680)
        self.scripts: list[L.Script] = data["scripts"]
        self.rows: list[tuple[int, str]] = data["rows"]
        self.words = load_words()
        saved = load_saved()
        self.confirmed: set[str] = set(saved)
        self.cands: dict[str, list[L.Candidate]] = {}
        for s in self.scripts:
            links = saved.get(s.id) if s.id in saved else s.links
            self.cands[s.id] = L.preselect(data["candidates"].get(s.id, []), links)
        self.current: str | None = None
        self._loading = False

        self.list = QListWidget()
        self.list.currentRowChanged.connect(self.show_script)

        self.summary = QLabel()
        self.summary.setWordWrap(True)
        self.confirm = QCheckBox("Confirmed: save this script's links")
        self.confirm.toggled.connect(self.toggle_confirmed)

        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(["Link", "Rung", "Note id", "Other AnKing tags", "Matched tag"])
        self.tree.setRootIsDecorated(False)
        self.tree.itemChanged.connect(self.item_changed)
        self.tree.itemDoubleClicked.connect(lambda item, _col: self.open_note(item))

        open_btn = QPushButton("Open in browser")
        open_btn.clicked.connect(lambda: self.open_note(self.tree.currentItem()))
        words_btn = QPushButton("Search words…")
        words_btn.clicked.connect(self.edit_words)
        topics_btn = QPushButton("Browse topics…")
        topics_btn.clicked.connect(self.browse_topics)
        hint = QLabel("Double-click a row to read the note in Anki's browser. Links save ids and rungs only.")
        row = QHBoxLayout()
        row.addWidget(open_btn)
        row.addWidget(words_btn)
        row.addWidget(topics_btn)
        row.addWidget(hint, 1)

        right = QWidget()
        rlay = QVBoxLayout(right)
        rlay.addWidget(self.summary)
        rlay.addWidget(self.confirm)
        rlay.addWidget(self.tree, 1)
        rlay.addLayout(row)

        split = QSplitter()
        split.addWidget(self.list)
        split.addWidget(right)
        split.setStretchFactor(1, 3)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Close)
        buttons.accepted.connect(self.save)
        buttons.rejected.connect(self.reject)

        lay = QVBoxLayout(self)
        lay.addWidget(QLabel(f"Scanned {data['notes']} AnKing Step 2 notes (ids and tags only)."))
        lay.addWidget(split, 1)
        lay.addWidget(buttons)

        for s in self.scripts:
            self.list.addItem(QListWidgetItem(self.list_label(s)))
        self.list.setCurrentRow(0)

    # ---------------------------------------------------------------- display

    def list_label(self, s: L.Script) -> str:
        cands = self.cands[s.id]
        mark = "✓ " if s.id in self.confirmed else "   "
        picked = sum(1 for c in cands if c.selected)
        warn = "  (over the cap)" if L.problems_for(s.id, cands) else ""
        return f"{mark}{s.name}  {picked} of {len(cands)}{warn}"

    def refresh_labels(self) -> None:
        if self.current is None:
            return
        i = next(i for i, s in enumerate(self.scripts) if s.id == self.current)
        self.list.item(i).setText(self.list_label(self.scripts[i]))
        n = L.counts(self.cands[self.current])
        parts = [f"{RUNG_LABELS[r]} {n.get(r, 0)}/{L.cap_for(r)}" for r in RUNG_CHOICES]
        problems = L.problems_for(self.current, self.cands[self.current])
        if not self.cands[self.current]:
            problems.append(
                "No proposals: AnKing may name this topic differently. "
                "Use Browse topics… to find its name, then add it with Search words…"
            )
        self.summary.setText(" · ".join(parts) + ("\n" + "; ".join(problems) if problems else ""))

    def show_script(self, row: int) -> None:
        if row < 0:
            return
        s = self.scripts[row]
        self.current = s.id
        self._loading = True
        self.confirm.setChecked(s.id in self.confirmed)
        self.tree.clear()
        for c in self.cands[s.id]:
            topic = c.topic if c.direct else f"{c.topic}  (sub-topic)"
            item = QTreeWidgetItem(["", "", str(c.note_id), str(c.score), topic])
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            item.setCheckState(0, Qt.CheckState.Checked if c.selected else Qt.CheckState.Unchecked)
            item.setData(0, Qt.ItemDataRole.UserRole, c.note_id)
            self.tree.addTopLevelItem(item)
            combo = QComboBox()
            combo.addItems([RUNG_LABELS[r] for r in RUNG_CHOICES])
            combo.setCurrentIndex(RUNG_CHOICES.index(c.rung))
            combo.currentIndexChanged.connect(lambda i, cand=c: self.set_rung(cand, i))
            self.tree.setItemWidget(item, 1, combo)
        for col in range(4):
            self.tree.resizeColumnToContents(col)
        self._loading = False
        self.refresh_labels()

    # ---------------------------------------------------------------- edits

    def candidate(self, item: QTreeWidgetItem) -> L.Candidate | None:
        nid = item.data(0, Qt.ItemDataRole.UserRole)
        return next((c for c in self.cands[self.current or ""] if c.note_id == nid), None)

    def item_changed(self, item: QTreeWidgetItem, column: int) -> None:
        if self._loading or column != 0:
            return
        c = self.candidate(item)
        if c:
            c.selected = item.checkState(0) == Qt.CheckState.Checked
            self.refresh_labels()

    def set_rung(self, cand: L.Candidate, index: int) -> None:
        cand.rung = RUNG_CHOICES[index]
        self.refresh_labels()

    def toggle_confirmed(self, on: bool) -> None:
        if self._loading or self.current is None:
            return
        (self.confirmed.add if on else self.confirmed.discard)(self.current)
        self.refresh_labels()

    def edit_words(self) -> None:
        if self.current is None:
            return
        script = next(s for s in self.scripts if s.id == self.current)
        text, ok = QInputDialog.getText(
            self,
            "Search words",
            f"Extra words for {script.name}, comma-separated (for example the topic name AnKing uses):",
            text=", ".join(script.extra),
        )
        if not ok:
            return
        script.extra = [w.strip() for w in text.split(",") if w.strip()]
        if script.extra:
            self.words[script.id] = script.extra
        else:
            self.words.pop(script.id, None)
        save_words(self.words)
        found = L.find_candidates(self.rows, [script])[script.id]
        keep = [L.Candidate(c.note_id, c.rung, c.topic, c.score, True) for c in self.cands[script.id] if c.selected]
        self.cands[script.id] = L.preselect(found, L.refs_for(keep) or None)
        self.show_script(self.list.currentRow())
        tooltip(f"{len(found)} proposal(s) for {script.name}", parent=self)

    def browse_topics(self) -> None:
        word, ok = QInputDialog.getText(self, "Browse topics", "Find AnKing Step 2 topics containing:")
        if not ok or not word.strip():
            return
        topics = L.topics_containing(self.rows, word)
        lines = [f"{n:5} notes  {t}" for t, n in topics] or ["No Step 2 subject topics contain that word."]
        showText("\n".join(lines), parent=self, title=f"Topics containing “{word.strip()}”")

    def open_note(self, item: QTreeWidgetItem | None) -> None:
        if item is None:
            return
        browser = dialogs.open("Browser", mw)
        browser.search_for(f"nid:{item.data(0, Qt.ItemDataRole.UserRole)}")

    # ---------------------------------------------------------------- save

    def save(self) -> None:
        chosen = {sid: self.cands[sid] for sid in self.confirmed if sid in self.cands}
        problems = [p for sid, cands in chosen.items() for p in L.problems_for(sid, cands)]
        if problems:
            showWarning("Untick notes until each rung is within its cap:\n\n" + "\n".join(problems), parent=self)
            return
        if not chosen:
            showWarning("Tick “Confirmed” on at least one script first.", parent=self)
            return
        os.makedirs(USER_FILES, exist_ok=True)
        with open(LINKS_FILE, "w", encoding="utf-8") as f:
            json.dump(L.links_file(chosen), f, indent=2)
            f.write("\n")
        showInfo(
            f"Saved links for {len(chosen)} script(s) to\n{LINKS_FILE}\n\n"
            f"In the repo, run:\npnpm content:link-anki \"{LINKS_FILE}\"",
            parent=self,
        )


def open_linker() -> None:
    def done(data: dict[str, Any]) -> None:
        # Keep a reference so the dialog isn't garbage-collected while open.
        mw.rounds_linker_dialog = LinkDialog(data)  # type: ignore[attr-defined]
        mw.rounds_linker_dialog.show()  # type: ignore[attr-defined]

    tooltip("Reading AnKing tags…")
    QueryOp(parent=mw, op=gather, success=done).failure(lambda e: showWarning(str(e))).run_in_background()


def setup_menu() -> None:
    action = QAction("Rounds: link scripts", mw)
    action.triggered.connect(open_linker)
    mw.form.menuTools.addAction(action)


gui_hooks.main_window_did_init.append(setup_menu)
