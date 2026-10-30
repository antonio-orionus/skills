# Native

Use when no package ecosystem manifest is detected.

## Source files

- Build files: `Makefile`, `CMakeLists.txt`, `configure`, `meson.build`, `build.ninja`.
- Source and platform files: `src/`, `include/`, `bin/`, release scripts.
- Docs, examples, tests, and CI workflows.

## Commands

- Prefer verified build commands from existing build files.
- If no build system exists, document source layout and required manual steps instead of inventing a build.
- For release binaries, link only to real release artifacts.

## Do not invent

- Registry badges.
- Package manager install commands.
- Platform support beyond what source, CI, or docs prove.
