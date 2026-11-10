# Gantry port, phase A: rules and small gaps

Date: 2026-11-10. Owner: Dante. Source of the features: Kylar's Gantry (branch `cloudflare-spike` of `Weber-State-AI-Applied-Lab/applied-ai-lab`). Inventory of what Gantry has against Projectum: `docs/superpowers/specs/2026-11-10-gantry-port-inventory.md`.

## Intent

Projectum keeps its backend (Cloudflare Worker, D1 through raw prepared SQL, KV, the static Next site) and takes on Gantry's features, phase by phase. Phase A changes four rules to Gantry's where Dante chose so, and fills the gaps that need nothing beyond the tables and infrastructure Projectum already has.

## Rules (decided by Dante, 2026-11-10)

1. **Levels are set by an Admin.** Nothing promotes a member on its own any more: approving a plan no longer makes the team Sponsored, and integrating no longer makes them Builders. An Admin sets any member's level (affiliate, sponsored, builder) from the Overview's accounts, and the member hears about it.
2. **Partners and faculty both wait for approval.** A new @weber.edu account starts `pending`, like a partner, and sees the waiting page until an Admin approves it. The Admin hears about each one the way they hear about partners (email with a link, plus the in-app list). Approving a rep does not file them under an organization.
3. **A project is private to its people.** A project and its board are visible to its team, the posting's partner organization once the plan is approved (as now), and staff (reps and admins, as now). Other members no longer see other members' projects at all: the "colleague" outline view goes, and members lose All Projects. Public profiles keep showing a member's own approved work, since the member opts into that.
4. **Returned statuses stay** (`returned`, `plan_returned`, `submission_returned`). No status migration.

## Gaps filled in phase A

5. **Withdraw takes a reason, and an Admin can reopen.** Releasing a claim asks why (required, stored). An Admin can reopen a withdrawn project, which puts it back in the status it was withdrawn from.
6. **Postings carry Gantry's extra fields**, all optional plain text: business model, why it matters, dependencies, what it achieves, goal, key milestones, and a Drive folder link (https only). The form shows them under a "More detail" disclosure; the posting page shows the filled ones.
7. **Admins edit the categories.** Add, rename, describe, reorder and archive disciplines and tags in the `taxonomy` table, from a Categories tab on the Overview. Archived terms stay on old postings but can't be picked for new ones.
8. **Notification settings.** Each person chooses, per kind of notification, whether it shows in the app and whether it emails them, with sensible defaults by role. Notification emails go out through the existing Resend sender, linking to the item.
9. **Daily digest.** An optional daily email of the unread notifications since the last digest, sent from the existing daily cron.

## Non-goals

Everything in the inventory's later phases: pipeline tree, milestones and timeline, files, showcase, teams, messages, documents, live updates, Google Calendar/Drive, school branding, reviewed changes to live postings, partner shortlist and tags, rep notes, join capture forms, profile highlight. Renaming posting to post or court to Up Next.

## Constraints

- Every status change still goes through `transition()`; new SQL uses guarded updates and `db.batch()` like the rest of the Worker.
- Each schema change is a new numbered migration under `website/site/worker/migrations/`.
- Rendered copy lives in `src/content/copy.ts` and passes `node scripts/copy-lint.mjs`.
- Worker tests (`npm test` in `worker/`) and site tests (`npm test` in the site) stay green.
