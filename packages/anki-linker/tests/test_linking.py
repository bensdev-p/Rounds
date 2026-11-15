"""Tests for the pure linking logic. Run: pnpm anki:test (stdlib unittest, no Anki needed).

Tags here are made up in AnKing's shape; no real AnKing data is stored in the repo.
"""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "rounds_linker"))

import linking as L  # noqa: E402

PANC = "#AK_Step2_v12::#Subjects::GI::11_Pancreas::Pancreatitis::Acute_Pancreatitis"
DKA = "#AK_Step2_v12::#Subjects::Endo::Diabetes::Diabetic_Ketoacidosis"

SCRIPTS = [
    L.Script("acute-pancreatitis", "Acute pancreatitis", []),
    L.Script("diabetic-ketoacidosis", "Diabetic ketoacidosis", ["DKA"]),
]


def cands(rows):
    return L.find_candidates(rows, SCRIPTS)


class NormalizeTest(unittest.TestCase):
    def test_strips_numbers_and_underscores(self):
        self.assertEqual(L.normalize("11_Acute_Pancreatitis"), "acute pancreatitis")
        self.assertEqual(L.normalize("Risk_Factors"), "risk factors")


class MatchTagTest(unittest.TestCase):
    def setUp(self):
        self.index = L.build_term_index(SCRIPTS)

    def test_leaf_picks_the_rung(self):
        self.assertEqual(
            L.match_tag(PANC + "::Management", self.index),
            {"acute-pancreatitis": ("management", PANC + "::Management", True)},
        )
        self.assertEqual(L.match_tag(PANC + "::Diagnosis", self.index)["acute-pancreatitis"][0], "workup")
        self.assertEqual(L.match_tag(PANC + "::Pathophysiology", self.index)["acute-pancreatitis"][0], "recall")

    def test_topic_itself_and_unknown_leaves_are_core(self):
        self.assertEqual(L.match_tag(PANC, self.index)["acute-pancreatitis"][0], "core")
        self.assertEqual(L.match_tag(PANC + "::Gallstone_Pancreatitis", self.index)["acute-pancreatitis"][0], "core")

    def test_parent_topic_alone_does_not_match(self):
        self.assertEqual(L.match_tag("#AK_Step2_v12::#Subjects::GI::Pancreatitis::Chronic_Pancreatitis", self.index), {})

    def test_only_step2_subjects_tags(self):
        self.assertEqual(L.match_tag("#AK_Step2_v12::#AMBOSS::Acute_Pancreatitis", self.index), {})
        self.assertEqual(L.match_tag("#AK_Step1_v12::#B&B::Acute_Pancreatitis", self.index), {})
        self.assertEqual(L.match_tag("#PANCE::GI::Acute_Pancreatitis", self.index), {})

    def test_aliases_match(self):
        tag = "#AK_Step2_v12::#Subjects::Endo::DKA::Management"
        self.assertEqual(L.match_tag(tag, self.index), {"diabetic-ketoacidosis": ("management", tag, True)})


class LeafAndSubtopicTest(unittest.TestCase):
    OLD = "#AK_Step2_v12::#Subjects::Pulm::Lungs::Obstructive_Lung_Disease"

    def setUp(self):
        self.copd = L.Script("copd-exacerbation", "COPD exacerbation", [], extra=["Obstructive lung disease"])
        self.index = L.build_term_index([self.copd])

    def test_redo_and_starred_leaves_keep_their_rung(self):
        self.assertEqual(L.leaf_rung("Management_Redo"), "management")
        self.assertEqual(L.leaf_rung("*Pathophysiology"), "recall")
        self.assertEqual(L.match_tag(self.OLD + "::*Management", self.index)[self.copd.id][::2], ("management", True))

    def test_subtopic_notes_are_core_and_not_direct(self):
        self.assertEqual(L.match_tag(self.OLD + "::Asthma::Management_Redo", self.index)[self.copd.id][::2], ("core", False))

    def test_subtopic_notes_are_listed_last_and_not_ticked(self):
        rows = [
            (1, self.OLD + "::*Management"),
            (2, self.OLD),
            (3, self.OLD + "::Asthma #AK_Step2_v12::#UWorld::1 #AK_Step2_v12::#UWorld::2"),
        ]
        out = L.preselect(L.find_candidates(rows, [self.copd])[self.copd.id], None)
        self.assertEqual([(c.note_id, c.rung, c.direct, c.selected) for c in out],
                         [(2, "core", True, True), (3, "core", False, False), (1, "management", True, True)])

    def test_a_direct_tag_wins_over_a_subtopic_tag(self):
        rows = [(1, f"{self.OLD}::Asthma {self.OLD}::*Management")]
        (c,) = L.find_candidates(rows, [self.copd])[self.copd.id]
        self.assertEqual((c.rung, c.direct), ("management", True))


class TermsTest(unittest.TestCase):
    def test_drops_generic_suffixes(self):
        s = L.Script("copd-exacerbation", "COPD exacerbation", [])
        self.assertEqual(s.terms(), {"copd exacerbation", "copd"})
        tag = "#AK_Step2_v12::#Subjects::Pulm::Obstructive::COPD::Management"
        self.assertEqual(L.match_tag(tag, L.build_term_index([s])), {"copd-exacerbation": ("management", tag, True)})

    def test_keeps_acute(self):
        self.assertEqual(L.Script("a", "Acute pancreatitis", []).terms(), {"acute pancreatitis"})

    def test_extra_words_match(self):
        s = L.Script("clostridioides-difficile-infection", "Clostridioides difficile infection", [], extra=["C diff"])
        tag = "#AK_Step2_v12::#Subjects::GI::Infections::C_Diff"
        self.assertEqual(L.match_tag(tag, L.build_term_index([s])), {s.id: ("core", tag, True)})


class TopicsContainingTest(unittest.TestCase):
    def test_lists_subject_topics_with_note_counts(self):
        rows = [
            (1, "#AK_Step2_v12::#Subjects::Renal::Electrolytes::Potassium::High_Potassium::Management"),
            (2, "#AK_Step2_v12::#Subjects::Renal::Electrolytes::Potassium::High_Potassium"),
            (3, "#AK_Step2_v12::#Subjects::Renal::Electrolytes::Potassium::Low_Potassium #AK_Step2_v12::#AMBOSS::Potassium"),
        ]
        self.assertEqual(
            L.topics_containing(rows, "potassium"),
            [("Renal::Electrolytes::Potassium", 3)],
        )
        self.assertEqual(
            L.topics_containing(rows, "high potassium"),
            [("Renal::Electrolytes::Potassium::High_Potassium", 2)],
        )


class FindCandidatesTest(unittest.TestCase):
    def test_ignores_non_anking_tags_and_ranks_by_other_tags(self):
        rows = [
            (1, f"{PANC}::Management"),
            (2, f"{PANC}::Management #AK_Step2_v12::#UWorld::123 #AK_Step2_v12::#OME::x"),
            (3, "#PANCE::GI::Acute_Pancreatitis"),
            (4, f"{PANC} {PANC}::Management"),
        ]
        out = cands(rows)["acute-pancreatitis"]
        self.assertEqual([(c.note_id, c.rung, c.score) for c in out], [(2, "management", 2), (1, "management", 0), (4, "management", 0)])
        self.assertEqual(cands(rows)["diabetic-ketoacidosis"], [])

    def test_core_first_then_ladder_order(self):
        rows = [(1, f"{PANC}::Management"), (2, PANC), (3, f"{PANC}::Diagnosis")]
        self.assertEqual([c.rung for c in cands(rows)["acute-pancreatitis"]], ["core", "workup", "management"])


class SelectionTest(unittest.TestCase):
    def test_preselects_the_top_notes_per_rung(self):
        rows = [(i, f"{PANC}::Management") for i in range(1, 6)] + [(i, PANC) for i in range(10, 18)]
        out = L.preselect(cands(rows)["acute-pancreatitis"], None)
        self.assertEqual(L.counts(out), {"core": L.MAX_CORE, "management": L.MAX_PER_RUNG})
        self.assertEqual(L.problems_for("acute-pancreatitis", out), [])

    def test_saved_links_win_and_missing_ones_are_kept(self):
        rows = [(1, f"{PANC}::Management"), (2, PANC)]
        saved = [{"kind": "note", "id": "2", "rung": "pearl"}, {"kind": "note", "id": "99"}]
        out = L.preselect(cands(rows)["acute-pancreatitis"], saved)
        picked = {c.note_id: c.rung for c in out if c.selected}
        self.assertEqual(picked, {2: "pearl", 99: "core"})

    def test_over_the_cap_is_a_problem(self):
        out = [L.Candidate(i, "workup", "t", 0, True) for i in range(4)]
        self.assertEqual(L.problems_for("x", out), ["x: 4 workup notes, at most 3"])


class LinksFileTest(unittest.TestCase):
    def test_ids_and_rungs_only(self):
        chosen = {
            "acute-pancreatitis": [
                L.Candidate(30, "management", "#AK_Step2_v12::#Subjects::secret", 5, True),
                L.Candidate(20, "core", "t", 0, True),
                L.Candidate(10, "core", "t", 0, False),
            ]
        }
        self.assertEqual(
            L.links_file(chosen),
            {
                "format": "rounds-anki-links",
                "version": 1,
                "scripts": {
                    "acute-pancreatitis": [
                        {"kind": "note", "id": "20"},
                        {"kind": "note", "id": "30", "rung": "management"},
                    ]
                },
            },
        )

    def test_reads_a_content_file(self):
        s = L.Script.from_content(
            {"script": {"id": "a", "name": "A b", "aliases": ["AB"], "anki_refs": [{"kind": "note", "id": "1"}]}}
        )
        self.assertEqual((s.terms(), s.links), ({"a b", "ab"}, [{"kind": "note", "id": "1"}]))


if __name__ == "__main__":
    unittest.main()
