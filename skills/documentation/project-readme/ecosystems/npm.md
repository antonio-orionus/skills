# npm

Use for repositories with `package.json`.

## Source files

- `package.json`: name, description, version, private, scripts, bin, exports, types, engines, dependencies.
- Lockfiles: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`.
- TypeScript: `tsconfig.json`, `types`, `typings`, declaration files.

## Commands

- Match the package manager from the lockfile: `pnpm`, `npm`, `yarn`, or `bun`.
- Use existing scripts for development, test, build, lint, docs, and start commands.
- For publishable packages, install examples can use the registry package name only when the package is not clearly private.

## Do not invent

- npm badges for private packages or repos without a real package name.
- Exported APIs not backed by `exports`, entry files, docs, or examples.
- Framework-specific commands unless dependencies or scripts support them.
