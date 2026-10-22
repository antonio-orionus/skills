---
name: claims
description: "Which agent session owns an issue, PR or set of files in this clone. Use before starting, dispatching, reviewing or commenting on an issue or PR, when filing a follow-up you will do yourself, when a drain needs the next free issue or its stop condition, and before asking the user a question an issue may already have a recorded decision for."
---

# Claims

Several sessions work one clone at once, all posting as the same GitHub account, so an assignee can't say which session owns what. A **claim** does: one record per target in the clone's shared git dir, read by every session and worktree, private to this machine.

```bash
claims() { bun "$HOME/.agents/skills/claims/scripts/claims.ts" "$@"; }
claims claim '#581' 'path:src/main/services/**' --for '#581' --note 'quit keeps queue'
claims who pr:621             # exit 1 when another session holds it
claims claimable              # open ready-for-agent issues free to start
claims decision 581           # the latest recorded decision on #581
claims release                # drop all your claims
```

Targets are `#N` (an issue), `pr:N` and `path:<glob>`. The owner is your desktop session id, read automatically; elsewhere set `CLAIMS_OWNER` to a name for the session. Every subagent of a session shares its claims.

## When to claim

- **Starting an issue or PR:** claim it, and `path:` globs for the files your plan changes, before the first edit, with `--for '#N'` so the path claims drop when the issue closes. Exit 1 means another session holds one: report its holder to the user rather than working around it.
- **Filing a follow-up you will do yourself:** claim it in the same step, so a drain doesn't pick it up.
- **Dispatching (orchestrator, drain):** take work only from `claimable`, and claim each issue for the worker before it starts. A drain is done when `claimable` prints nothing. An issue an outsider's PR names stays listed, flagged with that PR: whoever takes the issue finishes or absorbs the PR.
- **Reviewing or commenting on a PR, or answering for an issue:** `who` first; a target another session holds is that session's to act on.

Claims renew by claiming again and lapse after 24 hours without renewal (`CLAIMS_TTL_HOURS`); a claim on a closed issue or a closed or merged PR drops on its own. Release what you drop.

Exit codes: 1 means another session holds it (or no decision is recorded), 3 means the command itself failed; read its message rather than treating 3 as a refusal.

`check-head` (the `dual-review` skill) refuses a push that changes files under another session's `path:` claim. That refusal is the claim working: hand the change to the holder or ask the user.

## Decisions

A comment that records the user's decision on an issue carries `<!-- decision:v1 -->` after the agent marker. Before asking the user a question about an issue, run `decision <N>` and quote what it prints. Only a maintainer's comment counts, since anyone can type the marker on a public repo. A later decision replaces an earlier one; post the new one as its own comment with the marker.
