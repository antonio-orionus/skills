#!/usr/bin/env python3
"""Inspect repository facts useful for npm/GitHub README generation."""

from __future__ import annotations

import configparser
import json
import os
import pathlib
import re
import sys
from typing import Any


def read_json(path: pathlib.Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def detect_package_manager(root: pathlib.Path) -> str | None:
    checks = [
        ("pnpm-lock.yaml", "pnpm"),
        ("package-lock.json", "npm"),
        ("npm-shrinkwrap.json", "npm"),
        ("yarn.lock", "yarn"),
        ("bun.lockb", "bun"),
        ("bun.lock", "bun"),
    ]
    for filename, manager in checks:
        if (root / filename).exists():
            return manager
    return None


def parse_git_remote(root: pathlib.Path) -> dict[str, str] | None:
    config_path = root / ".git" / "config"
    if not config_path.exists():
        return None

    parser = configparser.ConfigParser()
    parser.read(config_path)
    section = 'remote "origin"'
    if section not in parser:
        return None

    url = parser[section].get("url", "")
    slug = None
    patterns = [
        r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?$",
        r"github\.com/(?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            slug = f"{match.group('owner')}/{match.group('repo')}"
            break
    return {"url": url, "github_slug": slug or ""}


def list_workflows(root: pathlib.Path) -> list[str]:
    workflow_dir = root / ".github" / "workflows"
    if not workflow_dir.is_dir():
        return []
    return sorted(
        str(path.relative_to(root))
        for path in workflow_dir.iterdir()
        if path.suffix in {".yml", ".yaml"}
    )


def detect_license(root: pathlib.Path, package: dict[str, Any] | None) -> dict[str, str]:
    files = []
    for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"):
        if (root / name).exists():
            files.append(name)
    value = ""
    if package and isinstance(package.get("license"), str):
        value = package["license"]
    return {"package": value, "files": ", ".join(files)}


def find_existing(paths: list[pathlib.Path], root: pathlib.Path) -> list[str]:
    return [str(path.relative_to(root)) for path in paths if path.exists()]


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    package = read_json(root / "package.json")
    package_manager = detect_package_manager(root)
    git_remote = parse_git_remote(root)

    result: dict[str, Any] = {
        "root": str(root),
        "name": root.name,
        "has_readme": (root / "README.md").exists(),
        "package_manager": package_manager,
        "git_remote": git_remote,
        "github_workflows": list_workflows(root),
        "license": detect_license(root, package),
        "files": find_existing(
            [
                root / "package.json",
                root / "tsconfig.json",
                root / "README.md",
                root / "CHANGELOG.md",
                root / "CONTRIBUTING.md",
                root / "SECURITY.md",
                root / ".env.example",
                root / ".env.sample",
                root / "Dockerfile",
                root / "docker-compose.yml",
                root / "mkdocs.yml",
            ],
            root,
        ),
        "directories": find_existing(
            [
                root / "src",
                root / "lib",
                root / "bin",
                root / "cli",
                root / "tests",
                root / "test",
                root / "docs",
                root / "examples",
            ],
            root,
        ),
    }

    if package:
        scripts = package.get("scripts") if isinstance(package.get("scripts"), dict) else {}
        result["package"] = {
            "name": package.get("name", ""),
            "description": package.get("description", ""),
            "version": package.get("version", ""),
            "private": package.get("private", False),
            "type": package.get("type", ""),
            "main": package.get("main", ""),
            "module": package.get("module", ""),
            "types": package.get("types") or package.get("typings", ""),
            "exports": package.get("exports", ""),
            "bin": package.get("bin", ""),
            "engines": package.get("engines", {}),
            "scripts": scripts,
            "dependencies": sorted((package.get("dependencies") or {}).keys()),
            "devDependencies": sorted((package.get("devDependencies") or {}).keys()),
            "peerDependencies": sorted((package.get("peerDependencies") or {}).keys()),
        }

    json.dump(result, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write(os.linesep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
