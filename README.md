# Agent Skills

A collection of skills for AI coding agents, following the [Agent Skills](https://agentskills.io/home) format.

## Skills

| Skill | Description |
|-------|-------------|
| [`npm-github-readme`](skills/documentation/npm-github-readme/SKILL.md) | Create, update, or validate README files for npm packages and GitHub repositories |

## Installation

### Option 1: Agent Skills CLI

Works with Claude Code, Codex, Cursor, Copilot, Windsurf, Gemini CLI, and [20+ other agents](https://skills.sh/):

```bash
npx skills add antonio-orionus/skills
```

### Option 2: Claude Code Plugin

```bash
claude plugin marketplace add antonio-orionus/skills
claude plugin install orionus-skills@npm-github-readme
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

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-skill`
3. Add your skill under `skills/<category>/<skill-name>/SKILL.md`
4. Register it in `.claude-plugin/plugin.json`
5. Open a pull request

## License

[MIT](LICENSE)
