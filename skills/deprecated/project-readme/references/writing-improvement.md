# README Writing Improvement

Use for `update/improve`, `rewrite`, and README quality requests. Run this before validation.

## Diagnosis Pass

- Identify the primary reader and the first successful action they need.
- Check the first screen: name, positioning, audience, and fastest real start path should be clear without scrolling far.
- Find stale or unsupported claims by comparing the README with manifests, exports, examples, tests, docs, workflows, and release notes.
- Judge examples by usefulness: they should show a real install/run/import path, a real API or command, and expected result when helpful.
- Check structure and navigation: section order should match the project type, long READMEs need a useful table of contents, and repeated sections should be merged.
- If `package.json` is in scope, align `description`, `keywords`, `bin`, `exports`, `engines`, and scripts with the README and actual package behavior.

## Edit Rules

- Improve prose and reader flow without changing verified technical meaning.
- Prefer specific, concrete value propositions over generic praise.
- Preserve working commands, code fences, links, badges, tables, HTML wrappers, and Markdown comments unless they are wrong.
- Remove or qualify unsupported claims instead of making them sound better.
- Keep existing useful content; do not rewrite the whole file when targeted edits solve the problem.

## Package Metadata

- `description`: one sentence, concrete product category plus primary value, no marketing filler.
- `keywords`: include terms users would search for; remove duplicates, private jargon, and stale ecosystem claims.
- Development scripts documented in README must exist and match the detected package manager.
- Public registry install examples should not be narrowed to the repo's development package manager when other standard consumer tools apply.
- Registry or badge claims must be backed by real publication intent or existing metadata.

## Final Check

- The README should let the reader decide "is this for me?" and complete the first real action without opening source files.
- Run validation after the writing pass; treat remaining validation output as mechanics/truthfulness feedback.
