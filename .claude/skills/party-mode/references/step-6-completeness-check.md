# Step 6 — Status Routing (Root Agent)

The Root Agent reads the `Status` field that the developer and tester sub-agents self-reported in their result templates and routes accordingly. This step is **routing only** — the Root Agent does **not** inspect files, judge code quality, or verify whether the work actually satisfies the requirement. That verification belongs exclusively to the reviewer in **Step 7**.

| Self-reported Status                              | Action                                                 |
| ------------------------------------------------- | ------------------------------------------------------ |
| `incomplete` or `blocked` on any sub-agent result | Loop back to **Step 2** (re-plan with updated context) |
| `complete` on every sub-agent result              | Proceed to **Step 7** (review)                         |

At this step the Root Agent must:

- **NOT** modify code directly
- **NOT** open the changed files to assess quality, correctness, or coverage
- **NOT** decide on its own whether a `complete` result is "really" complete — only the reviewer makes that judgment
- Trust the sub-agent's self-reported `Status` flag verbatim for routing purposes

When looping back to Step 2, the Root Agent must pass:

- The original prompt
- The previous plan
- The failure reason or missing requirement from the sub-agent result
