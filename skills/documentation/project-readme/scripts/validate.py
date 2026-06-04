#!/usr/bin/env python3
"""Validate README quality and cross-check claims against repository facts."""

from __future__ import annotations

import argparse
import importlib.util
import json
import pathlib
import re
import sys
from typing import Any
from urllib.parse import unquote, urlparse


PLACEHOLDER_PATTERNS = [
    r"\bTODO\b",
    r"package-name",
    r"username/repo",
    r"OWNER/REPO",
    r"example\.com",
    r"support@example\.com",
    r"your-username",
    r"Your Name",
    r"\bTBD\b",
]


def collect_links(text: str) -> list[str]:
    links = re.findall(r"(?<!!)\[[^\]]+\]\(([^)]+)\)", text)
    image_links = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", text)
    return links + image_links


def is_external(link: str) -> bool:
    parsed = urlparse(link)
    return parsed.scheme in {"http", "https", "mailto"}


def lines_outside_fenced_code(text: str) -> list[str]:
    lines: list[str] = []
    fence_open = False
    for line in text.splitlines():
        if line.startswith("```"):
            fence_open = not fence_open
            continue
        if not fence_open:
            lines.append(line)
    return lines


def strip_inline_code(text: str) -> str:
    return re.sub(r"`[^`\n]*`", "", text)


def split_link(link: str) -> tuple[str, str]:
    clean = link.strip()
    if clean.startswith("<") and clean.endswith(">"):
        clean = clean[1:-1]
    if "#" not in clean:
        return unquote(clean), ""
    target, anchor = clean.split("#", 1)
    return unquote(target), unquote(anchor).strip()


def github_slug(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"`([^`]*)`", r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"[^\w\s-]", "", value.lower(), flags=re.UNICODE)
    value = re.sub(r"\s+", "-", value.strip())
    value = re.sub(r"-+", "-", value)
    return value


def markdown_anchor_set(text: str) -> set[str]:
    anchors: set[str] = set()
    slug_counts: dict[str, int] = {}
    for match in re.finditer(r"<a\s+[^>]*(?:id|name)=[\"']([^\"']+)[\"']", text, flags=re.IGNORECASE):
        anchors.add(match.group(1))
    for line in lines_outside_fenced_code(text):
        match = re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if not match:
            continue
        slug = github_slug(match.group(2))
        if not slug:
            continue
        count = slug_counts.get(slug, 0)
        slug_counts[slug] = count + 1
        anchors.add(slug if count == 0 else f"{slug}-{count}")
    return anchors


def anchor_exists(text: str, anchor: str) -> bool:
    if not anchor:
        return True
    anchors = markdown_anchor_set(text)
    return anchor in anchors or anchor.lower() in anchors


def has_contents_navigation(text: str) -> bool:
    first_screen = "\n".join(text.splitlines()[:80])
    return bool(
        re.search(r"^##+\s+(?:table of contents|contents)\b", text, flags=re.IGNORECASE | re.MULTILINE)
        or re.search(r"^\s*[-*]\s+\[[^\]]+\]\(#[^)]+\)", first_screen, flags=re.MULTILINE)
    )


def has_language_selector(text: str) -> bool:
    first_screen = "\n".join(text.splitlines()[:40])
    return bool(
        re.search(r"readme-language-selector|language selector", first_screen, flags=re.IGNORECASE)
        or len(re.findall(r"README(?:\.[A-Za-z0-9-]+)?\.md", first_screen)) >= 2
        or (
            re.search(r"\b(languages?|translations?)\b", first_screen, flags=re.IGNORECASE)
            and re.search(r"README(?:\.[A-Za-z0-9-]+)?\.md", first_screen)
        )
    )


def load_inspector() -> Any:
    path = pathlib.Path(__file__).resolve().parent / "inspect.py"
    spec = importlib.util.spec_from_file_location("project_readme_inspect", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def inspect_facts(repo: pathlib.Path | None, inspect_json: pathlib.Path | None) -> dict[str, Any]:
    if inspect_json:
        return json.loads(inspect_json.read_text(encoding="utf-8"))
    if repo:
        return load_inspector().inspect_repo(repo)
    return {}


def generic_checks(path: pathlib.Path, text: str) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    errors: list[str] = []
    lines = text.splitlines()
    prose_lines = lines_outside_fenced_code(text)
    prose_text = strip_inline_code("\n".join(prose_lines))

    h1_count = sum(1 for line in prose_lines if line.startswith("# "))
    if h1_count != 1:
        errors.append(f"expected exactly one H1, found {h1_count}")

    for pattern in PLACEHOLDER_PATTERNS:
        if re.search(pattern, prose_text, re.IGNORECASE):
            errors.append(f"placeholder remains: {pattern}")

    fence_open = False
    for index, line in enumerate(lines, start=1):
        if line.startswith("```"):
            if not fence_open:
                if line.strip() == "```":
                    errors.append(f"code fence without language tag at line {index}")
                fence_open = True
            else:
                fence_open = False
    if fence_open:
        errors.append("unclosed code fence")

    root = path.parent.resolve()
    for link in collect_links(text):
        if not link or is_external(link):
            continue
        link_target, anchor = split_link(link)
        target = path.resolve() if not link_target else (root / link_target).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            continue
        if not target.exists():
            errors.append(f"relative link target not found: {link}")
            continue
        if anchor and target.suffix.lower() in {".md", ".markdown"}:
            target_text = text if target == path.resolve() else target.read_text(encoding="utf-8")
            if not anchor_exists(target_text, anchor):
                errors.append(f"anchor target not found: {link}")

    first_screen = "\n".join(lines[:25])
    if not re.search(r"(^|\n)#\s+\S+", first_screen):
        warnings.append("first screen should include the project title")
    if not re.search(r"\b(install|run|start|use|import|deploy|helm|terraform|docker|workflow|load)\b", first_screen, flags=re.IGNORECASE):
        warnings.append("first screen should include the fastest real start path")
    if len(text.strip()) < 400:
        warnings.append("README is very short; check whether setup and usage are complete")
    if len(lines) > 120 and not has_contents_navigation(text):
        warnings.append("long README should include a useful contents section")

    return warnings, errors


def has_section(text: str, name: str) -> bool:
    return bool(re.search(rf"^##+\s+{re.escape(name)}\b", text, flags=re.IGNORECASE | re.MULTILINE))


def fact_checks(text: str, facts: dict[str, Any]) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    errors: list[str] = []
    if not facts:
        return warnings, errors

    ecosystems = set(facts.get("ecosystems") or [])
    signals = facts.get("signals") or {}
    type_signals = facts.get("readme_type_signals") or {}
    license_info = facts.get("license") or {}
    workflows = facts.get("github_workflows") or []
    readme_type = facts.get("readme_type", "unknown")
    package = facts.get("package") or {}
    agent_skills = facts.get("agent_skills") or {}
    readme_variants = facts.get("readme_variants") or []
    package_name = str(package.get("name") or facts.get("name") or "")

    first_h1 = next((line[2:].strip() for line in lines_outside_fenced_code(text) if line.startswith("# ")), "")
    if package_name and first_h1 and package_name.lower() not in first_h1.lower() and first_h1.lower() not in package_name.lower():
        warnings.append(f"README H1 does not match detected package/repo name: {package_name}")

    badge_patterns = {
        "npm": r"npmjs\.com/package|img\.shields\.io/npm/",
        "pypi": r"pypi\.org/project|img\.shields\.io/pypi/",
        "cargo": r"crates\.io/crates|img\.shields\.io/crates/",
        "rubygems": r"rubygems\.org/gems|img\.shields\.io/gem/",
        "go": r"pkg\.go\.dev|img\.shields\.io/badge/pkg\.go\.dev",
    }
    for ecosystem, pattern in badge_patterns.items():
        if ecosystem not in ecosystems and re.search(pattern, text, flags=re.IGNORECASE):
            errors.append(f"README includes {ecosystem} registry badge/link but detected ecosystems are {sorted(ecosystems) or ['native']}")

    if re.search(r"workflows/.+/badge\.svg|img\.shields\.io/github/actions", text, flags=re.IGNORECASE) and not workflows:
        errors.append("README includes a CI badge but no GitHub workflow was detected")

    has_license_fact = bool(license_info.get("id") or license_info.get("files"))
    if re.search(r"img\.shields\.io/(?:github/)?license|License-", text, flags=re.IGNORECASE) and not has_license_fact:
        errors.append("README includes a license badge but no license source was detected")

    first_screen = "\n".join(text.splitlines()[:25])
    if re.search(r"\bdocker (run|compose)|docker-compose\b", first_screen, flags=re.IGNORECASE) and not (signals.get("dockerfile") or signals.get("compose") or readme_type == "container-image"):
        errors.append("README presents Docker as a primary path without a Docker signal")

    if has_section(text, "Environment") and not signals.get("env_example"):
        warnings.append("Environment section exists but no env source such as .env.example was detected")
    if has_section(text, "API Reference") and not (type_signals.get("lib_or_sdk") or type_signals.get("api_service")):
        warnings.append("API Reference section exists but no API or exported package surface was detected")
    if has_section(text, "Command Reference") and not type_signals.get("cli"):
        warnings.append("Command Reference section exists but no CLI signal was detected")
    if has_section(text, "Deployment") and not (signals.get("dockerfile") or signals.get("compose") or type_signals.get("webapp") or type_signals.get("api_service") or type_signals.get("helm_chart")):
        warnings.append("Deployment section exists but no deployment signal was detected")
    if readme_type == "model-card" and not has_section(text, "Limitations"):
        warnings.append("model-card README should include model limitations")
    if readme_type == "dataset-card" and not (has_section(text, "Schema") and re.search(r"\blicense\b", text, flags=re.IGNORECASE)):
        warnings.append("dataset-card README should include schema and license information")
    if readme_type == "research-code" and not re.search(r"\b(reproduce|reproduction|train|eval|experiment)\b", text, flags=re.IGNORECASE):
        warnings.append("research-code README should include reproduction commands or experiment guidance")
    if readme_type == "agent-skill" and int(agent_skills.get("count") or 0) > 1 and not has_section(text, "Skills"):
        warnings.append("agent-skill collection README should include a skill index")
    if readme_type == "agent-skill":
        if not re.search(r"\b(install|copy|add|clone|plugin)\b", text, flags=re.IGNORECASE):
            warnings.append("agent-skill README should include install guidance")
        if not re.search(r"\b(trigger|prompt|request|when to use|use this skill|try)\b", text, flags=re.IGNORECASE):
            warnings.append("agent-skill README should include trigger guidance")
    if re.search(r"\b(plugin|marketplace)\b", text, flags=re.IGNORECASE) and not agent_skills.get("plugin_manifests") and readme_type == "agent-skill":
        warnings.append("agent-skill README mentions plugin metadata but no plugin manifest was detected")
    if len(readme_variants) > 1 and not has_language_selector(text):
        warnings.append("multiple README variants exist but no language selector was detected")

    return warnings, errors


def validate(path: pathlib.Path, repo: pathlib.Path | None = None, inspect_json: pathlib.Path | None = None) -> tuple[list[str], list[str]]:
    if not path.exists():
        return [], [f"{path} does not exist"]
    text = path.read_text(encoding="utf-8")
    warnings, errors = generic_checks(path, text)
    fact_warnings, fact_errors = fact_checks(text, inspect_facts(repo, inspect_json))
    warnings.extend(fact_warnings)
    errors.extend(fact_errors)
    return warnings, errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("readme", nargs="?", default="README.md")
    parser.add_argument("--repo", type=pathlib.Path)
    parser.add_argument("--inspect-json", type=pathlib.Path)
    args = parser.parse_args()

    warnings, errors = validate(pathlib.Path(args.readme), args.repo, args.inspect_json)
    for warning in warnings:
        print(f"WARN: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        return 1
    print("README validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
