---
name: party-mode
description: User-invoked orchestration skill. Load ONLY when the user explicitly runs the `/party-mode` slash command (or otherwise tells the agent to "follow the party-mode"). Defines how the Root Agent classifies the request, spawns parallel sub-agents via the host's sub-agent tool, and routes results. DO NOT auto-load on every user prompt.
---

> **Activation rule:** This skill is **opt-in**. The Root Agent must not run this workflow on every user message — only when the user invokes `/party-mode` explicitly (or restates the equivalent in plain language). For all other prompts, the agent answers directly without spawning planner/developer/tester/reviewer sub-agents.

# Party-Mode

The orchestration contract for the **Root Agent**. The Root Agent never implements directly — it classifies, delegates, validates, and reports. All implementation work is performed by **ephemeral sub-agents** spawned on demand via the host's sub-agent tool, each loaded with the role skill that matches its job.

> Sub-agents in this project are **skill-bound**, not file-bound. The Root Agent picks the right role skill and passes it inline when spawning the sub-agent.

---

## Sub-Agent Roles (load via [sub-agents](./references/sub-agents.md) skill)

Only the **Root Agent** delegates. Sub-agents never spawn other sub-agents. The planner/debugger flags each task with a `Responsible Role` (developer or tester), and the reviewer flags each issue with a `Responsible Role`. Those flags are routing hints for the Root Agent, never a hand-off — only the Root Agent re-spawns.

---

## Workflow

> Diagram reference: [workflow-diagram](./references/workflow-diagram.md)

---

## Step-by-Step Instructions

1. [Step 1 — Classification](./references/step-1-classification.md)
2. [Step 2 — Planning](./references/step-2-planning.md)
3. [Step 3 — Plan Return](./references/step-3-plan-return.md)
4. [Step 3.5 — User Approval Gate](./references/step-3-5-approval-gate.md)
5. [Step 4 — Delegation to Sub-Agents](./references/step-4-delegation.md)
6. [Step 5 — Sub-Agent Result Return](./references/step-5-result-return.md)
7. [Step 6 — Status Routing](./references/step-6-completeness-check.md)
8. [Step 7 — Review](./references/step-7-review.md)
9. [Step 8 — Summary Report to User](./references/step-8-summary-report.md)

---

## Loop Guard

To prevent infinite loops, the Root Agent tracks **loop iterations per session**.

- After **3 consecutive incomplete cycles** on the same task → surface blockers to the user and request clarification.
- After **2 consecutive reviewer blocks** on the same output → surface reviewer feedback and ask whether to proceed or abort.

---

## Constraints

- **Only the Root Agent delegates.** The planner/debugger flags a `Responsible Role` per task and the reviewer flags a `Responsible Role` per issue — both are routing hints, never hand-offs. The Root Agent is the only point that spawns or re-spawns sub-agents.
- **Root Agent never does the work itself.** It classifies, navigates to the correct sub-agent, and relays results. It never plans or debugs (planner/debugger sub-agents do that), never edits production or test files (developer/tester do that), and never verifies or judges the quality of developer/tester output (reviewer does that).
- **Reviewer is the sole verification gate.** Developer and tester output is verified only by the reviewer sub-agent at Step 7. The Root Agent does not inspect files, judge correctness, or second-guess sub-agent results — it only reads the self-reported `Status` flag to route between Step 6 (status routing) and Step 7 (review).
- **Tester writes tests, does not review the developer.** The tester sub-agent writes tests for the tasks it was assigned. It does not evaluate whether the developer's implementation is correct, complete, or aligned with the plan — that judgment belongs to the reviewer.
- **Always spawn a sub-agent for feature, refactor, or bug work** — the Root Agent never edits production or test files directly for those classifications.
- **Run independent sub-agents in parallel** by issuing multiple spawn calls in the same tool turn.
- **No silent failures.** Any sub-agent returning `incomplete` or `blocked` must be surfaced — not paved over.
- **Approval gate is non-negotiable.** No implementation sub-agent runs until the user has approved a plan.
