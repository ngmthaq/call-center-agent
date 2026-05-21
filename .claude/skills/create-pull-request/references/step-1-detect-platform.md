# Step 1 — Detect the Remote Platform

Run the following and inspect the remote URL to determine the platform:

```bash
git remote get-url origin
```

| URL pattern                        | Platform                       |
| ---------------------------------- | ------------------------------ |
| `github.com`                       | GitHub                         |
| `gitlab.com` or self-hosted GitLab | GitLab                         |
| `bitbucket.org`                    | Bitbucket                      |
| Other / unknown                    | Generic (use default template) |
