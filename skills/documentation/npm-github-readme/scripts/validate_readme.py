#!/usr/bin/env python3
"""Lightweight README quality checks for npm/GitHub README work."""

from __future__ import annotations

import pathlib
import re
import sys
from urllib.parse import urlparse


PLACEHOLDER_PATTERNS = [
    r"\bTODO\b",
    r"package-name",
    r"username/repo",
    r"OWNER/REPO",
    r"example\.com",
    r"support@example\.com",
    r"your-username",
    r"Your Name",
]


def collect_links(text: str) -> list[str]:
    links = re.findall(r"\[[^\]]+\]\(([^)]+)\)", text)
    image_links = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", text)
    return links + image_links


def is_external(link: str) -> bool:
    parsed = urlparse(link)
    return parsed.scheme in {"http", "https", "mailto"}


def validate(path: pathlib.Path) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    errors: list[str] = []

    if not path.exists():
        return warnings, [f"{path} does not exist"]

    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    h1_count = sum(1 for line in lines if line.startswith("# "))
    if h1_count != 1:
        errors.append(f"expected exactly one H1, found {h1_count}")

    if len(text.strip()) < 400:
        warnings.append("README is very short; check whether setup and usage are complete")

    for pattern in PLACEHOLDER_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            errors.append(f"placeholder remains: {pattern}")

    fence_open = False
    for index, line in enumerate(lines, start=1):
        if line.startswith("```"):
            if not fence_open and line.strip() == "```":
                warnings.append(f"code fence without language tag at line {index}")
            fence_open = not fence_open
    if fence_open:
        errors.append("unclosed code fence")

    root = path.parent
    for link in collect_links(text):
        if not link or link.startswith("#") or is_external(link):
            continue
        clean = link.split("#", 1)[0]
        if not clean:
            continue
        if clean.startswith("<") and clean.endswith(">"):
            clean = clean[1:-1]
        target = (root / clean).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            continue
        if not target.exists():
            warnings.append(f"relative link target not found: {link}")

    return warnings, errors


def main() -> int:
    path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "README.md")
    warnings, errors = validate(path)

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
