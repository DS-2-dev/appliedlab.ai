"""Check the 600-line limit on files in the site checkout."""

import os
import subprocess
from pathlib import Path


root = Path(__file__).resolve().parent.parent
paths = subprocess.check_output(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "."],
    cwd=root,
)
oversized = []
for name in paths.split(b"\0"):
    path = root / os.fsdecode(name)
    if not name or path.is_symlink() or not path.is_file():
        continue
    with path.open("rb") as stream:
        count = sum(1 for _ in stream)
    if count > 600:
        oversized.append(f"{path.relative_to(root)} ({count} lines)")

if oversized:
    raise SystemExit("Files over 600 lines\n" + "\n".join(oversized))
print("All project files are within 600 lines.")
