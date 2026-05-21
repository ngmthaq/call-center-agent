# Phase 2 — Breakdown

Break the ticket into subtasks. Apply Technical Leader judgment:

- Each subtask must be **independently workable** (no implicit shared state with a sibling task)
- Each subtask should be completable in **≤ 1 day** ideally — flag anything that seems larger and suggest splitting it further
- Subtasks should follow a **logical implementation order**: schema/data → API → business logic → frontend → tests → docs/review
- Keep subtask titles in the format: `[Layer] Action — context` (e.g. `[API] Add POST /assessments endpoint`)

## Output format

Present a Markdown table:

```markdown
## 🔨 Breakdown

| #   | Title                                     | Acceptance Criteria                                                              | Depends On |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------- | ---------- |
| 1   | [DB] Add `assessments` table migration    | Migration runs cleanly; rollback tested; columns: id, user_id, created_at, score | —          |
| 2   | [API] POST /assessments — create endpoint | Returns 201 with payload; validates input; 400 on bad data; unit tests pass      | #1         |
| ... |                                           |                                                                                  |            |
```

## Acceptance Criteria rules

- Written as testable, observable outcomes (not vague intentions)
- At least 1 happy path + 1 edge/error case per subtask
- Use "Given / When / Then" style for complex cases

## Dependencies

Reference by `#row_number`. If none, write `—`.

After presenting the table, ask: _"Does this breakdown look right? You can ask me to split, merge, reorder, or adjust any subtask."_
