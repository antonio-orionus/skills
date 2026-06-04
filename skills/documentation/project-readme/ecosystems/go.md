# Go

Use for repositories with `go.mod`.

## Source files

- `go.mod`: module path and dependencies.
- `cmd/`, package directories, `internal/`, tests, examples.
- `go.work` for workspaces.

## Commands

- Use `go test ./...` for testable modules.
- Use `go install module/cmd/name@version` only when a command package exists.
- For libraries, show `go get` and import examples using the module path.

## Do not invent

- pkg.go.dev badges or links unless the module path is known.
- CLI install commands for repos without `cmd/` or a main package.
- API examples not supported by exported identifiers or examples.
