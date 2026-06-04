---
name: npm-github-readme
description: Create, update, rewrite, or validate README.md files for npm packages and GitHub repositories. Use when the user asks for a README, npm package documentation, GitHub project front-page docs, project setup docs, badges, quick start/install instructions, package usage examples, API or CLI documentation, repository structure, contributing/license/support sections, or README quality checks.
---

# NPM/GitHub README

Use this skill to produce truthful, polished README files that work well both on GitHub and, when applicable, on npm package pages.

## Workflow

1. Inspect the repository before writing. Find and run the bundled inspect script:

   ```bash
   SCRIPT=$(find ~ -maxdepth 6 -name "inspect_readme_context.py" -path "*/npm-github-readme/*" 2>/dev/null | head -1)
   [ -n "$SCRIPT" ] && python3 "$SCRIPT" . || echo "Script not found — inspect package.json, lockfiles, workflows, and existing README manually."
   ```

2. Preserve facts from source files. Use `package.json`, lockfiles, `.github/workflows/`, `LICENSE`, `.env.example`, docs, examples, tests, and existing README content. Do not invent package names, APIs, badges, deploy URLs, metrics, support contacts, or roadmap claims.
3. Choose the README mode:
   - **npm package**: `package.json` has a package name, package entry points, exports, `bin`, types, or clear package install/use behavior.
   - **GitHub project**: repository documentation, local development, architecture, deployment, issue reporting, and contribution workflows matter more than package consumption.
   - **Hybrid**: a publishable package also needs contributor/development sections.
4. Draft or update `README.md` with the highest-value sections for the project. Keep the first screen concise: title, badges, one-sentence value proposition, and the fastest useful command.
5. Validate before finishing:

   ```bash
   SCRIPT=$(find ~ -maxdepth 6 -name "validate_readme.py" -path "*/npm-github-readme/*" 2>/dev/null | head -1)
   [ -n "$SCRIPT" ] && python3 "$SCRIPT" README.md || echo "Validator not found — check manually against the quality bar."
   ```

## Section Order

Use this default order, omitting irrelevant sections and adding project-specific sections only when supported by the repo:

1. `# Project Name`
2. Badges
3. One- or two-sentence overview
4. Key links, demo, or live site when real
5. Features
6. Quick start
7. Installation
8. Usage
9. API reference or CLI reference
10. Configuration and environment variables
11. Examples
12. Project structure
13. Available scripts
14. Development, testing, and build
15. Troubleshooting
16. Contributing
17. Changelog or releases
18. License
19. Acknowledgements and support/contact

For long READMEs, add a linked table of contents after the overview.

## NPM Package Rules

Read `references/npm-package-readme.md` when documenting an npm package.

- Use the real package manager from lockfiles: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, or `bun.lockb`.
- Use npm install examples only when the package appears intended for npm consumption. Otherwise, document source installation.
- Include npm version/download badges only for a real `package.json` `name`; avoid package badges for private packages unless the README explicitly targets internal users.
- Show copy-pasteable usage examples that match the exported API, CLI `bin`, or documented entry points.
- Include TypeScript notes when `types`, `typings`, generated declarations, or TypeScript source exists.

## GitHub Repository Rules

Read `references/github-project-readme.md` when documenting a GitHub repository or docs site.

- Prefer the Git remote slug for GitHub links. If it is missing, use relative links and ask only when a required public URL cannot be inferred.
- Do not add a "GitHub repo" badge that links the README back to its own repository.
- Add CI badges only for workflows that exist in `.github/workflows/`.
- Use relative links for repo files such as `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/`, and `examples/`.
- If the repository is a docs or MkDocs project, use existing metrics files when present rather than recounting by hand.

## Quality Bar

Read `references/validation.md` for the full checklist.

- The README must pass a three-second test: readers can tell what the project does, who it is for, and how to start.
- Every command must be likely to work for this repository.
- Code fences need language tags.
- Badges and links must point somewhere meaningful.
- Avoid placeholders such as `package-name`, `username/repo`, `example.com`, `TODO`, fake emails, fake Discord links, or invented feature lists.
- Keep tone practical and direct. Prefer specific usage over marketing copy.
