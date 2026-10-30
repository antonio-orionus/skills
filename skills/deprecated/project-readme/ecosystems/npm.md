# npm

Use for repositories with `package.json`.

## Source files

- `package.json`: name, description, version, private, scripts, bin, exports, types, engines, dependencies.
- Lockfiles: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`.
- TypeScript: `tsconfig.json`, `types`, `typings`, declaration files.

## Commands

- Use the lockfile package manager (`pnpm`, `npm`, `yarn`, or `bun`) for repository development commands such as install, test, build, lint, docs, and start.
- For public or publishable registry packages, default to a compact consumer install block with common package managers, such as `npm install`, `pnpm add`, `yarn add`, and `bun add`.
- Put the lockfile package manager first when ordering install alternatives, but do not remove existing correct alternatives just because the repo uses a different manager internally.
- For publishable packages, install examples can use the registry package name only when the package is not clearly private.

## Do not invent

- npm badges for private packages or repos without a real package name.
- Public registry install alternatives for private packages or unpublished source-only apps.
- Exported APIs not backed by `exports`, entry files, docs, or examples.
- Framework-specific commands unless dependencies or scripts support them.
