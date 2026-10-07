#!/usr/bin/env bash
# Publishes the site to the live repo, DS-2-dev/appliedlab.ai, which GitHub
# Pages builds and serves at appliedlab.ai. That repo holds only this folder,
# as a snapshot without the monorepo's history.
#
#   scripts/publish-live.sh "Commit message"
#
# It copies every file git tracks here into a clone of the live repo, keeps
# the clone's CNAME, and refuses to push unless the clone then matches this
# folder exactly, so a copy from the wrong folder can never ship. GitHub's
# push sometimes fails with "Internal Server Error"; it retries for a few
# minutes.

set -euo pipefail

SITE="$(cd "$(dirname "$0")/.." && pwd)"
LIVE="${LIVE_CLONE:-${TMPDIR:-/tmp}/appliedlab-live}"
REMOTE="git@github.com:DS-2-dev/appliedlab.ai.git"
MESSAGE="${1:?Give a commit message}"

if [ -d "$LIVE/.git" ]; then
  git -C "$LIVE" fetch -q "$REMOTE" main
  git -C "$LIVE" reset -q --hard FETCH_HEAD
else
  git clone -q "$REMOTE" "$LIVE"
fi

# Clear everything but the clone's own CNAME, then copy the tracked files.
(cd "$LIVE" && git ls-files -z | grep -zv '^CNAME$' | xargs -0 rm -f)
find "$LIVE" -mindepth 1 -type d -empty -not -path "$LIVE/.git*" -delete
git -C "$SITE" ls-files -z | rsync -a --from0 --files-from=- "$SITE/" "$LIVE/"

# The clone must now hold exactly this folder's files, byte for byte.
missing=0
while IFS= read -r -d '' f; do
  cmp -s "$SITE/$f" "$LIVE/$f" || { echo "differs: $f" >&2; missing=1; }
done < <(git -C "$SITE" ls-files -z)
extra="$(comm -13 <(git -C "$SITE" ls-files | sort) <(cd "$LIVE" && git ls-files --others --cached --exclude-standard | grep -v '^CNAME$' | sort -u) || true)"
[ -z "$extra" ] || { echo "extra files in the live copy:" >&2; echo "$extra" >&2; missing=1; }
[ -f "$LIVE/.github/workflows/pages.yml" ] || { echo "the Pages workflow is missing" >&2; missing=1; }
[ "$missing" = 0 ] || { echo "Not pushing: the live copy doesn't match $SITE." >&2; exit 1; }

cd "$LIVE"
git add -A
if git diff --cached --quiet; then
  echo "Nothing to publish."
  exit 0
fi
git commit -q -m "$MESSAGE"
for _ in 1 2 3 4 5 6; do
  git push -q "$REMOTE" HEAD:main 2>/dev/null || true
  if [ "$(git ls-remote "$REMOTE" main | cut -c1-40)" = "$(git rev-parse HEAD)" ]; then
    echo "Published $(git rev-parse --short HEAD). GitHub Pages deploys it in about two minutes."
    exit 0
  fi
  sleep 30
done
echo "GitHub refused the push. Try again in a few minutes." >&2
exit 1
