# Step 6 — Submit or Return

Check whether an MCP integration is available for the detected platform:

| Platform  | MCP tool to check                                                  |
| --------- | ------------------------------------------------------------------ |
| GitHub    | `github-pull-request_create_pull_request` or equivalent GitHub MCP |
| GitLab    | GitLab MCP (merge request creation tool)                           |
| Bitbucket | Bitbucket MCP (pull request creation tool)                         |

**If MCP is available:**

1. Show the user the filled template for review.
2. Ask: _"Should I create this pull request now using the [Platform] integration?"_
3. If confirmed, invoke the MCP tool to create the PR/MR targeting `<target-branch>` with the filled description.
4. Report the PR/MR URL back to the user.

**If MCP is not available:**

- Return the fully filled PR description as a fenced Markdown block so the user can copy-paste it directly into their platform.
