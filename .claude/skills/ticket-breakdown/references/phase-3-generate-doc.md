# Phase 3 — Generate Markdown Document

Generate a `.md` file capturing the full breakdown for documentation and future reference in **Doc Directory**.

## Filename format

```
d-m-y-h-i-s-<summary>.md
```

Where:

- `d-m-y` = day-month-year (e.g. `20-05-2026`)
- `h-i-s` = hour-minute-second in 24h format (e.g. `14-32-05`)
- `<summary>` = kebab-case slug from the ticket title (max 6 words, lowercase, no special chars)

**Example:** `20-05-2026-14-32-05-add-assessments-feature-api.md`

## File contents

```markdown
# <Ticket Title>

**Date:** <d/m/y h:i:s>
**Source:** <Jira/Linear/GitHub/Pasted text> — <ticket ID or URL if available>
**Type:** <User Story / Bug / Feature / Task>

---

## Goal

<from Phase 1>

## Scope

<from Phase 1>

## Out of Scope / Assumptions

<from Phase 1>

## Key Technical Areas

<from Phase 1>

## Risks / Open Questions

<from Phase 1>

---

## Subtask Breakdown

| #   | Title | Acceptance Criteria | Depends On |
| --- | ----- | ------------------- | ---------- |
| 1   | ...   | ...                 | —          |
| 2   | ...   | ...                 | #1         |

---

## Subtask Details

### #1 — <Title>

**Acceptance Criteria:**

- [ ] <criterion 1>
- [ ] <criterion 2>

**Depends on:** —

---

### #2 — <Title>

...
```

Then ask: _"Document saved ✅. Shall I proceed to create the tickets in your ticket system?"_
