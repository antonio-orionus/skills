# Install

Write install instructions from the detected ecosystem and package facts.

- Registry package: show install commands using the real package name. When an ecosystem has multiple common consumer tools and the package is public or clearly intended for registry publication, default to compact alternatives that are standard and correct.
- Source project: show clone plus dependency install only when scripts/manifests support it, using the detected lockfile package manager for local development setup.
- Private package: avoid public registry commands unless existing docs prove the internal registry.
- Native project: use build files or documented release artifacts.

Keep install separate from usage when installation is more than one command.
