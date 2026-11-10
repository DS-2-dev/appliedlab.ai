# Gantry -> Projectum port inventory

Date: 2026-11-10. Read-only research.

- Gantry = `/private/tmp/claude-501/-Users-dantesmith-project-website-site/25450d2a-ede6-4c2c-8163-435767f40905/scratchpad/gantry` (paths below are relative to it). Abbreviated as `G:`.
- Projectum = `/Users/dantesmith/project/website/site` (paths relative to it). Abbreviated as `P:`.

## 0. The two stacks at a glance

| | Gantry | Projectum |
|---|---|---|
| Runtime | Next 16 App Router, server components + server actions + `/api/*` routes, cookie session (`G:src/core/data/auth.ts`) | Next static export on GitHub Pages; every read and write is a bearer-token call to the Worker `appliedlab-ask` (`P:worker/src/index.ts`) |
| DB | PostgreSQL via Drizzle, 48 tables (`G:src/core/data/schema.ts`) | D1 via raw prepared SQL, migrations `P:worker/migrations/0001..0011` |
| Realtime | SSE from `G:src/app/api/stream/route.ts`, Postgres LISTEN/NOTIFY (`G:src/core/data/bus.ts`, `live.tsx`); spike swaps in a Durable Object (`G:cloudflare/live-hub.ts`) | None. The shell polls `GET /shell` (`P:src/components/projectum/shell-store.ts`) |
| Files | Disk / R2 behind `G:src/core/data/files.ts` (25 MB max) | KV namespace `REPORTS`, final-report PDFs only (`P:worker/wrangler.jsonc` says R2 is not turned on for the account) |
| Editor | Tiptap 3 + Yjs collab, docx, pdfkit, mammoth | None (plain text fields) |
| Size | ~25.5k lines in `src/` | ~5.3k lines in `worker/src`, ~9.4k in `src/components/projectum` |
| Spec | `G:SPEC.md` (678 lines, decided items through 2026-11-09). Section 17 item "concepts from Projectum" shows Gantry already absorbed Projectum ideas (self-started projects, return-is-not-a-status, gate snapshots, withdrawn, email-domain roles) | Pipeline vocabulary in `P:src/lib/pipeline/domain.ts`, machines in `P:src/lib/pipeline/machines.ts`, handoff text `P:src/lib/pipeline/handoffs.ts` |

Constraints that recur below:
- **Static export**: Gantry's dynamic routes (`/w/posts/[id]`, `/p/[id]/*`, `/f/[id]`, `/u/[handle]`, `/showcase/[slug]`) must become query-param views inside `/projectum` (Projectum already does `?view=&id=`, `?posting=`, `?project=` in `P:src/components/projectum/nav.ts`). Server-rendered SEO pages (public showcase stories, sitemap with live items) are impossible without a rebuild per publish.
- **Server actions -> Worker routes**: each of Gantry's `G:src/app/actions/*.ts` (account, admin, auth, docs, explorer, messages, pipeline, public, shell, teams) becomes Worker endpoints.
- **Drizzle -> raw SQL**: Gantry's own spike (`G:CLOUDFLARE-SPIKE.md`) counts 634 query calls in 72 files; without Drizzle it estimates ~2 weeks just for the data layer. PG-only bits: jsonb `@>` containment (`G:src/core/data/files.ts:72`, `G:src/app/f/[id]/page.tsx:27`), `->>` (`G:src/core/data/conversations.ts:107`), `pg_advisory_xact_lock` + 2 interactive transactions (`G:src/core/data/doc-sync.ts`), 13 `ilike`, 6 `serial` ids. D1 has no interactive transactions; Projectum already uses `env.DB.batch()` for atomicity (`P:worker/src/events.ts`).
- **No realtime yet**: anything "live" starts as polling, then a Durable Object.

Legend: Status HAS / PARTIAL / MISSING. Difficulty S (< 1 day), M (1-3 days), L (1-2 weeks), XL (> 2 weeks or new infra + big deps).

---

## 1-3. Feature inventory, Projectum status, port difficulty

### A. Roles and sign-in

| Feature | What the user sees | Gantry files | Gantry tables | Projectum | Port |
|---|---|---|---|---|---|
| Email-code sign-in | 6-digit code, no password | `G:src/core/data/auth.ts`, `G:src/app/signin/*`, `G:src/app/actions/auth.ts` | users, sessions, login_codes, outbox | HAS: `P:worker/src/accounts.ts` (+ optional password, `P:worker/src/passwords.ts`) | - |
| Google sign-in | Continue with Google | `G:src/app/api/auth/google/*`, `G:src/core/data/google.ts` | google_accounts | HAS for sign-in only (`/auth/google/*` in accounts.ts); no stored tokens | - |
| Role from email | mail.weber.edu=member, weber.edu=rep, else partner | `G:src/core/registry/roles.ts` | users.role | HAS: `P:src/lib/email-rules.ts` | - |
| Rep needs Admin confirmation | @weber.edu waits as `pending_rep`, sees only Profile/Settings | `roles.ts`, `G:src/app/w/people/*` | users.role=pending_rep | PARTIAL: reps are active at once; it is *partners* who wait for approval (`accounts.ts:389`) | S (policy decision + role value) |
| Admin role | Admin = Advisor/President/Officers, full control | `roles.ts` PERMISSIONS | users.role=admin | HAS differently: `users.roles` JSON + `APPROVERS` env (`P:src/components/projectum/nav.ts` isAdmin) | - |
| Member levels | Badge everywhere, Admin sets by hand | `roles.ts` LEVELS, People page | users.level | PARTIAL: levels stored but *earned automatically* (affiliate/sponsored/builder, `level_locked`), `P:src/lib/pipeline/domain.ts` | S (add manual set on Overview) |
| Permissions table | One registry of who may try what | `roles.ts`, `G:src/core/data/access.ts` | - | PARTIAL: rules spread in each Worker module + machines `by:` | M (only if we want a central table) |
| Demo sign-in / dev outbox | `/demo`, `/dev/outbox` | `G:src/app/demo`, `G:src/app/dev/outbox` | outbox | PARTIAL: `DEV_CODES=1` shows code on the form | skip |

### B. Posts and Notice Board

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Notice Board | Sortable list, dropdown-chip filters generated from data, Claim | `G:src/app/w/board/*`, `G:src/core/components/collection.tsx`, `filter-chip.tsx`, `G:src/core/data/posts.ts` (boardFacets) | posts, post_categories, category_* | HAS: `P:src/components/projectum/postings-view.tsx` (discipline filter + search) | chips: S |
| Post fields | Title + short problem required; business model, problem, why, dependencies, achieves, goal, key milestones, Drive folder optional | `G:src/app/w/posts/post-form.tsx`, `G:src/core/data/pipeline.ts` (PostInput) | posts | PARTIAL: `P:src/components/projectum/posting-form.tsx` has title, summary, details, disciplines, tags, effort, deliverable, deadline | S (add columns) |
| Post lifecycle | Draft, Pending, Live, Inactive; pull back, take down, relaunch, delete unsent draft | `G:src/core/registry/statuses.ts`, `pipeline.ts` | posts.status, status_dates | HAS (different names): `postingMachine` draft/in_review/returned/live/paused/closed/archived | rename only, see section 4 |
| Reviewed changes to a live post | Edits collect as a revision; Rep sees field-by-field diff; approved version stays up | `pipeline.ts` submitPostChanges/recall/discard, review gate | posts.revision (jsonb), reviews gate "post changes" | MISSING: `PATCH /postings/:id` edits in place, blocked only while in review | M |
| Featured post on public home | Partner opts in | `pipeline.ts` setPostFeatured, `posts.ts` featuredPosts | posts.featured | MISSING | S (but static home needs client fetch) |
| Categories admin | Admin defines groups/options; Company group auto-fills from partner orgs; archived options kept | `G:src/app/w/categories/*` | category_groups, category_options, post_categories | PARTIAL: `taxonomy` table with discipline/tag (`P:worker/src/taxonomy.ts`, GET only); no admin editor found | S-M |
| Post page with tabs | Overview / Post / Work / Files / History | `G:src/app/w/posts/[id]/*` | posts, projects, reviews, files | PARTIAL: `P:src/components/projectum/posting-view.tsx` is one page with status, review rounds, teams | M |
| Partner organizer on Work tab | Sort, tag, shortlist delivered work; request meeting; adopt | `G:src/app/w/posts/[id]/work/*` | partner_marks, meetings | PARTIAL: `selections` table + meeting request (`P:worker/src/phase2.ts`); no tags/shortlist | S-M |

### C. Projects and teams

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Claim a post | Claim, optionally into a team, with confirmation | `pipeline.ts` claimPost, `G:src/app/w/_components/claim-button.tsx` | projects, project_members | HAS: `POST /postings/:id/claim` (`P:worker/src/projects.ts`), `claim-dialog.tsx` (teammates) | - |
| Self-started project | Name + description, ends at Complete, "Self-started" label | `pipeline.ts` startProject | projects.post_id null | HAS: `POST /proposals` creates a `postings.kind='self'` + project (`proposal-dialog.tsx`, `add-project-dialog.tsx`) | - |
| Project membership | People on project, one Lead, add/leave/remove | `pipeline.ts` addProjectMember, `G:src/app/p/[id]/_parts.tsx` | project_members.lead | HAS: project_members.role lead/member | - |
| Project privacy | Only its people, its team, its partner, staff can open | `G:src/core/data/access.ts` | - | CONFLICT: members and reps see every account's projects (`P:src/components/projectum/all-projects.tsx` header) | S (policy) |
| Withdraw / reopen | Withdraw with reason from most statuses; Admin reopens to prior status | `pipeline.ts` withdrawProject/reopenProject | projects.withdrawn_from, withdrawn_reason | PARTIAL: `withdraw` ("Release claim") exists; no reason stored, no reopen | S |
| Projects explorer (Drive-like) | Rows/grid, personal nested folders, rename-in-my-view, drag-drop, multi-select, archive, right-click menus | `G:src/app/w/projects/explorer.tsx`, `G:src/core/components/explorer.tsx` (600 lines), `context-menu.tsx`, `G:src/core/data/project-folders.ts`, `G:src/app/actions/explorer.ts` | folders (kind project/post), placements | PARTIAL: sidebar "Your Projects" one-level list with rename + colour (`P:src/components/projectum/project-folders.tsx`); "All Projects" grid (`all-projects.tsx`); "My Projects" list (`my-projects-view.tsx`) | M-L |
| Teams (self-organized) | Any member creates a team; Owner/Manager/Member; Private/Discoverable; requests to join; settings; details; delete | `G:src/core/data/teams.ts`, `G:src/core/registry/teams.ts`, `G:src/app/w/messages/teams/**`, `G:src/app/w/teams/**` | teams, team_members, team_requests | MISSING (a "team" in Projectum is a project's members). Nearest pattern: orgs + org_requests (`P:worker/src/orgs.ts`) | M (data + settings UI); depends on Messages for the workspace |
| File a project under a team | Whole team gets edit access; confirmation dialog | `teams.ts` setProjectTeam, `G:src/core/components/team-share.tsx` | projects.team_id | MISSING | S after Teams |
| Team tasks | Title, owner, due, notes, done | `teams.ts` addTask/updateTask, right panel | team_tasks | MISSING | S after Teams |
| Team right panel | Shared / Tasks / Threads / Pinboard | `G:src/core/components/shell/right-panel.tsx` | files, pins, messages | MISSING | M after Teams + Messages + Files |
| Project Tool frame | Header + tabs: Dashboard, Plan, Messages, Files, Submit, Showcase; lock overlays until Active | `G:src/app/p/[id]/layout.tsx`, `G:src/core/components/shell/project-frame.tsx`, `G:src/core/registry/logic.ts` pageUnlocked | - | PARTIAL: project board view `P:src/components/projectum/project-board.tsx` (stage track + one card), `plan-editor.tsx`, `transition-bar.tsx` | M |
| Project dashboard | Status, recent activity, next steps, milestones progress bar + upcoming due dates | `G:src/app/p/[id]/page.tsx`, `G:src/core/data/project-view.ts` | events, milestones | PARTIAL: `next-steps.tsx`, `stage-bar.tsx`, `transition-bar.tsx`; no per-project activity log or due-date list | S-M |
| Board stages / build log (Projectum-only) | brainstorming -> solidifying -> prototype -> live, thumbnails, build log, role presets, notes URL | n/a | n/a | Projectum only: `P:src/lib/projects.ts`, `boards` table JSON, `build-dialogs.tsx`, `live-dialog.tsx` | decide keep/fold (section 4) |

### D. Milestones and timeline

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Milestone tree | Unlimited nesting, expand/collapse, row menu (add inside, rename, delete), Add milestone row | `G:src/core/components/milestones/timeline.tsx` (663 lines), `G:src/core/data/milestones.ts` | milestones (parent_id, sort, stage lab/partner) | PARTIAL: flat list, max 8, title + success criterion, one `finishBy` date, stored as JSON in `projects.plan` (`P:src/lib/problems.ts:53,178`); board "steps" with owner | L (new table + migrate JSON) |
| Gantt timeline | Drag to create a block, drag edges/middle, Ctrl+scroll zoom, years of reach, opens on current milestone | `timeline.tsx`, `G:src/core/lib/schedule.ts` (pure, 272 lines) | milestones.start/end | MISSING | L (schedule.ts ports as-is; canvas is the work) |
| Dependencies | Drag from dot to block; finish-to-start; pushes dependents; parent frames stretch | `timeline.tsx`, `schedule.ts`, `milestones.ts` connect/disconnect | dependencies | MISSING | in the L above |
| Change history | Who/when/old/new for every milestone change | `milestones.ts` | changes (serial id) | MISSING (only `events` rows for status changes) | S after tree |
| Approved-plan comparison | Approved dates as outlines behind blocks | `timeline.tsx`, review snapshot | reviews.snapshot, projects.approved_review_id | PARTIAL: `milestone_baselines` table already snapshots plan at submit/approve (`P:worker/src/projects.ts:327`) | S after Gantt |
| Check-ins | When due and not done: "Done?" (date finished) or "Not yet" (new date), shifting dependents; once per due date from daily job | `G:src/core/components/milestones/check-in.tsx`, `milestones.ts` checkIn/sendCheckInReminders | milestones.done_on, reminded_for | MISSING (Projectum has deadline + quiet-board reminders in `P:worker/src/reminders.ts`, cron exists) | M after Gantt |
| Progress log | Weekly update entries against a milestone, with link or screenshot | `milestones.ts` logProgress | progress | MISSING | S (screenshot needs Files) |
| Timeline replay | Chess-style replay of every change from approved plan, scrubber, 1/2/4x | `G:src/core/components/milestones/replay.tsx` | timeline_snapshots (jsonb) | MISSING | M after Gantt |
| Milestone note docs / passage links | Note per milestone; plan passages link to milestones both ways | `documents.ts` linksForMilestone | milestones.note_doc_id, doc_links | MISSING | needs editor (E) |
| Phase-2 checklist (Projectum-only) | Implementation milestones title + done | n/a | n/a | `selections.milestones` JSON, `PUT /projects/:id/phase` (`P:worker/src/phase2.ts`) | maps to Gantry partner-stage milestones (stage='partner') |

### E. Documents, editor, co-editing

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Document object, 3 sources | In-house editor, linked Google Doc, or uploaded file with viewer | `G:src/core/components/document/document.tsx`, `viewer.tsx`, `G:src/core/data/documents.ts` | documents (content jsonb, text, google_url, file_id) | MISSING (plan is plain `approach` text; report is a PDF; notes is a Google Doc URL) | M for the object + Google link; editor below |
| Tiptap editor with profiles | Slash menu, markdown shortcuts, selection menu, callouts, tables, code, images, file cards, embeds (Drive/YouTube/Loom/Vimeo/Figma), drag handles, full screen | `G:src/core/components/document/editor.tsx` (905), `blocks.tsx`, `nodes.tsx`, `extensions.ts`, `suggest.tsx`, `G:src/core/registry/editor.ts` | documents | MISSING | L. Large deps: ~15 `@tiptap/*` packages + lowlight. Client-only, so static export is fine |
| @references and mentions | People, milestones, files, projects, posts; mention notifies once | `mentions.tsx`, `G:src/core/data/doc-refs.ts` | doc_mentions | MISSING | M after editor |
| Comments on passages | Threads anchored by quote+prefix+suffix, survive review rounds, resolve/reopen | `comments.tsx`, `G:src/core/data/doc-review.ts` | doc_threads, doc_comments | MISSING | M after editor |
| Version history + restore | Each editing session a version; review rounds marked | `history.tsx`, `doc-review.ts` | doc_versions (serial) | MISSING | M after editor |
| Changes since last review | Block/word diff from previous round | `diff.tsx`, `G:src/core/lib/doc-diff.ts` (pure) | doc_versions, reviews | MISSING | S-M after versions |
| Outline + word count | Heading outline, reading time | `outline.tsx`, `G:src/core/lib/doc.ts` | - | MISSING | S after editor |
| Writing together | Live co-editing, named cursors, presence, per-user undo | `collab.ts`, `G:src/app/api/docs/[id]/{sync,stream,awareness}`, `G:src/core/data/doc-sync.ts` | doc_sync (Yjs updates, advisory lock) | MISSING | XL. Needs a Durable Object per document (the spike proved it), Yjs + y-protocols + @tiptap/y-tiptap; PG transactions move into the DO |
| Export to Word / PDF | Download .docx / .pdf | `G:src/core/data/export.ts`, `G:src/app/api/export/[docId]` | - | MISSING | M. `docx` can run in the browser; `pdfkit` in the Worker pushed Gantry's bundle to 3.13 MB compressed (over the free plan's 3 MB). Browser print-to-PDF is the cheap path |
| Word viewer | .docx rendered in viewer | `viewer.tsx` + mammoth, `G:src/app/api/files/[id]/html` | files | MISSING | S-M (mammoth runs in browser) |

### F. Files

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Upload / download / remove | Up to 25 MB, any type | `G:src/core/data/files.ts`, `G:src/app/api/files/*` | files | PARTIAL: only final-report PDFs in KV `REPORTS` (`P:worker/src/submissions.ts`) | M. KV values allow 25 MiB, so KV can carry it; R2 is cleaner (listing, range reads) but is not enabled on the account |
| One reference per file | `/f/<id>` page with live location (Project > Files, Post > Files, # Team > Shared) | `G:src/app/f/[id]/page.tsx`, `G:src/core/data/file-refs.ts`, `G:src/core/components/file-ref.tsx` | files (project_id/post_id/team_id/conversation_id/doc_id) | MISSING | S after upload (becomes `?file=` view) |
| Project Files explorer | Same explorer as Projects, shared folders, type icons, filters Type/People/Source/Modified, drag from desktop | `G:src/app/p/[id]/files/*`, `explorer.tsx`, `project-folders.ts` | folders (kind file), file_places | MISSING | M after explorer + upload |
| Drive links | Link a Drive file; embed by URL | `files.ts` linkDriveFile, embedUrl | files.drive_url | MISSING (only `notesUrl` Google Doc link per board) | S |
| Drive folder sync | List the partner's Drive folder in Files | `G:src/core/data/google.ts` listDriveFolder | google_accounts | MISSING | L. Needs Drive OAuth scopes and token refresh in the Worker; drive.readonly is a restricted scope (Google verification) |
| Inline document images | Images belong to the document | `G:src/core/components/document/upload.ts`, `G:src/app/api/public-image/[id]` | files.doc_id | MISSING | S after upload + editor |

### G. Messages and chat

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Conversation component | Messages with threads (replies), pins, attachments, edit/delete, system lines | `G:src/core/components/conversation/conversation.tsx`, `G:src/core/data/conversations.ts` | conversations, conversation_members, messages, pins | MISSING | M with polling; realtime needs a DO |
| Messages page by role | DMs and groups up to 12 (reuse same-people conversation), picker of reachable people; teams for members; team + project chats for reps | `G:src/app/w/messages/*`, `G:src/core/data/messaging.ts` | same | MISSING | M |
| Project chat | Per-project, locked until Active, partner excluded | `G:src/app/p/[id]/messages/*` | conversations.kind=project | MISSING | S after Conversation |
| Team chat + announcements + pinboard | Announcement pins itself | `G:src/app/w/messages/teams/[id]/chat.tsx` | messages.announcement, pins | MISSING | S after Teams + Conversation |
| Read-on-screen | Read when visible, clears related notifications | `conversations.ts` markConversationRead | conversation_members.last_read_at, notifications | MISSING | S (uses `->>` on events.data; D1 has `json_extract`) |
| Meeting scheduling | Partner request opens group chat with poll card: slots, yes/no/maybe answers, confirm; ICS download; Google Calendar event | `G:src/core/components/conversation/meeting.tsx`, `G:src/core/data/meetings.ts`, `G:src/app/api/meetings/[id]` | meetings (slots/answers/picks jsonb) | PARTIAL: `POST /projects/:id/meeting` makes a request row; staff mark it arranged (`P:worker/src/phase2.ts`) | M (ICS: S; Calendar API: M, needs calendar.events scope) |
| Partners page + Rep notes | Partner contacts, their posts, notes every Rep can read | `G:src/app/w/partners/*` | organizations, rep_notes (doc) | PARTIAL: org page for staff (`P:src/components/projectum/org-view.tsx`); no Rep notes | S (plain text notes) |

### H. Approvals, review gates, pipeline view

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Review Gate screen | Snapshot on the left, Approve / Return with feedback / rating on the right | `G:src/core/components/review-gate.tsx`, `G:src/core/data/review-view.ts` | reviews (snapshot jsonb, round, rating) | HAS: `P:src/components/projectum/review-view.tsx`, `P:worker/src/reviews.ts` (rounds, snapshot, score, plus Take/assign) | - |
| Approval Hub | One queue for every gate, shared views list filters | `G:src/app/w/hub/*` | reviews | HAS: `reviews-view.tsx` ("Reviews") | - |
| Gates | post, post changes, plan, submission, partner plan (member reviews), final report (partner reviews), publication (admin) | `G:src/core/registry/statuses.ts` | reviews.gate | PARTIAL: posting, action_plan, submission, completion. Missing: post changes, partner_plan, final_report, publication | per gate S once the subject exists |
| Status registry + handoffs | Status key/label/waiting-on, handoff dialog, next-step text, lock overlays, all data | `statuses.ts` (500 lines), `logic.ts` | - | HAS: `P:src/lib/pipeline/machines.ts`, `handoffs.ts`, `handoff-dialog.tsx`, `next-steps.tsx` | - |
| Return is not a status | Return goes back to the pre-gate status; review keeps feedback | `statuses.ts` | - | CONFLICT: Projectum has `returned`, `plan_returned`, `submission_returned` states (Gantry removed these at Projectum's own suggestion, SPEC 17) | M (status migration + UI) |
| Pipeline tree | Posts expand to projects; Self-started group; attention flags (review waiting, overdue check-in, 14 days quiet); My pipeline / All; filters, details pane; partner version limited to own posts | `G:src/app/w/pipeline/client.tsx` (393), `G:src/core/data/pipeline-view.ts`, `view-list.tsx` | posts, projects, reviews, events, milestones | PARTIAL: Overview tables (`overview-view.tsx`), My Postings, All Projects; no tree | M |
| Submission | Document + result links + who-did-what | `G:src/app/p/[id]/submit/*`, `pipeline.ts` submitWork | submissions (doc_id, links, contributions) | HAS (different shape): PDF report in KV + board launch links + contributions (`live-dialog.tsx`, `submissions.ts`) | - |
| Partner stage | Adopt -> agreement both sign -> partner writes plan + milestones -> member reviews -> work -> final report -> partner reviews -> Complete | `pipeline.ts` adoptProject/signAgreement/sendPartnerPlan/submitReport | agreements, milestones.stage=partner, reviews | PARTIAL: phase 2 "integrate" -> checklist -> completion_review -> complete (`P:worker/src/phase2.ts`, `phase-two.tsx`) | M (agreement + partner plan gate); full version needs milestones (D) and documents (E) |

### I. Activity, notifications, Up Next

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Event stream | Append-only events -> activity and/or notification | `G:src/core/data/emit.ts`, `G:src/core/registry/events.ts` (~55 types), `event-text.ts` | events, notifications | HAS: `P:worker/src/events.ts` emit() inside the same D1 batch | - |
| Bell / notifications page | In-app list, mark read | `G:src/app/w/notifications/*` | notifications | HAS: `notifications-menu.tsx`, `inbox-view.tsx`, `P:worker/src/notify.ts` | - |
| Per-event, per-channel prefs; defaults by role | Settings: in-app/email per event type | `G:src/app/w/settings/*`, registry events defaults | notification_prefs | MISSING | S-M |
| Email per notification, links to the item | Every event can email | `G:src/core/data/mail.ts`, `G:src/core/lib/mail-html.ts` | outbox, notifications.email_pending | PARTIAL: emails sent ad hoc in several modules (Resend) | S-M |
| Daily digest | Optional daily email | `G:src/core/data/digest.ts`, `G:src/app/api/cron/digest` | users.digest | MISSING (cron exists, `P:worker/wrangler.jsonc`) | S |
| Up Next | What's waiting on me; during work follows the next open milestone; final submission only when all done | `G:src/core/data/queries.ts` upNext, `G:src/app/w/page.tsx` | projects, milestones | PARTIAL: "In your court" (`P:worker/src/court.ts`, `court-list.tsx`); not milestone-driven | S (after D for the milestone part) |
| Home dashboard | Up Next, activity scoped by role, deadlines, Lab agenda, what colleagues work on; partner stats + new delivered work | `G:src/app/w/page.tsx` (280) | events, site_content | PARTIAL: Inbox; Overview counts for admin | M |
| Scoped activity | Project log vs. Home "what others did", links only where useful | `queries.ts` recentActivity, `event-text.ts` | events | MISSING as a UI (events are stored) | S-M |
| Inactivity reminders (Projectum-only) | Waiting >3 days, deadline near, quiet board 14 days | n/a (Gantry: out of scope) | n/a | Projectum only: `P:worker/src/reminders.ts` | keep |

### J. Showcase and publication

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| Showcase draft in project | Locked until Lab stage complete; tool name, what it does, college/department, partner, images, cover, story | `G:src/app/p/[id]/showcase/*` | publications, documents | MISSING (handoff text mentions it, `P:src/lib/pipeline/handoffs.ts:130`) | M (story text without editor), L with editor |
| Publication Queue + gate | Admin approves; Revise keeps the live version up until the revision is approved | `G:src/app/w/publication/*`, `pipeline.ts` *Publication | publications.status, live (jsonb), reviews | MISSING | S-M (reuse reviews) |
| Public showcase | `/showcase` grid, `/showcase/[slug]` article with shots, pull quotes, SSR for SEO | `G:src/app/(public)/showcase/**`, `G:src/core/data/showcase.ts` | publications | MISSING | M client-rendered (`/showcase?s=slug`); SEO needs a GitHub Action rebuild on publish (`generateStaticParams` from the Worker) |
| Profiles | Level badge, stats, one highlight project; public opt-in; name-on-showcase opt-in | `G:src/app/_profile.tsx`, `G:src/app/(public)/u/[handle]`, `G:src/app/w/profile/[handle]` | users.highlight_project_id, profile_public, name_on_showcase | PARTIAL: public profile `P:src/app/profile/page.tsx` + `P:src/components/profile/PublicProfile.tsx`, `GET /profiles/:handle`; no highlight project, no in-app profile page, no showcase-name opt-in (partner `hide_name` exists) | S |

### K. Admin and school branding

| Feature | What the user sees | Gantry files | Tables | Projectum | Port |
|---|---|---|---|---|---|
| People | Users, roles, levels, confirm reps | `G:src/app/w/people/*`, `G:src/app/actions/admin.ts` | users | PARTIAL: Overview accounts tab (approve partner, turn off/on, Claude access) | S |
| Site Content | Edit public content incl. weekly meeting info, hero, Learn | `G:src/app/w/site/*`, `G:src/core/data/site.ts` | site_content (jsonb) | MISSING (content is `P:src/content/copy.ts`, schedule in `data/` bundled at deploy) | M (static pages would fetch from Worker, or rebuild) |
| School branding | Admin enters school name, one color, logo; contrast-checked brand slots as CSS vars; in email too | `G:src/app/w/branding/*`, `G:src/core/lib/school-theme.ts` (pure, 265), `G:src/core/data/branding.ts`, `G:src/app/api/brand/*` | site_content | MISSING | M. school-theme.ts ports as-is; on a static site the vars load after first paint (flash) unless cached in localStorage like the dark theme (`71d3ab3`). Logo needs file storage |
| Capture forms | Join as member/partner/rep/donor | `G:src/app/(public)/join/*`, `G:src/app/actions/public.ts` | captures | MISSING | S (one Worker route + table) |

### L. Public site pages

| Gantry page | Projectum / site equivalent |
|---|---|
| Home `(public)/page.tsx` (pipeline line, three ways in, this week's meeting, newest work, daily principle) | HAS own design: `P:src/app/page.tsx` (five tiles, per memory: openwebui style, goo star) |
| how-it-works (interactive journey) | HAS: tile page `/how-it-works` (`P:src/app/[slug]/page.tsx`) |
| students, partners, faculty | HAS: tile pages `/students`, `/partners`, `/faculty` |
| learn | PARTIAL: `/about` tile |
| principles (Appendix A) | MISSING as a page (check copy.ts) | 
| meet (weekly meeting from Site Content) | PARTIAL: schedule data bundled at deploy |
| showcase, showcase/[slug] | MISSING (see J) |
| join/[kind] forms | MISSING (site has /login, /signup) |
| u/[handle] | HAS: `/profile?u=` |
| sitemap.ts, robots.ts | Unknown for site; static export can emit both at build |

Public pages are design work, not port work; the site's own redesign (branch `site-redesign`) already owns them.

### M. Anything else

| Feature | Gantry files | Projectum | Port |
|---|---|---|---|
| Command palette (Cmd+K) + `?` hotkey sheet, scoped hotkeys | `G:src/core/components/shell/palette.tsx`, `hotkeys.tsx`, `G:src/core/registry/hotkeys.ts` | PARTIAL: transitions carry a `hotkey` (`transition-buttons.ts`) | S-M |
| Shell (collapsible rail, remembered state, Your teams) | `G:src/core/components/shell/shell.tsx` | HAS: `app-sidebar.tsx`, `shell-store.ts` | - |
| Collection (table/card/tree, chips, shift-select) | `collection.tsx`, `view-list.tsx` | PARTIAL: per-view tables | M |
| Motion tiers, tokens | `G:src/core/components/motion.tsx`, `G:src/core/lib/motion-tier.ts`, `G:src/core/tokens.css` | own theme (`theme.ts`, `theme-switch.tsx`) | design call |
| Global search | `queries.ts` searchAll | MISSING | S-M |
| Ask the Lab, passwords, Claude-access flag, org join by domain, deadline/quiet reminders, client error alerts | n/a | Projectum only | keep |

---

## 4. Concept and vocabulary conflicts

| Concept | Gantry | Projectum | Note |
|---|---|---|---|
| Partner's problem | **Post** (`posts`) | **Posting** (`postings`) | Projectum code says "problem" in older parts too (`P:src/lib/problems.ts`) |
| "Board" | **Notice Board** = list of live posts | **Notice Board** (`N.board` view `board`) AND **board** = a project's JSON workspace (`boards` table, `boards.ts`) | Projectum is ambiguous internally; Gantry has no "board" workspace |
| Project | A claim on a post, private to its people/team | `projects` row (was "claims") + its `boards` row (was "projects") | Projectum's `src/lib/projects.ts` still calls the board a "Project" |
| Post statuses | draft, pending, live, inactive (archive is a filing action) | draft, in_review, returned, live, paused, closed, archived | pending=in_review; inactive≈paused+closed; returned is not a status in Gantry |
| Project statuses (Lab) | lab.claimed, lab.pending, lab.active, lab.submitted, lab.delivered, lab.complete | claimed, plan_review, plan_returned, active, submission_review, submission_returned, delivered, complete | Gantry has no *_returned; Gantry's "Pending" = plan in review |
| Partner stage | partner.accepted, partner.pending (partner's plan, member reviews), partner.active, partner.submitted (final report), partner.complete | "Phase 2": integrated, completion_review, complete | Gantry: "adopt"; Projectum: "integrate / Bring on to implement" |
| Withdrawn | project.withdrawn, keeps withdrawn_from, Admin reopen | withdrawn ("Release claim") | |
| Publication | publication.draft / review / published | none | |
| Gate names | post, post changes, plan, submission, partner_plan, final_report, publication | posting, action_plan, submission, completion | Projectum "completion" ≈ Gantry "final report review" |
| Review score | `rating` | `score` | |
| Reviewer assignment | Rep coverage via `posts.rep_id` / `organizations.rep_id`; "My pipeline" | Take / assign per review (`reviews.assigned_to`) | Different models |
| Whose move | "Waiting on" / **Up Next**; SPEC 10.1 bans ball/court wording | **Court**, "In your court", `handsTo`, `court.ts` | Direct wording conflict |
| Inbox | Notifications page + Home Up Next | Inbox = court + notifications | |
| Member levels | affiliate, sponsored, **senior**; set by Admin | affiliate, sponsored, **builder**; earned (plan approved -> sponsored, integrated -> builder), `level_locked` | Name and rule both differ |
| Rep sign-up | `pending_rep` until Admin confirms; partners immediate | Reps immediate; **partners** pending until approver | Opposite |
| Admin | a role value | `users.roles` JSON + `APPROVERS` env | |
| Passwords | "There are no passwords" | optional password (`0011_passwords.sql`) | |
| Team | Self-run group (Owner/Manager/Member) that owns projects | The people on one project ("teammates" at claim) | Name collision |
| Roles on a project | Lead only | Lead/member + per-person role presets (manager, uiux, frontend, backend, data, qa, communication) | |
| Organization kinds | business, nonprofit, local, university, club | company, nonprofit, public, lab | Projectum orgs also have primary user, join-by-domain, requests |
| Categories | category_groups/options, Company group from orgs | taxonomy discipline/tag | |
| Milestone | Tree node with start/end, deps, assignee, done | Title + success criterion, max 8, project-level finishBy; board "steps" with owner | |
| Plan | Action plan **document** + milestones | `approach` text + milestones + finishBy; board stages thesis/reasoning/techStack/steps | |
| Stage | Lab stage / Partner stage | Board stage brainstorming/solidifying/prototype/live; "Live" also a posting status | |
| Submission | Document + links + contributions | PDF report (KV) + launch links (site/slides/demo) + contributions | |
| Selection | partner_marks (shortlist, tags) + adopt | `selections` row = partner brought the team on | |
| Meeting | Scheduling poll in a group chat, Calendar | Request row, staff mark arranged | |
| Project visibility | Private to its people/team/partner/staff | Members and reps see every project | |
| Reminders | Inactivity reminders out of scope; check-ins only | Waiting >3 days, deadline, quiet 14 days | |
| Sealed solutions | Out of scope (SPEC 14) | `postings.sealed` column exists | |
| Compensation | Removed from posts | Not present (effort/deliverable/deadline instead) | Gantry has no effort/deadline |

---

## 5. Suggested port order

Each phase is usable on its own. "Infra" says when something new is needed beyond Worker + D1 + KV + the existing cron.

**Phase 0 – Decide vocabulary (no code, then one migration). S-M.**
Pick names for every row in section 4, especially: post vs posting, court vs Up Next, returned-as-status vs not, levels (senior vs builder, manual vs earned), rep vs partner approval, project privacy, what "board" means. Then one D1 migration that remaps statuses (Projectum did this once already in `0010_gates_and_orgs.sql`, with `scripts/dry-run-migration.sh`). Everything after depends on these choices.

**Phase 1 – Pipeline gaps on existing tables. Infra: none. ~1-2 weeks total, each item S.**
- Withdraw reason + Admin reopen.
- Rep confirmation / manual level setting / People page on the Overview.
- Post fields (business model, problem, why, dependencies, achieves, goal, key milestones, Drive folder URL), featured flag.
- Reviewed changes to a live post (revision JSON + "post changes" gate).
- Categories admin over `taxonomy`.
- Partner organizer: shortlist + tags (`partner_marks`).
- Rep notes (plain text first).
- Notification prefs per event/channel, role defaults, email per event, daily digest on the existing cron.
- Capture forms (join) table + route.
- Highlight project + name-on-showcase on profiles.

**Phase 2 – Pipeline tree, Home, activity. Infra: none. M.**
Pipeline tree with attention flags (staff + partner), project dashboard activity log, Home scoped activity, global search, command palette, chips on the Notice Board.

**Phase 3 – Milestones and timeline. Infra: none. L.**
New `milestones`, `dependencies`, `changes`, `timeline_snapshots`, `progress` tables; migrate `projects.plan.milestones` and phase-2 checklists in. Port `G:src/core/lib/schedule.ts` unchanged; build the Gantt from `timeline.tsx`. Then approved-plan outlines (reuse `milestone_baselines`), check-ins (existing cron), Up Next by milestone, replay. Store snapshots as JSON TEXT.

**Phase 4 – Files. Infra: storage. M.**
Use KV (already bound, 25 MiB per value) or turn on R2. Upload/download through the Worker with bearer auth (no `<img src>` cookies: images need signed short-lived URLs or blob fetches). One reference per file (`?file=` view), Drive links (no API), project Files explorer, shared + personal folders (`folders`, `file_places`, `placements`), then the Drive-style Projects explorer.

**Phase 5 – Showcase and publication. Infra: optional GitHub Action. M.**
Publication draft (plain fields + story text), Publication gate, Queue, public `/showcase` read from the Worker. For SEO, a rebuild-on-publish workflow that pre-renders slugs; otherwise client-rendered only. Images depend on phase 4.

**Phase 6 – Teams and Messages (polling). Infra: none at first. M-L.**
Teams (roles, access, requests, settings), team tasks, conversations/messages/pins, DMs and groups, project chat (locked until Active), announcements, read-on-screen, the team right panel. Poll every few seconds while a chat is open. Meeting scheduling poll + ICS download here.

**Phase 7 – Realtime. Infra: Durable Object. M.**
One hub DO with WebSocket hibernation (Gantry's `G:cloudflare/live-hub.ts` is an SSE in-memory version; its own notes say production should hibernate). The Worker publishes change topics after each D1 batch; pages subscribe. Replaces polling for chat, shell counts, and live refresh.

**Phase 8 – Documents and editor (single writer). Infra: none (files from phase 4). L.**
`documents` table; Tiptap with profiles; Google Doc link + upload sources; plan, submission, final report, milestone notes, showcase story move into documents. Then comments, versions, diff since last review, mentions/references, milestone passage links, outline. Export: docx in the browser; PDF by print stylesheet (avoid pdfkit in the Worker for bundle size). mammoth viewer in the browser.

**Phase 9 – Partner stage in full. Infra: none. M.**
Agreements both sign, partner plan + partner milestones (stage='partner'), partner-plan gate (member reviews), final-report gate (partner reviews). Needs phases 3 and 8. Replaces or extends Projectum's phase 2.

**Phase 10 – Writing together. Infra: Durable Object per document. XL.**
Yjs + y-protocols + @tiptap/y-tiptap; the DO holds the doc and serializes writes (replaces Gantry's PG advisory lock/transactions); persist compacted state to D1 or KV.

**Phase 11 – Google Workspace and branding. Infra: Google OAuth scopes. M-L.**
Store Google tokens (new `google_accounts`), Calendar event on confirmed meeting (calendar.events scope), Drive folder listing (restricted scope, needs Google verification). School branding (school-theme.ts port + logo in storage + localStorage cache to avoid a flash). Site Content editing (meeting info) via the Worker.

---

## Could not determine

- Whether the Cloudflare account is on the Workers paid plan (bundle limit 3 MB free vs 10 MB paid) and whether R2 can be turned on. `wrangler.jsonc` only says R2 "has not" been turned on.
- Gantry's wireframes (`G:wireframes/`) and its tests were not reviewed; the inventory comes from SPEC.md, README, schema, registry and file headers, not from running Gantry.
- Whether Projectum's site emits sitemap/robots, and whether a Principles/Learn page exists in `P:src/content/copy.ts` (only the five tile slugs were checked).
- Exact behaviour of every Gantry screen (e.g. People page details, Settings sections) beyond what SPEC.md states.
- Whether Gantry's `/w/teams/*` routes are live or leftover (SPEC says teams moved into Messages).
