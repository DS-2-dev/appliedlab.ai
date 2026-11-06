# Appendix B: Gantry (Kylar's platform-v2) feature inventory

Read-only inventory of `kylarvee/Lab_Platform`, branch `platform-v2`, taken 2026-10-21. Paths are relative to that repo's `src/`. This is the reference for what to port; nothing in its backend is reused.

Root: `/private/tmp/claude-501/-Users-dantesmith-project-website-site/3762158d-ff54-475b-8169-de6dce4c5a34/scratchpad/platform-v2`. All paths below are relative to `src/`.

Roles (`lib/domain.ts`): `member | partner | rep | admin`. Court: `member | partner | rep | admin | none`. Member levels: `affiliate → sponsored → builder`. Gates: `posting | action_plan | submission | completion | publication`.

---

## 1. State machines

The machines are defined in `lib/engine/machines.ts` and run by `runTransition` in `lib/engine/transition.ts:246`. Each transition runs as one DB transaction, in this order:
1. Load the context.
2. Check that the current status is in `from`. Otherwise: "already moved on".
3. Authorize (`transition.ts:150`).
4. Run the guard checks (`checksFor`, `:167`).
5. Run the per-transition side effects.
6. After commit, `flush()` the live messages.

`doTransition` (`server/transition.ts:9`) adds work after the transition:
- Meetings: calls `afterMeetingTransition`, which posts a system message to the thread and cancels the Google Calendar event.
- Postings and publications: `revalidatePath("/")`.
- Project withdrawn: re-queues the Drive mirror.

**Authorization (`transition.ts:150`)**
- `actingRole` picks the viewer's current portal if that role is allowed, otherwise any allowed role they hold.
- admin and rep: always allowed.
- partner: needs `viewer.orgId === entity orgId`. For publications, the author is also allowed.
- member: must be on the project (`project_members`). For publications, must be the author.

**Required feedback**: a transition with `feedback: "required"` fails without notes ("Add notes so they know what to change.").

**Common helpers**
- `snapshotDoc`: inserts a `document_versions` row with reason "submitted".
- `openReview`: inserts a `reviews` row (status `open`, `round = count + 1`).
- `closeOpenReview`: sets status, decidedBy, decidedAt, feedback and score.
- `takeBaseline`: inserts a `milestone_baselines` snapshot.
- `promote(users, to)`: raises level unless `levelLocked` is set or the user is already at or above it. Emits `member.level_changed`. Promotion to sponsored also creates an `ai_seat` task and emits `task.created` to admins (`:787`).

### 1a. Posting (`machines.ts:49`)

| Status | Court | Label |
|---|---|---|
| draft | partner | Draft |
| in_review | rep | In review |
| returned | partner | Returned |
| live | none | Live |
| paused | partner | Paused |
| closed | none | Closed |
| archived | none | Archived |

Transitions:
- **submit** "Send for review": draft, returned → in_review. By partner; hands to rep.
  - Guards: title ≥4 chars; summary ≥20 chars.
  - Effects: sets `submittedAt`; snapshots `bodyDocId`; opens a `posting` review.
  - Emits `posting.submitted` to all reps. Body says "· their first posting" when the org has no earlier published posting (`:272`).
- **withdraw** "Withdraw to edit": in_review → draft. By partner.
  - Closes the open review as `withdrawn`. Emits `posting.withdrawn` with no recipients (`:295`).
- **approve** "Publish to board": in_review → live. By rep or admin; hands to none; feedback optional; hotkey `a`.
  - Sets `publishedAt`; closes the review as approved.
  - Emits `posting.published` (everyone=true) to org users.
  - Also emits `posting.new_on_board` to every member whose `interests` overlap the posting's `disciplines` (Postgres array `&&`) (`:301`).
- **return** "Return with notes": in_review → returned. By rep or admin; hands to partner; feedback required; hotkey `r`.
  - Closes the review as returned. Emits `posting.returned` to org users (`:353`).
- **pause**: live → paused. By partner or admin.
- **resume** "Put back on board": paused → live. By partner or admin.
- **close** "Close to new claims": live, paused → closed. By partner or admin; danger style.
  - Sets `closedAt`. Notifies members on projects in claimed through submission_returned: "closed to new claims".
- **reopen**: closed → live. By partner or admin.
- **archive**: draft, closed, returned → archived. By partner or admin.
- pause, resume, close, reopen and archive share one code path (`:375`). It updates status and emits `def.event` with everyone=true.

Other posting rules:
- `kind = "self"` postings (member self-directed) are created with status `closed` and never shown on the board (`engine/commands.ts:103`).
- Visibility (`lib/auth/policy.ts` `canSeePosting`): staff see all postings. The org sees its own. Members see live, paused and closed postings. Self postings are hidden.

### 1b. Project (`machines.ts:115`)

| Status | Court | Label |
|---|---|---|
| claimed | member | Claimed |
| plan_review | rep | Plan in review |
| plan_returned | member | Plan returned |
| active | member | Active |
| submission_review | rep | Submission in review |
| submission_returned | member | Submission returned |
| delivered | partner | Delivered |
| integrated | member | Integrated (Phase 2) |
| completion_review | partner | Completion sign-off |
| complete | none | Complete |
| withdrawn | none | Withdrawn |

- Flow order (`PROJECT_FLOW`): claimed → plan_review → active → submission_review → delivered → integrated → complete. `projectStage()` folds `*_returned` into the review stage and completion_review into integrated.
- `OPEN_PROJECT_STATUSES`: every status except delivered, complete and withdrawn.

**Creation (not a machine transition)**
- `claimPosting` (`engine/commands.ts:19`):
  - Requires the member role and a posting in `live`.
  - Idempotent per member and posting (ignores withdrawn projects).
  - Creates a "Project files" folder, an action plan doc (template), a project with status `claimed`, and a `project_members` lead row.
  - Emits `project.claimed` (everyone) to org users, with the claim count.
- `createSelfProject` (`:84`):
  - Ensures the Lab org exists (`kind = "lab"`).
  - Creates a posting with `kind = "self"`, status `closed` and `showOnProfile = false`, plus folders, plan doc, project and lead row. `plannedTerms` is clamped to 1–6.
  - Writes an audit row `posting.created`. Emits `project.claimed` with no recipients.
  - Each teammate gets a `team_requests` invite and a `team.invited` event.

**Transitions**
- **submitPlan** "Submit action plan": claimed, plan_returned → plan_review. By member; hands to rep.
  - Guards: the plan doc has content (upload → fileId; gdoc → externalUrl; editor → authored text ≥120 chars); at least one milestone.
  - Effects: `planSubmittedAt`; doc snapshot; baseline `plan_submitted`; opens an `action_plan` review.
  - Emits `project.plan_submitted` to all reps; audience = members (`:409`).
- **approvePlan** "Approve plan": plan_review → active. By rep or admin; hands to member; feedback optional; hotkey `a`.
  - Sets `activatedAt`; closes the review; baseline `plan_approved`; `ensureSubmissionDoc` creates the "Final submission" doc from a template.
  - Emits `project.plan_approved`: members (court=true) and partner org users (none for self projects).
  - Promotes all members to sponsored, which creates ai_seat tasks (`:429`).
- **returnPlan**: plan_review → plan_returned. By rep or admin; feedback required; hotkey `r`. Closes the review; notifies members (`:450`).
- **submitWork** "Submit project": active, submission_returned → submission_review. By member; hands to rep.
  - Guards: the submission doc has content; `aiDisclosure` ≥10 chars.
  - Effects: `submittedAt`; snapshot; opens a `submission` review. Notifies reps (`:465`).
- **approveWork** "Approve & deliver": submission_review → delivered. By rep or admin; hands to partner; feedback optional; hotkey `a`. Accepts a `score`.
  - Self project: goes straight to **complete** (sets deliveredAt and completedAt) and emits `project.completed` to members (`:483`).
  - Otherwise: sets `deliveredAt`; closes the review with score; inserts a `delivery_marks` row (stage `new`). Emits `project.work_approved` to members (court=false) and partners (court=true) (`:482`).
- **returnWork**: submission_review → submission_returned. By rep or admin; feedback required; hotkey `r` (`:518`).
- **integrate** "Bring on to implement": delivered → integrated. By partner; hands to member.
  - Input `memberIds` (a subset of the team; defaults to all).
  - Sets `phase = "integrated"` and `integratedAt`; baseline `integrated`.
  - Notifies the chosen members, the rest of the team (court=false) and reps (court=false). Promotes the chosen members to builder (`:533`).
- **requestCompletion**: integrated → completion_review. By member; hands to partner. Opens a `completion` review; notifies partners (`:555`).
- **confirmCompletion** "Confirm complete": completion_review → complete. By partner or admin; feedback optional. Sets `completedAt`; closes the review; notifies members and reps (`:569`).
- **returnCompletion** "Not yet": completion_review → integrated. By partner or admin; feedback required. Closes the review; notifies members (`:587`).
- **withdraw** "Release claim": claimed, plan_returned, active, submission_returned → withdrawn. By member or admin; danger style. Sets `withdrawnAt`; closes open action_plan and submission reviews as withdrawn; notifies partners (`:602`).

**Project visibility (`policy.ts` `projectView`)**
- `full`: members, reps and admins.
- `partner`: the org, but only for non-self projects and not while claimed, plan_review, plan_returned or withdrawn.
- `colleague`: any other member (outline only).

**Related project rules**
- Milestones are editable in every open status (`server/milestones.ts:16`).
- Partners are notified of milestone changes only after a `plan_approved` or `integrated` baseline exists and the status is in PARTNER_VISIBLE.
- Milestone depth is 0–3.
- AI disclosure is editable in active, submission_returned and integrated (`server/projects.ts:92`).
- Showcase (publication) can start in delivered, integrated, completion_review or complete (`server/projects.ts:38`).
- Work share requires a non-self project in delivered or later (`server/work.ts`).
- Meetings can be requested in delivered, integrated, completion_review or complete (`lib/meetings.ts:24` MEETABLE).
- Sealed solutions unlock for members in the same statuses (`lib/sealed.ts:59`).
- End-of-term check-ins open for active, submission_returned and integrated (`lib/checkins.ts:16`).
- Teams: join and invite are blocked when withdrawn or complete. Joining a project in an approved status promotes the joiner to sponsored (`server/team.ts:20`).

### 1c. Meeting (`machines.ts:242`)

| Status | Court |
|---|---|
| requested ("Scheduling") | member |
| scheduled | none |
| held | none |
| cancelled | none |

**Machine transitions**
- **markHeld**: scheduled → held. By partner, rep or admin. Guard: `startsAt` ≤ now.
- **cancel**: requested, scheduled → cancelled. By partner, rep or admin; danger style.
- Both notify members, the requester and the rep (`transition.ts:618`).
- Afterwards `afterMeetingTransition` (`server/meetings.ts:304`) posts an idempotent system message. On cancel it also deletes the Google Calendar event.
- Note: for meetings, the partner check compares `orgId` to the project's posting org.

**Non-machine scheduling (`server/meetings.ts`)**
- **requestMeeting** (`:64`):
  - Allowed for partners of the org, or admins. Project must be in MEETABLE.
  - Duration is one of 15, 30, 45 or 60 min. Slots are in Lab time (America/Denver): up to 5 per proposal and 15 in total, future only, within 1 year.
  - `pickRep` chooses the rep who approved the submission, otherwise the rep with the fewest open meetings.
  - Creates the meeting (`requested`, slots with `accepts = [requester]`) and a meeting thread with members, requester and rep. Posts system, purpose and slots messages.
  - Emits `meeting.requested` to members and the rep.
- **toggleSlotAccept** (`:143`): participants only, while requested. Locks the row (`SELECT … FOR UPDATE`). When everyone has accepted, emits `meeting.times_proposed` to the requester and rep: "Everyone can make…".
- **proposeSlots** (`:191`): participants or admin, while requested. Emits `meeting.times_proposed` to the other participants.
- **confirmSlot** (`:240`): sets requested → **scheduled** with startsAt and endsAt.
  - Allowed for the requester, rep or admin. Any participant can confirm once everyone has accepted that slot (`canConfirmSlot`).
  - Emits `meeting.scheduled` to all participants, then `dispatchCalendarEvent` (Google Calendar with a Meet link, from the confirmer's account if connected).
- **sendToGoogleCalendar** (`:288`).

### 1d. Publication / showcase (`machines.ts:265`)

| Status | Court |
|---|---|
| draft | member |
| partner_consent | partner |
| admin_review | admin |
| returned | member |
| published | none |
| unpublished | none |

- **submit** "Submit for showcase": draft, returned, unpublished → admin_review **or** partner_consent. By member or partner (the author).
  - Guards: title ≥4; summary ≥20; body ≥80.
  - `needsConsent` = the publication has an org, `!org.showcaseConsentDefault`, and the author is not in that org.
  - partner_consent: emits `publication.consent_requested` to org users.
  - admin_review: emits `publication.submitted` to admins (`transition.ts:636`).
- **consent** "Allow showcase": partner_consent → admin_review. By partner. Sets `partnerConsentBy` and `partnerConsentAt`; notifies admins and the author (court=false) (`:654`).
- **decline** "Don't share": partner_consent → returned. By partner; feedback required. Sets `reviewNote` and `reviewedBy`; notifies the author.
- **publish**: admin_review → published. By admin; feedback optional; hotkey `a`. Sets `publishedAt`, `reviewedBy` and `reviewNote`; notifies the author and org users (`:685`).
- **return**: admin_review → returned. By admin; feedback required; hotkey `r`.
- **unpublish**: published → unpublished. By admin, member or partner; danger style. Emits with no recipients (`:701`).

Creation and editing:
- Created by `startPublication` (`server/projects.ts:38`). One per author and project. Slug is `slugify(title)-xxxxx`. The body has a template.
- `savePublication` (`server/admin.ts:132`): the author can edit in draft, returned or unpublished. An admin can edit (redact) at any time.

### 1e. Lead / application (non-machine; `lib/leads/model.ts`, `lib/leads/ops.ts`)

Lead roles: `member | partner | rep | donor`. Court values: `team | applicant | org | none`.

| Status | Court |
|---|---|
| new | team |
| in_review | team |
| info_requested | applicant |
| with_org | org |
| approved | none |
| declined | none |
| closed | none |
| withdrawn | none |

Open statuses are new, in_review, info_requested and with_org. Each email has at most one open lead.

Access: admin = `decide` on everything. Other users get `users.leadAccess[role]` set to `follow` or `decide`. Donors can be closed with `follow`.

Transitions (all in `lib/leads/ops.ts`):
- **submitApplication** (`:134`): creates a lead with status new and emits `lead.received` to processors. If an open lead exists for the email, it merges blanks instead. A new message is logged as `reply` and emits `lead.replied` to the owner, otherwise `lead.resubmitted`.
- **confirmEmail** (`:198`): sets `emailVerifiedAt`; emits `lead.verified`; then `approveIfStudent`. That auto-activates when role = member, status = new, verified, the email is a school domain, and setting `leads.autoApproveStudents` is true.
- **applicantReply** (`:214`): from the status page or inbound email; dedupes on `messageId`. info_requested → in_review. Emits `lead.replied` to the owner or processors.
- **withdraw** (`:243`): open → withdrawn. Cancels pending org_requests. Emits `lead.withdrawn` to the owner.
- **reapply** (`:262`): withdrawn → new. Emits `lead.received`.
- **editLead** (`:288`): blocked once approved. An email change resets verification, bumps `tokenVersion` and re-sends the confirmation. Emits `lead.updated`; sensitive fields are not logged.
- **takeLead** (`:343`): follow access. Sets owner = self; new → in_review. Emits `lead.assigned`.
- **assignLead** (`:355`): the owner must be a processor for that role; new → in_review. Notifies the new owner.
- **addNote** (`:374`): emits `lead.note_added`.
- **emailApplicant** (`:388`): queues a direct email (reply-to is the lead's inbound address). `requestInfo` → info_requested; otherwise new → in_review. Sets owner if empty. Emits `lead.info_requested` or `lead.email_sent`.
- **approveLead** (`:492`): decide access; status open and not with_org. Calls `activate` (`:406`):
  - Not allowed for donors.
  - For partners: creates a new org, or (admin only) attaches an existing org.
  - Creates or updates the user (`status = active`, adds the role). If the org has no primary, the user becomes primary.
  - Lead → approved. Cancels pending org requests. Queues a "You're in" email.
  - Emits `lead.approved` and `account.approved` (to the user).
- **declineLead** (`:499`): not for donors. Requires a reason. Lead → declined; user pending → declined; cancels org requests; emails the reason. Emits `lead.declined`.
- **closeLead** (`:520`): open → closed. Emits `lead.closed`.
- **reopenLead** (`:528`): declined, closed or withdrawn → in_review. Only if the person has no other open lead. User declined → pending. Emits `lead.reopened`.
- **resendStatusLink** (`:539`).
- Org-join hooks:
  - `leadAskedToJoin`: open → with_org.
  - `leadJoinCancelled`: with_org → new.
  - `leadJoinApproved`: open → approved.
  - `leadJoinDeclined`: with_org → info_requested.
- **logOwnEmail** (`:580`): handles a bcc to the log address. Logged on the most recent lead the sender can follow. new → in_review.
- **setLeadAccess** (`:601`): admin only. Clears ownership of leads the user can no longer see. Emits `lead.access_changed`.
- The Google sign-in callback (`app/api/auth/google/callback/route.ts`) creates a lead with `source = google`. The role comes from the email domain (MEMBER_EMAIL_DOMAINS → member, FACULTY_EMAIL_DOMAINS → rep, else partner). The user is created as pending.

### 1f. Other stateful entities

- **reviews** (`schema.ts:412`): `open → approved | returned | withdrawn`. Opened and closed by the transitions above. `assignReview` (`server/postings.ts:181`) sets `assignedTo` and emits `review.assigned`.
- **team_requests** (`server/team.ts`): `pending → accepted | declined | cancelled`.
  - invite: lead only.
  - request: members.
  - respond: the invitee answers an invite; the lead answers a request. Accept → join, which emits `team.joined` and promotes to sponsored if the project is approved.
  - cancel: creator only.
  - Also: leave (not the lead), remove (lead), makeLead (current lead).
- **org_requests** (`server/orgs.ts`): `pending → approved | declined | cancelled`. A user has at most one pending request (partial unique index).
  - request: a pending partner applicant, or an active partner without an org. Notifies the primary, or admins if there is no primary.
  - approve/decline: the primary or an admin. `joinDomain` is enforced unless the actor is an admin.
  - Also: `transferPrimary`, `removeFromOrg`, `setJoinDomain`. Only the primary can turn joinDomain on, for their own non-personal domain.
- **term_checkins** (`lib/checkins.ts`): `open → submitted → acknowledged`.
  - open: emits `checkin.opened` to members.
  - submit: by a project member; summary ≥20; emits `checkin.submitted` to reps.
  - acknowledge: by staff. If continuing, creates an ai_seat renewal task for each non-affiliate member. Emits `checkin.acknowledged`.
- **milestones**: status `todo | doing | done | dropped`; phase `build | implementation`. Every change writes a `milestone_changes` row.
  - done on a depth-0 milestone: emits `project.milestone_done` to co-members and, if the project is partner-visible, partners.
  - dropped or rescheduled: emits `project.milestones_changed`.
- **tasks**: `open | done | dismissed`. Kinds: `ai_seat | welcome_partner | lead_followup`. `setTaskStatus` (admin).
- **users.status**: `active | pending | declined`.
- **delivery_marks.stage**: `new | shortlist | meet | hold | passed` (a partner-only kanban).

**Hand-off copy**
- `lib/engine/handoffs.ts` `HANDOFF` holds confirmation copy for: posting submit/approve/return/close; project claim/submitPlan/approvePlan/returnPlan/submitWork/approveWork/returnWork/integrate/requestCompletion/confirmCompletion/returnCompletion/withdraw; checkin submit/acknowledge/open; meeting request/cancel; publication submit/consent/decline/publish/return.
- `NEXT_STEPS` (`:291`) covers project states for member and partner, posting returned/draft/in_review/live for partner, and publication returned for member.

---

## 2. Events catalog (`lib/engine/events.ts`)

Each event has a default in-app setting, a default email mode (`off | instant | digest`), and a `court` flag. A court notification is always delivered in-app.

Columns: event — recipient roles — in-app / email — court.

**Postings**
- posting.submitted — rep — on / instant — court (`:22`)
- posting.published — partner — on / instant
- posting.new_on_board — member — on / digest
- posting.returned — partner — on / instant — court
- posting.withdrawn — rep — off / off
- posting.paused — member — off / off
- posting.resumed — member — off / off
- posting.reopened — member — off / off
- posting.archived — partner — off / off
- posting.closed — member — on / off

**Projects**
- project.claimed — partner — on / off
- project.plan_submitted — rep — on / instant — court
- project.plan_approved — member, partner — on / instant
- project.plan_returned — member — on / instant — court
- project.teammate_added — member — on / instant (declared; not emitted anywhere I found)
- project.milestone_done — member, partner, rep — on / digest
- project.milestones_changed — partner, rep — off / digest
- project.progress_logged — member, partner — on / digest
- project.work_submitted — rep — on / instant — court
- project.work_approved — member, partner — on / instant — court
- project.work_returned — member — on / instant — court
- project.integrated — member, rep — on / instant — court
- project.completion_requested — partner — on / instant — court
- project.completed — member, rep — on / instant
- project.completion_returned — member — on / instant — court
- project.withdrawn — partner — on / off
- project.work_shared — partner — on / instant

**Teams, check-ins, reviews**
- team.invited — member — on / instant — court
- team.join_requested — member — on / instant — court
- team.joined — member — on / off (also used for leave, remove, new lead and declined requests)
- checkin.opened — member — on / instant — court
- checkin.submitted — rep — on / digest — court
- checkin.acknowledged — member — on / off
- review.assigned — rep — on / instant — court

**Meetings**
- meeting.requested — member, rep — on / instant — court
- meeting.times_proposed — member, partner, rep — on / instant — court
- meeting.scheduled — member, partner, rep — on / instant
- meeting.cancelled — member, partner, rep — on / instant
- meeting.held — member, rep — off / off

**Messages**
- message.received — all roles — on / digest. Exempt from court-only mode.

**Showcase**
- publication.consent_requested — partner — on / instant — court
- publication.submitted — admin — on / instant — court
- publication.consented — member, admin — on / off (declared; consent actually emits `publication.submitted`)
- publication.declined — member — on / instant — court
- publication.unpublished — member, partner, admin — on / off
- publication.published — member, partner — on / instant
- publication.returned — member, partner — on / instant — court

**Lab and organizations**
- lab.agenda_updated — member, rep — on / digest
- member.level_changed — member — on / instant
- note.added — rep — off / off
- org.join_requested — partner, admin — on / instant — court
- org.join_approved — partner — on / instant
- org.join_declined — partner — on / instant
- org.primary_transferred — partner — on / instant
- org.member_removed — partner — on / instant
- account.approved — rep, partner, member — on / instant

**Leads**
- lead.received — admin, member, partner, rep — on / digest — court
- lead.resubmitted — admin — off / off
- lead.verified — admin — off / off
- lead.assigned — all roles — on / instant — court
- lead.replied — all roles — on / instant — court
- lead.email_sent — admin — off / off
- lead.note_added — admin — off / off
- lead.updated — admin — off / off
- lead.info_requested — admin — off / off
- lead.approved — admin — off / off
- lead.declined — admin — off / off
- lead.closed — admin — off / off
- lead.reopened — admin — off / off
- lead.withdrawn — all roles — on / off
- lead.access_changed — member, partner, rep — on / instant

**Admin**
- task.created — admin — on / instant — court (`:553`)

Notes:
- `roles` is metadata for the settings screen. The actual recipients are the explicit `notify` groups in each emit call (section 1).
- Audit-only event types live in the same `events` table; labels are in `lib/audit.ts` `AUDIT_LABELS`. They cover auth.*, admin.*, taxonomy.*, file.*, doc.*, template.*, folder.*, sealed.*, posting.created/updated, project.work_unshared/acknowledged/length_changed, profile.updated, org.updated, notifications.updated, google.*, and drive.sync_changed.
- Live SSE: staff also receive these types even when they are not in the audience (`app/api/live/route.ts` STAFF_TYPES): posting.submitted, withdrawn, published, returned; project.plan_*, work_*, withdrawn; review.assigned; publication.submitted, published, returned; lead.received; task.created; meeting.requested, scheduled, cancelled.

---

## 3. Schema (`lib/db/schema.ts`; all ids are text)

- **orgs** (`:44`): id, slug uniq, name, kind[company|nonprofit|public|lab], industry, location, website, description, logo_url, is_public bool, showcase_consent_default bool, primary_user_id→users, join_domain, created_at
- **users** (`:67`): id, email uniq, name, handle uniq, roles text[], org_id→orgs, title, department, grad_year int, level[affiliate|sponsored|builder], level_locked bool, headline, bio, avatar_url, links jsonb[{label,url}], interests text[], is_public bool, highlight_project_id, showcased_project_ids text[], status[active|pending|declined], requested_role, request_details jsonb, drive_sync bool, dashboard_prefs jsonb{hidden,order}, lead_access jsonb, created_at, last_seen_at
- **sessions** (`:103`): id (sha256 of token), user_id, created_at, expires_at, user_agent, acting_as_user_id
- **oauth_accounts** (`:115`): provider[google], provider_account_id (PK with provider), user_id, email, access_token, refresh_token, expires_at, scope, updated_at
- **folders** (`:135`): id, parent_id, owner_kind[posting|project|user|org], owner_id, name, drive_folder_id, drive_folder_url, created_by, created_at. Partial unique index: one root per user/org.
- **files** (`:155`): id, folder_id, name, mime, size bigint, source[upload|drive|link|doc], storage_key, url, drive_file_id, document_id, created_by, created_at, deleted_at (soft delete / trash)
- **documents** (`:177`): id, owner_id, title, kind[editor|upload|gdoc], content jsonb (ProseMirror), text, file_id, external_url, external_id, context[posting|action_plan|submission|milestone_note|publication|personal|sealed], context_id, created_at, updated_at, updated_by
- **document_versions** (`:200`): id, document_id, version int, title, kind, content jsonb, text, file_id, external_url, reason, created_by, created_at
- **postings** (`:223`): id, org_id, author_id, contact_id, title, summary, body_doc_id, disciplines text[], tags text[], effort[small|medium|large|multi], deadline date, status (PostingStatus), kind[partner|self], sealed bool, show_on_profile bool, folder_id, submitted_at, published_at, closed_at, created_at, updated_at
- **sealed_solutions** (`:260`): posting_id PK, ciphertext, iv, tag, created_by, updated_at
- **sealed_access** (`:272`): id, posting_id, project_id, user_id, opened_at
- **projects** (`:282`): id, posting_id, lead_id, status (ProjectStatus), phase[parallel|integrated], plan_doc_id, submission_doc_id, ai_disclosure, folder_id, planned_terms int, work_shared_at, work_shared_by, claimed_at, plan_submitted_at, activated_at, submitted_at, delivered_at, integrated_at, completed_at, withdrawn_at, updated_at
- **project_members** (`:316`): project_id + user_id (PK), role[lead|member], joined_at
- **milestones** (`:331`): id, project_id, parent_id, depth int, position double, title, criterion, due_date date, status[todo|doing|done|dropped], phase[build|implementation], note_doc_id, assignee_id, created_by, created_at, updated_at, completed_at
- **milestone_changes** (`:358`): id, project_id, milestone_id, actor_id, kind[created|renamed|rescheduled|status|moved|criterion|deleted|note|assigned], before jsonb, after jsonb, reason, at
- **milestone_baselines** (`:377`): id, project_id, reason[plan_submitted|plan_approved|integrated|manual], snapshot jsonb[{id,parentId,depth,title,dueDate,status}], taken_at
- **progress_logs** (`:393`): id, project_id, milestone_id, author_id, body, created_at
- **reviews** (`:412`): id, gate, subject_id, round int, doc_version_id, status[open|approved|returned|withdrawn], assigned_to, decided_by, decided_at, feedback, score int, opened_at
- **org_notes** (`:433`): id, org_id, posting_id, author_id, body, pinned bool, created_at
- **delivery_marks** (`:452`): project_id PK, org_id, stage[new|shortlist|meet|hold|passed], starred bool, tags text[], note, position double, updated_by, updated_at
- **threads** (`:468`): id, kind[direct|project|posting|meeting|org], subject_id, title, created_at, last_message_at
- **thread_participants** (`:481`): thread_id + user_id (PK), last_read_at, muted bool
- **messages** (`:496`): id, thread_id, author_id, kind[text|system|slots], body, meta jsonb, created_at
- **meetings** (`:514`): id, project_id, requested_by, rep_id, status, purpose, duration_min int, slots jsonb[{id,start,end,by,accepts[]}], starts_at, ends_at, location, calendar_event_id, calendar_link, thread_id, created_at, updated_at
- **events** (`:545`): id, type, actor_id, subject_kind, subject_id, posting_id, project_id, org_id, payload jsonb, via_user_id, ip, user_agent, created_at. Append-only; feeds activity, history and the audit log.
- **notifications** (`:574`): id, user_id, event_id, type, title, body, href, court bool, read_at, created_at
- **notification_prefs** (`:601`): user_id PK, prefs jsonb (NotificationPrefs), updated_at
- **email_outbox** (`:609`): id, user_id, to, subject, body, mode[instant|digest], kind[notification|direct], from_name, reply_to, bcc, sent_at, created_at
- **tasks** (`:625`): id, kind[ai_seat|welcome_partner|lead_followup], title, detail, subject_kind, subject_id, status[open|done|dismissed], created_at, done_at, done_by
- **publications** (`:644`): id, slug uniq, kind[project|posting], project_id, posting_id, org_id, author_id, title, summary, body (markdown), disciplines text[], status, partner_consent_by, partner_consent_at, reviewed_by, review_note, published_at, created_at, updated_at
- **leads** (`:674`): id, role, name, email, org, message, fields jsonb, status, source[form|google|invite], user_id, owner_id, org_id, email_verified_at, token_version int, major, birthday date, background, decided_at, decided_by, decision_reason, handled_by (legacy), handled_at (legacy), created_at, updated_at, last_activity_at
- **lead_messages** (`:712`): id, lead_id, kind[note|email_out|email_in|reply], author_id, parent_id, subject, body, from_email, to_email, message_id (partial unique), created_at
- **agenda_items** (`:734`): id, title, kind[collective|focused|collaborative|social|showcase|other], starts_at, ends_at, location, description, is_public bool, created_by, created_at
- **settings** (`:751`): key PK, value jsonb, updated_at. Keys used: `lab.contact`, `lab.terms`, `lab.weekly`, `leads.autoApproveStudents`.
- **team_requests** (`:760`): id, project_id, user_id, kind[invite|request], status[pending|accepted|declined|cancelled], message, created_by, created_at, responded_at, responded_by
- **blobs** (`:785`): key PK, bytes bytea, mime, created_at. Used by the STORAGE_DRIVER=db driver.
- **templates** (`:795`): id, scope[universal|shared|personal], owner_id, name, subject, body, lead_role, uses int, created_at, updated_at, updated_by
- **posting_views** (`:817`): posting_id + user_id + day date (PK)
- **org_requests** (`:833`): id, org_id, user_id, status[pending|approved|declined|cancelled], message, title, created_at, decided_at, decided_by, note. Partial unique: one pending request per user.
- **work_acknowledgments** (`:857`): project_id + user_id (PK), policy_version, at
- **term_checkins** (`:875`): id, project_id, term_id, status[open|submitted|acknowledged], continuing bool, summary, next_plan, submitted_by, submitted_at, acknowledged_by, acknowledged_at, note, created_at. Unique on (project, term).
- **taxonomy** (`:901`): id, kind[discipline|tag], name, slug, description, active bool, position double, created_by, created_at. Unique on (kind, slug).
- **drive_mirrors** (`:921`): id, user_id, source_kind[file|doc], source_id, drive_file_id, drive_parent_id, source_version, synced_at
- **drive_folders** (`:938`): user_id + folder_key (PK), drive_folder_id, name, updated_at

There are no Postgres enum types. All enums are text columns with TS `$type<>`; the value lists are in `lib/domain.ts`. Postgres-specific features in use: `text[]` with `= any()` and `&&`, jsonb with `->>`, partial unique indexes, `FOR UPDATE`, `count(*)::int`, `ilike` (search, audit log, leads, observe), `unnest` (taxonomy usage), `array_agg`, and `onConflictDoUpdate/DoNothing` upserts.

---

## 4. Pages

### Public (`app/(public)`)

- `/` — public: landing page.
- `/about`, `/about/members`, `/about/partners`, `/about/representatives` — public: role explainers.
- `/join`, `/join/[role]` — public: join form per role; it shows the `processFor(role)` steps. Action: `submitLead`.
- `/meetings` — public: weekly meeting time and place, the meeting formats, and the upcoming public agenda.
- `/pipeline` — public: explainer of the pipeline.
- `/policy` — public: student work policy.
- `/principles` — public: the seven principles.
- `/partners`, `/partners/[slug]` (+ OG image) — public: public orgs and their live postings with `showOnProfile`.
- `/members/[handle]` (+ OG) — public: public member profile.
- `/showcase`, `/showcase/[slug]` (+ OG) — public: published publications. ISR 5 min. Discipline filter.

### Auth and onboarding

- `/signin` — Google sign-in, plus demo account switching when demo sign-in is enabled.
- `/signin/pending` — a pending Google user. Shows the application status. Partners pick or join an org (`requestToJoinOrg`, `cancelOrgRequest`).
- `/apply/[token]` — the applicant's status page from a signed link. Actions: confirm email, reply, update details, withdraw, reapply.
- `/access` — access-code gate when `ACCESS_CODE` is set.
- `/demo` — demo guide (per-account "try" lists and walkthrough scenes) and reset of demo data, optionally with load data.

### App (`/app`; the nav varies by portal, `components/shell/nav.ts`)

**Home and inbox**
- `/app` — role-specific home:
  - Member: court list, project list, stats, agenda next-up, upcoming meetings, activity, level badge.
  - Partner: court list, postings, deliveries, upcoming meetings, join-org prompt if the partner has no org.
  - Rep: court list, stats, upcoming meetings, activity.
  - Admin: dashboard with widgets: attention, quick, health, funnel, gates, overdue, partners, signups, activity. Reorderable, saved via `saveDashboardPrefs`.
- `/app/inbox` — all roles: "In your court" (CourtList) plus notifications. Action: mark all read.

**Board and postings**
- `/app/board` — member and staff: notice board of live postings. Filters, sort, list or grid, peek, claim.
- `/app/board/[id]` — member and staff: posting detail (body doc, files, stage bars). Records a `posting_views` row. Action: Claim.
- `/app/postings` — partner: the org's posting table. Action: "Post a problem".
- `/app/postings/new` — partner: composer (`createPosting`). Save draft or send for review.
- `/app/postings/[id]` — partner and staff:
  - Shows the details editor, sealed-solution manager, files, projects on the posting, review history, rep notes (staff only), thread, next steps.
  - Actions: ActionBar transitions (submit, withdraw, pause, resume, close, reopen, archive), edit, set sealed, show on profile.

**Projects**
- `/app/projects` — member: my projects. Staff: PostingGroups (all projects grouped by posting, stage filter). Partner: org projects.
- `/app/projects/new` — member: start a self-directed project (title, summary, build, disciplines, terms, teammates).
- `/app/projects/[id]` (layout with tabs; `layout.tsx:37`) — members, staff and partner (partner view):
  - Overview: next steps, stage, transitions, team panel (invite, request, accept, leave, remove, make lead), check-in card, delivery organizer (partner), share-work panel (member), mute toggle, planned terms, AI disclosure.
  - Tabs: Overview, Action plan (`/plan`: DocView + ReviewHistory), Milestones (`/milestones`: MilestoneTree list or map with baselines), Progress log (`/log`: LogComposer), Submission (`/submission`: DocView, ReviewHistory, WorkAckGate for partners), Files (`/files`: FolderPanel, WorkAckGate), Discussion (`/discussion`: project ThreadPanel), History (`/history`: event/milestone-change ActivityList).
- `/app/sealed/[projectId]` — a member with an unlocked project: SecureViewer for the sealed solution.

**Reviews and check-ins**
- `/app/reviews` — rep and admin: ReviewQueue of open reviews (posting, action_plan, submission). Action: take or assign.
- `/app/reviews/[gate]/[id]` — rep and admin: frozen doc version, review history, partner notes, thread. ActionBar approve or return with feedback (and score for submissions). Queue navigation j/k/u.
- `/app/checkins` — rep and admin: term check-ins to acknowledge (CheckinCard).

**Deliveries, meetings, messages**
- `/app/deliveries` — partner: organizer of delivered projects. Kanban by DeliveryStage or list; star, tags, note, bulk set.
- `/app/meetings` — all: MeetingList scoped mine or all. Partners can request a meeting on a meetable project.
- `/app/meetings/[id]` — participants, the org and staff: SchedulingBoard (propose, accept, confirm slots), CalendarPanel (.ics, Google Calendar), MeetingActions (mark held, cancel), next steps.
- `/app/messages`, `/app/messages/[threadId]` — all: threads list plus conversation. Actions: compose a direct message (`?to=` opens a DM), send, mark read, mute.

**Directory, files, agenda, org**
- `/app/people`, `/app/people/[handle]` — all: directory; profile with projects, activity and stage bars.
- `/app/partners`, `/app/partners/[id]` — staff: org list; org detail with projects, rep notes (add, pin), thread, admin org-request handling.
- `/app/observe`, `/app/observe/[userId]` — staff: see a member's or partner's home as they see it (read-only).
- `/app/files` — all: personal and org roots (FolderPanel). Upload, folders, links, Drive picker, trash and restore, move, rename.
- `/app/docs/[id]` — doc access rules apply: DocPage/DocView (TipTap editor, versions, export to Word/PDF, change source to upload or gdoc).
- `/app/agenda` — member and staff: AgendaBoard (admins add, edit, delete).
- `/app/org` — partner: organization profile form, people, pending join requests (primary), transfer primary, remove, join domain.
- `/app/showcase/[id]` — author, org and admin: PublicationPage editor plus transitions.

**Leads**
- `/app/leads` — admin and anyone with leadAccess: the lead list.
- `/app/leads/[id]` — same: lead detail. Feed (notes, emails, replies, events), composer with templates, details form, take/assign/approve/decline/close/reopen, resend link.

**Admin (admin only; `app/app/admin/layout.tsx`)**
- `/app/admin` — admin queue: open tasks, publications in admin_review, unclaimed leads.
- `/app/admin/people` — people and levels: set level/lock, roles, invite, act as, lead access.
- `/app/admin/checkins` — open check-ins for the current term; overview.
- `/app/admin/showcase`, `/app/admin/showcase/[id]` — publication list; review/redact plus publish or return.
- `/app/admin/categories` — taxonomy add, rename, describe, activate, reorder, merge.
- `/app/admin/log` — audit log with facets and search; CSV export.
- `/app/admin/settings` — semester terms editor, weekly meeting, contact email, auto-approve students.
- `/app/admin/accounts` and `/app/admin/leads` — redirect to `/app/leads`.

**Settings (all)**
- `/app/settings`, `/app/settings/profile` — profile form.
- `/app/settings/notifications` — per-event in-app/email, court-only, quiet hours, digest hour, reset.
- `/app/settings/integrations` — Google sign-in, Drive (mirror on/off, sync now, remove copies), Calendar connect, disconnect.
- `/app/settings/shortcuts` — shortcut list.
- `/app/settings/templates` — TemplateManager (universal templates are admin-managed; shared; personal).

---

## 5. API routes (`app/api`)

- GET `/api/live` — SSE stream. Filters LiveMessages by audience, `everyone` and STAFF_TYPES. Sends only the viewer's own toast title. Ping every 25s.
- GET `/api/search?q=` — permission-aware search for the command palette: postings, projects, people, orgs, docs (`ilike`).
- POST `/api/files` — multipart upload into `folderId` or as a `documentId`'s upload version.
- GET `/api/files/[id]` — streams an upload with access checks; links redirect; docs open in the editor. `?download=1`; HTML and SVG are always downloaded.
- GET `/api/meetings/[id]/ics` — .ics for a scheduled meeting (participants and admin).
- GET `/api/agenda.ics` — public agenda feed, or a single item with `?id=`.
- GET `/api/admin/log.csv` — audit log CSV for admins, streamed in pages, with the page's filters.
- GET `/api/auth/google` — starts OAuth with PKCE. `?connect=drive|calendar` adds incremental scopes; `?next=`.
- GET `/api/auth/google/callback` — sign-in, account or lead creation, and token storage.
- GET `/api/dev/session` — dev/demo-only sign-in as a user.
- POST `/api/inbound/email` — mail-provider webhook. `lead+<id>.<sig>@` → applicantReply; `log+<user>.<sig>@` → logOwnEmail. Secret via Basic auth, `x-inbound-secret` or `?secret=`.
- GET `/api/cron/daily` — runs terms check-ins, instant email retry, digests and Drive sync. CRON_SECRET bearer.
- GET `/api/cron/email` — `deliverInstant` + `deliverDigests` (hourly).
- GET `/api/cron/drive` — syncs every Drive mirror.
- GET `/api/cron/terms` — opens check-ins when ≤14 days remain in the current term.

---

## 6. Server commands

**`lib/engine/commands.ts`**
- `claimPosting` — member claims a live posting; creates project, plan and folder.
- `ensureLabOrg` — gets or creates the Lab's own organization.
- `createSelfProject` — member creates a self-directed project and invites teammates.

**`server/*.ts`**

access.ts
- `enterAccessCode` — validates the shared access code and sets a cookie.

accounts.ts
- `signOutPending` — signs out a pending applicant.

admin-access.ts
- `actAs` — admin starts acting as another user.
- `stopActing` — admin stops acting as a user.

admin.ts
- `setTaskStatus` — admin marks a task done, dismissed or open.
- `setLevel` — admin sets a member's level and lock.
- `setRoles` — admin changes a user's roles.
- `inviteUser` — admin creates or invites a user with a role.
- `savePublication` — author or admin edits a showcase entry.

agenda.ts
- `saveAgendaItem` — admin creates or edits an agenda item.
- `deleteAgendaItem` — admin deletes an agenda item.

apply.ts (token-based)
- `confirmApplicationEmail` — confirms the email via the signed link.
- `replyToApplication` — applicant replies from the status page.
- `updateApplication` — applicant edits org, major or fields.
- `withdrawApplication` — applicant withdraws an open application.
- `reapply` — applicant reopens a withdrawn application.

dashboard.ts
- `saveDashboardPrefs` — saves the admin dashboard widget order and hidden widgets.

demo.ts
- `resetDemoData` — wipes and reseeds demo data, optionally with load data.

docs.ts
- `saveDocument` — autosaves ProseMirror JSON with conflict detection.
- `loadDocument` — loads doc content for the editor.
- `renameDocument` — renames a document.
- `setDocumentSource` — switches a doc between editor, upload and Google Doc.
- `getDocumentForExport` — returns content for a client-side docx/pdf export.

drive.ts
- `setDriveSync` — turns the Drive mirror on or off, optionally removing copies.
- `syncDriveNow` — runs the viewer's Drive mirror sync immediately.

files.ts
- `loadFolder` — lists folder contents or trash.
- `listFolderTree` — returns the folder tree for move dialogs.
- `createFolder` — creates a subfolder.
- `renameItem` — renames a file or folder.
- `deleteItems` — soft-deletes files and deletes folders.
- `restoreFiles` — restores trashed files.
- `moveItems` — moves files and folders to a target folder.
- `addLink` — adds a URL link file to a folder.
- `createDocumentInFolder` — creates an editor doc inside a folder.
- `getDriveToken` — gets an access token for the Google Picker.
- `addDriveFiles` — adds picked Google Drive files as files.

lab-settings.ts
- `saveTerms` — admin saves the semester calendar.
- `saveWeekly` — admin saves the weekly meeting info.
- `saveContact` — admin saves the Lab contact email.

lead-work.ts (wrappers around `lib/leads/ops.ts`)
- `takeLead` — takes ownership of an application.
- `assignLead` — hands an application to another processor.
- `addLeadNote` — adds an internal note to a lead.
- `emailLead` — emails the applicant, optionally requesting info.
- `editLead` — edits applicant details.
- `approveLead` — approves and activates the account and org.
- `declineLead` — declines with a reason emailed to the applicant.
- `closeLead` — closes without a decision.
- `reopenLead` — reopens a decided or closed application.
- `resendStatusLink` — re-sends the confirmation and status-link email.
- `setLeadAccess` — admin grants per-role lead follow/decide access.
- `setAutoApproveStudents` — admin toggles auto-approval of verified students.

leads.ts
- `submitLead` — public join form submission that creates a lead.

meetings.ts
- `requestMeeting` — partner or admin requests a meeting with proposed slots.
- `toggleSlotAccept` — participant toggles "works for me" on a slot.
- `proposeSlots` — participant proposes more times.
- `confirmSlot` — schedules the meeting at the chosen slot and adds it to the calendar.
- `sendToGoogleCalendar` — creates a Google Calendar event from the viewer's account.
- `afterMeetingTransition` — posts a thread note and cancels the calendar event.

messages.ts
- `sendMessageAction` — posts a message to a thread.
- `sendToSubjectAction` — posts to a subject thread, creating it if needed.
- `startDirectThread` — opens or creates a direct-message thread.
- `markReadAction` — marks a thread read.
- `muteThreadAction` — mutes or unmutes a thread.
- `listMessageablePeople` — lists people the viewer may message.

milestones.ts
- `addMilestone` — adds a milestone (depth ≤3, fractional position).
- `updateMilestone` — edits title, criterion, due date, status or assignee; logs the change.
- `setMilestonesStatus` — bulk-sets status for multiple milestones.
- `moveMilestone` — reparents or reorders a milestone subtree.
- `deleteMilestone` — deletes a milestone with an optional reason.
- `ensureMilestoneNote` — creates or gets a milestone notes document.
- `logProgress` — adds a progress log entry and notifies.

orgs.ts
- `requestToJoinOrg` — partner asks to join an existing organization.
- `cancelOrgRequest` — cancels the viewer's pending join request.
- `approveOrgRequest` — primary or admin approves a join request.
- `declineOrgRequest` — primary or admin declines with a note.
- `transferPrimary` — hands the primary account to a colleague.
- `removeFromOrg` — removes a partner from the organization.
- `setJoinDomain` — restricts join requests to the primary's email domain.

posting-groups.ts
- `loadPostingProjects` — lazily loads a posting's projects for staff rows.

postings.ts
- `createPosting` — partner creates a posting draft, optionally sending it for review.
- `updatePosting` — edits posting fields; audited.
- `setSealed` — saves or clears the encrypted sealed solution.
- `addOrgNote` — rep adds a note about a partner.
- `toggleNotePin` — pins or unpins a rep note.
- `revealSealed` — the author org reveals its sealed solution.
- `assignReview` — takes or assigns a review to a rep.

projects.ts
- `claim` — claims a posting and redirects to the project.
- `setHighlight` — picks the project highlighted on the public profile.
- `startPublication` — creates or opens a showcase draft for a project.
- `setDeliveryMark` — partner sets a delivery's stage, star, note or tags.
- `setDeliveryMarks` — bulk-sets stage or star for deliveries.
- `saveAiDisclosure` — member saves the project's AI-use disclosure.
- `startOwnProject` — creates a self-directed project and seeds the plan.

settings.ts
- `updateProfile` — updates the viewer's profile fields.
- `saveNotificationPrefs` — merges and saves notification preferences.
- `resetNotificationPrefs` — deletes preferences, restoring defaults.
- `toggleMute` — mutes or unmutes a project or posting subject.
- `disconnectGoogle` — removes Google OAuth tokens.
- `updateOrg` — partner updates the organization profile.
- `setPostingOnProfile` — shows or hides a posting on the public org page.

shell.ts
- `switchPortal` — switches the active role portal.
- `signOut` — destroys the session.
- `demoSignIn` — signs in as a demo user.
- `markNotificationsRead` — marks some or all notifications read.

taxonomy.ts
- `addCategory` — admin adds a discipline or tag.
- `renameCategory` — renames a category (propagates).
- `setCategoryDescription` — sets a category description.
- `setCategoryActive` — activates or retires a category.
- `reorderCategories` — reorders categories by fractional position.
- `mergeCategory` — merges one category into another everywhere.

team.ts
- `inviteToTeam` — lead invites an active member.
- `requestToJoin` — member asks to join a project team.
- `respondToTeamRequest` — accepts or declines an invite or request.
- `cancelTeamRequest` — creator cancels a pending request.
- `leaveTeam` — non-lead leaves the team.
- `removeTeammate` — lead removes a teammate.
- `makeLead` — current lead hands the lead to a teammate.
- `teamCandidates` — lists active members not on the team.

templates.ts
- `listTemplates` — lists templates visible to the viewer.
- `saveTemplate` — creates or edits a template within its scope rules.
- `deleteTemplate` — deletes a template.
- `markTemplateUsed` — increments a template's use count.

terms.ts
- `setPlannedTerms` — member sets the planned semesters (1–6); audited.
- `openTermCheckins` — admin opens check-ins for the current term.
- `submitTermCheckin` — member submits a check-in.
- `acknowledgeTermCheckin` — staff acknowledges and queues seat renewals.

transition.ts
- `doTransition` — runs a machine transition plus post-commit effects.

work.ts
- `shareWork` — member shares delivered project files with the partner.
- `unshareWork` — member stops sharing project files.
- `acknowledgeWork` — partner acknowledges the student-work policy.

**Other**
- `app/app/admin/log/actions.ts` `loadOlderLog` — paginates the audit log.

---

## 7. Notifications model

**Preferences** (`notification_prefs.prefs`, type at `schema.ts:593`; zod schema at `server/settings.ts:42`):
- `events[type] = { inApp, email: off|instant|digest }`
- `courtOnly: bool`
- `quietHours: {start "HH:MM", end "HH:MM"} | null`
- `digestHour: 0–23` (default 17, Lab time)
- `mutedSubjects: string[]` (project or posting ids, max 500)

**Delivery decision** (`lib/engine/notify.ts:125` `decide`):
1. Start from the user's own setting for the event, falling back to the event default.
2. If court (the notify group's `court` overrides the event's `court`): inApp is forced on.
3. If not court and `courtOnly` and the type is not `message.received`: inApp off, email off.
4. If not court and any of the subjectId, projectId or postingId is in `mutedSubjects`: inApp off, email off.
5. If email is instant and the current time (server local) is within quiet hours: email becomes digest. Quiet hours wrap past midnight.

**Recipients and delivery**
- The actor is always removed from recipients (`:56`).
- In-app delivery inserts `notifications` rows with a `court` flag.
- Email inserts `email_outbox` rows. `flush()` triggers `deliverInstant` best-effort.
- Digests: `deliverDigests` groups each user's unsent digest items and sends them when the Lab-time hour equals that user's `digestHour` (`lib/email.ts:53`).
- Thread mutes (`thread_participants.muted`) exclude users from `message.received` recipients (`lib/messages.ts:307`).

**"In your court"** (`lib/queries/court.ts:25` `getCourt`): a union of items, each tagged with role, kind and urgency (`action` = waiting; `work` = ongoing). Sorted action first, then oldest first.

- Member:
  - Their projects in claimed, plan_returned, active, submission_returned or integrated. Action for claimed and `*_returned`; work otherwise.
  - Requested meetings where they haven't accepted any slot.
  - Pending team invites to them.
  - Pending join requests on projects they lead.
  - Open term check-ins on their projects.
  - Their publications in `returned`.
- Partner (with an org):
  - Org postings in draft (work) and returned (action).
  - If they are the org primary: pending org_requests.
  - Org projects in delivered without a delivery mark or with stage `new`, plus projects in completion_review.
  - Publications in partner_consent for the org.
- Rep or admin:
  - Open reviews for posting, action_plan and submission gates that are unassigned or assigned to them.
  - Submitted check-ins.
  - Requested meetings where they are `repId` and haven't accepted.
- Admin:
  - Pending org_requests where the org has no primary or the request is ≥7 days old.
  - Open tasks.
  - Publications in admin_review.
- Lead processors: leads in their followable roles with status new or in_review, unowned or owned by them. Action if unowned or the applicant replied.

`shellCounts` (`:221`) produces nav badges: court (actions in the current portal), courtAll, reviews, checkins, deliveries, org, adminQueue, leads, unread notifications, unread message threads (`lastMessageAt > lastReadAt`), and the 12 most recent notifications.

---

## 8. Hotkeys and command palette

Registry: `lib/hotkeys.tsx`.
- Bindings: `{id, keys, label, group, run, allowInInput, inDialog, global, command, keywords, hidden, disabled}`.
- `mod` means Cmd on Mac and Ctrl elsewhere. Two-step sequences (e.g. "g b") time out after 1200ms.
- Single-key shortcuts don't fire inside inputs. While a dialog is open, only bindings marked `inDialog` (or global mod combos) fire. The latest registration wins.
- Pointer conventions (`:175`): shift+click range select; mod+click toggle; alt+click peek; shift+click "only this filter" or secondary sort; shift/alt+click on milestones; shift+click skips confirmation.

**Shell** (`components/shell/app-shell.tsx`)

| Keys | Action |
|---|---|
| mod+k | Command palette |
| ? | Shortcut sheet |
| [ | Toggle sidebar |
| alt+t | Cycle theme |
| n | Open notifications |
| g , | Settings |

**Nav "g" sequences** (`shell/nav.ts`)

| Keys | Destination |
|---|---|
| g h | Home or Dashboard |
| g i | In your court |
| g b | Notice board |
| g p | Projects or Postings |
| g t | Meetings |
| g m | Messages |
| g a | Agenda |
| g e | People |
| g f | Files |
| g d | Deliveries |
| g o | Org profile or Partners |
| g r | Reviews |
| g c | Check-ins (rep) or Categories (admin) |
| g v | Observe |
| g x | Admin queue |
| g l | Leads |
| g y | Admin check-ins |
| g s | Showcase |
| g u | Templates |
| g k | Activity log |
| g ; | Lab settings |

**Per-page bindings**
- Board: `/` search, j/k or arrows to move, enter open, space peek, esc close peek, c claim, v list/grid, s sort, shift+x clear filters.
- Transitions: each machine `hotkey` (a = approve or publish, r = return) on the page. mod+enter confirms the hand-off dialog.
- Milestone tree: j/k/arrows; ←/→ collapse/expand; space done; x select; shift+arrows extend; o add below; shift+o add nested; a add major; enter rename; c criterion; d due; i take; n notes; backspace delete; mod+↑/↓ move; alt+←/→ outdent/indent; shift+h hide done; shift+i only mine; m list/map; esc clear.
- File browser: j/k/arrows; shift+j/k/arrows extend; x select; mod+a select all; enter open; ← parent; → open folder; space preview; u upload; shift+n new folder; mod+shift+n new doc; l link; r or f2 rename; r restore (trash); delete/backspace trash; `/` filter; esc clear.
- Editor (TipTap): mod+b/i/u; mod+shift+x strike; mod+shift+h highlight; mod+alt+0–3 text/H1–H3; mod+shift+7/8/9 numbered/bulleted/task list; mod+s save; mod+shift+e export Word/PDF. The slash menu also offers mod+alt+c (code) and mod+shift+b (quote).
- Reviews: queue j/k, enter, t take. Detail j/k/u (back to queue).
- Deliveries: j/k, enter, x select, s star, v board/list, 1–5 set stage, esc.
- Meetings: list j/k/o. Scheduling board j/k, x toggle works-for-me, c confirm, p propose, mod+enter submit.
- Messages: j/k, alt+↑/↓ conversations, c compose, `/` search, r reply.
- Leads: t take, a approve, shift+d decline.
- Others:
  - Notifications: j/k/enter, shift+r mark all read.
  - People directory: `/`, j/k/enter.
  - PostingGroups: j/k, →/←, enter, o, e, `/`.
  - Posting table: j/k/enter, c "Post a problem".
  - Composer: mod+s draft, mod+enter send.
  - Project tabs: 1–9.
  - Log composer: l.
  - Doc page: v versions.
  - Publication editor: mod+s, mod+shift+p preview.
  - Templates: 1/2/3 scope, n new.
  - Agenda: a add, e edit, j/k, mod+enter.
  - Admin log: j/k/arrows, o open, esc, shift+l older, `/` search, a acting-as filter, shift+x clear.
  - Dashboard: e edit, esc.
  - People admin and quick actions: i invite.
  - Profile and terms editor: mod+s.
  - Own-project form and request meeting: mod+enter.

**Command palette** (`components/shell/command-palette.tsx`)
- Server search via `/api/search` after 2+ characters, debounced 120ms. Results: posting, project, person, org, doc.
- Plus every registered binding with `command: true`, grouped "This page" / "Actions" / "Navigate" / "Platform":
  - Go to each nav item; Go to Settings; Go to my profile.
  - Keyboard shortcuts; Toggle sidebar; Cycle theme; Open notifications.
  - Switch to the <role> portal (one per available portal); Sign out.
  - Act as someone… (admin); Stop acting as X; Switch demo account.
  - Page commands: claim, view, sort, clear filters; Post a problem; New message; Mark all read; posting-groups open/expand; Invite someone; Edit dashboard; log filters/load older; versions; milestone add/hide/mine/map; New template; Add agenda item; Propose times; transition actions; Export; Take review; delivery view.

---

## 9. Shared building blocks (`components/platform`)

- `facts.tsx`: the "every slot always renders" rule; a missing value shows a dash.
  - `Dash` — placeholder for a missing value.
  - `DueValue` — due date, colored as it approaches.
  - `MilestoneDate` — labeled as done, due or none.
  - `CountBar` — done/total bar plus count.
  - `PercentBar` — 0–1 bar plus percentage.
  - `semesters(n)` — "n sem."
- `court-list.tsx` `CourtList` — CourtItem rows (title, subtitle, status pill, since).
- `activity.tsx` `ActivityList` — event timeline items.
- `notification-list.tsx` `NotificationList` — notifications with j/k navigation and mark all read.
- `people-directory.tsx` `PeopleDirectory` — searchable people list.
- `person.tsx` — `Person` (avatar, name, level badge) and `AvatarStack`.
- `posting-groups.tsx` `PostingGroups` — staff all-projects view; expandable posting rows that lazy-load their projects; per-project stage dots.
- `project-list.tsx` `ProjectList` — fixed-column project rows: stage bar, members, org, next due, milestone CountBar, terms.
- `stage.tsx` `StageBar` — segmented pipeline bar. Returned states are red; self projects omit delivered and integrated.

Related:
- `components/engine/transition-button.tsx`: `TransitionButton` (preflight checks and the hand-off dialog with feedback and score) and `ActionBar`.
- `components/engine/confirm-handoff.tsx` `ConfirmHandoff`.
- `components/engine/next-steps.tsx` `NextSteps`.
- `components/ui/status.tsx` `StatusPill` (label and tone from the machine).
- `components/ui/level.tsx` `LevelBadge`.
- `components/ui/explainer.tsx` `Explainer` (topics in `content/explainers.ts`).

---

## 10. Demo data (`lib/db/seed.ts`, `lib/demo/guide.ts`)

The story date is 2026-10-08. On load, dates shift by whole weeks.

**Organizations** (`seed.ts:48`)
- `org_lab` Applied AI Lab (kind lab)
- `org_kestrel` Kestrel Facilities Co.
- `org_larkspur` Larkspur Freight
- `org_juniper` Juniper Family Dental
- `org_basalt` Basalt Outfitters
- `org_tamarack` Tamarack Credit Union
- `org_cinder` Cinder & Pine Coffee
- Leads also mention Ogden Valley Food Bank, Wasatch Bike Co-op and Hartley Family Foundation (applicant orgs only, not seeded as orgs).

**Members** (emails `first.last@mail.example.edu`; `seed.ts:72`)
- usr_alex Alex Rivera — member + **admin**, sponsored. Guide: applications, accounts, work queue, showcase, act as.
- usr_maya Maya Ortiz — sponsored. Active project; check-in; follows up on member applications.
- usr_jordan Jordan Nguyen — sponsored. Submission in review; team invite; message.
- usr_eli Eli Brooks — affiliate. Plan returned.
- usr_kai Kai Morgan — sponsored. Plan in review; teammate on the CRM project.
- usr_sam Sam Whitaker — affiliate. Self-directed project in review (`prj_sam_posters`); a join request.
- usr_priya Priya Raman — builder. Phase 2; meeting Thursday.
- usr_ana Ana Lucero — sponsored. Delivered; meeting to schedule.
- usr_ben Ben Castillo — affiliate. Claimed, plan not written; a withdrawn project.
- usr_grace Grace Holm — affiliate. Claimed; teammate on Sam's project.
- usr_noah Noah Kim — sponsored. Finished, ready to submit.
- usr_leah Leah Morales — affiliate. Strong plan awaiting a rep.
- usr_zoe Zoe Martin — sponsored. Submission in review.
- usr_isaac Isaac Chen — sponsored. Submission returned; check-in.
- usr_ruby Ruby Park — sponsored. Just delivered; showcase draft.
- usr_lily Lily Tran — builder. Phase 2 done; awaiting sign-off.

**Reps** (`seed.ts:88`)
- usr_marsh Dr. Helen Marsh (Finance) — reviews postings, submissions and check-ins; decides faculty applications.
- usr_okafor Prof. David Okafor (CS) — action plans; messages.
- usr_pike Dr. Lauren Pike (Accounting) — accounting reviews.

**Partners** (`seed.ts:91`)
- usr_dana Dana Whitfield (Kestrel) — primary; join request from Jamal; draft posting.
- usr_marcus Marcus Bell (Larkspur) — several projects under way.
- usr_nina Dr. Nina Patel (Juniper) — sign-off waiting; posting in review.
- usr_owen Owen Hale (Basalt) — new delivery; returned posting.
- usr_rosa Rosa Delgado (Tamarack) — showcase consent; join request; deliveries; follows up on partner applications.
- usr_lena Lena Brandt (Tamarack) — paused posting.
- usr_theo Theo Grant (Cinder & Pine) — first posting, in review.
- usr_lab "Alex Rivera (Lab)" — partner for org_lab; not public.

**Pending accounts** (`seed.ts:1082`, `:1359`)
- usr_whitley (rep applicant)
- usr_hannah (partner, new org)
- usr_jamal (asked to join Kestrel)
- usr_ethan (student via Google)
- usr_devon (asked to join Tamarack)

**Leads**: lead_grace, luis, tess, omar (info_requested), daniela, victor (declined), hannah, jamal (with_org), whitley, carol (donor), marco, ethan, nate (withdrawn), devon (with_org), greg, amy (rep), paul (donor).

**Other seed data**
- Templates: tpl_welcome, tpl_student, tpl_partner_call, tpl_faculty, tpl_donor (universal); tpl_thursday (shared, Maya); tpl_nudge (personal).
- Taxonomy: the 14 DISCIPLINES plus Law and Nursing, and tags.
- Settings: `lab.contact`.
- Projects cover every status (`seed.ts:433–626`).
- Load data: `lib/db/load-gen.ts:30` defines scales tiny, small, medium and large (e.g. large = 5000 members, 20000 projects). Load rows use the `ld_` prefix.

---

## 11. Node-server and Postgres-specific dependencies

- **SSE bus**: an in-process Node `EventEmitter` on `globalThis` (`lib/engine/bus.ts`). The comment says to swap in Postgres LISTEN/NOTIFY for multiple instances; that is not implemented.
- **SSE endpoint**: a long-lived `ReadableStream` with a 25s heartbeat via `setInterval` (`app/api/live/route.ts`). The client is `components/shell/live.tsx`.
- **Transactions**: `db.transaction` wraps every transition and command. Events and notifications are written inside the transaction; live publish happens after commit (`lib/engine/transition.ts:257`, `notify.ts`).
- **Row locks**: `SELECT … FOR UPDATE` on meeting slots (`server/meetings.ts:153`, `:200`, `:248`).
- **DB client**: node-postgres when `DATABASE_URL` is set; otherwise embedded PGlite at `.data/pglite`, which auto-migrates (`drizzle/`) and seeds (`lib/db/client.ts`). `request-context.ts` passes the tx handle because PGlite has a single connection.
- **Postgres SQL**: text[] with `= any` and `&&`, jsonb `->>`, partial unique indexes, `ilike`, `unnest`, `array_agg`, bytea `blobs`, upserts (`lib/db/schema.ts`, `lib/queries/*`, `app/api/search/route.ts`).
- **Crons**: daily, email, drive and terms routes (`app/api/cron/*`), protected by CRON_SECRET (vercel.json daily).
- **In-process Drive mirror queue**: `setTimeout` debounce with per-user non-overlapping runs (`lib/google/mirror.ts:612`). Cron catch-up runs in `/api/cron/drive`.
- **TipTap editor**: ProseMirror JSON stored in `documents.content` (`components/editor/*`). Autosave goes through `saveDocument` with last-writer conflict detection (`server/docs.ts:34`). No realtime collaboration (no Yjs).
- **docx/pdf export**: client-side `docx` and `pdfmake` (`lib/export/docx.ts`, `lib/export/pdf.ts`, `components/docs/export-menu.tsx`). Content comes from `getDocumentForExport`.
- **Google OAuth**: PKCE with incremental scopes `drive.file` and `calendar.events` (`lib/google/oauth.ts`, `app/api/auth/google/*`). Tokens are in `oauth_accounts`.
- **Google Drive**: REST client (`lib/google/drive.ts`), one-way mirror (`lib/google/mirror.ts`), Picker (`components/google/drive-picker.tsx`), and docs-to-HTML conversion for Google Docs (`lib/google/html.ts`).
- **Google Calendar**: event create with a Meet link, and cancel (`lib/meetings.ts:278`, `:345`).
- **Resend email**: Resend if `RESEND_API_KEY` is set, otherwise console. Outbox table, instant plus digest (`lib/email.ts`).
- **Inbound email**: webhook (`app/api/inbound/email/route.ts`) with HMAC reply addresses (`lib/leads/tokens.ts`).
- **Sealed solution crypto**: AES-256-GCM via `node:crypto` with `SEALED_SOLUTION_KEY` (`lib/sealed.ts`). Access is logged in `sealed_access` and audit.
- **Secrets**: `SESSION_SECRET` and `SEALED_SOLUTION_KEY` (in dev, generated into `.data/secrets.json`) (`lib/secrets.ts`).
- **Sessions**: cookie token, sha256-hashed in the `sessions` table, with act-as and portal (`lib/auth/session.ts`).
- **Storage driver**: `local` (`.data/uploads`) or `db` (`blobs`) via `STORAGE_DRIVER`; S3 is not implemented (`lib/storage.ts`). Files stream through `/api/files/[id]`.
- **Access-code gate**: `src/proxy.ts` and `lib/access-code.ts` (`ACCESS_CODE`).
- **Next-specific**: `refresh()` and `revalidatePath` after server actions. Public showcase ISR 5 min. OG images via `opengraph-image.tsx`.
- **Demo sign-in toggle**: `DEMO_SIGNIN` / non-production (`lib/auth/session.ts:170`). Reset via `server/demo.ts`.

One stray file: `app/signin/.page.tsx.swp` (a Vim swap file).
