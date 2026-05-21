---
name: create-pull-request
description: "Create a pull request or merge request with a properly filled template. Use when: opening a PR, creating a MR, submitting code for review, writing a pull request description, generating PR content, preparing a merge request, drafting PR summary from git changes, ticket, or plan."
---

# Create Pull Request

Produces a fully filled pull request / merge request description by discovering the platform template and synthesizing context from git changes, tickets, plans, and user input. If a platform MCP is available, the agent can submit the PR directly.

## When to Use

- Developer wants to open a PR/MR and needs a description
- Auto-filling a PR template from git diff, ticket, or design doc
- Submitting a PR via GitHub / GitLab / Bitbucket MCP integration

---

## Procedure

1. [Step 1 — Detect the Remote Platform](./references/step-1-detect-platform.md)
2. [Step 2 — Find the PR Template](./references/step-2-find-template.md)
3. [Step 3 — Determine Target Branch](./references/step-3-determine-target-branch.md)
4. [Step 4 — Gather Context](./references/step-4-gather-context.md)
5. [Step 5 — Fill the Template](./references/step-5-fill-template.md)
6. [Step 6 — Submit or Return](./references/step-6-submit-or-return.md)

---

## Notes

- User **must** commit their changes before invoking this skill, as it relies on `git diff` to gather context.
- Always use the target branch chosen by the user in **Step 3** as the base branch for the diff and PR.
- If the git diff is very large (>300 lines), summarize by file/module instead of listing every line.
- Never include secrets, credentials, or internal environment values in the PR description.
