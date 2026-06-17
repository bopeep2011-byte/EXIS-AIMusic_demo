#!/usr/bin/env python3
"""List largest blobs in git history; exit 1 if any blob >= limit MB."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

LIMIT_MB = 25


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    lines = subprocess.check_output(["git", "rev-list", "--objects", "--all"], cwd=root, text=True).splitlines()
    blobs: list[tuple[int, str]] = []
    for line in lines:
        oid, *rest = line.split(" ", 1)
        size = int(subprocess.check_output(["git", "cat-file", "-s", oid], cwd=root, text=True).strip())
        path = rest[0] if rest else ""
        if size > 0:
            blobs.append((size, path))
    blobs.sort(reverse=True)
    bad = [b for b in blobs if b[0] >= LIMIT_MB * 1024 * 1024]
    print(f"Repository: {root}")
    print(f"Limit: {LIMIT_MB} MB per blob\nTop 15:")
    for size, path in blobs[:15]:
        flag = " !! OVER LIMIT" if size >= LIMIT_MB * 1024 * 1024 else ""
        print(f"  {size / 1024 / 1024:7.2f} MB  {path}{flag}")
    if bad:
        print(f"\n{len(bad)} blob(s) >= {LIMIT_MB}MB — fix before push (see GITHUB_SETUP.md)")
        return 1
    print("\nOK — no blobs over limit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
