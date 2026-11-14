# Content

Real illness scripts for Rounds. Each file in `scripts/` is one script plus its ladder questions: one to three per rung, six rungs. Every question and accepted answer must trace to a field of its script (CLAUDE.md, domain rule 1), and only scripts a medical reviewer has approved reach students (domain rule 2).

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

- **One to three questions per rung,** in ladder order: recall, second order, differentiate, workup, management, pearl. A session asks one question per rung, picked at random and avoiding the previous session's question, so repeat sessions differ. Score and mastery still count rungs, not questions.
- **Versions of a rung must test different facts** at the same level, not reword one question. Ids run `<script>.<rung>.1`, `.2`, `.3`. Add a third only when the script has a third fact worth asking at that rung.
- **Quote accepted answers from the source field.** The canonical `answer` must appear word for word in a `source_fields` field. Synonyms don't need to.
- **Keep synonyms specific.** The local matcher matches whole words, so a short or common synonym can credit wrong answers. For example, "calcium" would credit "low calcium", and "US" would credit "tell us". A test checks that every synonym earns credit; only a reviewer can check that none credits too much.
- **List questions** (`"kind": "list"`) pass at 60% of `required_count`. Don't accept anything the prompt excludes; for example, "name three more" shouldn't accept the two causes it already gave.
- **No AnKing or Qbank text.** Reference cards by numeric ID only, in `anki_refs`.
- **No patient details,** even in made-up vignettes: no names, dates of birth or record numbers.
