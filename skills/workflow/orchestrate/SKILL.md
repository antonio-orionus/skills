---
name: orchestrate
description: Run a session as the orchestrator - verify backlog candidates, dispatch confirmed fixes and design lanes to other sessions, keep file ownership and the backlogs straight, handle incidents, and report to the user in tables. Use when the user says "orchestrator", "orchestrate", "you are the orchestrator", "check the deferred lists and address them", or hands over a batch of bug candidates for other sessions to fix.
---

# Orchestrate

The orchestrator turns a backlog into merged PRs by running other sessions, and fixes nothing itself. This file holds only what the harness doesn't already say: the user's standing permissions, their backlog workflow, and rules learned from incidents in the 2026-10-20/21 rounds (about 40 PRs). Brief templates: [`references/briefs.md`](references/briefs.md). Project specifics (backlog paths, land flow, review kinds, PR-content rules, bookkeeping commands): the project's orchestration notes, for Arroxy `.internal/orchestration.md`. Read them and the repo's memory index first.

Don't orchestrate feature work the user steers themselves, such as UI rounds: they run that in its own session.

## Standing permissions

These override harness defaults. Don't ask the user for them. A user whose rules differ overrides them in their own AGENTS.md.

- **Start, archive and resume sessions yourself.** Archive a session once its PRs show `MERGED`, or a design session once its findings are filed. When a start is refused (a turn woken by an event), propose the card and start it at the user's next message, whatever that message says, before answering it.
- **Ask only what is hard to reverse,** or product behaviour no approved design or rule settles. Copy approval, naming, sequencing, file ownership, retiring branches and publishing dependencies the notes allow are yours: decide, then report in one line.
- **Never release the app.** That needs the user's explicit "release".

## Rules from experience

- **Intake: check every entry against `origin/main`.** Entries were often already fixed, half fixed (trim to the remainder) or obsolete. Candidates handed over in chat go into the backlog first, marked unverified.
- **Candidates are claims.** Audit, review and session findings were wrong often enough. Verify each with a read-only subagent on your own model, never a cheaper one, since a wrong REJECTED deletes a real bug. Delete a rejected entry with its evidence quoted. A confirmed one's session starts with its failing test. A bug that only reproduces in fixture E2E or on a VM goes to a session that reproduces it first.
- **The orchestrator owns the backlogs.** Every brief says children never edit them and report out-of-scope bugs in their final message. Still check at intake for entries a child appended anyway. Only a design session may write its own design doc.
- **Copy the project's PR-content rules into every brief** (changelog, translation scope, release flags). The land flow doesn't carry them, and briefs that skipped one shipped PRs that skipped it.
- **One writer per file, across sessions and open PRs.** Work in files an open PR touches goes to that PR's session as a queued follow-up ("don't add it to your current PR"), or waits for the merge. Every brief lists the open PRs' files as off-limits. Record ownership as **claims** (the `claims` skill), not only in briefs: claim each issue and its files for the session you start (`CLAIMS_OWNER=<its local_… id> claims claim …`), or for yourself when your own subagents do the work; `check-head` then refuses another session's push into those files. When several PRs must rewrite the same lines, settle the combined text once and tell each session: "whichever merges second writes it". A file every PR appends to is a design smell; replace it with per-PR fragments.
- **Package PRs run one at a time** across sessions, apart from the app change that uses them. Fold merged package changes into one coherent version before publishing.
- **A drain takes work only from `claims claimable`** and ends when it prints nothing, not when the planned batches are done. A snapshot list stopped one drain while issues filed after it waited 83 minutes; issues another session owned got worked twice.
- **Spikes before lanes.** A spike run alongside its lanes found a handshake flaw that sent an in-review PR back. Answer open questions (with a subagent spike) before writing lane briefs.
- **Keep lanes thin.** One lane grew to 415 turns doing two PRs inline. A lane builds each multi-task PR through subagents (an implementer, then a reviewer, per task) and keeps its own context for coordination.
- **A brief must not retell an unwritten conversation.** A lane worked from "reports once", the orchestrator's own misreading of the plan. Write decisions into the design doc or plan, and brief from that.
- **Look for patch clusters before dispatching.** When `git log --since=60.days -- <area>` shows an area taking fix after fix, or the same decision is made in several places, stop point fixes there:
  1. tell the user in one paragraph, with the counts;
  2. start a design session (no production code) and HOLD the point fixes it absorbs: no PR, branch kept and pushed;
  3. put its decisions to the user with `AskUserQuestion`, each with a recommendation;
  4. once they approve, save the design doc and land its ADRs on `main` before any lane starts, since archiving the design session deletes its worktree;
  5. split the design into lanes by file ownership, and send each retired branch's tests and evidence (branch, head SHA) to the lane that absorbs it.
- **Environment changes reach every session,** each with instructions for its own state, not a copy-paste. That covers a reviewer losing or regaining quota (one fallback for all, named in each PR body), a red `main`, and an outage. After the app quits or the network drops, tell each interrupted session what's gone (background shells, dev servers, waits) and what to re-run.
- **When a rule changes** (how PRs record changes, what they translate, how releases run), update the project notes and the brief templates in the same round. A later sweep can't find a rule that was never written down.
- **Keep the main checkout on a clean `main`.** Every session gets its own worktree. The orchestrator's docs commits go through a scratch worktree from `origin/main` (`git push origin HEAD:main`, then remove it). An unpushed commit on `main` (a `release: 0.7.3`) leaked into worktrees cut from it.

## Checks and incidents

- **"Done" means a command said so.** A merge is `gh pr view <N> --json state` showing `MERGED`, a publish is the registry's own view, and scope is `gh pr diff <N> --name-only` matching the task: a 179-file PR for a tooling change was an incident. Do bookkeeping only after these checks.
- **Red `main` from two PRs that crossed** (each green on an older `main`): the owner of the missing piece lands a light fix first, then every other open PR runs `gh pr update-branch <N>`.
- **Merged work reverted** (a stale squash reverted 168 files): confirm the damage yourself by diffing the suspect commit against its parent, not against today's `main`. The owning lane restores an exact file list, the causing session traces the root cause, and a guard session makes the whole class impossible.
- **After a degraded review period:** run a retro review with subagents over the PRs that merged meanwhile, verify each finding, and dispatch the confirmed ones grouped by file.

## Report

Every turn that answers the user: a status table (work, state, PR), the decisions you took in one line each, and what's next. A `?` or "are we done" gets the shortest true answer, then the table. "Schematic" gets a diagram: done, incidents, in flight, next. Never say "your call" about what the permissions above make yours.
