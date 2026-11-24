"""Tests for the add-on's collection logic and HTTP client.

Run: pnpm anki:test (stdlib unittest, no Anki needed). The fake collection is
an in-memory SQLite database with the columns of Anki's cards, notes and
revlog tables that the add-on reads, plus the few collection calls it makes.
No note fields exist in it: the add-on must never need them.
"""

from __future__ import annotations

import io
import json
import os
import sqlite3
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "rounds_anki"))

import client as C  # noqa: E402
import core  # noqa: E402

TODAY = 3000


class FakeDb:
    def __init__(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.executescript(
            """
            create table notes (id integer primary key, tags text not null);
            create table cards (id integer primary key, nid integer, queue integer, type integer,
                                due integer, ivl integer, reps integer, lapses integer);
            create table revlog (id integer primary key, cid integer);
            """
        )

    def all(self, sql: str, *args):
        return self.conn.execute(sql, args).fetchall()

    def list(self, sql: str, *args):
        return [row[0] for row in self.conn.execute(sql, args).fetchall()]

    def execute(self, sql: str, *args) -> None:
        self.conn.execute(sql, args)


class Count:
    def __init__(self, count: int) -> None:
        self.count = count


class FakeCollection:
    """The calls the add-on makes, with Anki's behaviour: unsuspending restores
    queue from type; tags are case-insensitive and space-separated."""

    def __init__(self) -> None:
        self.db = FakeDb()
        self.undo_entries: list[str] = []
        self.merged: list[int] = []
        col = self

        class Sched:
            today = TODAY

            def unsuspend_cards(self, ids):
                for cid in ids:
                    col.db.execute("update cards set queue = type where id = ? and queue = -1", cid)

        class Tags:
            def bulk_add(self, nids, tag):
                changed = 0
                for nid in nids:
                    (tags,) = col.db.all("select tags from notes where id = ?", nid)[0]
                    if tag.lower() not in [t.lower() for t in tags.split()]:
                        col.db.execute("update notes set tags = ? where id = ?", f" {tags.strip()} {tag} ", nid)
                        changed += 1
                return Count(changed)

            def bulk_remove(self, nids, tag):
                changed = 0
                for nid in nids:
                    (tags,) = col.db.all("select tags from notes where id = ?", nid)[0]
                    kept = [t for t in tags.split() if t.lower() != tag.lower()]
                    if len(kept) != len(tags.split()):
                        col.db.execute("update notes set tags = ? where id = ?", f" {' '.join(kept)} " if kept else "", nid)
                        changed += 1
                return Count(changed)

        self.sched = Sched()
        self.tags = Tags()

    def add_custom_undo_entry(self, name: str) -> int:
        self.undo_entries.append(name)
        return len(self.undo_entries)

    def merge_undo_entries(self, pos: int) -> str:
        self.merged.append(pos)
        return "changes"

    def note(self, nid: int, tags: str = "") -> None:
        self.db.execute("insert into notes values (?, ?)", nid, f" {tags} " if tags else "")

    def card(self, cid: int, nid: int, queue: int = -1, ctype: int = 0, due: int = 0, ivl: int = 0,
             reps: int = 0, lapses: int = 0) -> None:
        self.db.execute("insert into cards values (?, ?, ?, ?, ?, ?, ?, ?)", cid, nid, queue, ctype, due,
                        ivl, reps, lapses)

    def queue_of(self, cid: int) -> int:
        return self.db.all("select queue from cards where id = ?", cid)[0][0]

    def tags_of(self, nid: int) -> list[str]:
        return self.db.all("select tags from notes where id = ?", nid)[0][0].split()


def collection() -> FakeCollection:
    col = FakeCollection()
    col.note(100, "#AK_Step2_v12::#Subjects::GI")
    col.note(200)
    col.note(300, core.MISSED_TAG)
    col.note(999)  # not linked
    col.card(1, 100, queue=-1, ctype=0)  # suspended new card
    col.card(2, 100, queue=2, ctype=2, due=TODAY + 4, ivl=12, reps=7, lapses=1)
    col.card(3, 200, queue=-1, ctype=2, due=TODAY - 2, ivl=30, reps=9, lapses=2)
    col.card(4, 300, queue=0, ctype=0)
    col.card(5, 999, queue=-1, ctype=0)
    col.db.execute("insert into revlog values (1763000000000, 2)")
    col.db.execute("insert into revlog values (1763200000000, 2)")
    return col


class CardStatsTest(unittest.TestCase):
    def test_reads_linked_cards_only(self):
        col = collection()
        stats = core.card_stats(col.db, [100, 200, 300], TODAY)
        self.assertEqual([s["card_id"] for s in stats], [1, 2, 3, 4])

    def test_numbers_only(self):
        col = collection()
        stats = {s["card_id"]: s for s in core.card_stats(col.db, [100, 200], TODAY)}
        self.assertEqual(
            stats[2],
            {
                "card_id": 2,
                "note_id": 100,
                "suspended": False,
                "queue": 2,
                "due_days": 4,
                "interval_days": 12,
                "reps": 7,
                "lapses": 1,
                "last_review_ms": 1763200000000,
            },
        )
        self.assertTrue(stats[1]["suspended"])
        self.assertIsNone(stats[1]["due_days"])
        self.assertIsNone(stats[1]["last_review_ms"])
        self.assertEqual(stats[3]["due_days"], -2)
        allowed = {"card_id", "note_id", "suspended", "queue", "due_days", "interval_days", "reps",
                   "lapses", "last_review_ms"}
        for s in stats.values():
            self.assertEqual(set(s), allowed)

    def test_many_notes_are_chunked(self):
        col = FakeCollection()
        for nid in range(1, 1001):
            col.note(nid)
            col.card(nid, nid)
        self.assertEqual(len(core.card_stats(col.db, range(1, 1001), TODAY)), 1000)

    def test_missing_notes_are_skipped(self):
        self.assertEqual(core.card_stats(collection().db, [424242], TODAY), [])


PULL = {
    "note_ids": [100, 200, 300],
    "actions": [
        {"id": "a1", "kind": "unsuspend", "note_ids": [100, 200]},
        {"id": "a2", "kind": "tag_missed", "note_ids": [100, 200, 300]},
    ],
    "tag_note_ids": [],
}


class ApplyTest(unittest.TestCase):
    def test_unsuspends_and_tags_in_one_undo_step(self):
        col = collection()
        plan = core.plan_changes(col.db, PULL)
        changes, result = core.apply_plan(col, plan)
        self.assertEqual(changes, "changes")
        self.assertEqual(col.undo_entries, [core.UNDO_LABEL])
        self.assertEqual(col.merged, [1])
        self.assertEqual(col.queue_of(1), 0)  # new card back to new
        self.assertEqual(col.queue_of(3), 2)  # review card back to review
        self.assertEqual(col.queue_of(5), -1)  # unlinked note untouched
        self.assertIn(core.MISSED_TAG, col.tags_of(100))
        self.assertIn("#AK_Step2_v12::#Subjects::GI", col.tags_of(100))
        self.assertEqual(result.applied, [{"id": "a1", "count": 2}, {"id": "a2", "count": 2}])
        self.assertEqual((result.unsuspended, result.tagged), (2, 2))

    def test_nothing_to_do_makes_no_undo_step(self):
        col = collection()
        core.apply_plan(col, core.plan_changes(col.db, PULL))
        again = core.plan_changes(col.db, PULL)
        self.assertTrue(again.empty)

    def test_puts_the_missed_tag_back(self):
        col = collection()
        plan = core.plan_changes(col.db, {"note_ids": [], "actions": [], "tag_note_ids": [100, 300]})
        self.assertEqual(plan.retag, [100])  # 300 still has it
        _, result = core.apply_plan(col, plan)
        self.assertIn(core.MISSED_TAG, col.tags_of(100))
        self.assertEqual(result.tagged, 1)
        self.assertEqual(result.applied, [])

    def test_tag_check_ignores_case(self):
        col = collection()
        col.note(400, "#pimpme::MISSED")
        plan = core.plan_changes(col.db, {"actions": [], "tag_note_ids": [400]})
        self.assertTrue(plan.empty)

    def test_swaps_the_old_rounds_tag(self):
        col = collection()
        col.note(500, "#AK_Step2_v12::#Subjects::GI #Rounds::missed")
        col.note(600, "#rounds::MISSED")
        plan = core.plan_changes(col.db, {"actions": [], "tag_note_ids": [500]})
        self.assertEqual(sorted(plan.untag_old), [500, 600])
        _, result = core.apply_plan(col, plan)
        self.assertEqual(col.tags_of(500), ["#AK_Step2_v12::#Subjects::GI", core.MISSED_TAG])
        self.assertEqual(col.tags_of(600), [])  # the server no longer lists it
        self.assertEqual(result.tagged, 1)
        self.assertTrue(core.plan_changes(col.db, {"actions": [], "tag_note_ids": [500]}).empty)

    def test_notes_this_collection_lacks_report_zero(self):
        col = collection()
        plan = core.plan_changes(
            col.db, {"actions": [{"id": "a3", "kind": "unsuspend", "note_ids": [555]}], "tag_note_ids": []}
        )
        self.assertTrue(plan.empty)
        _, result = core.apply_plan(col, plan)
        self.assertEqual(result.applied, [{"id": "a3", "count": 0}])

    def test_a_card_is_counted_once_across_actions(self):
        col = collection()
        pull = {
            "actions": [
                {"id": "a1", "kind": "unsuspend", "note_ids": [100]},
                {"id": "a2", "kind": "unsuspend", "note_ids": [100, 200]},
            ],
            "tag_note_ids": [],
        }
        _, result = core.apply_plan(col, core.plan_changes(col.db, pull))
        self.assertEqual(result.applied, [{"id": "a1", "count": 1}, {"id": "a2", "count": 1}])

    def test_summary_names_the_counts(self):
        self.assertEqual(
            core.summary(core.Result(applied=[], unsuspended=3, tagged=1)),
            "PimpMe: unsuspended 3 cards and tagged 1 note #PimpMe::missed. Edit → Undo puts them back.",
        )
        self.assertIsNone(core.summary(core.Result(applied=[], unsuspended=0, tagged=0)))


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class ClientTest(unittest.TestCase):
    def opener(self, status=200, body=None):
        sent = []

        def open_(request, timeout):
            sent.append((request, timeout))
            payload = json.dumps(body or {}).encode()
            if status != 200:
                raise urllib.error.HTTPError(request.full_url, status, "err", {}, io.BytesIO(payload))
            return FakeResponse(payload)

        return open_, sent

    def test_claim_sends_the_code_without_any_key(self):
        open_, sent = self.opener(body={"token": "t" * 64})
        token = C.Client("http://x/functions/v1/", opener=open_).claim("abcd-2345")
        self.assertEqual(token, "t" * 64)
        request = sent[0][0]
        self.assertEqual(request.full_url, "http://x/functions/v1/anki-pair")
        self.assertEqual(json.loads(request.data), {"op": "claim", "code": "abcd-2345"})
        headers = {k.lower() for k in request.headers}
        self.assertNotIn("authorization", headers)
        self.assertNotIn("apikey", headers)

    def test_sync_sends_the_device_token(self):
        open_, sent = self.opener(body={"note_ids": [], "actions": [], "tag_note_ids": []})
        C.Client("http://x", opener=open_).pull("tok")
        self.assertEqual(sent[0][0].get_header("X-rounds-device"), "tok")

    def test_unknown_token_means_not_connected(self):
        open_, _ = self.opener(status=401, body={"error": "This Anki is not connected"})
        with self.assertRaises(C.NotConnected):
            C.Client("http://x", opener=open_).pull("tok")

    def test_wrong_code_shows_rounds_message(self):
        open_, _ = self.opener(status=404, body={"error": "That code is wrong or has expired."})
        with self.assertRaisesRegex(C.RoundsError, "wrong or has expired") as caught:
            C.Client("http://x", opener=open_).claim("ZZZZ-ZZZZ")
        self.assertNotIsInstance(caught.exception, C.NotConnected)

    def test_offline(self):
        def open_(request, timeout):
            raise urllib.error.URLError("no route")

        with self.assertRaisesRegex(C.RoundsError, "Couldn't reach Rounds"):
            C.Client("http://x", opener=open_).pull("tok")


if __name__ == "__main__":
    unittest.main()
