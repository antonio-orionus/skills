# NPM Package README Reference

Use this reference for JavaScript/TypeScript packages, CLI packages, libraries, SDKs, and publishable package repositories.

## Discovery

Read these files before writing package-facing docs:

- `package.json`: `name`, `description`, `version`, `type`, `main`, `module`, `types`, `exports`, `bin`, `files`, `engines`, `scripts`, `keywords`, `repository`, `license`, `peerDependencies`
- Lockfile: choose `npm`, `pnpm`, `yarn`, or `bun` commands from the lockfile
- Source entry points: `src/index.*`, `src/cli.*`, package export targets, examples, tests
- Existing docs: `docs/`, `examples/`, `CHANGELOG.md`, `CONTRIBUTING.md`

## Package Badge Templates

Use badges only when the underlying fact is real.

```markdown
[![npm version](https://img.shields.io/npm/v/PACKAGE.svg)](https://www.npmjs.com/package/PACKAGE)
[![npm downloads](https://img.shields.io/npm/dm/PACKAGE.svg)](https://www.npmjs.com/package/PACKAGE)
[![CI](https://github.com/OWNER/REPO/actions/workflows/WORKFLOW.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/WORKFLOW.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
```

For scoped packages, keep the scoped name in both the npm package URL and shields path, for example `@scope/name`.

## Recommended Package Sections

Use this order for a package-first README:

1. Title and badges
2. One-sentence value proposition
3. Features
4. Quick start
5. Installation
6. Usage
7. API reference or CLI reference
8. Configuration
9. Examples
10. TypeScript
11. Compatibility and requirements
12. Development
13. Troubleshooting
14. Changelog
15. Contributing
16. License
17. Support

## Installation Patterns

Choose commands from the detected package manager. For library consumption:

```bash
npm install PACKAGE
pnpm add PACKAGE
yarn add PACKAGE
bun add PACKAGE
```

For source development:

```bash
git clone https://github.com/OWNER/REPO.git
cd REPO
npm install
npm run build
npm test
```

Do not list all package managers if the repository clearly standardizes on one package manager for development. It is fine to list multiple consumer install commands when the package is published.

## Usage Patterns

For libraries, include the smallest working import:

```ts
import { createClient } from "package-name";

const client = createClient({ apiKey: process.env.API_KEY });
const result = await client.run();
```

For CLIs, include `npx` or installed binary usage:

```bash
npx package-name --help
package-name input --flag value
```

For default exports, CommonJS, ESM-only packages, or subpath exports, match the codebase exactly. Do not guess import names.

## API Reference Pattern

Document only public APIs that are visible in exports, README examples, generated types, docs, or tests.

```markdown
### `createClient(options)`

Creates a client.

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `apiKey` | `string` | Yes | - | API key used for requests. |

Returns: `Client`
```

## Development Sections

Include commands from `package.json` scripts:

```markdown
## Development

| Command | Description |
|---------|-------------|
| `npm run build` | Build the package. |
| `npm test` | Run tests. |
| `npm run lint` | Run lint checks. |
```

Only include scripts that exist. If scripts are unclear, say what they run rather than what you hope they do.
