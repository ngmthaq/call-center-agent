# Step 4 — Gather Context

Collect all available context to fill the template. Use whatever is provided:

| Source                | How to collect                                                                         |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Git changes**       | `git diff <target-branch>...HEAD`; also `git log <target-branch>...HEAD --oneline`     |
| **User input**        | The argument passed when invoking this skill (ticket URL, requirement text, plan link) |
| **Plan / design doc** | Read any linked `.md` planning files in the workspace                                  |
| **Ticket**            | If a URL is provided, fetch the ticket content                                         |
