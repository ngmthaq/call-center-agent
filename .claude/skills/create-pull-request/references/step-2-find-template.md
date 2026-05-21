# Step 2 — Find the PR Template

Search for a template based on the detected platform:

| Platform      | Template location(s)                                                     |
| ------------- | ------------------------------------------------------------------------ |
| **GitHub**    | `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/*.md` |
| **GitLab**    | `.gitlab/merge_request_templates/*.md`                                   |
| **Bitbucket** | `.bitbucket/pull_request_template.md`                                    |

**Rules:**

- If **exactly one** template is found → use it automatically.
- If **more than one** template is found → ask the user to pick one before continuing.
- If **no template** is found → use the default: [pull-request-template.md](./pull-request-template.md).
