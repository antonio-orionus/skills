# PyPI

Use for repositories with `pyproject.toml`, `setup.py`, or `setup.cfg`.

## Source files

- `pyproject.toml`: `[project]`, scripts, dependencies, optional dependencies, build backend.
- Lockfiles and environments: `uv.lock`, `poetry.lock`, `requirements*.txt`, `Pipfile.lock`, `environment.yml`.
- Package source: `src/`, package directories, `tests/`, `examples/`.

## Commands

- Use the lockfile or environment manager (`uv`, Poetry, pipenv, conda, or pip) for repository development setup and test/build commands.
- For public or publishable Python packages, default to compact consumer install alternatives when they are standard for the package type: `python3 -m pip install`, `uv add`, `poetry add`, and for CLI tools `pipx install` or `uv tool install`.
- For CLI packages, document console scripts from `[project.scripts]`.
- For libraries, include import examples that match real package/module names.

## Do not invent

- PyPI badges unless registry publication is real or clearly intended.
- Public PyPI install alternatives for private packages or unpublished source-only apps.
- Package import names when only the distribution name is known; verify source modules.
- Virtual environment steps that conflict with existing tooling.
