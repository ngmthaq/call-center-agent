# Phase 4 — Create Tickets

## 4a. Determine output destination

Ask the user (unless already specified):

> "Where should I create these tickets?"
>
> - Jira (as subtasks under the parent)
> - Linear (as sub-issues)
> - GitHub Issues (in a repo)

If the user picks a ticket system, confirm the target: project key / team / repo.

## 4b. Create tickets

**For each subtask**, create a ticket using the appropriate MCP with this content:

- **Title:** subtask title from Phase 2
- **Description:** include Goal context + Acceptance Criteria (formatted as a checklist)
- **Labels/Tags:** layer tag (e.g. `frontend`, `api`, `db`, `infra`, `tests`)
- **Linked to parent:** link/block relationship to the original big ticket
- **Dependencies:** add "blocked by" links to dependency tickets once created (create in order so IDs are known)

Create tickets **in order** (respecting dependency chain) so that "blocked by" links resolve correctly.

## 4c. Output summary

After all tickets are created, output a summary table:

```markdown
## ✅ Tickets Created

| #   | Ticket ID | Title                                | Link  |
| --- | --------- | ------------------------------------ | ----- |
| 1   | PROJ-124  | [DB] Add assessments table migration | <url> |
| 2   | PROJ-125  | [API] POST /assessments              | <url> |
| 2   | PROJ-126  | [FRONTEND] Create assessment form    | <url> |

...

**Parent ticket:** PROJ-123 — subtasks linked ✅
```

## MCP Reference

| System | MCP to use         | Notes                                                                  |
| ------ | ------------------ | ---------------------------------------------------------------------- |
| Jira   | Atlassian Rovo MCP | Use for fetch and create; link subtasks to parent via issue link       |
| Linear | Linear MCP         | Use sub-issues feature                                                 |
| GitHub | GitHub MCP         | Create issues with labels; use milestone or project board if available |

If an MCP is not connected, tell the user: _"I don't have [Jira/Linear/GitHub] connected. You can enable it in the tools menu."_
