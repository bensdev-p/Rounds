# Content

Real scripts for PimpMe. Each file in `scripts/` is one script plus its ladder questions: one to three per rung, six rungs. Every question and accepted answer must trace to a field of its script (CLAUDE.md, domain rule 1), and only scripts a medical reviewer has approved reach students (domain rule 2).

## Kinds and topics

A script has a `kind`: `disease` (the illness script), `drug`, `bug` or `pathway`. Each kind has its own content fields (`packages/shared/src/schemas/illnessScript.ts`, PRODUCT.md → Core entity). Every script also needs `systems` (at least one organ system). `rotation` lists the clinical rotations and may be empty for preclinical-only scripts. One script per disease: when a clinical wave reaches a disease that already has a script, extend that script (add its rotation and clinical facts, bump `version`) instead of writing a second one.

The six rungs keep their ids for every kind (`recall`, `second_order`, `differentiate`, `workup`, `management`, `pearl`, also used in question ids), but each kind labels them differently:

| Rung id | Disease | Drug | Bug | Pathway |
|---|---|---|---|---|
| `recall` | Recall | Class | Identify | Step |
| `second_order` | Next most common | Mechanism | Virulence | Regulation |
| `differentiate` | Tell it apart | Uses | Diseases | Deficiency |
| `workup` | Workup | Adverse effects | Diagnosis | Tell it apart |
| `management` | Management | Tell it apart | Treatment | Treatment |
| `pearl` | Pearl | Pearl | Pearl | Pearl |

So `beta-blockers.workup.1` is a drug's adverse-effects question. The review sheet prints the kind's labels.

`topics/` lists every planned topic by kind and system, with its id and a priority (P1 core, P2 the rest of a wave, P3 extras). Use the planned id when writing a script. Point `confused_with` only at scripts that exist and are the same kind (`content:check` enforces both).

## Workflow

1. **Draft.** Scripts start as `"status": "draft"`. AI may draft them; nothing in a draft is shown to students.
2. **Check.** Run this after any edit. It validates every file, including drafts, and also runs in `pnpm test`.
   ```bash
   pnpm content:check
   ```
3. **Review.** This writes a readable sheet for each unapproved script to `content/review/` (gitignored). The reviewer reads the sheet, not the JSON.
   ```bash
   pnpm content:review
   ```
   The reviewer checks three things:
   - every fact against current guidance;
   - each question's accepted answers. Students are graded only against these, so a missing synonym marks a right answer wrong;
   - that nothing outside the script is needed to answer.
4. **Fix.** Edit the JSON, then run `pnpm content:check` and `pnpm content:review` again.
5. **Approve.** Only the reviewer, or someone acting on their explicit sign-off, runs:
   ```bash
   pnpm content:approve <script-id> --by "Name, role"
   ```
   This sets `approved`, `reviewed_by` and `reviewed_at`. It also records a hash of the approved text in `approvals.json`.
6. **Seed.**
   ```bash
   pnpm content:seed
   pnpm db:reset
   ```
   Approved scripts join the fictional test fixtures in the local database. Drafts are never seeded.

## Editing an approved script

Any edit to approved text makes `pnpm content:check` (and `pnpm test`) fail until the script is reviewed again:
1. Set `"status": "in_review"`.
2. Bump `version`.
3. Make the edit.
4. Review and approve again.

Attempts record the script version they were graded against.

## Writing good questions

- **One to three questions per rung,** in ladder order: recall, second order, differentiate, workup, management, pearl (for drugs, bugs and pathways, the kind's labels above). A session asks one question per rung, picked at random and avoiding the previous session's question, so repeat sessions differ. Score and mastery still count rungs, not questions.
- **Versions of a rung must test different facts** at the same level, not reword one question. Ids run `<script>.<rung>.1`, `.2`, `.3`. Add a third only when the script has a third fact worth asking at that rung.
- **Quote accepted answers from the source field.** The canonical `answer` must appear word for word in a `source_fields` field. Synonyms don't need to.
- **Keep synonyms specific.** The local matcher matches whole words, so a short or common synonym can credit wrong answers. For example, "calcium" would credit "low calcium", and "US" would credit "tell us". A test checks that every synonym earns credit; only a reviewer can check that none credits too much.
- **List questions** (`"kind": "list"`) pass at 60% of `required_count`. Don't accept anything the prompt excludes; for example, "name three more" shouldn't accept the two causes it already gave.
- **No AnKing or Qbank text.** Reference AnKing notes by numeric id only, in `anki_refs`.
- **No patient details,** even in made-up vignettes: no names, dates of birth or record numbers.

## Anki links

`anki_refs` links a script to AnKing notes: `{ "kind": "note", "id": "…", "rung": "management" }`. Ids only, never card text or tag names (domain rule 6). Note ids, not card ids: card ids differ per student.
- `rung` is optional. A miss on that rung points to its notes; notes without a rung are the script's **core** notes, used when the missed rung has none.
- At most 3 notes per rung and 5 core notes; no note twice. `pnpm content:check` enforces this.
- Links aren't medical content, so changing them doesn't undo an approval.
- Don't edit them by hand: pick them in the Rounds linker add-on (`packages/anki-linker/README.md`), then run `pnpm content:link-anki <links.json>` (`--dry-run` to preview).
