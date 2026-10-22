import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import upstream  # noqa: E402

SKILL = """---
name: foo
description: Upstream foo.
---

# Foo

Line one.
Line two.
Line three.
"""


def sh(*args, cwd):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def commit(repo: Path, files: dict[str, str | None], message: str) -> str:
    for rel, text in files.items():
        path = repo / rel
        if text is None:
            path.unlink()
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    sh("git", "add", "-A", cwd=repo)
    sh("git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", message, cwd=repo)
    return sh("git", "rev-parse", "HEAD", cwd=repo)


def setup(tmp_path: Path, extra_files: dict[str, str] | None = None):
    up = tmp_path / "upstream"
    up.mkdir()
    sh("git", "init", "-q", "-b", "main", cwd=up)
    pin = commit(up, {"skills/eng/foo/SKILL.md": SKILL, **(extra_files or {})}, "add foo")
    local = tmp_path / "local"
    fork = local / "skills/adapted/foo"
    fork.mkdir(parents=True)
    adapted = SKILL.replace("---\n\n", f"metadata:\n  upstream-repo: {up}\n  upstream-path: skills/eng/foo\n  upstream-commit: {pin}\n---\n\n", 1)
    (fork / "SKILL.md").write_text(adapted.replace("Line one.", "Line one, adapted."), encoding="utf-8")
    for rel, text in (extra_files or {}).items():
        (fork / Path(rel).relative_to("skills/eng/foo")).write_text(text, encoding="utf-8")
    return up, local, fork, pin


def test_check_lists_upstream_commits_since_the_pin(tmp_path, capsys):
    up, local, _, _ = setup(tmp_path)
    commit(up, {"skills/eng/foo/SKILL.md": SKILL.replace("Line three.", "Line three, upstream.")}, "sharpen foo")
    commit(up, {"skills/eng/bar/SKILL.md": "---\nname: bar\n---\n"}, "add bar")

    assert upstream.check(local, tmp_path / "cache", show_new=True) == 1
    out = capsys.readouterr().out
    assert "sharpen foo" in out
    assert "add bar" not in out.split("New skills")[0]
    assert "skills/eng/bar/SKILL.md" in out.split("New skills")[1]


def test_check_reports_up_to_date(tmp_path, capsys):
    _, local, _, _ = setup(tmp_path)
    assert upstream.check(local, tmp_path / "cache", show_new=False) == 0
    assert "up to date" in capsys.readouterr().out


def test_merge_keeps_both_sides_adds_and_deletes_files_and_moves_the_pin(tmp_path):
    up, local, fork, pin = setup(tmp_path, {"skills/eng/foo/OLD.md": "old\n"})
    tip = commit(up, {
        "skills/eng/foo/SKILL.md": SKILL.replace("Line three.", "Line three, upstream."),
        "skills/eng/foo/NEW.md": "new\n",
        "skills/eng/foo/OLD.md": None,
    }, "sharpen foo")

    assert upstream.merge(local, tmp_path / "cache", "foo") == 0
    text = (fork / "SKILL.md").read_text()
    assert "Line one, adapted." in text and "Line three, upstream." in text
    assert f"upstream-commit: {tip}" in text and pin not in text
    assert (fork / "NEW.md").read_text() == "new\n"
    assert not (fork / "OLD.md").exists()


def test_merge_marks_overlapping_edits(tmp_path):
    up, local, fork, _ = setup(tmp_path)
    commit(up, {"skills/eng/foo/SKILL.md": SKILL.replace("Line one.", "Line one, upstream.")}, "reword one")

    assert upstream.merge(local, tmp_path / "cache", "foo") == 1
    text = (fork / "SKILL.md").read_text()
    assert "<<<<<<< adapted" in text and ">>>>>>> upstream-head" in text
