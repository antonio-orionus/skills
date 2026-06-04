import json

import pytest


@pytest.fixture
def make_repo(tmp_path):
    """Build a fake repo. files: {relpath: str|dict|list}."""
    counter = 0

    def _make(files):
        nonlocal counter
        counter += 1
        root = tmp_path / f"repo-{counter}"
        for rel, content in files.items():
            path = root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(content, (dict, list)):
                path.write_text(json.dumps(content), encoding="utf-8")
            else:
                path.write_text(content, encoding="utf-8")
        return root

    return _make
