---
name: dual-review
description: Local cross-checked code review of the current branch by the Claude and Codex CLIs, each verifying the other's findings, on their logged-in subscriptions. Use before opening a pull request, for a review round on fix commits, or before pushing a reviewed branch (check-head refuses a push that differs from what was reviewed, undoes work on the default branch, or changes files another session claims).
---

# Dual review

Codex reviews the whole change; Claude, pinned to Opus, reviews it in four
lanes (regressions, silent failures, types and documented rules, tests). Each
tool then checks every finding the other reported, and the result is sorted
into what this change must fix and what predates it. Needs `git`, `bun`, and
the `claude` and `codex` CLIs logged in; no API keys. The `opencode` CLI is
optional: it stands in for Codex when Codex is unavailable.

Roles follow model strength: Opus first, Codex second, the OpenCode fallback
last.

| Role | Who |
| --- | --- |
| Find | Opus lanes + Codex, or the OpenCode fallback when Codex is out |
| Check Codex/OpenCode findings | Opus |
| Check Opus findings | Codex (or a second Opus pass when Codex is out) |
| P0/P1 Opus finding refuted by a weaker checker | Uncertain, never dropped |

`DUAL_REVIEW_CLAUDE_MODEL` changes the Claude model (default `opus`).

```bash
DR="bun $HOME/.agents/skills/dual-review/scripts"
$DR/run.ts                          # behaviour changes: Codex + four Claude lanes
$DR/run.ts --light                  # mechanical or behaviour-free changes: Codex alone, checked by Claude
$DR/run.ts --light --base <sha>     # fix round: only the commits since the head the last round reviewed
$DR/check-head.ts                   # right before every push
```

Run it from inside the repository, after committing: it reviews the commits,
never the working tree. A full run takes several minutes, so run it in the
background. `--base` defaults to the remote's default branch (`origin/HEAD`,
else `origin/main`). `--help` prints the options and the context a run would
use (project, base, learnings, report folder) without reviewing anything.

## Exit codes

| Exit | Meaning | Do |
| --- | --- | --- |
| 0 | Nothing to fix or decide in this change (backlog entries may be listed) | Proceed |
| 1 | Something to fix or decide | Work through `report.md` |
| 2 | A reviewer failed (coverage is partial), no reviewer completed, or the run could not start | Read the failure; say coverage was partial, or fix the cause and re-run |

Exit 2 with "No reviewer completed" means nothing reviewed the change: treat it
as unreviewed.

## Reading `report.md`

The run prints the report and its path, in this worktree's git dir under
`dual-review/`, next to each reviewer's log. Its first line, **Review
coverage**, says who reviewed and who checked; quote it in the PR body.

- **Fix in this change**: confirmed bugs the change introduced or that sit in
  its changed lines. Fix each one test-first. You stay the judge: a confirmed
  finding can still be wrong, so say why when you reject one.
- **Uncertain**: the checker could not settle it from the code, or Codex
  refuted a P0/P1 Opus finding ("refuted by codex, escalated"). Read the code
  and decide.
- **Backlog**: confirmed bugs that predate the change, outside its lines. Fix
  one here only when it sits in code you touched and the fix is small; record
  the rest wherever the project tracks issues.
- **Refuted**: skim. When a refutation will recur, add a line to the review
  learnings.

After fixing, run one `--light --base <reviewed head>` round on the fix
commits. Two rounds at most; take anything a third would need to the user.

## Codex unavailable

On a usage limit, a missing login or a missing binary, the run skips Codex and
the coverage line says so and why. An OpenCode reviewer takes Codex's
whole-change slot, in `--light` and full runs alike (a full run keeps its four
Claude lanes). It runs read-only from the repository root
(`opencode run --standalone --agent plan -m <model>`), on
`DUAL_REVIEW_FALLBACK_MODEL` (default `openrouter/xiaomi/mimo-v2.6-pro`).
Claude checks every OpenCode finding; OpenCode never checks anything. Claude's
own findings get a second Claude pass instead of Codex: a weaker cross-check
(same model, shared blind spots), so read the code behind every "uncertain"
yourself. The coverage line names what ran, e.g. "Codex skipped (usage limit:
…); fallback reviewer opencode:openrouter/xiaomi/mimo-v2.6-pro, checked by
Claude".

- `DUAL_REVIEW_FALLBACK_MODEL=none`, no `opencode` on PATH, or an OpenCode run
  that fails (non-zero exit, an error event such as an unknown model) switches
  the fallback off without failing the run; the coverage line says why.
  `--light` then has Claude review the whole change, as before.
- A reply with no valid review JSON gets one follow-up in the same session;
  a second bad reply makes OpenCode a failed reviewer (exit 2).

Rely on this built-in fallback; any other Codex failure is a failed reviewer
(exit 2).

## Before pushing: `check-head.ts`

A run that exits 0 or 1 records the commit it reviewed. `check-head.ts` fetches
the default branch, prints the files the push changes (check them against what
the task declared), and exits 1 when:

- the branch wholly undoes commits already on the default branch, the mark of
  a squash onto a moved `origin/main` (`git reset --soft origin/main`). Rebuild
  from `git reflog`, squash onto the merge-base
  (`git reset --soft $(git merge-base origin/main HEAD)`), then rebase or merge.
  A deliberate revert trips it too;
- HEAD is not the reviewed change. A clean rebase or a merge of the default
  branch passes; any edit, squash or resolved conflict after the review needs
  another round, which it names.

Follow what it prints; push only on exit 0.

## Review learnings

Every reviewer and checker prompt includes the repository's
`.agents/memory/review-learnings.md` when it exists, plus the file named by
`DUAL_REVIEW_LEARNINGS`, and they override the built-in rules. Write each entry
as a one-line instruction to a reviewer with its reason, e.g. "Do not raise
security hardening: this is a local tool (2026-10-20)".

## Maintenance

`scripts/core.ts` (parsing, cross-check routing, escalation, report) and
`scripts/prompts.ts` hold the logic; `scripts/validate.ts` replaces a schema
library so the skill has no dependencies. `tests/run.test.ts` drives `run.ts`
through fake `claude`, `codex` and `opencode` binaries, so the suite spends no
quota.

```bash
cd ~/.agents/skills/dual-review && bun test
```
