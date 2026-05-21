# Step 7 — Review

The reviewer is the **only agent** that verifies the output of the developer and tester sub-agents. Neither the Root Agent nor the tester evaluates developer work — verification happens here and only here.

Spawn a sub-agent that loads the **reviewer** skill, using the reviewer delegation prompt template.

> Prompt template skill: [delegation-prompt](./delegation-prompt.md) — `Reviewer Delegation Prompt`
> Role skill: [reviewer](./reviewer.md)

| Reviewer Decision            | Root Agent Action                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `blocked` — issues found     | Loop back to **Step 4**, re-spawn the sub-agent named in each issue's `Responsible Role` |
| `accepted` — output is valid | Proceed to **Step 8**                                                                    |

The Root Agent reads the reviewer's decision verbatim and routes accordingly. It does not override, re-interpret, or second-guess the reviewer's verdict.
