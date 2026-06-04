# Badge Patterns

Badges are optional. Use them only when the underlying fact is real.

## Registry

- npm: package is public or clearly intended for npm publication.
- PyPI: project has real publication metadata or existing PyPI link.
- crates.io: crate name is known and publication is real or intended.
- RubyGems: gemspec supports a real gem.
- pkg.go.dev: Go module path is known.

## Repository

- CI: include only for existing files in `.github/workflows/`.
- License: include only when a license file or SPDX license field exists.
- Release: include only when GitHub slug is known.

## Avoid

- Badges that link a repo back to itself without adding information.
- Download, coverage, quality, security, or status badges unless source files prove them.
- Badges for the wrong ecosystem in mixed or native projects.
