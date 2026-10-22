#!/usr/bin/env python3
"""Track adapted skills against the upstream skill each one was copied from.

An adapted skill pins its source in SKILL.md frontmatter:

    metadata:
      upstream-repo: mattpocock/skills
      upstream-path: skills/engineering/triage
      upstream-commit: <full sha>

  check [--new]   list upstream commits that touched each pinned path since its pin;
                  --new also lists skills added upstream since the pin
  merge <skill>   three-way merge upstream changes into the adapted copy
                  (base = upstream at the pin, ours = this repo, theirs = upstream HEAD),
                  then move the pin to upstream HEAD; overlaps get conflict markers

Upstream repos are cached as bare clones under $XDG_CACHE_HOME/skills-upstream.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIN_KEYS = ("upstream-repo", "upstream-path", "upstream-commit")


@dataclass
class Adapted:
    name: str
    folder: Path
    repo: str
    path: str
    commit: str


def git(*args: str, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=check)


def frontmatter(text: str) -> str:
    match = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return match.group(1) if match else ""


def find_adapted(root: Path) -> list[Adapted]:
    found = []
    for skill_md in sorted((root / "skills").glob("**/SKILL.md")):
        meta = frontmatter(skill_md.read_text(encoding="utf-8"))
        pins = {key: re.search(rf"^\s+{key}:\s*(\S+)\s*$", meta, re.M) for key in PIN_KEYS}
        if not all(pins.values()):
            continue
        name = re.search(r"^name:\s*(\S+)", meta, re.M)
        found.append(Adapted(
            name=name.group(1) if name else skill_md.parent.name,
            folder=skill_md.parent,
            repo=pins["upstream-repo"].group(1),
            path=pins["upstream-path"].group(1).rstrip("/"),
            commit=pins["upstream-commit"].group(1),
        ))
    return found


def repo_url(repo: str) -> str:
    # A path or URL is used as is (tests point at a local repo); owner/name means GitHub.
    if "://" in repo or repo.startswith(("/", ".")):
        return repo
    return f"https://github.com/{repo}.git"


def fetch(repo: str, cache: Path) -> Path:
    bare = cache / re.sub(r"[^\w.-]+", "__", repo)
    if not bare.exists():
        cache.mkdir(parents=True, exist_ok=True)
        git("clone", "--bare", "--quiet", repo_url(repo), str(bare))
    else:
        git("fetch", "--quiet", "--prune", "origin", "+refs/heads/*:refs/heads/*", cwd=bare)
    return bare


def head(bare: Path) -> str:
    return git("rev-parse", "HEAD", cwd=bare).stdout.strip()


def files_at(bare: Path, commit: str, path: str) -> set[str]:
    out = git("ls-tree", "-r", "--name-only", commit, "--", path, cwd=bare).stdout
    return {line[len(path) + 1:] for line in out.splitlines() if line}


def blob(bare: Path, commit: str, path: str) -> str:
    return git("show", f"{commit}:{path}", cwd=bare).stdout


def check(root: Path, cache: Path, show_new: bool) -> int:
    adapted = find_adapted(root)
    if not adapted:
        print("No adapted skills pin an upstream.")
        return 0
    drifted = 0
    for skill in adapted:
        bare = fetch(skill.repo, cache)
        tip = head(bare)
        log = git("log", "--format=  %h %cs %s", f"{skill.commit}..{tip}", "--", skill.path, cwd=bare).stdout.rstrip()
        if log:
            drifted += 1
            print(f"{skill.name}: upstream {skill.repo}/{skill.path} changed since {skill.commit[:7]}")
            print(log)
            print(f"  diff: git -C {bare} diff {skill.commit[:12]} {tip[:12]} -- {skill.path}")
        else:
            print(f"{skill.name}: up to date with {skill.repo} ({tip[:7]})")
    if show_new:
        for repo in sorted({skill.repo for skill in adapted}):
            bare = fetch(repo, cache)
            oldest = min((s.commit for s in adapted if s.repo == repo),
                          key=lambda c: int(git("show", "-s", "--format=%ct", c, cwd=bare).stdout))
            added = git("log", "--diff-filter=A", "--format=  %h %cs %s", "--name-only",
                        f"{oldest}..{head(bare)}", "--", "*SKILL.md", cwd=bare).stdout.strip()
            print(f"\nNew skills in {repo} since {oldest[:7]}:" if added else f"\nNo new skills in {repo} since {oldest[:7]}.")
            if added:
                print("\n".join(f"  {line}" if line.endswith("SKILL.md") else line for line in added.splitlines() if line))
    return 1 if drifted else 0


def merge(root: Path, cache: Path, name: str) -> int:
    skill = next((s for s in find_adapted(root) if s.name == name or s.folder.name == name), None)
    if skill is None:
        print(f"No adapted skill named {name}.", file=sys.stderr)
        return 2
    bare = fetch(skill.repo, cache)
    tip = head(bare)
    base_files = files_at(bare, skill.commit, skill.path)
    tip_files = files_at(bare, tip, skill.path)
    conflicts = []
    for rel in sorted(base_files | tip_files):
        ours_path = skill.folder / rel
        base = blob(bare, skill.commit, f"{skill.path}/{rel}") if rel in base_files else ""
        theirs = blob(bare, tip, f"{skill.path}/{rel}") if rel in tip_files else None
        if theirs == base:
            continue
        if theirs is None:
            # Deleted upstream: delete ours only when we never changed it.
            if ours_path.exists() and ours_path.read_text(encoding="utf-8") == base:
                ours_path.unlink()
                print(f"  deleted {rel}")
            elif ours_path.exists():
                conflicts.append(rel)
                print(f"  CONFLICT {rel}: deleted upstream, changed here; kept ours")
            continue
        if not ours_path.exists():
            ours_path.parent.mkdir(parents=True, exist_ok=True)
            ours_path.write_text(theirs, encoding="utf-8")
            print(f"  added {rel}")
            continue
        result = merge_text(ours_path.read_text(encoding="utf-8"), base, theirs)
        ours_path.write_text(result.text, encoding="utf-8")
        if result.conflicted:
            conflicts.append(rel)
            print(f"  CONFLICT {rel}: resolve the markers")
        else:
            print(f"  merged {rel}")
    skill_md = skill.folder / "SKILL.md"
    skill_md.write_text(re.sub(r"(^\s+upstream-commit:\s*)\S+", rf"\g<1>{tip}",
                               skill_md.read_text(encoding="utf-8"), count=1, flags=re.M), encoding="utf-8")
    print(f"{skill.name}: pin moved {skill.commit[:7]} -> {tip[:7]}" + (f", {len(conflicts)} conflict(s)" if conflicts else ""))
    return 1 if conflicts else 0


@dataclass
class Merged:
    text: str
    conflicted: bool


def merge_text(ours: str, base: str, theirs: str) -> Merged:
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for label, text in (("ours", ours), ("base", base), ("theirs", theirs)):
            path = Path(tmp) / label
            path.write_text(text, encoding="utf-8")
            paths.append(str(path))
        run = git("merge-file", "-p", "-L", "adapted", "-L", "upstream-pinned", "-L", "upstream-head", *paths, check=False)
    if run.returncode < 0 or run.returncode > 127:
        raise RuntimeError(run.stderr)
    return Merged(run.stdout, run.returncode > 0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    check_cmd = sub.add_parser("check")
    check_cmd.add_argument("--new", action="store_true", help="also list skills added upstream since the pin")
    merge_cmd = sub.add_parser("merge")
    merge_cmd.add_argument("skill")
    args = parser.parse_args()
    cache = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "skills-upstream"
    if args.command == "check":
        return check(ROOT, cache, args.new)
    return merge(ROOT, cache, args.skill)


if __name__ == "__main__":
    sys.exit(main())
