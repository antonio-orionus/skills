# Skill mechanics

The skill-specific branch of [`writing-for-agents-frontier`](SKILL.md): what changes when the document is a skill. Everything else about writing it is the universal reference in `SKILL.md`.

## Invocation

Two choices, trading the two loads:

- A **model-invoked** skill keeps a `description`, so the agent can fire it autonomously, and other skills can reach it. You can still type its name: model-invocation always _includes_ user reach. The description is the skill's top-level context pointer, forced to stay loaded at all times: permanent context load in exchange for discoverability. A model-invoked skill whose content is all reference is also one home for shared reference: another skill can invoke it, so reference needed by several skills lives in one place. Mechanics: omit `disable-model-invocation`, and write a model-facing description carrying the trigger branches (the pointer-writing rules in `SKILL.md` apply in full).
- A **user-invoked** skill strips the description from the agent's reach: only the human typing its name can invoke it, and no other skill can. Zero context load, but it spends cognitive load: you are the index that must remember it exists. Mechanics: set `disable-model-invocation: true`; the `description` becomes human-facing: a one-line summary, trigger lists stripped.

Pick model-invocation only when the agent must reach the skill on its own, or another skill must. If it only ever fires by hand, make it user-invoked and pay no context load.

Shared reference that two user-invoked skills both need can live in neither: with no model-facing description, neither can fire the other. Push it to a plain file outside the skill system: external reference any skill can point at.

## Splitting by invocation

The invocation cut of splitting (the sequence cut lives in `SKILL.md`): split off a model-invoked skill when you have a distinct trigger word that should reach it on its own (one you actually use in your prompts), or another skill must reach it. You pay context load for the new always-loaded description, so that independent reach has to be worth it.

## Router skills

When user-invoked skills multiply past what you can remember, cognitive load has outgrown one human index, and the answer is a **router skill**: one user-invoked skill that names the others and when to reach for each, so the human has one skill to remember instead of many. It can only hint, never fire them: user-invoked skills have no model-facing description, so nothing but the human can reach them.

## Calling other skills

A skill that reaches another names it in the host's invocation form (in Claude Code, "call the Skill tool with `<name>`"). Two things break that line silently:

- **Absence.** Skills get installed in subsets, so say what the caller does when the target is missing: carry on without it, or stop and tell the user which skill to install. A dependency the run can't do without is worth one sentence saying so.
- **Collision.** A bare name resolves to whatever the harness finds first, and harnesses ship built-ins (Claude Code has its own `code-review`). Where a pack is installed as a plugin, name the namespaced form (`<plugin>:<skill>`) for any sibling whose name a built-in might share.

## Harness differences

`disable-model-invocation` is Claude Code frontmatter. Codex makes a skill user-invoked with `policy: allow_implicit_invocation: false` in `agents/openai.yaml`; set both when a skill targets both. Some hosts show only the first ~250 characters of a description; keep the trigger branches inside that.
