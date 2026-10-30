# README Reader Context

Use this as an overlay on top of `readme_type` when the audience or repository purpose changes the reader journey.

## OSS

- Primary readers are users and potential contributors.
- Include install, usage, examples, contribution path, license, and support/status only when files prove them.
- Badges are useful when backed by real workflows, registries, releases, or license files.

## Personal

- Primary readers are future maintainers, portfolio viewers, or the author returning later.
- Emphasize what it does, why it exists, how to run it, notable decisions, and maintenance notes.
- Keep claims modest unless the repo proves production use or external adoption.

## Internal

- Primary readers are teammates, operators, and new maintainers.
- Emphasize local setup, environment, architecture map, operational notes, ownership, and runbooks when source files prove them.
- Avoid public registry, support, or contribution assumptions unless internal docs prove them.

## Config

- Primary readers are future maintainers trying to understand why files exist.
- Emphasize what is here, where it is installed, how to extend it, dependencies, gotchas, and backup/restore paths.
- Installation may be unnecessary; usage can be a short location and purpose map.

## Last Reviewed

- Preserve and update a "Last reviewed" date only when the README already uses one or the repo is internal/config-style and stale operational guidance is likely.
- Do not add a date to every README by default.
