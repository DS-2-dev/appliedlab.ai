#!/usr/bin/env bash
# Dry run of migrations/0010_gates_and_orgs.sql against a copy of the live
# database. Reads the remote database once (wrangler d1 export, read only),
# loads the export into a throwaway local database in a temp folder, applies
# 0010 there and compares row counts before and after. Nothing is written to
# the remote database, and every run starts from a fresh copy. The export is
# kept at worker/backups/<timestamp>.sql (git ignores it) as a backup to
# restore from; the script prints its path.
#
#   cd worker && bash scripts/dry-run-migration.sh
#
# DRYRUN_SQL=path/to/export.sql skips the export and loads that file instead.
# Exits non-zero when any table ends up with fewer rows than it started with.
set -euo pipefail

worker_dir="$(cd "$(dirname "$0")/.." && pwd)"
migration="$worker_dir/migrations/0010_gates_and_orgs.sql"
work="$(mktemp -d "${TMPDIR:-/tmp}/projectum-dryrun.XXXXXX")"
trap 'rm -rf "$work"' EXIT

wrangler() { (cd "$worker_dir" && npx --no-install wrangler "$@"); }

# A config of its own, so the local copy can never be mistaken for the real
# database: a different name, a dummy id, and state kept in the temp folder.
cat >"$work/wrangler.jsonc" <<'EOF'
{
  "name": "projectum-dryrun",
  "compatibility_date": "2026-09-01",
  "d1_databases": [
    { "binding": "DB", "database_name": "appliedlab-projectum-dryrun", "database_id": "00000000-0000-0000-0000-000000000000" }
  ]
}
EOF
local_d1() { wrangler d1 execute appliedlab-projectum-dryrun --local --config "$work/wrangler.jsonc" --persist-to "$work/state" "$@"; }

if [[ -n "${DRYRUN_SQL:-}" ]]; then
  cp "$DRYRUN_SQL" "$work/export.sql"
  echo "Using $DRYRUN_SQL"
else
  mkdir -p "$worker_dir/backups"
  backup="$worker_dir/backups/$(date -u +%Y%m%dT%H%M%SZ).sql"
  echo "Exporting appliedlab-projectum (read only)..."
  wrangler d1 export appliedlab-projectum --remote --output "$backup" >/dev/null
  cp "$backup" "$work/export.sql"
  echo "Kept the export at $backup"
fi

# The export interleaves each table's rows with its CREATE TABLE, so a row
# can arrive before the table its foreign key points at exists. Load the
# schema first, then the rows, parents before children. D1 writes each row
# as one INSERT on one line.
node - "$work/export.sql" "$work/schema.sql" "$work/rows.sql" <<'EOF'
const fs = require("node:fs");
const [src, schemaOut, rowsOut] = process.argv.slice(2);
const order = ["d1_migrations", "users", "login_codes", "sessions", "problems", "claims", "claim_members", "projects",
  "submissions", "meetings", "selections", "notifications", "reminders_sent"];
const rank = (line) => {
  const table = (line.match(/^INSERT INTO "?([^"\s(]+)"?/) || [])[1];
  const i = order.indexOf(table);
  return i === -1 ? order.length : i;
};
const lines = fs.readFileSync(src, "utf8").split("\n");
const rows = lines.filter((l) => l.startsWith("INSERT INTO "));
if (rows.some((l) => !l.endsWith(");"))) throw new Error("An INSERT spans more than one line; cannot reorder the export safely.");
fs.writeFileSync(schemaOut, lines.filter((l) => !l.startsWith("INSERT INTO ")).join("\n") + "\n");
fs.writeFileSync(rowsOut, rows.map((l, i) => [rank(l), i, l]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((r) => r[2]).join("\n") + "\n");
EOF

echo "Loading the copy into a throwaway local database..."
local_d1 --yes --file "$work/schema.sql" >/dev/null
local_d1 --yes --file "$work/rows.sql" >/dev/null

if ! local_d1 --json --command "SELECT 1 FROM claims LIMIT 1" >/dev/null 2>&1; then
  echo "The copy has no claims table: 0010 looks already applied. Nothing to dry run." >&2
  exit 1
fi

counts() { local_d1 --json --command "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s)[0].results[0])))'; }

pre="$(counts "SELECT
  (SELECT COUNT(*) FROM problems) AS problems,
  (SELECT COUNT(*) FROM claims) AS claims,
  (SELECT COUNT(*) FROM claim_members) AS claim_members,
  (SELECT COUNT(*) FROM projects) AS projects,
  (SELECT COUNT(*) FROM submissions) AS submissions,
  (SELECT COUNT(*) FROM meetings) AS meetings,
  (SELECT COUNT(*) FROM selections) AS selections,
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM notifications) AS notifications")"

echo "Applying 0010_gates_and_orgs.sql to the copy..."
local_d1 --yes --file "$migration" >/dev/null

broken="$(local_d1 --json --command "PRAGMA foreign_key_check" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].results.length))')"
if [[ "$broken" != "0" ]]; then
  echo "$broken row(s) point at rows that do not exist after the migration (PRAGMA foreign_key_check)." >&2
  exit 1
fi

post="$(counts "SELECT
  (SELECT COUNT(*) FROM postings) AS postings,
  (SELECT COUNT(*) FROM projects) AS projects,
  (SELECT COUNT(*) FROM project_members) AS project_members,
  (SELECT COUNT(*) FROM boards) AS boards,
  (SELECT COUNT(*) FROM submissions) AS submissions,
  (SELECT COUNT(*) FROM meetings) AS meetings,
  (SELECT COUNT(*) FROM selections) AS selections,
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM notifications) AS notifications,
  (SELECT COUNT(*) FROM orgs) AS orgs,
  (SELECT COUNT(*) FROM reviews) AS reviews")"

# Each new table next to the old one it came from. orgs is new; reviews has
# one row per old claim.
PRE="$pre" POST="$post" node -e '
const pre = JSON.parse(process.env.PRE), post = JSON.parse(process.env.POST);
const pairs = [
  ["problems", "postings"], ["claims", "projects"], ["claim_members", "project_members"],
  ["projects", "boards"], ["submissions", "submissions"], ["meetings", "meetings"],
  ["selections", "selections"], ["users", "users"], ["notifications", "notifications"],
  [null, "orgs"], ["claims", "reviews"],
];
let short = 0;
console.log("\n" + "before".padEnd(16) + "n".padStart(6) + "   " + "after".padEnd(16) + "n".padStart(6));
for (const [a, b] of pairs) {
  const n0 = a ? pre[a] : null, n1 = post[b];
  const bad = a !== null && n1 < n0;
  if (bad) short++;
  console.log((a ?? "-").padEnd(16) + String(n0 ?? "").padStart(6) + "   " + b.padEnd(16) + String(n1).padStart(6) + (bad ? "   FEWER" : ""));
}
if (short) { console.error(`\n${short} table(s) lost rows.`); process.exit(1); }
console.log("\nEvery row carried forward.");
'
