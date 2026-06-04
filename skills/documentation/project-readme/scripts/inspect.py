#!/usr/bin/env python3
"""Unified multi-ecosystem repository inspector for README generation."""

from __future__ import annotations

import configparser
import json
import os
import pathlib
import re
import sys
import tomllib
from typing import Any


README_TYPES = [
    "monorepo",
    "agent-skill",
    "github-action",
    "mcp-server",
    "terraform-module",
    "helm-chart",
    "docs-site",
    "model-card",
    "dataset-card",
    "research-code",
    "spec-protocol",
    "template-starter",
    "example-demo",
    "extension-plugin",
    "desktop-mobile-app",
    "webapp",
    "api-service",
    "container-image",
    "cli",
    "lib-or-sdk",
]

TYPE_TO_SIGNAL = {
    "agent-skill": "agent_skill",
    "github-action": "github_action",
    "mcp-server": "mcp_server",
    "terraform-module": "terraform_module",
    "helm-chart": "helm_chart",
    "docs-site": "docs_site",
    "model-card": "model_card",
    "dataset-card": "dataset_card",
    "research-code": "research_code",
    "spec-protocol": "spec_protocol",
    "template-starter": "template_starter",
    "extension-plugin": "extension_plugin",
    "desktop-mobile-app": "desktop_mobile_app",
    "api-service": "api_service",
    "container-image": "container_image",
    "lib-or-sdk": "lib_or_sdk",
}

TYPE_CONTEXT = {
    "lib-or-sdk": (
        "developer consuming the package or SDK",
        "install the package and import it in a minimal example",
        "lib",
        "registry-package",
        "registry",
    ),
    "cli": (
        "operator or developer running the command",
        "install or run the command once with a real argument",
        "cli",
        "registry-package",
        "registry",
    ),
    "webapp": (
        "developer or operator running a user-facing application",
        "run the app locally and open it in a browser",
        "app",
        "source",
        "source",
    ),
    "api-service": (
        "developer integrating with or operating the API",
        "start the service locally and make one successful request",
        "service",
        "source",
        "source",
    ),
    "mcp-server": (
        "AI-client user or developer connecting an MCP client",
        "configure an MCP client and call one listed tool",
        "mcp",
        "mcp-server",
        "registry",
    ),
    "agent-skill": (
        "agent user or maintainer installing a skill",
        "install the skill and trigger it with a representative request",
        "skill",
        "agent-skill",
        "source",
    ),
    "monorepo": (
        "developer navigating a multi-package workspace",
        "identify the relevant package and run its local setup command",
        "monorepo",
        "workspace",
        "source",
    ),
    "docs-site": (
        "reader or maintainer of a documentation site",
        "run or build the docs site locally",
        "docs",
        "docs-site",
        "source",
    ),
    "github-action": (
        "GitHub Actions user adding the action to a workflow",
        "paste a workflow snippet using uses: owner/repo@vX",
        "action",
        "github-action",
        "releases",
    ),
    "extension-plugin": (
        "user installing an extension into a host platform",
        "install the extension into the host and activate one feature",
        "extension",
        "extension",
        "registry",
    ),
    "container-image": (
        "operator running a packaged container image",
        "run the image with the minimal required command or compose file",
        "container",
        "container-image",
        "docker",
    ),
    "terraform-module": (
        "infrastructure engineer consuming a Terraform module",
        "copy a module block and run terraform init and plan",
        "iac",
        "terraform-module",
        "registry",
    ),
    "helm-chart": (
        "Kubernetes operator installing a Helm chart",
        "run helm install with minimal values",
        "chart",
        "helm-chart",
        "registry",
    ),
    "model-card": (
        "researcher or developer evaluating a model",
        "load the model and run one inference or evaluation",
        "model",
        "model",
        "source",
    ),
    "dataset-card": (
        "researcher or developer evaluating a dataset",
        "load a split or sample and understand schema and license",
        "dataset",
        "dataset",
        "source",
    ),
    "research-code": (
        "researcher reproducing results",
        "reproduce a table, figure, metric, or experiment",
        "research",
        "source",
        "source",
    ),
    "template-starter": (
        "developer starting a new project from a template",
        "generate a new project and customize placeholders",
        "template",
        "template",
        "source",
    ),
    "example-demo": (
        "developer learning from a working example",
        "run the demo and inspect the key source files",
        "example",
        "source",
        "source",
    ),
    "spec-protocol": (
        "implementer or validator of a protocol or specification",
        "understand the spec and run or inspect conformance checks",
        "spec",
        "specification",
        "source",
    ),
    "desktop-mobile-app": (
        "developer building or running an app on a target platform",
        "build or run the app on the target platform",
        "app",
        "application",
        "releases",
    ),
    "unknown": (
        "reader evaluating the repository",
        "inspect the repository and choose the supported setup path",
        "unknown",
        "source",
        "source",
    ),
}


def read_json(path: pathlib.Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def read_text(path: pathlib.Path, limit: int | None = None) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except (FileNotFoundError, UnicodeDecodeError):
        return ""
    return text[:limit] if limit else text


def read_toml(path: pathlib.Path) -> dict[str, Any]:
    try:
        with path.open("rb") as handle:
            data = tomllib.load(handle)
    except (FileNotFoundError, tomllib.TOMLDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def detect_ecosystems(root: pathlib.Path) -> list[str]:
    found: set[str] = set()
    if (root / "package.json").exists():
        found.add("npm")
    if (root / "pyproject.toml").exists() or (root / "setup.py").exists() or (root / "setup.cfg").exists():
        found.add("pypi")
    if (root / "Cargo.toml").exists():
        found.add("cargo")
    if (root / "go.mod").exists():
        found.add("go")
    if any(root.glob("*.gemspec")) or (root / "Gemfile").exists():
        found.add("rubygems")
    return sorted(found)


def detect_package_manager(root: pathlib.Path, ecosystems: list[str]) -> str | None:
    checks = [
        ("pnpm-lock.yaml", "pnpm"),
        ("package-lock.json", "npm"),
        ("npm-shrinkwrap.json", "npm"),
        ("yarn.lock", "yarn"),
        ("bun.lockb", "bun"),
        ("bun.lock", "bun"),
        ("uv.lock", "uv"),
        ("poetry.lock", "poetry"),
        ("Pipfile.lock", "pipenv"),
        ("Cargo.lock", "cargo"),
        ("go.sum", "go"),
        ("Gemfile.lock", "bundler"),
    ]
    for filename, manager in checks:
        if (root / filename).exists():
            return manager
    if "npm" in ecosystems:
        return "npm"
    if "pypi" in ecosystems:
        return "pip"
    if "cargo" in ecosystems:
        return "cargo"
    if "go" in ecosystems:
        return "go"
    if "rubygems" in ecosystems:
        return "bundler"
    return None


def dependencies_from_package_json(package: dict[str, Any]) -> set[str]:
    deps: set[str] = set()
    for key in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        value = package.get(key)
        if isinstance(value, dict):
            deps.update(value.keys())
    return deps


def python_dependencies(pyproject: dict[str, Any]) -> set[str]:
    deps: set[str] = set()
    project = pyproject.get("project")
    if isinstance(project, dict):
        for value in project.get("dependencies") or []:
            if isinstance(value, str):
                deps.add(re.split(r"[<>=~! ;\[]", value, maxsplit=1)[0].lower())
        optional = project.get("optional-dependencies")
        if isinstance(optional, dict):
            for items in optional.values():
                for value in items or []:
                    if isinstance(value, str):
                        deps.add(re.split(r"[<>=~! ;\[]", value, maxsplit=1)[0].lower())
    poetry = pyproject.get("tool", {}).get("poetry", {}) if isinstance(pyproject.get("tool"), dict) else {}
    if isinstance(poetry, dict):
        for key in ("dependencies", "dev-dependencies"):
            value = poetry.get(key)
            if isinstance(value, dict):
                deps.update(k.lower() for k in value if k.lower() != "python")
    return deps


def has_any(root: pathlib.Path, names: list[str]) -> bool:
    return any((root / name).exists() for name in names)


def has_glob(root: pathlib.Path, pattern: str) -> bool:
    return any(root.glob(pattern))


def relative_paths(root: pathlib.Path, pattern: str) -> list[str]:
    return sorted(str(path.relative_to(root)) for path in root.glob(pattern))


def source_text_sample(root: pathlib.Path, suffixes: set[str], limit: int = 120_000) -> str:
    ignored_parts = {
        "node_modules",
        "vendor",
        "dist",
        "build",
        "target",
        "__pycache__",
        ".git",
        "test",
        "tests",
        "__tests__",
        "fixtures",
    }
    chunks: list[str] = []
    total = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in suffixes:
            continue
        rel = path.relative_to(root)
        if any(part in ignored_parts or part.startswith(".") for part in rel.parts[:-1]):
            continue
        text = read_text(path, limit=20_000)
        if not text:
            continue
        chunks.append(text)
        total += len(text)
        if total >= limit:
            break
    return "\n".join(chunks)


def detect_media_assets(root: pathlib.Path) -> list[str]:
    image_suffixes = {".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico"}
    keywords = ("logo", "icon", "banner", "hero", "screenshot", "cover", "brand", "mark")
    ignored_parts = {"node_modules", "vendor", "dist", "build", "target", "__pycache__"}
    assets: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in image_suffixes:
            continue
        rel = path.relative_to(root)
        if any(part in ignored_parts or part.startswith(".") for part in rel.parts[:-1]):
            continue
        lowered = str(rel).lower()
        if any(keyword in lowered for keyword in keywords):
            assets.append(str(rel))
    return sorted(assets)


def readme_variants(root: pathlib.Path) -> list[str]:
    variants = [
        path.name
        for path in root.iterdir()
        if path.is_file()
        and path.suffix.lower() == ".md"
        and path.name.lower().startswith("readme")
    ]
    return sorted(variants, key=str.lower)


def detect_spdx_from_license_text(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text[:4000]).strip().lower()
    if not normalized:
        return ""
    if "mit license" in normalized or normalized == "mit":
        return "MIT"
    if "apache license" in normalized and "version 2.0" in normalized:
        return "Apache-2.0"
    if "gnu general public license" in normalized and "version 3" in normalized:
        return "GPL-3.0"
    if "gnu general public license" in normalized and "version 2" in normalized:
        return "GPL-2.0"
    if "bsd 3-clause" in normalized or "redistribution and use in source and binary forms" in normalized and "neither the name" in normalized:
        return "BSD-3-Clause"
    if "bsd 2-clause" in normalized or "redistribution and use in source and binary forms" in normalized and "contributors may be used" not in normalized:
        return "BSD-2-Clause"
    return ""


def copyright_from_license_text(text: str) -> dict[str, str]:
    for line in text.splitlines()[:40]:
        match = re.search(
            r"copyright\s*(?:\(c\)|\u00a9)?\s*(?P<year>\d{4}(?:\s*[-,]\s*\d{4})?)?\s*(?P<holder>.+)",
            line,
            flags=re.IGNORECASE,
        )
        if not match:
            continue
        holder = re.sub(r"\s+", " ", match.group("holder")).strip(" .")
        year = re.sub(r"\s+", " ", match.group("year") or "").strip()
        if holder:
            return {
                "notice": re.sub(r"\s+", " ", line).strip(),
                "year": year,
                "holder": holder,
            }
    return {"notice": "", "year": "", "holder": ""}


def author_names(package: dict[str, Any], pyproject: dict[str, Any], cargo: dict[str, Any]) -> list[str]:
    names: list[str] = []

    def add_author(value: Any) -> None:
        if isinstance(value, str):
            name = value.split("<", 1)[0].strip()
        elif isinstance(value, dict):
            name = str(value.get("name") or "").strip()
        else:
            name = ""
        if name and name not in names:
            names.append(name)

    add_author(package.get("author"))
    maintainers = package.get("maintainers")
    if isinstance(maintainers, list):
        for maintainer in maintainers:
            add_author(maintainer)

    project = pyproject.get("project") if isinstance(pyproject.get("project"), dict) else {}
    authors = project.get("authors")
    if isinstance(authors, list):
        for author in authors:
            add_author(author)
    maintainers = project.get("maintainers")
    if isinstance(maintainers, list):
        for maintainer in maintainers:
            add_author(maintainer)

    cargo_package = cargo.get("package") if isinstance(cargo.get("package"), dict) else {}
    authors = cargo_package.get("authors")
    if isinstance(authors, list):
        for author in authors:
            add_author(author)

    return names


def parse_skill_frontmatter(path: pathlib.Path) -> dict[str, str]:
    text = read_text(path, limit=4000)
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    frontmatter = text[3:end].strip()
    values: dict[str, str] = {}
    for line in frontmatter.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        if key in {"name", "description"}:
            values[key] = value.strip().strip("\"'")
    return values


def agent_skill_inventory(root: pathlib.Path) -> dict[str, Any]:
    skill_paths = sorted(
        path
        for path in root.rglob("SKILL.md")
        if path.is_file()
        and ".git" not in path.parts
        and not any(part.startswith(".") for part in path.relative_to(root).parts[:-1])
    )
    skills: list[dict[str, str]] = []
    for path in skill_paths:
        metadata = parse_skill_frontmatter(path)
        skills.append(
            {
                "path": str(path.relative_to(root)),
                "name": metadata.get("name", path.parent.name),
                "description": metadata.get("description", ""),
            }
        )
    plugin_manifests = [
        path
        for path in (root / ".claude-plugin" / "plugin.json", root / ".codex-plugin" / "plugin.json")
        if path.exists()
    ]
    return {
        "count": len(skills),
        "files": [skill["path"] for skill in skills],
        "skills": skills,
        "is_collection": len(skills) > 1 or (root / "skills").is_dir(),
        "plugin_manifests": [str(path.relative_to(root)) for path in plugin_manifests],
    }


def parse_git_remote(root: pathlib.Path) -> str:
    config_path = root / ".git" / "config"
    if not config_path.exists():
        return ""
    parser = configparser.ConfigParser()
    parser.read(config_path)
    section = 'remote "origin"'
    if section not in parser:
        return ""
    url = parser[section].get("url", "")
    patterns = [
        r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?$",
        r"github\.com/(?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return f"{match.group('owner')}/{match.group('repo')}"
    return ""


def list_workflows(root: pathlib.Path) -> list[str]:
    workflow_dir = root / ".github" / "workflows"
    if not workflow_dir.is_dir():
        return []
    return sorted(
        str(path.relative_to(root))
        for path in workflow_dir.iterdir()
        if path.suffix in {".yml", ".yaml"}
    )


def detect_license(root: pathlib.Path, package: dict[str, Any], pyproject: dict[str, Any], cargo: dict[str, Any]) -> dict[str, Any]:
    files = [
        name
        for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING")
        if (root / name).exists()
    ]
    license_id = ""
    copyright_info = {"notice": "", "year": "", "holder": ""}
    if isinstance(package.get("license"), str):
        license_id = package["license"]
    elif isinstance(pyproject.get("project"), dict):
        license_value = pyproject["project"].get("license")
        if isinstance(license_value, str):
            license_id = license_value
        elif isinstance(license_value, dict):
            license_id = license_value.get("text", "") or license_value.get("file", "")
    elif isinstance(cargo.get("package"), dict):
        license_id = cargo["package"].get("license", "")
    if not license_id:
        for name in files:
            text = read_text(root / name)
            license_id = detect_spdx_from_license_text(text)
            if license_id:
                break
    for name in files:
        copyright_info = copyright_from_license_text(read_text(root / name))
        if copyright_info["holder"]:
            break
    authors = author_names(package, pyproject, cargo)
    holder = copyright_info["holder"] or (authors[0] if authors else "")
    return {
        "id": license_id,
        "files": files,
        "copyright_notice": copyright_info["notice"],
        "copyright_year": copyright_info["year"],
        "copyright_holder": holder,
        "authors": authors,
    }


def workspace_members(root: pathlib.Path, package: dict[str, Any], pyproject: dict[str, Any], cargo: dict[str, Any]) -> list[str]:
    members: set[str] = set()
    workspaces = package.get("workspaces")
    if isinstance(workspaces, list):
        members.update(str(item) for item in workspaces)
    elif isinstance(workspaces, dict):
        packages = workspaces.get("packages")
        if isinstance(packages, list):
            members.update(str(item) for item in packages)
    if isinstance(cargo.get("workspace"), dict):
        for item in cargo["workspace"].get("members") or []:
            members.add(str(item))
    tool = pyproject.get("tool")
    if isinstance(tool, dict):
        uv_workspace = tool.get("uv", {}).get("workspace", {}) if isinstance(tool.get("uv"), dict) else {}
        if isinstance(uv_workspace, dict):
            for item in uv_workspace.get("members") or []:
                members.add(str(item))
    if (root / "go.work").exists():
        members.add("go.work")
    return sorted(members)


def package_metadata(root: pathlib.Path, ecosystems: list[str], package: dict[str, Any], pyproject: dict[str, Any], cargo: dict[str, Any]) -> dict[str, Any]:
    project = pyproject.get("project") if isinstance(pyproject.get("project"), dict) else {}
    scripts = project.get("scripts") if isinstance(project.get("scripts"), dict) else {}
    cargo_package = cargo.get("package") if isinstance(cargo.get("package"), dict) else {}

    name = package.get("name") or project.get("name") or cargo_package.get("name") or root.name
    version = package.get("version") or project.get("version") or cargo_package.get("version") or ""
    description = package.get("description") or project.get("description") or cargo_package.get("description") or ""

    go_mod = read_text(root / "go.mod", limit=512)
    if "go" in ecosystems and not package and not project and not cargo_package:
        match = re.search(r"^module\s+(.+)$", go_mod, flags=re.MULTILINE)
        if match:
            name = match.group(1).strip()

    return {
        "name": name,
        "version": version,
        "description": description,
        "bin": package.get("bin", ""),
        "exports": package.get("exports", ""),
        "types": package.get("types") or package.get("typings", ""),
        "scripts": package.get("scripts") if isinstance(package.get("scripts"), dict) else scripts,
    }


def detect_signals(root: pathlib.Path, package: dict[str, Any], pyproject: dict[str, Any], cargo: dict[str, Any]) -> dict[str, bool]:
    deps = dependencies_from_package_json(package)
    py_deps = python_dependencies(pyproject)
    cargo_text = read_text(root / "Cargo.toml")
    go_text = read_text(root / "go.mod")
    readme_text = read_text(root / "README.md", limit=20000)
    source_text = source_text_sample(root, {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rs", ".go"})

    docs_generator = has_any(
        root,
        [
            "mkdocs.yml",
            "docusaurus.config.js",
            "docusaurus.config.ts",
            "vitepress.config.ts",
            "vitepress.config.js",
        ],
    ) or (root / "docs" / ".vitepress").is_dir()

    openapi = has_any(root, ["openapi.yaml", "openapi.yml", "openapi.json", "swagger.yaml", "swagger.yml", "swagger.json"])
    graphql = has_any(root, ["schema.graphql", "schema.gql"]) or has_glob(root, "**/*.graphql")
    dockerfile = has_any(root, ["Dockerfile", "Containerfile"]) or has_glob(root, "docker/Dockerfile*")
    compose = has_any(root, ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"])

    env_example = has_any(root, [".env.example", ".env.sample", ".env.template"]) or has_glob(root, "*.env.example")
    action_yml = has_any(root, ["action.yml", "action.yaml"])
    plugin_manifest = has_any(root, [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"])
    chart_yaml = has_any(root, ["Chart.yaml"]) and has_any(root, ["values.yaml"]) and (root / "templates").is_dir()
    terraform_files = has_glob(root, "*.tf")
    model_files = has_any(root, ["model.safetensors", "pytorch_model.bin", "tf_model.h5", "tokenizer.json"]) or (
        (root / "config.json").exists() and has_any(root, ["generation_config.json", "preprocessor_config.json"])
    )
    dataset_files = has_any(root, ["dataset_infos.json"]) or has_glob(root, "data/*.parquet") or has_glob(root, "data/*.jsonl") or has_glob(root, "data/*.csv")
    notebooks = has_glob(root, "*.ipynb") or has_glob(root, "notebooks/*.ipynb")
    citation = has_any(root, ["CITATION.cff"]) or bool(re.search(r"\barxiv\b|\bdoi\.org\b", readme_text, flags=re.IGNORECASE))
    skill_inventory = agent_skill_inventory(root)
    skill_md = skill_inventory["count"] > 0

    package_scripts = package.get("scripts") if isinstance(package.get("scripts"), dict) else {}
    py_scripts = pyproject.get("project", {}).get("scripts", {}) if isinstance(pyproject.get("project"), dict) else {}
    has_cli = bool(package.get("bin")) or bool(py_scripts) or (root / "src" / "main.rs").exists() or "[[bin]]" in cargo_text or (root / "cmd").is_dir()

    web_deps = {"next", "react-scripts", "vite", "@sveltejs/kit", "nuxt", "astro", "@remix-run/node", "@remix-run/react"}
    api_deps = {"express", "fastify", "koa", "hapi", "nestjs", "@nestjs/core"}
    py_api_deps = {"fastapi", "flask", "django", "starlette", "litestar", "sanic"}
    rust_api_deps = ("axum", "actix-web", "rocket")
    go_api_deps = ("gin-gonic/gin", "labstack/echo", "gofiber/fiber")
    has_webapp = bool(deps & web_deps) or has_any(root, ["public/index.html"]) or (root / "pages").is_dir() or (root / "app").is_dir() or (root / "src" / "routes").is_dir()
    has_api_service = openapi or graphql or bool(deps & api_deps) or bool(py_deps & py_api_deps) or any(name in cargo_text for name in rust_api_deps) or any(name in go_text for name in go_api_deps) or (root / "routes").is_dir() or (root / "controllers").is_dir()

    mcp_dependency = (
        "@modelcontextprotocol/sdk" in deps
        or "mcp" in py_deps
        or "modelcontextprotocol" in py_deps
    )
    mcp_source_related = bool(
        re.search(
            r"@modelcontextprotocol/sdk/server|from\s+mcp\.server|FastMCP|McpServer|model context protocol",
            source_text,
            flags=re.IGNORECASE,
        )
    )
    mcp_server_source = bool(
        re.search(
            r"StdioServerTransport|SSEServerTransport|StreamableHTTPServerTransport|"
            r"server\.connect\s*\(|\.connect\s*\(\s*new\s+\w*ServerTransport|"
            r"FastMCP\s*\(|\.run\s*\(\s*transport|mcp\.run\s*\(",
            source_text,
            flags=re.IGNORECASE,
        )
    )
    mcp_related = mcp_dependency or mcp_source_related or bool(re.search(r"\bMCP\b|model context protocol", readme_text, flags=re.IGNORECASE))
    has_mcp = mcp_dependency and mcp_server_source
    if not has_mcp and not (deps or py_deps):
        has_mcp = mcp_server_source
    has_extension = bool(package.get("engines", {}).get("vscode") if isinstance(package.get("engines"), dict) else False) or "contributes" in package or has_any(root, ["plugin.xml"]) or bool(read_json(root / "manifest.json").get("manifest_version"))
    has_desktop_mobile = has_any(root, ["tauri.conf.json", "capacitor.config.ts", "capacitor.config.js", "pubspec.yaml"]) or (root / "src-tauri").is_dir() or (root / "android").is_dir() or (root / "ios").is_dir() or "electron" in deps or "react-native" in deps
    has_template = has_any(root, [".github/template.yml", ".github/template.yaml", "cookiecutter.json"]) or bool(re.search(r"\b(template|starter|boilerplate)\b", root.name, flags=re.IGNORECASE))
    has_spec = has_any(root, ["spec.md", "SPEC.md", "RFC.md"]) or has_glob(root, "schemas/*.schema.json") or ((openapi or has_glob(root, "*.schema.json")) and not (has_api_service or has_webapp))
    has_examples = (root / "examples").is_dir() or (root / "example").is_dir()
    has_tests = (
        (root / "tests").is_dir()
        or (root / "test").is_dir()
        or has_glob(root, "**/tests")
        or has_glob(root, "**/test")
        or "test" in package_scripts
        or has_glob(root, "*test*.py")
        or has_glob(root, "**/*test*.py")
    )

    return {
        "env_example": env_example,
        "dockerfile": dockerfile,
        "compose": compose,
        "has_tests": has_tests,
        "has_examples": has_examples,
        "existing_readme": has_any(root, ["README.md", "readme.md"]),
        "openapi": openapi,
        "graphql": graphql,
        "citation": citation,
        "notebooks": notebooks,
        "action_yml": action_yml,
        "plugin_manifest": plugin_manifest,
        "chart_yaml": chart_yaml,
        "terraform_files": terraform_files,
        "model_files": model_files,
        "dataset_files": dataset_files,
        "skill_md": skill_md,
        "skill_collection": bool(skill_inventory["is_collection"]),
        "mcp_related": mcp_related,
        "mcp": has_mcp,
        "docs_generator": docs_generator,
        "webapp": has_webapp,
        "api_service": has_api_service,
        "cli": has_cli,
        "extension_plugin": has_extension,
        "desktop_mobile_app": has_desktop_mobile,
        "template_starter": has_template,
        "spec_protocol": has_spec,
        "research_code": citation or notebooks or has_any(root, ["environment.yml"]) or has_any(root, ["scripts/train.py", "scripts/eval.py"]) or (root / "checkpoints").is_dir(),
    }


def readme_type_signals(root: pathlib.Path, ecosystems: list[str], is_monorepo: bool, signals: dict[str, bool], package: dict[str, Any], pyproject: dict[str, Any], cargo: dict[str, Any]) -> dict[str, bool]:
    deps = dependencies_from_package_json(package)
    package_meta = package_metadata(root, ecosystems, package, pyproject, cargo)
    has_package_surface = bool(
        package_meta.get("exports")
        or package_meta.get("types")
        or package.get("main")
        or package.get("module")
        or pyproject.get("project")
        or cargo.get("package")
        or ((root / "go.mod").exists() and not signals["api_service"] and not signals["webapp"])
    )
    return {
        "monorepo": is_monorepo,
        "lib_or_sdk": has_package_surface,
        "cli": signals["cli"],
        "webapp": signals["webapp"],
        "api_service": signals["api_service"],
        "mcp_server": signals["mcp"],
        "agent_skill": signals["skill_md"],
        "github_action": signals["action_yml"],
        "docs_site": signals["docs_generator"],
        "container_image": signals["dockerfile"] and not any(
            signals[key]
            for key in ("webapp", "api_service", "cli", "action_yml", "chart_yaml", "terraform_files", "mcp", "skill_md", "docs_generator")
        ),
        "terraform_module": signals["terraform_files"],
        "helm_chart": signals["chart_yaml"],
        "model_card": signals["model_files"],
        "dataset_card": signals["dataset_files"],
        "research_code": signals["research_code"],
        "template_starter": signals["template_starter"],
        "example_demo": signals["has_examples"] and not has_package_surface and not signals["webapp"] and not signals["api_service"],
        "spec_protocol": signals["spec_protocol"],
        "extension_plugin": signals["extension_plugin"],
        "desktop_mobile_app": signals["desktop_mobile_app"] or bool(deps & {"electron", "react-native"}),
    }


def classify_readme_type(type_signals: dict[str, bool]) -> tuple[str, list[str]]:
    candidates: list[str] = []
    for readme_type in README_TYPES:
        signal_name = TYPE_TO_SIGNAL.get(readme_type, readme_type.replace("-", "_"))
        if type_signals.get(signal_name):
            candidates.append(readme_type)
    if not candidates:
        return "unknown", []
    return candidates[0], candidates


def inspect_repo(root: pathlib.Path) -> dict[str, Any]:
    root = root.resolve()
    package = read_json(root / "package.json")
    pyproject = read_toml(root / "pyproject.toml")
    cargo = read_toml(root / "Cargo.toml")
    ecosystems = detect_ecosystems(root)
    ecosystem = "mixed" if len(ecosystems) > 1 else ecosystems[0] if ecosystems else "native"
    package_manager = detect_package_manager(root, ecosystems)
    members = workspace_members(root, package, pyproject, cargo)
    is_monorepo = bool(members)
    signals = detect_signals(root, package, pyproject, cargo)
    type_signals = readme_type_signals(root, ecosystems, is_monorepo, signals, package, pyproject, cargo)
    readme_type, candidates = classify_readme_type(type_signals)
    primary_reader, first_action, delivery, artifact_type, publication = TYPE_CONTEXT[readme_type]

    skill_inventory = agent_skill_inventory(root)
    if readme_type == "agent-skill" and skill_inventory["is_collection"]:
        primary_reader = "agent user or maintainer installing a skill collection"
        first_action = "install the collection and trigger one included skill"
        artifact_type = "agent-skill-collection"

    if publication == "registry" and package.get("private") is True:
        publication = "private"
    if readme_type == "lib-or-sdk" and ecosystem == "native":
        publication = "source"
        artifact_type = "source"
    if readme_type == "cli" and ecosystem == "native":
        artifact_type = "release-binary"
        publication = "releases"

    package_meta = package_metadata(root, ecosystems, package, pyproject, cargo)
    name = str(package_meta.get("name") or root.name)

    return {
        "root": str(root),
        "name": name,
        "ecosystems": ecosystems,
        "ecosystem": ecosystem,
        "package_manager": package_manager,
        "readme_type": readme_type,
        "readme_type_candidates": candidates,
        "delivery": delivery,
        "artifact_type": artifact_type,
        "publication": publication,
        "primary_reader": primary_reader,
        "first_successful_action": first_action,
        "is_monorepo": is_monorepo,
        "workspaces": members,
        "github_slug": parse_git_remote(root),
        "github_workflows": list_workflows(root),
        "license": detect_license(root, package, pyproject, cargo),
        "package": package_meta,
        "media_assets": detect_media_assets(root),
        "readme_variants": readme_variants(root),
        "agent_skills": skill_inventory,
        "signals": signals,
        "readme_type_signals": type_signals,
    }


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    json.dump(inspect_repo(root), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write(os.linesep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
