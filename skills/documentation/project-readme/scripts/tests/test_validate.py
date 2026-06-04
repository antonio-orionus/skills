import importlib.util
import pathlib


def load_script(name: str):
    path = pathlib.Path(__file__).resolve().parents[1] / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"project_readme_{name}", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


val = load_script("validate")


GOOD_README = """# demo

Small package for testing the validator.

Install and run:

```bash
python3 -m demo
```

## Usage

This README contains enough content to avoid the short-readme warning and
exercise the generic checks without relying on any external service.
"""


def test_valid_readme_passes(make_repo):
    root = make_repo({"README.md": GOOD_README, "demo.py": ""})
    warnings, errors = val.validate(root / "README.md")
    assert errors == []
    assert isinstance(warnings, list)


def test_rejects_missing_h1_and_untagged_fence(make_repo):
    root = make_repo({"README.md": "## demo\n\n```\nx\n```\n"})
    _warnings, errors = val.validate(root / "README.md")
    assert any("expected exactly one H1" in error for error in errors)
    assert any("code fence without language tag" in error for error in errors)


def test_ignores_h1_like_comments_inside_fenced_code(make_repo):
    root = make_repo(
        {
            "README.md": "# demo\n\nInstall and run:\n\n```bash\n# install from npm\nnpm install demo\n```\n",
        }
    )
    _warnings, errors = val.validate(root / "README.md")
    assert not any("expected exactly one H1" in error for error in errors)


def test_ignores_placeholders_inside_code(make_repo):
    root = make_repo(
        {
            "README.md": "# demo\n\nInstall and run this example for `https://example.com`:\n\n```bash\ncurl https://example.com/health\n```\n",
        }
    )
    _warnings, errors = val.validate(root / "README.md")
    assert not any("placeholder remains" in error for error in errors)


def test_rejects_placeholders_in_prose(make_repo):
    root = make_repo({"README.md": "# demo\n\nTODO: explain this package.\n\n```bash\npython3 -m demo\n```\n"})
    _warnings, errors = val.validate(root / "README.md")
    assert any("placeholder remains" in error for error in errors)


def test_rejects_bad_relative_link(make_repo):
    root = make_repo({"README.md": "# demo\n\nInstall this.\n\n[Missing](docs/missing.md)\n"})
    _warnings, errors = val.validate(root / "README.md")
    assert any("relative link target not found" in error for error in errors)


def test_rejects_wrong_ecosystem_badge(make_repo):
    root = make_repo(
        {
            "package.json": {"name": "x"},
            "README.md": "# x\n\nInstall with npm.\n\n![PyPI](https://img.shields.io/pypi/v/x)\n\n```bash\nnpm install x\n```\n",
        }
    )
    _warnings, errors = val.validate(root / "README.md", repo=root)
    assert any("pypi registry badge" in error.lower() for error in errors)


def test_rejects_ci_badge_without_workflow(make_repo):
    root = make_repo(
        {
            "README.md": "# x\n\nRun the project.\n\n![CI](https://github.com/a/b/actions/workflows/ci.yml/badge.svg)\n\n```bash\nmake test\n```\n",
        }
    )
    _warnings, errors = val.validate(root / "README.md", repo=root)
    assert any("CI badge" in error for error in errors)


def test_warns_when_skill_collection_has_no_skill_index(make_repo):
    root = make_repo(
        {
            "README.md": "# skills\n\nInstall and use this collection.\n\n```bash\nnpx skills add antonio-orionus/skills\n```\n",
            "skills/a/SKILL.md": "---\nname: a\ndescription: A\n---\n",
            "skills/b/SKILL.md": "---\nname: b\ndescription: B\n---\n",
        }
    )
    warnings, errors = val.validate(root / "README.md", repo=root)
    assert errors == []
    assert any("skill index" in warning for warning in warnings)
