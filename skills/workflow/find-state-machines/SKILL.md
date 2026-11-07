---
name: find-state-machines
description: Report every implicit state machine in a project, with its states, transitions and flaws.
disable-model-invocation: true
---

Report every **implicit state machine** in this project: state that decides
what may happen next, with no single declaration of its states and
transitions. Change no code.

1. Summary table, riskiest first: name, state location (`file:line`), state
   count, worst flaw.
2. Per machine:
   - **States**, including those implied by flag combinations or `null`.
   - **Transitions**: from → to, trigger, `file:line`.
   - **Flaws**: impossible states it allows, unreachable or dead-end states,
     unguarded writes, racing async writes, stale persisted values.
3. Rejected candidates, one line each with the reason.
