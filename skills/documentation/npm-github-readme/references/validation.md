# README Validation Reference

Use this checklist before finishing README work.

## Truthfulness

- Package name, repository URL, license, commands, and exported APIs come from repository files.
- No placeholder URLs, placeholder package names, fake contact channels, fake support links, or invented roadmap items remain.
- Badges correspond to real workflows, packages, technologies, or files.
- Public API examples match actual exports, CLI binaries, tests, examples, or docs.
- Deployment instructions match actual deployment config or existing documentation.

## GitHub Rendering

- One H1 at the top.
- Headings use ATX syntax (`#`, `##`, `###`).
- Code fences have language tags such as `bash`, `ts`, `tsx`, `json`, `text`, or `md`.
- Relative links point to files that exist when possible.
- Tables render cleanly and have header separators.
- Long READMEs include a linked table of contents.

## Reader Experience

- The first screen explains what the project does and how to start.
- Quick start commands are short and realistic.
- Installation is distinct from development setup when both audiences exist.
- Usage examples come before exhaustive API details.
- Troubleshooting covers real errors seen in docs, tests, or setup paths.
- Contributing and license sections link to existing files when available.

## Validation Commands

Run the bundled validator:

```bash
SCRIPT=$(find ~/.claude -name "validate_readme.py" -path "*/npm-github-readme/*" 2>/dev/null | head -1)
[ -n "$SCRIPT" ] && python3 "$SCRIPT" README.md
```

If the repository has markdown tooling, run it too:

```bash
npm run lint:md
npm run docs:check
markdownlint README.md
```

Only run commands that exist or are installed.
