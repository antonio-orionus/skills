import importlib.util
import pathlib


def load_script(name: str):
    path = pathlib.Path(__file__).resolve().parents[1] / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"project_readme_{name}", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


ins = load_script("inspect")


def test_detects_npm(make_repo):
    root = make_repo({"package.json": {"name": "x"}})
    assert ins.detect_ecosystems(root) == ["npm"]


def test_detects_pypi_pyproject(make_repo):
    root = make_repo({"pyproject.toml": "[project]\nname='x'\n"})
    assert ins.detect_ecosystems(root) == ["pypi"]


def test_detects_pypi_setup_py(make_repo):
    root = make_repo({"setup.py": "from setuptools import setup"})
    assert ins.detect_ecosystems(root) == ["pypi"]


def test_detects_cargo(make_repo):
    root = make_repo({"Cargo.toml": "[package]\nname='x'\n"})
    assert ins.detect_ecosystems(root) == ["cargo"]


def test_detects_go(make_repo):
    root = make_repo({"go.mod": "module example.com/x\n"})
    assert ins.detect_ecosystems(root) == ["go"]


def test_detects_rubygems(make_repo):
    root = make_repo({"x.gemspec": "Gem::Specification.new"})
    assert ins.detect_ecosystems(root) == ["rubygems"]


def test_mixed_sorted(make_repo):
    root = make_repo({"package.json": {"name": "x"}, "Cargo.toml": "[package]\n"})
    assert ins.detect_ecosystems(root) == ["cargo", "npm"]


def test_native_when_none(make_repo):
    root = make_repo({"main.c": "int main(){}"})
    assert ins.detect_ecosystems(root) == []
    assert ins.inspect_repo(root)["ecosystem"] == "native"


def test_detects_package_managers(make_repo):
    root = make_repo({"package.json": {"name": "x"}, "pnpm-lock.yaml": ""})
    assert ins.inspect_repo(root)["package_manager"] == "pnpm"
    root = make_repo({"pyproject.toml": "[project]\nname='x'\n", "uv.lock": ""})
    assert ins.inspect_repo(root)["package_manager"] == "uv"


def test_classifies_github_action(make_repo):
    root = make_repo({"action.yml": "runs:\n  using: node20\n"})
    data = ins.inspect_repo(root)
    assert data["readme_type"] == "github-action"
    assert data["first_successful_action"].startswith("paste a workflow")


def test_classifies_mcp_server(make_repo):
    root = make_repo(
        {
            "package.json": {"name": "mcp-x", "dependencies": {"@modelcontextprotocol/sdk": "latest"}},
            "src/server.ts": (
                "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';\n"
                "import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';\n"
                "const server = new McpServer({ name: 'x', version: '1.0.0' });\n"
                "await server.connect(new StdioServerTransport());\n"
            ),
        }
    )
    data = ins.inspect_repo(root)
    assert data["readme_type"] == "mcp-server"
    assert data["signals"]["mcp"] is True


def test_mcp_related_library_is_not_classified_as_mcp_server(make_repo):
    root = make_repo(
        {
            "package.json": {
                "name": "mcp-toolkit",
                "exports": "./index.js",
                "dependencies": {"@modelcontextprotocol/sdk": "latest"},
            },
            "README.md": "# mcp-toolkit\n\nA library used by MCP servers.\n",
            "index.js": "export function createTool() { return {}; }\n",
        }
    )
    data = ins.inspect_repo(root)
    assert data["readme_type"] == "lib-or-sdk"
    assert data["signals"]["mcp_related"] is True
    assert data["signals"]["mcp"] is False
    assert data["readme_type_signals"]["mcp_server"] is False


def test_mcp_server_type_import_does_not_override_library(make_repo):
    root = make_repo(
        {
            "package.json": {
                "name": "mcp-types",
                "exports": "./index.js",
                "dependencies": {"@modelcontextprotocol/sdk": "latest"},
            },
            "index.js": "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';\nexport { McpServer };\n",
        }
    )
    data = ins.inspect_repo(root)
    assert data["readme_type"] == "lib-or-sdk"
    assert data["signals"]["mcp_related"] is True
    assert data["signals"]["mcp"] is False


def test_classifies_terraform_module(make_repo):
    root = make_repo({"variables.tf": "", "outputs.tf": ""})
    assert ins.inspect_repo(root)["readme_type"] == "terraform-module"


def test_classifies_helm_chart(make_repo):
    root = make_repo({"Chart.yaml": "name: x\n", "values.yaml": "", "templates/deployment.yaml": ""})
    assert ins.inspect_repo(root)["readme_type"] == "helm-chart"


def test_classifies_docs_site(make_repo):
    root = make_repo({"mkdocs.yml": "site_name: Docs\n", "docs/index.md": "# Docs\n"})
    assert ins.inspect_repo(root)["readme_type"] == "docs-site"


def test_classifies_webapp_before_container(make_repo):
    root = make_repo({"package.json": {"dependencies": {"next": "latest"}}, "Dockerfile": "FROM node:22\n"})
    data = ins.inspect_repo(root)
    assert data["readme_type"] == "webapp"
    assert data["readme_type_signals"]["container_image"] is False


def test_classifies_api_service(make_repo):
    root = make_repo({"pyproject.toml": "[project]\nname='x'\ndependencies=['fastapi']\n", "openapi.yaml": "openapi: 3.1.0\n"})
    assert ins.inspect_repo(root)["readme_type"] == "api-service"


def test_classifies_container_when_docker_is_product(make_repo):
    root = make_repo({"Dockerfile": "FROM alpine\n"})
    assert ins.inspect_repo(root)["readme_type"] == "container-image"


def test_classifies_agent_skill(make_repo):
    root = make_repo({"SKILL.md": "---\nname: x\ndescription: y\n---\n"})
    assert ins.inspect_repo(root)["readme_type"] == "agent-skill"


def test_agent_skill_collection_inventory(make_repo):
    root = make_repo(
        {
            "skills/docs/a/SKILL.md": "---\nname: a\ndescription: First skill\n---\n",
            "skills/docs/b/SKILL.md": "---\nname: b\ndescription: Second skill\n---\n",
            ".ref/reference-skill/SKILL.md": "---\nname: hidden\ndescription: Not installable\n---\n",
            ".claude-plugin/plugin.json": {"name": "skills"},
            "skills/docs/a/scripts/tests/test_a.py": "def test_a():\n    assert True\n",
        }
    )
    data = ins.inspect_repo(root)
    assert data["readme_type"] == "agent-skill"
    assert data["artifact_type"] == "agent-skill-collection"
    assert data["signals"]["skill_collection"] is True
    assert data["signals"]["plugin_manifest"] is True
    assert data["signals"]["has_tests"] is True
    assert data["agent_skills"]["count"] == 2
    assert data["agent_skills"]["plugin_manifests"] == [".claude-plugin/plugin.json"]
    assert data["agent_skills"]["skills"][0]["name"] == "a"


def test_detects_media_assets_and_readme_variants(make_repo):
    root = make_repo(
        {
            "README.md": "# Demo\n",
            "README.zh.md": "# Demo\n",
            "docs/README.fr.md": "# Nested readme is not a sibling variant\n",
            "assets/logo.svg": "<svg></svg>",
            "public/app-screenshot.png": "",
            "assets/photo.png": "",
            ".ref/hidden-logo.svg": "<svg></svg>",
        }
    )
    data = ins.inspect_repo(root)
    assert data["media_assets"] == ["assets/logo.svg", "public/app-screenshot.png"]
    assert data["readme_variants"] == ["README.md", "README.zh.md"]


def test_detects_license_id_from_license_file(make_repo):
    root = make_repo({"LICENSE": "MIT License\n\nCopyright (c) 2026 Antonio Orionus\n"})
    license_info = ins.inspect_repo(root)["license"]
    assert license_info["id"] == "MIT"
    assert license_info["copyright_notice"] == "Copyright (c) 2026 Antonio Orionus"
    assert license_info["copyright_year"] == "2026"
    assert license_info["copyright_holder"] == "Antonio Orionus"


def test_detects_license_author_from_package_metadata(make_repo):
    root = make_repo({"package.json": {"name": "x", "license": "MIT", "author": "Antonio Orionus <a@example.com>"}})
    license_info = ins.inspect_repo(root)["license"]
    assert license_info["id"] == "MIT"
    assert license_info["copyright_holder"] == "Antonio Orionus"
    assert license_info["authors"] == ["Antonio Orionus"]


def test_classifies_model_dataset_research(make_repo):
    assert ins.inspect_repo(make_repo({"model.safetensors": ""}))["readme_type"] == "model-card"
    assert ins.inspect_repo(make_repo({"dataset_infos.json": "{}"}))["readme_type"] == "dataset-card"
    assert ins.inspect_repo(make_repo({"CITATION.cff": "", "notebooks/demo.ipynb": "{}"}))["readme_type"] == "research-code"


def test_classifies_extension_and_desktop(make_repo):
    root = make_repo({"package.json": {"engines": {"vscode": "^1.90.0"}, "contributes": {}}})
    assert ins.inspect_repo(root)["readme_type"] == "extension-plugin"
    root = make_repo({"src-tauri/tauri.conf.json": "{}"})
    assert ins.inspect_repo(root)["readme_type"] == "desktop-mobile-app"


def test_classifies_template_spec_example_and_monorepo(make_repo):
    assert ins.inspect_repo(make_repo({"cookiecutter.json": "{}"}))["readme_type"] == "template-starter"
    assert ins.inspect_repo(make_repo({"spec.md": "# Spec\n"}))["readme_type"] == "spec-protocol"
    assert ins.inspect_repo(make_repo({"examples/demo.js": ""}))["readme_type"] == "example-demo"
    root = make_repo({"package.json": {"workspaces": ["packages/*"]}})
    assert ins.inspect_repo(root)["readme_type"] == "monorepo"


def test_contract_fields_present(make_repo):
    root = make_repo({"package.json": {"name": "x", "exports": "./index.js"}, "LICENSE": "MIT\n"})
    data = ins.inspect_repo(root)
    for key in (
        "root",
        "name",
        "ecosystems",
        "ecosystem",
        "package_manager",
        "readme_type",
        "readme_type_candidates",
        "delivery",
        "artifact_type",
        "publication",
        "primary_reader",
        "first_successful_action",
        "is_monorepo",
        "workspaces",
        "github_slug",
        "github_workflows",
        "license",
        "package",
        "media_assets",
        "readme_variants",
        "signals",
        "readme_type_signals",
    ):
        assert key in data
