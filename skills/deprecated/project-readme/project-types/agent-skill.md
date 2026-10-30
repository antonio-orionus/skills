# Agent Skill

## Primary reader

Agent user or maintainer installing and triggering a skill. If `artifact_type` is `agent-skill-collection`, the primary reader is choosing and installing one or more skills from a collection.

## First successful action

Install the skill or collection and trigger one included skill with a representative request.

## First screen

For a single skill, show the skill name, trigger use case, install location, and sample prompt.

For a skill collection, show the collection name, who it is for, the fastest install command, and a short index of included skills.

## Required sections

What it does, when to use it, install or copy location, representative trigger prompts, workflow, bundled resources, validation, license.

For `artifact_type = agent-skill-collection`, include a skill index sourced from `agent_skills.skills`.

## Conditional sections

Scripts, references, assets, examples, supported agents, plugin manifest, marketplace/install notes, limitations.

## Source-of-truth files

`SKILL.md`, nested `SKILL.md` files, `scripts/`, `references/`, `assets/`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, agent metadata.

## Do not invent

Agent compatibility, tools, trigger behavior, scripts, marketplace status, plugin registration, install targets.

## Mini example

````markdown
Example:

```text
Create a README for this CLI and validate it.
```
````
