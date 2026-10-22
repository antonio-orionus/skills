# Brief and message templates

These templates are filled in from the briefs that worked in Arroxy's 2026-10-20/21 round. Project-specific templates (publishing a package, the project's own background header) live in the project's orchestration notes. Replace every `<…>` with specifics: `file:line`, PR numbers, the names of the files to avoid. A brief with vague paths sends the session off to search for them again.

## Shared `background` (every fresh session)

```text
<Project, one line: e.g. "Arroxy (Electron app, Bun monorepo)">. An orchestrating session dispatches
these fixes and owns the backlogs. <Why this batch exists: e.g. "the user warns these audit findings
are unverified">. In flight right now, so don't write these files: <#PR: files>. Rules:
never edit the backlogs yourself; report any out-of-scope bug in your final message; no AI
attribution. Goal is <merge | a published package>, not an app release; don't stop to ask before
pushing.
```

## Verify only (a subagent, not a session)

Send several in one message, each as its own `Agent` call on the orchestrator's own model (no `model` override). Use `isolation: "worktree"` when the check runs tests.

```text
Read-only verification. Don't edit, commit or open anything.

Candidate: `<file:line>`. <What breaks, for whom, in one or two sentences>.

Find the relevant code with `codegraph explore "<symbols>"` (it returns the source and its callers)
before reading files. Then <the check: trace the path, or run one targeted test>.

Report in at most 10 lines: CONFIRMED (the scenario, `file:line`, and the test that would fail) or
REJECTED (the evidence: the guard or path that already handles it).
```

Only a CONFIRMED candidate gets the session brief below.

## Land a fix (one confirmed candidate)

```text
Bug, confirmed by a read-only check: `<file:line>`. <What breaks, for whom, in one or two
sentences>. Evidence: <the verifying subagent's scenario>.

Step 1 (red): write the failing test at the layer that owns it: <a unit test, a fixture E2E for a
user workflow, N loop runs for a flake (e.g. 60 alone and 40 under load)>. If it can't be made to
fail, stop: no PR, report the evidence.
Step 2: land the fix (<the project's land flow: test-first, review, PR, auto-merge>). <Preferred
shape of the fix, e.g. a soft notice that mirrors an existing one, not a hard failure>.
New user-facing copy: send the English to the orchestrator for approval and keep working; open the
PR only once it is approved. Follow the project's translation rule.
<The project's PR-content rules from its notes, e.g. the changelog entry.>

Final message: fixed (PR link and merge state), or not reproducible (the evidence), plus any other
out-of-scope bug you noticed.
```

For a candidate that only reproduces in a fixture E2E run or on a VM, which no read-only check can
confirm, open the brief with "UNVERIFIED: reproduce it first, and land a fix only if it's real" and
make step 1 the reproduction.

Two confirmed candidates in the same files go in one brief, numbered, with one PR each unless the two can't be green apart.

## Lane (a sequence of PRs from an approved design)

```text
Read <design doc §§> and <ADR> on main first. They are the spec. You own <N> PRs in sequence, each
branched from main and each landed with <the project's land flow>.

- **<Step id>** (<app refactor | package feature | behaviour>, <light | full review>;
  after <step or PR>): <what it does>; <what it absorbs from the backlog>.
- ...

Cross-lane order: <step> waits for <other lane's step>. Park a background wait on its PR
(`gh pr list --head <branch>` finds it), then branch from main once it has merged. Package PRs run
one at a time across lanes (a package's PRs always do). Don't tag or publish packages: the orchestrator starts a publish session for that.
A user-facing feature that spans several PRs merges behind the project's release flag (if it has one)
until its last step; the project's notes say how such PRs record changes (Arroxy: no changelog
fragment until the PR that turns the flag on).
Keep your own context for coordination. For a PR with more than one task, write the task briefs to
files and run each task through a fresh implementer subagent, then a reviewer subagent, before the
next task (the subagent-driven-development flow, where installed). Tell each implementer to find
code with `codegraph explore` before reading files, and to run every check its brief names, not a
subset of them. Once all tasks are in, you review the PR's whole diff and run the land flow yourself.
Report at the end, or when blocked: PR links and merge state, copy that needs approval, whether a
package release is due, and any out-of-scope bug you noticed.
```

## Design (a patch cluster)

```text
Architecture investigation and design. Write NO production code in this session. Load the
`codebase-design` and `domain-modeling` skills first.

Why: in the last 60 days main took <N> fixes in <area> and <M> in <area>, and they keep arriving
one path at a time: <the duplicated routes, with PR numbers>.

Do:
1. Map each area completely (codegraph first): every route by which <the decision> is made, from
   <entry> through <layers>. Back the map with `git log` evidence: which fixes landed where, and
   which routes each fix missed.
2. Find the missing seam. Propose one deep module per area that owns the decision: its interface,
   its ownership, what gets deleted, and how a test pins every route. Check the proposal against
   upstream source wherever it mirrors upstream behaviour.
3. Give a PR sequence that follows AGENTS.md (one concern per PR, no stacking, package changes
   separate, behaviour-free refactors first). For each PR, list the backlog bugs it absorbs.
4. Draft an ADR for each decision that is hard to reverse, and list the decisions the user must make,
   each with a recommendation.

Output: `<the project's private docs>/<design-doc>.md` (a new file, the one exception to the
no-backlogs rule; don't save or push the private docs). Draft ADRs stay uncommitted in your worktree. Final message: at most 15 lines
covering the seams, the PR sequence, and which in-flight work should pause.
```

## Guard after an incident

```text
Incident to guard against: <what happened, the commit and the repair PR>. Root cause: <from the
session that caused it>. Build these guards test-first and land them as one tooling PR (one
concern: "<the invariant>"): <each guard, with the exact check and where it lives>. Reproduce the
incident in a temp repo inside the test. Record the rule in the project's memory and in the skill it
belongs to.
```

## Retro review (after a degraded review period)

```text
Read-only. These PRs merged while <reviewer> was out: <#list>. Run <reviewer> over them in chunks
small enough to finish (close stdin, put a timeout on each chunk, run them in the background). Then
check every finding against current main yourself: confirmed (with the scenario and `file:line`),
or rejected (with the reason). No fixes and no PRs. Final message: the confirmed findings with
severity, plus the rejected ones with reasons.
```

## Messages to running sessions (`SendMessage`, id `local_…`)

- **Queued follow-up:** "Follow-up for after your current PR merges: <candidate>. Don't add it to your current PR. It comes to you because you're already in `<file>`. It is unverified: start with its failing test, and if the test can't fail, report the evidence instead of a PR."
- **Hold:** "HOLD: don't open or merge the PR for <x> yet. Keep the branch pushed and intact. <The design that may absorb it>."
- **Retire and harvest:** "Don't open a PR for <branch>. <Decision> makes it step <id> of the redesign. Push the branch as it is, including <the test>, which <lane> will reuse."
- **Hand a lane its inputs:** "For <step>, here are the inputs from the retired branch `<branch>`, head `<sha>`: read them with `git show origin/<branch>:<path>`. <The lesson its review learned>."
- **Resume after a quit or an outage:** "Resume your task: <what it was doing>. Background shells, dev servers and waits from before the <quit/outage> are gone, so re-run <what>, then carry on as briefed."
- **Environment change:** one message per session, written for its own state. Example: "<Reviewer> is back. Your open PR #N was reviewed without it, so run one full review round on its current head before auto-merge takes it."
- **Red main:** "`main` is red because <cause>, not your change. The fix is #N. Park a wait on it, then run `gh pr update-branch <yours>` so your gates re-run, and auto-merge does the rest."
- **Answer a question:** the decision first, then its reason in one sentence, then exactly what to do next.
