---
name: project-readme
description: Create, rewrite, update, or validate truthful README.md files for any project archetype. Use for libraries, SDKs, CLIs, web apps, API services, MCP servers, agent skills, monorepos, docs sites, GitHub Actions, extensions, container images, Terraform modules, Helm charts, model cards, dataset cards, research code, templates, demos, specs, desktop/mobile apps, badges, quick starts, setup docs, API or command references, README validation, and README quality checks.
---

# Project README

Use this skill to build README files from repository facts. README structure is selected by the primary reader and their first successful action, not by language ecosystem alone.

## Workflow

1. Inspect the repository before writing:

   ```bash
   SCRIPT=$(find ~ -maxdepth 8 -name "inspect.py" -path "*/project-readme/scripts/*" 2>/dev/null | head -1)
   [ -n "$SCRIPT" ] && python3 "$SCRIPT" . || echo "Script not found; inspect manifests and repo facts manually."
   ```

2. Use the inspector output:
   - `ecosystem` controls install commands, package metadata, badges, dev commands, and language-specific examples.
   - `readme_type` controls structure, first screen, section order, and reader journey.
   - `readme_type_candidates` is the ambiguity set. If `readme_type` is `unknown` and candidates exist, ask one clarifying question based on the candidate first actions. If work must proceed without an answer, choose the type whose first successful action is best supported by repo facts.
   - `agent_skills` lists detected skill files and plugin manifests when `readme_type` is `agent-skill`; use it to build collection indexes and validation sections.

3. Load only the needed modules:
   - Ecosystem: `ecosystems/<ecosystem>.md`, or each ecosystem when `ecosystem` is `mixed`.
   - Type: `project-types/<readme_type>.md`.
   - Shared ordering: `references/section-order.md`.
   - Badges: `references/badge-patterns.md`.
   - Validation rules: `references/validation.md`.
   - Section modules in `sections/` only for sections the README will include.

4. Compose the README from facts. Preserve true content from source files, existing README, docs, examples, tests, manifests, workflows, license files, and env examples. Do not invent package names, APIs, badges, deploy URLs, metrics, model performance, dataset size, support contacts, registry status, or roadmap claims.

5. Keep the first screen short. It must answer:
   - What is this?
   - Who is it for?
   - What is the fastest real thing the reader can do?

6. Validate before finishing:

   ```bash
   SCRIPT=$(find ~ -maxdepth 8 -name "validate.py" -path "*/project-readme/scripts/*" 2>/dev/null | head -1)
   [ -n "$SCRIPT" ] && python3 "$SCRIPT" README.md --repo . || echo "Validator not found; check manually against references/validation.md."
   ```

## Core Rules

- Do not treat language ecosystem as README type. A Node repo may be a library, CLI, web app, GitHub Action, VS Code extension, MCP server, docs site, template, or monorepo.
- Dockerfile is a deployment signal unless the container image is clearly the product.
- Badges are emitted only when the corresponding fact is real.
- Commands must match the detected package manager and existing scripts.
- Code examples must match real exports, routes, commands, tools, charts, modules, datasets, models, or files.
- If a section is unsupported by repo facts, omit it or label it as a manual step the user must supply.

## README Types

Supported `readme_type` values:

`lib-or-sdk`, `cli`, `webapp`, `api-service`, `mcp-server`, `agent-skill`, `monorepo`, `docs-site`, `github-action`, `extension-plugin`, `container-image`, `terraform-module`, `helm-chart`, `model-card`, `dataset-card`, `research-code`, `template-starter`, `example-demo`, `spec-protocol`, `desktop-mobile-app`, `unknown`.

If `unknown`, create a conservative repository README: state observed facts, provide verified setup commands only, and avoid API, deployment, registry, or performance claims unless source files prove them.
