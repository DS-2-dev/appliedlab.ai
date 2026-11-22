# Applied AI Lab website

GitHub Pages serves appliedlab.ai from a snapshot of The Lab's public platform.
The Pages workflow fetches pages and assets from the platform on pushes to
main and about every 15 minutes. If a required page or asset fails to download,
the previous deployment stays live.

## Preview the public site

From this directory, fetch a fresh snapshot and serve it locally with Python 3.

```sh
preview_dir="$(mktemp -d)"
python3 -I scripts/snapshot-the-lab.py "$preview_dir"
python3 -m http.server --bind 127.0.0.1 --directory "$preview_dir" 8000
```

Open http://localhost:8000. Sign-in and workspace links open the platform.

## Publish workflow or snapshot changes

After committing changes, run `scripts/publish-live.sh "What changed"` to
copy this directory's tracked files to the DS-2-dev/appliedlab.ai repository.
That repository deploys through GitHub Actions.

## Legacy Worker

The separate Worker, its database migrations, and its setup instructions are in
`worker/`. Its shared TypeScript modules and tests live in `src/` and
`scripts/`. Run `npm ci` and `npm test` here for the shared modules.
