# GitHub Project README Reference

Use this reference for GitHub repositories, applications, tools, documentation sites, examples, and hybrid package repositories.

## Discovery

Read these before writing GitHub-facing docs:

- Git remote: repository owner/name
- Existing README and docs: preserve useful facts and links
- `.github/workflows/`: CI badge candidates and canonical validation commands
- `Dockerfile`, `docker-compose.yml`, deployment configs, and app manifests
- `.env.example`, `.env.sample`, or config docs
- `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`
- Project entry points and tests

## Badge Rules

Use badges as proof, not decoration.

```markdown
[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/OWNER/REPO/branch/main/graph/badge.svg)](https://codecov.io/gh/OWNER/REPO)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

Avoid a badge that links to the same repository page the reader is already on. A deployment badge is useful when it points to a different surface, such as GitHub Pages, docs, npm, Docker Hub, or a hosted app.

## Recommended Project Sections

Use this order for a GitHub-first README:

1. Title and badges
2. Short overview
3. Key features
4. Live demo or docs link, if real
5. Quick start
6. Prerequisites
7. Installation
8. Configuration
9. Usage
10. Architecture or repository structure
11. Development workflow
12. Testing and quality checks
13. Deployment
14. Troubleshooting
15. Reporting issues
16. Contributing
17. License
18. Acknowledgements/contact

## Repository Structure Pattern

Show the useful shape of the repo, not every file.

````markdown
## Repository Structure

```text
repo-name/
├── src/                 # Runtime source
├── tests/               # Automated tests
├── docs/                # Documentation
├── examples/            # Runnable examples
├── package.json         # Package metadata and scripts
└── README.md            # Project overview
```
````

Keep structure diagrams to about 10-25 lines unless the repo itself is a framework or template where structure is the product.

## Issue Reporting Pattern

```markdown
## Reporting Issues

Open a GitHub issue with:

- A short description of the problem or request
- Steps to reproduce, when relevant
- Expected and actual behavior
- Environment details
- Screenshots or logs, when useful
```

## Docs Site and Metrics Pattern

If the repository is an MkDocs, docs, learning-content, or generated-book project, prefer existing metrics files. Do not re-derive counts by hand when a generated metrics file exists.

Common files:

- `mkdocs.yml`: site name, URL, repo URL, nav, theme
- `docs/learning-graph/book-metrics.json`: canonical book metrics
- `book-metadata.json`: title, author, repository URL, license

If metrics are available, present them in a compact table and label them clearly. If metrics are not available, omit the table or use simple observable facts such as major docs directories.

## Deployment Pattern

Only document deployment targets found in the repo or existing docs. Examples:

- `mkdocs gh-deploy` for MkDocs/GitHub Pages projects
- Docker commands when `Dockerfile` or Compose files exist
- Vercel/Netlify/Railway/Fly.io only when config files or docs reference them

When no deployment path exists, omit deployment or add a brief "Deployment is project-specific" note only if deployment is central to the README.
