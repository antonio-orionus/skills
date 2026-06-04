import pathlib


ROOT = pathlib.Path(__file__).resolve().parents[2]

README_TYPES = [
    "lib-or-sdk",
    "cli",
    "webapp",
    "api-service",
    "mcp-server",
    "agent-skill",
    "monorepo",
    "docs-site",
    "github-action",
    "extension-plugin",
    "container-image",
    "terraform-module",
    "helm-chart",
    "model-card",
    "dataset-card",
    "research-code",
    "template-starter",
    "example-demo",
    "spec-protocol",
    "desktop-mobile-app",
]

EXPECTED_HEADINGS = [
    "Primary reader",
    "First successful action",
    "First screen",
    "Required sections",
    "Conditional sections",
    "Source-of-truth files",
    "Do not invent",
    "Mini example",
]


def test_required_skill_files_exist():
    required = [
        "SKILL.md",
        "ecosystems/npm.md",
        "ecosystems/pypi.md",
        "ecosystems/cargo.md",
        "ecosystems/go.md",
        "ecosystems/rubygems.md",
        "ecosystems/native.md",
        "references/badge-patterns.md",
        "references/section-order.md",
        "references/detection-heuristics.md",
        "references/validation.md",
        "references/research-pass.md",
        "references/positioning.md",
        "references/reader-context.md",
        "references/markdown-mechanics.md",
        "sections/badges.md",
        "sections/install.md",
        "sections/quick-start.md",
        "sections/usage-examples.md",
        "sections/api-reference.md",
        "sections/cli-reference.md",
        "sections/env-config.md",
        "sections/mcp-client-config.md",
        "sections/workspace-index.md",
        "sections/deployment.md",
        "sections/reproducibility.md",
        "sections/model-card-fields.md",
        "sections/dataset-card-fields.md",
        "sections/troubleshooting.md",
        "scripts/inspect.py",
        "scripts/validate.py",
    ]
    for relpath in required:
        assert (ROOT / relpath).exists(), relpath


def test_all_project_type_modules_exist_and_have_consistent_headings():
    for readme_type in README_TYPES:
        path = ROOT / "project-types" / f"{readme_type}.md"
        assert path.exists(), readme_type
        headings = [
            line.removeprefix("## ").strip()
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.startswith("## ")
        ]
        assert headings == EXPECTED_HEADINGS, readme_type
