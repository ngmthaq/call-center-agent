- From: debugger (sub-agent loaded with the debugger role skill)
- To: Root Agent
- Title: Plan Response — Silence "UDP receive buffer too small" WARN in livekit-server container
- Description: Raise the in-container UDP socket receive/send buffer ceilings to 5_000_000 bytes by declaring `net.core.rmem_max` and `net.core.wmem_max` as per-service `sysctls:` in `livekit-server/docker-compose.yml`, with operator documentation for the deployment-target caveats (Docker Desktop on macOS vs Linux host).

---

## Approach Summary

- The LiveKit server invokes `SO_RCVBUF` on its UDP listener at startup; when the kernel cap (`net.core.rmem_max`) is below the suggested 5_000_000 bytes, it logs the production WARN at `rtcconfig/rtc_unix.go:31`. The container inherits the host kernel's `net.core.rmem_max` (observed: 425_984), so the fix is to raise that ceiling at container start. The least-invasive, declarative remedy is a per-service `sysctls:` block in `docker-compose.yml`, which Docker passes through `--sysctl` and the container runtime applies inside its own network namespace at create time — no host-level `sysctl -w`, no `network_mode: host`, no LiveKit config or source change. The README's "Troubleshooting" section will gain a short subsection explaining the warning, the fix, and the macOS-Docker-Desktop caveat.
- This addresses the **root cause** (kernel-level UDP receive-buffer ceiling), not the symptom (the log line). It does not change LiveKit source, log level, or runtime config.

## Functional Requirements

- After `docker compose up -d --force-recreate livekit`, `docker compose logs livekit` MUST NOT contain the line `UDP receive buffer is too small for a production set-up`.
- The container's effective `net.core.rmem_max` (verified with `docker compose exec livekit sysctl net.core.rmem_max`) MUST be exactly `5000000`.
- The container's effective `net.core.wmem_max` MUST be exactly `5000000` as well.
- The fix MUST be applied automatically by `docker compose up -d` — no manual `sysctl` step on the host.
- The existing TURN port publishing, healthcheck, env-var injection, and `depends_on redis` behavior MUST remain unchanged.
- The fix MUST be scoped to `livekit-server/` only — no edits to `agent-worker/`, root-level files, or unrelated services.

## Non-Functional Requirements

- **Maintainability / clean-code (KISS, SoC):** changes are declarative configuration only; no script gymnastics, no entrypoint shims, no `init` containers.
- **Backward compatibility:** the container continues to run on the default compose bridge network. No move to `network_mode: host`.
- **Observability:** the README addition documents how an operator verifies the fix in a single `docker compose exec` command.
- **Security:** no new capabilities (`cap_add`), no `privileged: true`. Only the two specific sysctls are added. Both are namespaced to the container's net namespace by modern Docker; the change is opt-in per service.
- **Portability caveat documented:** on Docker Desktop for macOS, the container's net-namespace sysctls resolve against the LinuxKit VM kernel — `sysctls:` in compose continues to work because Docker Desktop forwards the `--sysctl` flag into the VM. README will state this so the operator does not run `sysctl -w` on the macOS host expecting it to help.

## Files in Scope

- `/Users/nmthang6/Documents/Workspace/agent-assistant/livekit-server/docker-compose.yml` — add a `sysctls:` block to the `livekit:` service raising `net.core.rmem_max` and `net.core.wmem_max` to `5000000`.
- `/Users/nmthang6/Documents/Workspace/agent-assistant/livekit-server/README.md` — add a new troubleshooting subsection ("Production-readiness WARN: UDP receive buffer too small") under the existing "Troubleshooting" heading explaining the warning, the compose-level fix, the verification command, and the Docker-Desktop-on-macOS caveat. Cross-link to LiveKit's "host networking recommended for Dockerized production" note as an alternative production tuning path.

No new files. No file deletions. No changes to `livekit.yaml`, `redis.conf`, `.env`, `.env.example`, `scripts/bootstrap.sh`, or the `agent-worker/` tree.

## Risks & Assumptions

- **Assumption — Linux container kernel exposes `net.core.rmem_max` as a writable namespaced sysctl.** True for Linux kernel 4.15+ (Docker Desktop ships well above this; bare-metal Linux production hosts will too).
- **Risk — Docker Desktop on macOS:** the `sysctls:` directive is forwarded into the LinuxKit VM by Docker Desktop, so it works for the container.
- **Risk — `network_mode: host` is NOT a substitute on macOS.** Docker Desktop's host networking does not expose macOS host network interfaces to containers in the same way Linux does. We will not propose this path. On Linux production, the operator may *optionally* switch to host networking later for performance per LiveKit's official deployment guidance — but that is a separate change and explicitly **out of scope** for this fix.
- **Risk — buffer overcommit.** `net.core.rmem_max` only raises the *ceiling*; LiveKit chooses how much to actually allocate via `SO_RCVBUF`. Raising the ceiling does not by itself allocate kernel memory.
- **Risk — TURN listeners on `3478/udp`.** The same kernel ceiling applies to the embedded TURN UDP listener when enabled. Raising `rmem_max` benefits both the SFU UDP port (`7882/udp`) and TURN UDP — no negative interaction expected.
- **Backward compatibility — `LIVEKIT_KEYS` parsing, healthcheck, redis password handling, and bootstrap script are unaffected.**

## Open Questions / Blockers

- (none — resolved by user 2026-05-20)
- Q1 — Deployment target: **Both (macOS Docker Desktop today AND Linux production later).** README documents both paths.
- Q2 — Buffer value: **5_000_000 (LiveKit's exact suggested minimum).**
- Q3 — Symmetric `wmem_max`: **Yes — raise to 5_000_000 alongside `rmem_max`.**

## Status

- [x] Ready to execute
- [ ] Blocked

## Task List

| #   | Status | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Responsible Role | Dependencies | Skills                                                  |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------ | ------------------------------------------------------- |
| 1   | TODO   | In `/Users/nmthang6/Documents/Workspace/agent-assistant/livekit-server/docker-compose.yml`, under the `livekit:` service, add a `sysctls:` block with `net.core.rmem_max: 5000000` and `net.core.wmem_max: 5000000`. Place it after `healthcheck:` and before `depends_on:` to match the file's existing top-down ordering. Add an inline comment citing `rtcconfig/rtc_unix.go:31` and the README troubleshooting subsection. No other changes to this file.                                                                                                                                                                                                                                                                                                                                                       | developer        | none         | `clean-code` (KISS, SoC)                                |
| 2   | TODO   | In `/Users/nmthang6/Documents/Workspace/agent-assistant/livekit-server/README.md`, add a new troubleshooting subsection titled exactly "Production-readiness WARN: UDP receive buffer too small" under the existing "Troubleshooting — agent-worker logs `Unexpected server response: 401`" subsection. Explain the warning, point to the compose change made in task 1, give the verification command (`docker compose exec livekit sysctl net.core.rmem_max`), and call out the Docker-Desktop-on-macOS caveat (host-side `sysctl -w` is ineffective; the `sysctls:` block is forwarded into the LinuxKit VM by Docker Desktop). Cross-reference the `livekit.yaml` comment about `network_mode: host` as an alternative Linux production tuning path. | developer        | task 1       | `clean-code` (SoC, KISS)                                |
| 3   | TODO   | Run `docker compose config` from `/Users/nmthang6/Documents/Workspace/agent-assistant/livekit-server/` to validate the compose file parses with the new `sysctls:` block. Confirm the rendered service includes `Sysctls: map[net.core.rmem_max:5000000 net.core.wmem_max:5000000]`. No other side effects expected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | tester           | task 1       | none                                                    |
| 4   | TODO   | Manual verification (Skip-Testing substitute for the mandatory regression test). From `/Users/nmthang6/Documents/Workspace/agent-assistant/livekit-server/`: run `docker compose up -d --force-recreate livekit`, wait for healthcheck green, then run `docker compose logs livekit \| grep "UDP receive buffer"` (expect zero matches) and `docker compose exec livekit sysctl net.core.rmem_max` and `... net.core.wmem_max` (expect `5000000`). Record outputs. If either check fails, return to task 1 with the failure context.                                                                                                                                                                                                                                                                                                | tester           | task 2, 3    | `testing-workflow` (Skip-Testing → manual verification) |
| 5   | TODO   | Re-read the changed `docker-compose.yml` and `README.md` for clean-code compliance: no commented-out code, comments justify the *why* (cite the upstream warning location), no unrelated formatting churn, no scope creep into `agent-worker/` or root. Confirm only two files are touched and the diff is < ~40 lines total.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | developer        | task 2       | `clean-code` (review pass)                              |

> **Note on the mandatory regression-test substitution:** the debugger contract requires a regression test that fails on the buggy code and passes on the fix. The project's testing workflow is `Skip-Testing` (per `/Users/nmthang6/Documents/Workspace/agent-assistant/.claude/PROJECT_OVERVIEW.md`), so task 4 substitutes a deterministic manual verification (`tester` role) that proves both halves of the regression contract: the `grep` confirms the WARN is absent on the fix, and reverting the compose change would deterministically reproduce the original 425984/5000000 WARN line.
