---
name: writing-for-agents-opus
description: Writing documents for agents. Use when creating, editing or reviewing a skill, AGENTS.md or CLAUDE.md, or any doc an agent is pointed at or handed (a sub-agent brief, a ticket, a rule file).
metadata:
  upstream-repo: mattpocock/skills
  upstream-path: skills/productivity/writing-for-agents
  upstream-commit: a496f5513d4a4cf889bc48e189e579f4b0bdf6aa
---

Reference for writing any document an agent consumes: a skill, an `AGENTS.md` / `CLAUDE.md`, a doc reached by a pointer, a brief handed to a sub-agent. The packaging differs; the writing does not.

When the document you're writing, editing or reviewing is a skill, read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) for frontmatter, invocation choice, router skills, calls between skills, and harness differences.

## The reader

Every judgement below is relative to the model that reads the document: whether a line is a no-op, how much process to fix, how much to explain. This reference assumes a strong agentic reader (Opus 5.5 class): it knows the craft, plans its own work, and finds paths the author did not foresee. It rarely wanders; its characteristic failure is the opposite, obeying a document so faithfully that it trades a better path for the written one, or stretches a rule to cases the author never meant.

So a document for this reader earns its place by supplying what the model cannot know (the goal, the constraints, the local conventions, the reasons behind them) and by leaving room everywhere else. A document that must also serve weaker models keeps more process and more explicit instruction, at the strong reader's expense: make that trade knowingly.

## Outcome and process

A document can fix two things: the **outcome** (what done looks like, what must not break) and the **process** (the route there). Fix the outcome always. Fix the process only where the order is itself the knowledge: an ordering a strong model still gets wrong by default (a loop that goes _red_ before any hypothesis; agreed seams before any test), a sequence other people or tools depend on, or a step whose skipping is costly and silent. Everywhere else, state the goal, the constraints and the done-condition, and let the agent choose the route.

Signs a document over-fixes process: steps the model would take anyway, in the order it would take them anyway; a fixed count where the right number depends on the case (exactly three sub-agents, exactly five hypotheses); hard gates on work that is cheap to redo; checklists that restate the goal as procedure. Each spends the reader's judgement on predictability nobody needs.

A strong model reads a document as a contract, so mark where the contract is loose: "choose the approach", "skip what doesn't apply", "if a better path appears, take it and say why".

## Context pointers

A **context pointer** is a reference held in the agent's context that names some out-of-context material and encodes the condition for reaching it. A skill's description is one; a line in `AGENTS.md` naming a doc is the same object. The pointer's _wording_, not its target, decides when the agent reaches the material, and how reliably. A must-have target behind a weakly worded pointer is a variance bug: sharpen the wording first, and inline the material only if sharpening fails.

A pointer does two jobs: state what the material is, and list the **branches** that should trigger reaching it (a branch is a distinct case the document handles, so different runs take different paths through it). As always-loaded material, it earns even harder pruning than the body:

- **Front-load the trigger word**: the word you would actually use when asking for this material.
- **One trigger per branch.** Synonyms that rename a single branch are one branch written twice; collapse them and keep only genuinely distinct branches.
- **Keep identity to what triggering needs**; the body carries the rest.
- **Cover every branch the body claims.** A body that handles more cases than its pointer names never fires for the rest.

## The two loads

Every document and pointer you add spends one of two budgets:

- **Context load** is the cost of always-loaded material on the agent's window: an `AGENTS.md` line, a skill description, anything sitting in context every turn, spending tokens and attention whether or not it fires.
- **Cognitive load** is the cost on the human: which documents exist and when to reach for each. The human is the index. Not a cost to minimise: it is the price of human agency; spend it where human judgement matters, remove it where it does not.

Material reached only through a pointer escapes context load at the price of the pointer's own line; material with no pointer at all rides entirely on cognitive load.

## Information hierarchy

A document is built from two content types: **steps** (the ordered actions the agent performs) and **reference** (definitions, rules, facts consulted on demand). The two mix freely: all steps (a recipe), all reference (a review's rules, this skill), or both. The core decision is where each piece sits on the **information hierarchy**, a ladder ranked by how immediately the agent needs the material:

1. **In-file step** is the primary tier: what the agent does, in order.
2. **In-file reference** is consulted on demand. Often a legitimately flat peer-set (every rule of a review on one rung).
3. **Disclosed reference** is pushed out into a separate file, reached by a context pointer, loaded only when the pointer fires. It ranges from a sibling file in the same folder to external reference that lives anywhere and any document can point at.

Push too little down and the top bloats; push too much and you hide material the agent actually needs.

**Progressive disclosure** is the move down the ladder (out of the main file and behind a pointer) so the top stays legible. Branching is the cleanest disclosure test: inline what every branch needs, and push behind a pointer what only some branches reach. When a document has steps, in-file reference that should be disclosed buries them and turns attending to them into a coin-flip: a variance lever, not just a legibility one.

**Co-location** is the within-file companion: where the ladder decides _how far down_ a piece sits, co-location decides _what sits beside it_ once there. Keep a concept's definition, rules, and caveats under one heading rather than scattered, so reading one part brings its neighbours with it. (Distinct from duplication: that repeats one meaning in two places; scattering fragments one meaning across many.)

**Sprawl** is the failure mode here: a document simply too long, even when every line is live and unique. Attention thins across the excess. The cure is the ladder: disclose reference behind pointers, and split by branch or sequence so each path carries only what it needs.

## Completion criteria

Every fixed step, and every document as a whole, ends on a **completion criterion**, the condition that tells the agent the work is done. When the process is left open, the criterion is most of what the document says, so it carries the weight the steps would have. Two properties make it a lever:

- **Clarity**: can the agent tell done from not-done? A vague bound ("understanding reached") invites **premature completion**: ending the step before it is genuinely done, attention slipping to _being done_. The visible steps still ahead (the **post-completion steps**) supply the pull; the criterion's clarity is the resistance. Defend in order: **sharpen the bound first** (local and cheap); only if it is irreducibly fuzzy _and_ you observe the rush, hide the later steps by splitting the sequence. Hiding only works across a real context boundary (a hand-off or a subagent dispatch; an inline call leaves the later steps in context and clears nothing).
- **Demand**: how much it requires. "Every modified model accounted for" forces thorough work where "produce a change list" does not. Demand drives **legwork** (the digging the agent does within the work, latent in the wording rather than written as its own step), and it is not step-bound: "every rule applied" binds a body of flat reference just as "every step done" binds a sequence, which is how an all-reference document still carries an exhaustiveness bar. Demand is a dial, not a ratchet: a strong reader is already thorough, and demand past what the goal needs turns into legwork the task never asked for (exhaustive passes over material that cannot change the result, tokens spent proving the obvious). Set it high where a miss is costly and silent; elsewhere let the goal itself be the bar. Either way, make the criterion checkable.

## When to split

Splitting one document into two adds a pointer (context load) or another document to remember (cognitive load), so split only when the cut earns it:

- **By branch**: push what only some branches reach behind a pointer (see Information hierarchy).
- **By sequence**: when the post-completion steps visibly pull the agent off the step in front of it and a sharper criterion has not fixed it (see Completion criteria), split them across a context boundary. Merging works the other way: it puts each step's later steps back in view.
- **By invocation**, skill-specific: see [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md).

## Leading words

A **leading word** is a compact concept already living in the model's pretraining that the agent thinks with while running the document (_lesson_, _fog of war_, _tracer bullets_). Repeated as the same word rather than paraphrased, it accumulates a distributed definition and anchors a whole region of behaviour in the fewest tokens, by recruiting priors the model already holds. Coining your own works if you define it clearly, but a made-up word recruits no priors: you pay in definition tokens what a pretrained word gives free; reach for an existing word first.

It anchors twice. In the body, _execution_: the agent reaches for the same behaviour every time the word appears, and inside flat reference it focuses attention on a class of thing to look for. In a pointer, _invocation_: when the same word lives in your prompts, your docs, and your codebase, the agent links that shared language to the material and reaches it more reliably.

Where a triad recurs, or a pointer spends a sentence to gesture at one idea, try a leading word:

- "fast, deterministic, low-overhead" → _tight_ (a _tight_ loop).
- "a loop you believe in" → _red_, turning a fuzzy gate into a binary observable state (the loop goes _red_ on the bug, or it doesn't).

**Intensity** is a leading word too, and with a strong reader it overshoots. Shouted emphasis (all-caps imperatives, "critical" on every rule, _relentless_ on every step) does not buy more care from a model that is already careful; it buys rigidity, and the emphasised rule crowds out judgement on everything near it. Reach for precision before intensity, and spend emphasis only on the rules whose miss is costly and silent.

**Prohibitions** fail differently with a strong reader. It follows a ban reliably, too reliably: it applies a broad ban to cases the author never meant ("do not modify the parent issue" blocking the sub-issue link the same step asks for). Prompt the **positive** first: state the target behaviour ("write one-line comments") so the banned one never needs saying. When a prohibition is the clearest guardrail, scope it to what it protects and give the reason ("leave the parent issue's body and state alone: it is the spec others work from"), so the model can tell the cases apart. In a document the agent produces from, describe a banned pattern rather than reproducing it: a forbidden snippet shown verbatim is a template sitting in context. (Naming a mistake so a reviewer can recognise it is a different job; see Examples.)

## Reasons

A rule without a reason gets obeyed mechanically or stretched to cases it never meant. A rule with a reason lets the reader handle what the author never foresaw, which is most of what a strong reader is for. Give every rule whose purpose isn't obvious one short clause of why.

Keep the reason, cut the **exposition**. The test: would the reason change what the model does in a case the rule doesn't name? Then it is load-bearing; keep it. Does it restate the rule, argue for it, tell its history, or explain what the model already knows? Cut it.

## Examples

A strong model copies examples: show one ticket and every ticket takes its shape, down to its length and headings. Use an example where copying is the point (a format that must be exact: a schema, a frontmatter block, a command line) or to show a mistake to recognise. For anything that should vary, describe the qualities instead, or show two examples that differ on purpose and say they are two of many.

A document distilled from one real run inherits that run: its repo, its file names, its accidents. Keep the run as evidence, then write for the class of task.

## Pruning

- Keep each meaning in a **single source of truth**: one authoritative place, so changing the behaviour is a one-place edit. **Duplication** (the same meaning in more than one place) costs maintenance and tokens, and inflates a meaning's prominence on the ladder past its real rank. Duplicate deliberately across a **context boundary** the source can't cross: a sub-agent brief must stand alone, and a skill installed into other repos can't lean on their `AGENTS.md`. Keep such a copy verbatim and treat the source as its owner.
- The **environment** is a source of truth too (`package.json` scripts, config files, the directory layout, `--help` output), and a document that restates it is a **cache**: a copy of a lookup, earning its load only when the lookup is expensive. Cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses. Leave the one-file, one-command lookups to the environment, where they cannot go stale.
- Check every line for **relevance**: does it still bear on what the document does? A line loses relevance by never bearing on the task (mere exposition, or a branch that should be disclosed) or by going stale as the behaviour or world it describes changes. Shorter documents are easier to keep relevant. Without a pruning discipline the default fate is **sediment**: stale layers that settle because adding feels safe and removing feels risky, until you must core down through them to find what is still live.
- Read every **heading** as a claim about everything beneath it. The reader meets it first and trusts it longest, so a false heading over true lines ("Currently using" above a list of retired tools) misleads even when every line passes; rename it, or move the lines under one that is true.
- Hunt **no-ops** sentence by sentence: an instruction the model already obeys by default pays load to say nothing. The test (does it change behaviour versus the default?) is model-relative, not reviewer-relative: two people disagreeing about a no-op disagree about the default, and settle it by running the document, not by debate. With a strong reader the net is wide: generic craft advice (read before editing, handle errors, check your work, be thorough) is already its default. When a sentence fails, cut it, or the part of it that fails; a dead sentence reworded is still dead. Keep any reason a surviving rule depends on (see Reasons). The test also grades leading words: a word that doesn't change behaviour is a no-op, and the fix is a more precise word, not a louder one (see Intensity).

## Reviewing a document

A draft written at the end of a long conversation absorbs that conversation: its arguments, its rejected options, its banned snippets. Review it from a fresh context (a sub-agent given only the draft, its pointer, and this reference) before it lands; the conversation that produced it is the worst place to judge it.

A review is done when every line has been weighed against the reader, not when something has been cut: a line that earns its place stays as written, so a second review of a clean document changes nothing. Check the pointer against the body (see Context pointers), and that disclosed files agree with the file that points at them. When a cut is uncertain or consequential, run a representative task for each branch the cut touches, with the document before and after, and keep the version whose behaviour you want.
