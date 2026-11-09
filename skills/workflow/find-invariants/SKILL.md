---
name: find-invariants
description: Report every invariant a project relies on but doesn't enforce, with how each can break.
disable-model-invocation: true
---

Report every **unenforced invariant** in this project: a condition the code
assumes always holds, but that nothing enforces on every path. Change no code.

1. Summary table, riskiest first: invariant, where it is relied on
   (`file:line`), worst consequence of a break.
2. Per invariant: the assumption, the code that relies on it, every writer
   that can break it, and a concrete way to break it.
3. Rejected candidates, one line each with what enforces them.
