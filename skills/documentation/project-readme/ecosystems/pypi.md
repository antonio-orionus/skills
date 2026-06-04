# PyPI

Use for repositories with `pyproject.toml`, `setup.py`, or `setup.cfg`.

## Source files

- `pyproject.toml`: `[project]`, scripts, dependencies, optional dependencies, build backend.
- Lockfiles and environments: `uv.lock`, `poetry.lock`, `requirements*.txt`, `Pipfile.lock`, `environment.yml`.
- Package source: `src/`, package directories, `tests/`, `examples/`.

## Commands

- Prefer `uv` when `uv.lock` exists, Poetry when `poetry.lock` exists, otherwise use `python3 -m pip`.
- For CLI packages, document console scripts from `[project.scripts]`.
- For libraries, include import examples that match real package/module names.

## Do not invent

- PyPI badges unless registry publication is real or clearly intended.
- Package import names when only the distribution name is known; verify source modules.
- Virtual environment steps that conflict with existing tooling.
