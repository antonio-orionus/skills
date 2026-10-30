# Cargo

Use for Rust repositories with `Cargo.toml`.

## Source files

- `Cargo.toml`: package metadata, workspace members, bins, examples, features.
- `src/lib.rs`, `src/main.rs`, `examples/`, `tests/`, benches.
- `Cargo.lock` when present.

## Commands

- Use `cargo build`, `cargo test`, `cargo run`, or `cargo install` only when supported by the package type.
- For libraries, show a dependency snippet and a minimal `use` example backed by `src/lib.rs`.
- For CLIs, include `cargo install` only for publishable crates or release binaries when supported.

## Do not invent

- crates.io badges unless the crate is real or clearly publishable.
- Feature flags not present in `Cargo.toml`.
- Command output not demonstrated by tests, examples, or source.
