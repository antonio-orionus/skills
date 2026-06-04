---
name: project-readme
description: Create, rewrite, update, improve, or validate truthful README.md files for any project archetype. Use for libraries, SDKs, CLIs, web apps, API services, MCP servers, agent skills, monorepos, docs sites, GitHub Actions, extensions, container images, Terraform modules, Helm charts, model cards, dataset cards, research code, templates, demos, specs, desktop/mobile apps, badges, quick starts, setup docs, API or command references, README validation, and README quality checks.
---

# Project README

Use this skill to build README files from repository facts. README structure is selected by the primary reader and their first successful action, not by language ecosystem alone.

## Workflow

1. Classify the request:
   - `create`: no README or user asks for a new README.
   - `rewrite`: user asks for a full rewrite or replacement.
   - `update/improve`: user asks to improve, refresh, polish, fix, or update an existing README or package metadata.
   - `validate`: user asks only to check, audit, review, or validate.

2. Inspect the repository before writing:

   ```bash
   SCRIPT=$(find ~ -maxdepth 8 -name "inspect.py" -path "*/project-readme/scripts/*" 2>/dev/null | head -1)
   [ -n "$SCRIPT" ] && python3 "$SCRIPT" . || echo "Script not found; inspect manifests and repo facts manually."
   ```

3. Use the inspector output:
   - `ecosystem` controls install commands, package metadata, badges, dev commands, and language-specific examples.
   - `readme_type` controls structure, first screen, section order, and reader journey.
   - `readme_type_candidates` is the ambiguity set. If `readme_type` is `unknown` and candidates exist, ask one clarifying question based on the candidate first actions. If work must proceed without an answer, choose the type whose first successful action is best supported by repo facts.
   - `agent_skills` lists detected skill files and plugin manifests when `readme_type` is `agent-skill`; use it to build collection indexes and validation sections.
   - `media_assets` lists detected logo, icon, banner, or screenshot candidates; use them only when they clearly represent the project.
   - `readme_variants` lists sibling README variants for multilingual workflows.

4. Load only the needed modules:
   - Ecosystem: `ecosystems/<ecosystem>.md`, or each ecosystem when `ecosystem` is `mixed`.
   - Type: `project-types/<readme_type>.md`.
   - Shared ordering: `references/section-order.md`.
   - Badges: `references/badge-patterns.md`.
   - Validation rules: `references/validation.md`.
   - Writing improvement: `references/writing-improvement.md` for `update/improve`, `rewrite`, or README quality requests.
   - Research pass: `references/research-pass.md` for every `rewrite` and for stale/incomplete README improvement work.
   - Positioning: `references/positioning.md` when the user asks for comparison, repo docs name alternatives, or public incumbents are obvious.
   - Reader context: `references/reader-context.md` when audience context matters or the README is OSS, personal, internal, or config-oriented.
   - Markdown mechanics: `references/markdown-mechanics.md` when changing links, anchors, tables, alerts, code fences, images, or README variants.
   - Section modules in `sections/` only for sections the README will include.

5. For `rewrite`, run a project research pass before drafting. Treat the old README as context only: it may be stale, incomplete, wrong, or missing important capabilities. Derive claims from manifests, exports, source files, examples, tests, docs, workflows, releases, package metadata, and other repository evidence.

6. For `update/improve`, diagnose before editing. Read the existing README and any in-scope metadata such as `package.json`, then identify concrete issues in reader fit, first-screen clarity, stale claims, examples/API usefulness, navigation, and metadata alignment. Make targeted edits based on that diagnosis; do not treat validation output as the improvement plan.

7. Compose from facts. Preserve true content from source files, existing README, docs, examples, tests, manifests, workflows, license files, and env examples. Do not invent package names, APIs, badges, deploy URLs, metrics, model performance, dataset size, support contacts, registry status, or roadmap claims.

8. Keep the first screen short. It must answer:
   - What is this?
   - Who is it for?
   - What is the fastest real thing the reader can do?

9. Validate before finishing:

   ```bash
   SCRIPT=$(find ~ -maxdepth 8 -name "validate.py" -path "*/project-readme/scripts/*" 2>/dev/null | head -1)
   if [ -n "$SCRIPT" ]; then
     python3 "$SCRIPT" README.md --repo .
   else
     echo "Validator not found; check manually against references/validation.md."
   fi
   ```

## Core Rules

- Do not treat language ecosystem as README type. A Node repo may be a library, CLI, web app, GitHub Action, VS Code extension, MCP server, docs site, template, or monorepo.
- Dockerfile is a deployment signal unless the container image is clearly the product.
- Badges are emitted only when the corresponding fact is real.
- Development commands must match the detected package manager and existing scripts; public registry install examples should default to correct alternatives for common package managers.
- Code examples must match real exports, routes, commands, tools, charts, modules, datasets, models, or files.
- README rewrites always require internal project research before drafting; never assume the old README is accurate or complete.
- Incumbent comparisons must use cited external sources or repo-named alternatives; omit comparison sections when they would force guesswork.
- Multilingual README edits must preserve code, commands, paths, links, badges, and selectors unless the user explicitly asks to rewrite them.
- If a section is unsupported by repo facts, omit it or label it as a manual step the user must supply.
- Validation is the final truthfulness and mechanics check. It does not replace writing analysis for improvement requests.

## README Types

Supported `readme_type` values:

`lib-or-sdk`, `cli`, `webapp`, `api-service`, `mcp-server`, `agent-skill`, `monorepo`, `docs-site`, `github-action`, `extension-plugin`, `container-image`, `terraform-module`, `helm-chart`, `model-card`, `dataset-card`, `research-code`, `template-starter`, `example-demo`, `spec-protocol`, `desktop-mobile-app`, `unknown`.

If `unknown`, create a conservative repository README: state observed facts, provide verified setup commands only, and avoid API, deployment, registry, or performance claims unless source files prove them.
