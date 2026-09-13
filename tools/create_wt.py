#!/usr/bin/env python3
"""
create_wt.py — create a git worktree and a new branch under
<repo>/.worktrees/<tag>/<name>/.

Both --tag and --name must be kebab-case: lowercase letters, digits,
and single hyphens between segments. No spaces, no underscores, no
capitals. The branch created is named ``<tag>/<name>`` so the on-disk
path mirrors the branch layout (a Vite plugin reads the same path to
discover the worktree — see tools/vite-plugins/worktree-switcher.ts).

Usage:
  create_wt.py --tag fix --name invoice-logic-bug
  create_wt.py                                            # interactive session
  create_wt.py --help
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

# kebab-case: one or more lowercase-word segments joined by single hyphens.
# rejects spaces, underscores, capitals, leading/trailing/consecutive hyphens.
KEBAB_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DEFAULT_BASE = ".worktrees"


# ---------- output ----------

def die(msg: str, code: int = 1) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def info(msg: str) -> None:
    print(f"  {msg}")


def heading(msg: str) -> None:
    print()
    print(msg)


# ---------- input ----------

def prompt(label: str) -> str:
    """Prompt for a kebab-case value in an interactive loop."""
    hint = (
        "    must be kebab-case: lowercase letters, digits, and hyphens only.\n"
        "    no spaces, no underscores, no capitals.\n"
        f"    example: {label}-one-two"
    )
    while True:
        try:
            value = input(f"{label}: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            die("aborted", code=130)
        if not value:
            print(f"  ! {label} cannot be empty")
            continue
        if not KEBAB_RE.match(value):
            print(f"  ! invalid {label}: {value!r}")
            print(hint)
            continue
        return value


def check(value: str, label: str) -> str:
    """Validate a kebab-case value provided via CLI flag. Die on failure."""
    if not value:
        die(f"--{label} cannot be empty")
    if not KEBAB_RE.match(value):
        die(
            f"invalid --{label}: {value!r}\n"
            "  must be kebab-case: lowercase letters, digits, and hyphens only.\n"
            "  no spaces, no underscores, no capitals.\n"
            f"  example: --{label} {label}-one-two"
        )
    return value


def confirm(question: str, default_yes: bool = True) -> bool:
    suffix = "[Y/n]" if default_yes else "[y/N]"
    try:
        resp = input(f"{question} {suffix} ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    if not resp:
        return default_yes
    return resp in ("y", "yes")


# ---------- git ----------

def run_git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            ["git", *args],
            check=check,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        die("git is not installed or not on PATH")


def find_repo_root() -> Path:
    result = run_git("rev-parse", "--show-toplevel", check=False)
    if result.returncode != 0:
        die("not inside a git repository")
    return Path(result.stdout.strip())


def branch_exists(branch: str) -> bool:
    return (
        run_git("rev-parse", "--verify", "--quiet", branch, check=False).returncode
        == 0
    )


# ---------- worktree ----------

def create_worktree(repo: Path, worktree: Path, branch: str) -> bool:
    worktree.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["git", "worktree", "add", "-b", branch, str(worktree)],
        cwd=repo,
    )
    if result.returncode != 0:
        print(
            f"\n  ! `git worktree add` failed (exit {result.returncode})",
            file=sys.stderr,
        )
        return False
    return True


# ---------- flow ----------

def plan(repo: Path, base: Path, tag: str, name: str) -> tuple[Path, str]:
    worktree = (repo / base / tag / name).resolve()
    branch = f"{tag}/{name}"
    return worktree, branch


def execute(repo: Path, worktree: Path, branch: str, *, yes: bool) -> bool:
    heading("Plan")
    info(f"repo     : {repo}")
    info(f"worktree : {worktree}")
    info(f"branch   : {branch}")

    if branch_exists(branch):
        print(f"\n  ! branch already exists: {branch}")
        return False
    if worktree.exists() or worktree.is_symlink():
        print(f"\n  ! path already exists: {worktree}")
        return False

    if not yes and not confirm("proceed?", default_yes=True):
        print("cancelled.")
        return False

    heading("Creating worktree")
    if not create_worktree(repo, worktree, branch):
        return False

    print()
    print(f"OK  created worktree at {worktree}")
    print(f"    branch : {branch}")
    print(f"    next   : cd {worktree}")
    return True


def interactive_session(repo: Path, base: Path) -> None:
    print("create_wt — interactive session")
    print("press Ctrl+C at any time to abort")
    while True:
        tag = prompt("tag")
        name = prompt("name")
        worktree, branch = plan(repo, base, tag, name)
        execute(repo, worktree, branch, yes=False)
        print()
        if not confirm("create another?", default_yes=False):
            print("bye.")
            return


# ---------- cli ----------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="create_wt",
        description=(
            "Create a git worktree and a new branch under "
            "<repo>/<base>/<tag>/<name>. Both --tag and --name must be "
            "kebab-case: lowercase letters, digits, and single hyphens "
            "between segments. No spaces, no underscores, no capitals."
        ),
        epilog=(
            "examples:\n"
            "  create_wt.py --tag fix --name invoice-logic-bug\n"
            "  create_wt.py --tag feat --name add-export-csv\n"
            "  create_wt.py                                  # interactive session"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--tag", "-t",
        help="category tag, e.g. fix, feat, chore, refactor (kebab-case)",
    )
    p.add_argument(
        "--name", "-n",
        help="worktree name in kebab-case, e.g. invoice-logic-bug",
    )
    p.add_argument(
        "--base", "-b",
        default=DEFAULT_BASE,
        help=(
            "base directory for worktrees, relative to repo root "
            f"(default: {DEFAULT_BASE})"
        ),
    )
    p.add_argument(
        "--yes", "-y",
        action="store_true",
        help="skip the confirmation prompt",
    )
    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    repo = find_repo_root()
    base = Path(args.base)

    if args.tag or args.name:
        # one-shot: validate flag values, fill in whichever flag was omitted
        tag = check(args.tag, "tag") if args.tag else prompt("tag")
        name = check(args.name, "name") if args.name else prompt("name")
        worktree, branch = plan(repo, base, tag, name)
        ok = execute(repo, worktree, branch, yes=args.yes)
        return 0 if ok else 1

    # no flags: full interactive session
    interactive_session(repo, base)
    return 0


if __name__ == "__main__":
    sys.exit(main())
