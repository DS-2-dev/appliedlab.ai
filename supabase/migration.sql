-- Applied AI Lab: iteration-1 schema (spec-v2 §5.1), RLS on everything.
-- Run once in the club Supabase project (owned by ailab@weber.edu):
--   SQL editor -> paste -> run. Then seed the first officer (bottom of file).

create type event_type as enum ('meeting', 'social', 'showcase', 'other');
create type inquiry_status as enum ('new', 'contacted', 'archived');
create type inquiry_kind as enum ('casework', 'project', 'representative');
create type profile_role as enum ('officer', 'member', 'partner'); -- member/partner reserved for later iterations
create type showcase_kind as enum ('founder', 'casework', 'project');
create type profile_status as enum ('active', 'removed');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role profile_role not null default 'officer',
  status profile_status not null default 'active',
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type event_type not null default 'meeting',
  starts_at timestamptz not null,
  ends_at timestamptz,
  room text,
  -- false renders the room with a "to be confirmed" note on the public site
  room_confirmed boolean not null default true,
  location_note text,
  description text,
  created_at timestamptz not null default now()
);

create table partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  -- which door the inquiry came through. One table serves all of them because
  -- the follow-up workflow is identical; only the questions differ.
  kind inquiry_kind not null default 'casework',
  org_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  problem text not null,
  anything_else text,
  how_heard text,
  status inquiry_status not null default 'new',
  notes_internal text,
  -- reserved for the later iteration where partner orgs become entities (spec-v2 §9)
  partner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Showcase entries are data so publishing member work is an admin action,
-- never a code change. "by"/"when" are reserved words, hence by_line/when_label.
create table showcase_entries (
  id uuid primary key default gen_random_uuid(),
  kind showcase_kind not null default 'casework',
  title text not null,
  does text not null,
  by_line text not null,
  affiliation text,
  partner text,
  when_label text not null,
  -- both set, or both null (not faculty rated)
  rating_average numeric,
  rating_count integer,
  running boolean not null default true,
  -- all three set, or none
  metric_label text,
  metric_before text,
  metric_after text,
  story text[] not null default '{}',
  limits text not null,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Student signups: membership is showing up; this keeps a student in the
-- loop (kickoff reminder, each week's room). One row per email.
create table student_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  major text,
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id)
);

alter table profiles enable row level security;
alter table events enable row level security;
alter table partner_inquiries enable row level security;
alter table showcase_entries enable row level security;
alter table student_signups enable row level security;
alter table settings enable row level security;

-- Helper: is the calling user an active officer?
create or replace function is_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'officer' and status = 'active'
  );
$$;

-- events: world-readable (visibility is implicit; officers only enter public
-- events in iteration 1), officer-writable.
create policy "events public read" on events for select using (true);
create policy "events officer insert" on events for insert with check (is_officer());
create policy "events officer update" on events for update using (is_officer());
create policy "events officer delete" on events for delete using (is_officer());

-- settings: world-readable, officer-writable.
create policy "settings public read" on settings for select using (true);
create policy "settings officer write" on settings for insert with check (is_officer());
create policy "settings officer update" on settings for update using (is_officer());

-- partner_inquiries: anonymous INSERT only; officers read and update.
create policy "inquiries public insert" on partner_inquiries
  for insert with check (status = 'new' and notes_internal is null);
create policy "inquiries officer read" on partner_inquiries for select using (is_officer());
create policy "inquiries officer update" on partner_inquiries for update using (is_officer());

-- showcase: the public reads published rows only; officers manage everything.
create policy "showcase public read" on showcase_entries for select using (published);
create policy "showcase officer read" on showcase_entries for select using (is_officer());
create policy "showcase officer insert" on showcase_entries for insert with check (is_officer());
create policy "showcase officer update" on showcase_entries for update using (is_officer());
create policy "showcase officer delete" on showcase_entries for delete using (is_officer());

-- student signups: anonymous INSERT only; officers read.
create policy "students public insert" on student_signups for insert with check (true);
create policy "students officer read" on student_signups for select using (is_officer());

-- profiles: officers read and manage; a signed-in user may read their own row
-- (needed for the sign-in gate).
create policy "profiles own read" on profiles for select using (id = auth.uid());
create policy "profiles officer read" on profiles for select using (is_officer());
create policy "profiles officer write" on profiles for insert with check (is_officer());
create policy "profiles officer update" on profiles for update using (is_officer());

-- Seed the first officer AFTER they have signed in once with Google
-- (the sign-in creates the auth.users row; grab its id from Authentication -> Users):
-- insert into profiles (id, email, full_name, role, status)
-- values ('<auth-user-uuid>', 'ailab@weber.edu', 'Club President', 'officer', 'active');

-- Seed the two founder showcase entries (stories are provisional; Kylar
-- rewrites them in admin).
insert into showcase_entries
  (kind, title, does, by_line, affiliation, partner, when_label, running,
   metric_label, metric_before, metric_after, story, limits, published, sort_order)
values
  ('founder', 'Route planner', 'Plans daily service routes for a working business.',
   'Kylar Vierra, founder', 'Goddard School of Business and Economics', null,
   'Summer 2026', true, null, null, null,
   array['Built in about two weeks while testing the format the Lab now runs on.',
         'It replaced a hand-built routing process, and it has been in use since.'],
   'Built for one organization''s constraints. The organization is not named here.',
   true, 0),
  ('founder', 'Budget builder', 'Builds a company budget that used to take weeks, in days.',
   'Kylar Vierra, founder', 'Goddard School of Business and Economics', null,
   'Summer 2026', true, 'Time to finish the budget', 'weeks', 'days',
   array['Built while testing the same format.',
         'It rebuilt a spreadsheet budget process end to end, and it is still how the budget gets done.'],
   'Fitted to one organization''s accounts and approvals. Portable in shape, not in detail.',
   true, 1);
