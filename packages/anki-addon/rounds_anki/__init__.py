"""Rounds for Anki (M3.3): connects Anki to a student's Rounds account.

Tools → Rounds: Connect (a one-time code from the Rounds app, Settings → Anki;
no password is typed into Anki), Sync now, Disconnect.

Each sync: pull the notes Rounds links and any pending actions, apply them in
one undo step ("Rounds: apply changes"), then upload per-card numbers for the
linked notes. Syncs when a profile opens, after Anki's own sync, and (upload
only) when a profile closes.

The connection is stored per Anki profile (in the profile's own settings, not
in the add-on config, which every profile shares, and not in the collection,
which syncs to AnkiWeb). Never reads or uploads card text (domain rule 6).
"""

from __future__ import annotations

from typing import Any

from aqt import gui_hooks, mw
from aqt.operations import CollectionOp
from aqt.qt import QAction, QInputDialog, QLineEdit, QMenu
from aqt.utils import askUser, showInfo, showWarning, tooltip

from . import core
from .client import Client, NotConnected, RoundsError

PROFILE_KEY = "rounds"
OPEN_DELAY_MS = 3000
CLOSE_TIMEOUT_S = 5.0

_busy = False
# Set while a profile closes: Anki's own sync on close shouldn't start ours.
_closing = False


# ---------------------------------------------------------------- settings


def _server() -> str:
    cfg = mw.addonManager.getConfig(__name__) or {}
    return str(cfg.get("server", "")).strip()


def _token() -> str | None:
    if not mw.pm or mw.pm.profile is None:
        return None
    saved = mw.pm.profile.get(PROFILE_KEY) or {}
    token = saved.get("token")
    return token if isinstance(token, str) and token else None


def _set_token(token: str | None) -> None:
    if token:
        mw.pm.profile[PROFILE_KEY] = {"token": token}
    else:
        mw.pm.profile.pop(PROFILE_KEY, None)
    mw.pm.save()


def _client(timeout: float = 30.0) -> Client | None:
    server = _server()
    if not server:
        showWarning("The Rounds add-on has no server set. Check its config (Tools → Add-ons).")
        return None
    return Client(server, timeout=timeout)


# ---------------------------------------------------------------- connect


def connect() -> None:
    if _token() and not askUser(
        "This Anki profile is already connected to Rounds. Connect it again with a new code?"
    ):
        return
    code, ok = QInputDialog.getText(
        mw,
        "Connect to Rounds",
        "In the Rounds app, open Profile → Settings → Anki and tap Connect Anki.\n"
        "Enter the code it shows:",
        QLineEdit.EchoMode.Normal,
    )
    if not ok or not code.strip():
        return
    client = _client(timeout=15.0)
    if not client:
        return

    def done(future: Any) -> None:
        try:
            token = future.result()
        except RoundsError as e:
            showWarning(str(e), title="Rounds")
            return
        _set_token(token)
        tooltip(f"Connected to Rounds (profile {mw.pm.name}).")
        sync(quiet=False)

    mw.taskman.run_in_background(lambda: client.claim(code.strip()), done)


def disconnect() -> None:
    token = _token()
    if not token:
        tooltip("This Anki profile isn't connected to Rounds.")
        return
    if not askUser("Disconnect this Anki profile from Rounds? Cards already changed stay as they are."):
        return
    client = _client(timeout=15.0)
    _set_token(None)
    if not client:
        return

    def done(future: Any) -> None:
        try:
            future.result()
        except NotConnected:
            pass
        except RoundsError as e:
            showWarning(f"Disconnected here, but Rounds couldn't be told: {e}", title="Rounds")
            return
        tooltip("Disconnected from Rounds.")

    mw.taskman.run_in_background(lambda: client.disconnect(token), done)


# ---------------------------------------------------------------- sync


def _lost_connection() -> None:
    _set_token(None)
    tooltip(
        "Rounds: this Anki was disconnected. Connect again from Tools → Rounds.",
        period=6000,
    )


def sync(quiet: bool = True) -> None:
    """Pull, apply in one undo step, push. Quiet syncs report only changes and problems."""
    global _busy
    token = _token()
    if _busy or _closing or not token or not mw.col:
        if not quiet and not token:
            showInfo("Connect to Rounds first: Tools → Rounds → Connect to Rounds.")
        return
    client = _client()
    if not client:
        return
    _busy = True

    def fail(e: Exception) -> None:
        global _busy
        _busy = False
        if isinstance(e, NotConnected):
            _lost_connection()
        elif isinstance(e, RoundsError):
            if not quiet:
                showWarning(str(e), title="Rounds")
        else:
            raise e

    def pulled(future: Any) -> None:
        try:
            pull = future.result()
        except Exception as e:  # noqa: BLE001 — reported or re-raised in fail()
            fail(e)
            return
        if not mw.col:
            fail(RoundsError("The collection closed before Rounds could sync."))
            return
        plan = core.plan_changes(mw.col.db, pull)
        if plan.empty:
            upload(pull, core.Result(applied=[{"id": a, "count": 0} for a, _, _ in plan.actions], unsuspended=0, tagged=0))
            return
        holder: list[core.Result] = []

        def op(col: Any) -> Any:
            changes, result = core.apply_plan(col, plan)
            holder.append(result)
            return changes

        CollectionOp(mw, op).success(lambda _: upload(pull, holder[0])).failure(fail).run_in_background()

    def upload(pull: dict[str, Any], result: core.Result) -> None:
        stats = core.card_stats(mw.col.db, pull.get("note_ids", []), mw.col.sched.today)

        def pushed(future: Any) -> None:
            global _busy
            try:
                future.result()
            except Exception as e:  # noqa: BLE001
                fail(e)
                return
            _busy = False
            message = core.summary(result)
            if message:
                tooltip(message, period=6000)
            elif not quiet:
                tooltip(f"Rounds synced: {core.plural(len(stats), 'linked card')}.")

        mw.taskman.run_in_background(lambda: client.push(token, stats, result.applied), pushed)

    mw.taskman.run_in_background(lambda: client.pull(token), pulled)


def upload_on_close() -> None:
    """Upload only, with a short timeout, so closing Anki isn't held up for long."""
    global _closing
    _closing = True
    token = _token()
    server = _server()
    if not token or not server or not mw.col or _busy:
        return
    client = Client(server, timeout=CLOSE_TIMEOUT_S)
    try:
        pull = client.pull(token)
        stats = core.card_stats(mw.col.db, pull.get("note_ids", []), mw.col.sched.today)
        client.push(token, stats, [])
    except NotConnected:
        mw.pm.profile.pop(PROFILE_KEY, None)
    except RoundsError:
        pass  # Offline: the next open syncs.


# ---------------------------------------------------------------- menu and hooks


def _setup_menu() -> None:
    menu = QMenu("Rounds", mw)
    connect_action = QAction("Connect to Rounds…", mw)
    sync_action = QAction("Sync with Rounds now", mw)
    disconnect_action = QAction("Disconnect from Rounds", mw)
    connect_action.triggered.connect(connect)
    sync_action.triggered.connect(lambda: sync(quiet=False))
    disconnect_action.triggered.connect(disconnect)
    for action in (connect_action, sync_action, disconnect_action):
        menu.addAction(action)

    def refresh() -> None:
        connected = _token() is not None
        sync_action.setEnabled(connected)
        disconnect_action.setEnabled(connected)

    menu.aboutToShow.connect(refresh)
    mw.form.menuTools.addMenu(menu)


gui_hooks.main_window_did_init.append(_setup_menu)
def _on_profile_open() -> None:
    global _closing
    _closing = False
    mw.progress.single_shot(OPEN_DELAY_MS, sync)


gui_hooks.profile_did_open.append(_on_profile_open)
gui_hooks.sync_did_finish.append(lambda: sync())
gui_hooks.profile_will_close.append(upload_on_close)
