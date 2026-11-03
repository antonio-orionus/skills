# Agent Skills

A collection of skills for AI coding agents, following the [Agent Skills](https://agentskills.io/home) format. It is for people who want to install these skills into an agent, or maintain the skill files in this repository.

Fastest start:

```bash
npx skills add antonio-orionus/skills
```

## Skills

| Skill | Description |
|-------|-------------|
| [`pr-review-watch`](skills/workflow/pr-review-watch/SKILL.md) | Trigger, wait for and read a CodeRabbit review on a GitHub PR without polling loops |
| [`speed-mode`](skills/workflow/speed-mode/SKILL.md) | Switch the current session to favor speed over token savings without giving up accuracy |
| [`writing-for-agents-frontier`](skills/adapted/writing-for-agents-frontier/SKILL.md) | Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-for-agents): write and review documents agents read (skills, AGENTS.md, briefs, tickets), tuned for a strong reader: fix outcomes rather than process, keep the reasons behind rules, scope prohibitions, review from a fresh context |

## Installation

### Option 1: Agent Skills CLI

Works with Claude Code, Codex, Cursor, Copilot, Windsurf, Gemini CLI, and [20+ other agents](https://skills.sh/):

```bash
npx skills add antonio-orionus/skills
```

### Option 2: Claude Code Plugin

```bash
claude plugin marketplace add antonio-orionus/skills
claude plugin install orionus-skills@project-readme
```

### Option 3: Manual

Copy the contents of `skills/` to the appropriate location for your agent:

| Agent | Location |
|-------|----------|
| Claude Code | `.claude/skills/` |
| Codex | `.codex/skills/` |
| Cursor | `.cursor/rules/` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurfrules/` |

### Option 4: Local Development (Live Symlink)

```bash
git clone https://github.com/antonio-orionus/skills.git
ln -s /path/to/skills/skills /path/to/your/project/.claude/skills
```

## Repository Layout

| Path | Contents |
|------|----------|
| [`skills/workflow/`](skills/workflow/) | Maintained skills written here |
| [`skills/deprecated/`](skills/deprecated/) | Skills no longer maintained, kept for reference and hidden from `npx skills add` (see its [README](skills/deprecated/README.md)) |
| [`skills/adapted/`](skills/adapted/) | Skills copied from another repository and changed; each keeps its source's `LICENSE` and pins its upstream commit |
| [`scripts/upstream.py`](scripts/upstream.py) | Lists and merges upstream changes into adapted skills |
| [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) | Claude Code plugin manifest |

## Adapted skills

A skill under `skills/adapted/` is another author's skill with a few changes. Its `SKILL.md` frontmatter pins the source:

```yaml
metadata:
  upstream-repo: mattpocock/skills
  upstream-path: skills/productivity/writing-for-agents
  upstream-commit: <sha the copy was taken or last merged at>
```

See what changed upstream since each pin, and which skills were added there:

```bash
python3 scripts/upstream.py check --new
```

Take the upstream changes into a copy with a three-way merge. Edits on both sides are kept, overlapping edits get conflict markers, and the pin moves to upstream's latest commit:

```bash
python3 scripts/upstream.py merge writing-for-agents-frontier
```

Upstream text is someone else's code and instructions: read every merged diff before committing it, and reject a change that tells an agent to run, fetch or install something, send data anywhere, or skip checks.

Keep each copy's changes small, and put project-specific rules in that project's `AGENTS.md` rather than in the copy, so upstream merges stay clean.

## Validate

Run the script tests:

```bash
uv run --with pytest pytest scripts/tests -q
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-skill`
3. Add your skill under `skills/<category>/<skill-name>/SKILL.md`
4. Register it in `.claude-plugin/plugin.json`
5. Open a pull request

## License

[MIT](LICENSE) (c) 2026 Antonio Orionus
