# Phase 1 — Fetch & Analyze

## 1a. Determine input source

| Source                           | Action                       |
| -------------------------------- | ---------------------------- |
| User pasted text                 | Use it directly              |
| Jira ticket ID (e.g. `PROJ-123`) | Fetch via Atlassian Rovo MCP |
| Linear ticket ID/URL             | Fetch via Linear MCP         |
| GitHub Issue URL or `#number`    | Fetch via GitHub MCP         |

If the user provides a ticket ID but no system is specified, ask: _"Is that a Jira, Linear, or GitHub issue?"_

## 1b. Analyze and output a structured summary

Present this before asking for Phase 2 approval:

```md
## 📋 Ticket Analysis

**Title:** <ticket title>
**Source:** Jira / Linear / GitHub / Pasted text
**Type:** User Story / Bug / Feature / Task

### Goal

<1–2 sentences: what problem this solves or what value it delivers>

### Scope

<bullet list of what's in scope>

### Out of Scope / Assumptions

<bullet list of assumptions or explicit exclusions>

### Key Technical Areas

<list affected layers: e.g. Frontend, API, DB schema, Auth, Infra, Tests>

### Risks / Open Questions

<anything ambiguous that the team needs to clarify>
```

Then ask: _"Does this analysis look right? Any corrections before I break it down?"_
