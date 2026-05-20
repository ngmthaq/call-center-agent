- From: debugger (sub-agent loaded with the debugger role skill)
- To: Root Agent
- Title: Plan Response (REVISED) — Revert broken per-container sysctls; document host-side fix for UDP receive buffer WARN
- Description: Revert the `sysctls:` block in `livekit-server/docker-compose.yml` back to the HEAD version (the runc namespaced-sysctl allowlist rejects `net.core.*` without privileged/SYS_ADMIN, breaking container startup), and rewrite the README troubleshooting subsection so operators get a working host-side recipe on Linux production plus an explicit macOS-cosmetic-only caveat — without ever re-introducing the broken compose path.

> Supersedes: `20-05-2026-15-42-58-fix-livekit-udp-buffer-warning.md` (old plan; verification revealed runc rejects `net.core.*` per-container).

---

## Approach Summary

- The previous plan's root-cause assumption (that `net.core.rmem_max` is a namespaced sysctl Docker would accept per-service) was incorrect. runc's libcontainer allowlist only admits `kernel.{shm,msg,sem}*`, `fs.mqueue.*`, and a curated subset of `net.ipv4.*` / `net.ipv6.*`; `net.core.*` is global and is rejected at `runc create` time on every Linux kernel regardless of version. The runtime error `open sysctl net.core.rmem_max file: reopen fd 8: permission denied` is the runc allowlist refusing the syscall, not a kernel-capability issue.
- The user has chosen the doc-only path, which is the only path that (a) keeps the container starting on every supported host and (b) does not require `privileged: true` or `cap_add: SYS_ADMIN`. The fix is therefore split cleanly by responsibility: the *container* image stays untouched, and the *host operator* tunes the host kernel where they actually have authority to do so.
- Two files modified, no new files. The compose file returns to byte-exact parity with HEAD; the README troubleshooting subsection is rewritten (not removed) and explicitly warns future operators away from re-introducing the broken `sysctls:` block, citing the runc allowlist as the upstream reason.

## Functional Requirements

- `livekit-server/docker-compose.yml` MUST be byte-identical to its version at git `HEAD` (`5153ead`) after task 1; `git diff HEAD -- livekit-server/docker-compose.yml` MUST print nothing.
- `livekit-server/README.md` MUST retain a troubleshooting subsection titled "Troubleshooting — Production-readiness WARN: UDP receive buffer too small" (rewritten, not removed).
- The rewritten subsection MUST contain, in order: the WARN line quoted verbatim; a one-line root-cause statement (kernel-level UDP receive-buffer ceiling, namespace-global `net.core.*`); an explicit "do not add `sysctls:` to compose" warning citing the runc namespaced-sysctl allowlist; the Linux production recipe (`/etc/sysctl.d/99-livekit.conf` with `net.core.rmem_max=5000000` and `net.core.wmem_max=5000000` followed by `sudo sysctl --system`); a cross-reference to the `network_mode: host` note in `livekit.yaml` as the Linux-only alternative; the macOS Docker Desktop note (cosmetic in dev; non-declarative tuning via Docker Desktop Settings → Resources for those who need it); and an in-container verification command (`docker compose exec livekit sysctl net.core.rmem_max` — expects `5000000` *after the host has been tuned and the container recreated*).
- After task 1, `docker compose up -d --force-recreate livekit` from `livekit-server/` MUST succeed and the healthcheck MUST go green.
- After task 1, on macOS Docker Desktop without any host tuning, the WARN line MUST still be present in `docker compose logs livekit` (documented dev-time cosmetic state; absence would mean the revert was incomplete).
- Scope MUST stay inside `livekit-server/`.
- No `privileged: true`, no `cap_add: SYS_ADMIN`, no entrypoint scripts, no init containers, no override files.

## Non-Functional Requirements

- **clean-code (KISS, SoC):** container's responsibility (run LiveKit) is decoupled from the host's responsibility (tune the kernel).
- **Security:** zero new capabilities, no privilege escalation, no host networking.
- **Maintainability:** the rewritten README subsection includes a negative example ("do not re-add `sysctls: net.core.*` to compose; runc rejects it") so a future operator does not re-walk the same broken path.
- **Observability:** verification is a single `docker compose exec ... sysctl` line.

## Files in Scope

- `/Users/nmthang6/Documents/Workspace/agent-assistant/livekit-server/docker-compose.yml` — revert (drop the 10 added lines: 7-line comment + 3-line `sysctls:` mapping).
- `/Users/nmthang6/Documents/Workspace/agent-assistant/livekit-server/README.md` — rewrite the existing troubleshooting subsection (lines 97..128 of the current working tree). Keep the title and insertion point.

No new files. No file deletions. No changes to `livekit.yaml` (only referenced).

## Risks & Assumptions

- **Assumption — HEAD `5153ead` is the correct pre-fix baseline for `docker-compose.yml`.** Verified by inspecting the current `git diff` vs HEAD: the only diff present is the broken `sysctls:` block + its preceding comment.
- **Risk — README cross-reference accuracy.** The rewritten section points operators to the `livekit.yaml` comment near `udp_port` (lines 17–20 of `livekit.yaml`, verified present).
- **Risk — operator misreads the macOS caveat.** Mitigation: section states the WARN is cosmetic *in development on macOS Docker Desktop*, and explicitly does not promise any host-side `sysctl` will work on macOS.
- **Risk — operator re-introduces the broken `sysctls:` block.** Mitigation: negative example with the runc-allowlist citation lives directly in the section.
- **Backward compatibility — full.** Reverting returns the stack to commit `5153ead`'s last-known-working state.
- **Out of scope (deliberate) — actually silencing the WARN on macOS Docker Desktop.** Doing so would require either declaratively reconfiguring the LinuxKit VM (no supported declarative interface in this repo) or running `privileged: true` / `cap_add: SYS_ADMIN` (rejected by the user).
- **Skip-Testing substitution.** Per `PROJECT_OVERVIEW.md` / `testing-workflow.md`, the mandatory regression test is substituted with a deterministic manual verification (task 4). The regression contract is satisfied because (a) the buggy state was already deterministically reproduced by the previous iteration's tester (runc `permission denied`), and (b) the fixed state deterministically reaches healthy.

## Open Questions / Blockers

- (none — user has resolved prior open questions by choosing Doc-only.)

## Status

- [x] Ready to execute
- [ ] Blocked

## Task List

| #   | Status | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Responsible Role | Dependencies   | Skills                                                  |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------- | ------------------------------------------------------- |
| 1   | DONE   | Revert the broken `sysctls:` change in `livekit-server/docker-compose.yml`. Remove the 10 added lines (the 7-line comment block + the 3-line `sysctls:` mapping) that currently sit between `start_period: 10s` and `depends_on:`. After the edit, `git diff HEAD -- livekit-server/docker-compose.yml` MUST print nothing. Do not touch any other line. | developer        | none           | `clean-code` (KISS, SoC)                                |
| 2   | DONE   | Rewrite the existing "Troubleshooting — Production-readiness WARN: UDP receive buffer too small" subsection in `livekit-server/README.md`. Keep the title and position. Content MUST include, in order: (a) the WARN line quoted in a code fence; (b) a one-sentence root-cause statement citing `net.core.rmem_max` as a kernel-global ceiling and pointing at `rtcconfig/rtc_unix.go:31` upstream; (c) an explicit "DO NOT add `sysctls: net.core.rmem_max` to docker-compose.yml" warning citing runc's libcontainer namespaced-sysctl allowlist as the reason runc returns `permission denied`; (d) a "Linux production" code block with `echo 'net.core.rmem_max=5000000' | sudo tee /etc/sysctl.d/99-livekit.conf` and a second line for `net.core.wmem_max=5000000`, followed by `sudo sysctl --system`; (e) a cross-reference to the `network_mode: host` note in `livekit.yaml`; (f) a "macOS Docker Desktop" note stating the WARN is cosmetic in dev; tuning is only possible via Docker Desktop → Settings → Resources, intentionally not codified here; (g) verification: `docker compose exec livekit sysctl net.core.rmem_max` (expect `5000000` *after Linux host tuning + container recreate*; expect the original low value on macOS). | developer        | task 1         | `clean-code` (SoC, KISS, comments justify WHY)          |
| 3   | DONE   | From `livekit-server/`, run `docker compose config` and confirm the rendered `livekit` service contains NO `Sysctls:` entry. Also run `git diff HEAD -- livekit-server/docker-compose.yml` and confirm the output is empty. Record both outputs. No host commands; no `sysctl -w` on the macOS host. | tester           | task 1         | none                                                    |
| 4   | DONE (known issue: pre-existing bash healthcheck — out of scope, see notes) | Manual runtime verification (Skip-Testing substitute). From `livekit-server/`: (a) `docker compose up -d --force-recreate livekit` exits 0; (b) `docker compose ps livekit` STATUS reaches `healthy` (poll up to ~30s); (c) `docker compose logs livekit | grep "UDP receive buffer"` — WARN line IS present (documents the dev-time cosmetic state on macOS Docker Desktop); (d) DO NOT run `sudo sysctl -w` or modify `/etc/sysctl.d/` on the macOS host. Record outputs of (a), (b), (c). Run `docker compose down` after recording. | tester           | task 2, task 3 | `testing-workflow` (Skip-Testing → manual verification) |
| 5   | DONE   | Clean-code review pass: confirm `docker-compose.yml` is byte-identical to HEAD; the rewritten README subsection has no commented-out code, no dangling cross-references, no formatting churn elsewhere, and prose answers WHY not WHAT. Exactly two files touched. Net README delta vs HEAD ≤ 50 added/changed lines. | developer        | task 2         | `clean-code` (review pass)                              |
