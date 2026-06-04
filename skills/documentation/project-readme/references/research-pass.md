# README Research Pass

Use for every `rewrite` and for `update/improve` requests where the README may be stale, incomplete, wrong, or under-positioned.

## Rule

The existing README is context, not source of truth. Keep useful verified content, but derive the final README from project evidence.

## Internal Evidence Checklist

- Manifests and package metadata: names, descriptions, scripts, exports, bins, engines, dependencies, workspace members, license, author/copyright credentials, and publication intent.
- Source surfaces: public modules, CLIs, routes, tools, schemas, charts, models, datasets, plugin manifests, or skill metadata.
- Working examples: examples, tests, snapshots, docs, generated references, sample configs, and demo files.
- Operations evidence: workflows, Docker/compose files, deployment configs, env examples, release artifacts, and build/test scripts.
- Existing docs: source docs, issue templates, changelogs, release notes, ADRs, and comments that explain supported behavior.

## Rewrite Process

- Identify the primary reader and first successful action from repo facts before writing.
- Compare old README claims against the evidence checklist.
- Remove, qualify, or replace unsupported claims instead of improving their wording.
- Fill missing important facts when the repo proves them, even if the old README omitted them.
- Keep old prose only when it is accurate, useful, and still matches the current project shape.

## Output Standard

The rewritten README should let the reader decide whether the project is for them and complete the first real action without opening source files.
