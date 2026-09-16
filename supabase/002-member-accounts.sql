-- Applied AI Lab: member accounts (2026-09-11).
-- Run AFTER migration.sql, once, in the club Supabase project:
--   SQL editor -> paste -> run. Safe to re-run.
--
-- Until now only officers could sign in, and the callback turned everyone
-- else away. Accounts are now open to anyone with a Weber State address, by
-- Google or by email and password, so three things change here.

-- 1. The default role was 'officer'. That was harmless when every profile was
--    hand-seeded, and dangerous the moment strangers can create accounts: a
--    profile row inserted without a role would have been an officer. The
--    default is now the least-privileged role, and the trigger below sets it
--    explicitly anyway.
alter table profiles alter column role set default 'member';

-- 2. Only Weber State addresses may create an account. Enforced here, before
--    the auth.users row exists, so it holds for Google, for email and
--    password, and for anything added later. Google's `hd` parameter is only a
--    hint to its account picker, and the app's own check can be bypassed by
--    calling the auth API directly, so neither is enough on its own.
create or replace function public.enforce_weber_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(split_part(new.email, '@', 2)) not in ('weber.edu', 'mail.weber.edu')
     or new.email like '%@%@%' then
    raise exception 'Accounts are limited to Weber State email addresses.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_weber_email on auth.users;
create trigger enforce_weber_email
  before insert on auth.users
  for each row execute function public.enforce_weber_email();

-- 3. Every new account gets a profile, as a member. Google puts the person's
--    name in raw_user_meta_data as full_name or name; the email sign-up form
--    sends full_name. `on conflict do nothing` covers a profile that an
--    officer created ahead of the person's first sign-in, which keeps its role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    lower(new.email),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', '')
    ),
    'member',
    'active'
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles RLS is unchanged and already right for members: "profiles own
-- read" lets a person read their own row, and only officers can insert or
-- update, so nobody can promote themselves.

-- Dashboard settings to match (Authentication in the Supabase dashboard):
--   Providers -> Email: enabled, "Confirm email" on, minimum password 8.
--   Providers -> Google: enabled, with the club's Google Cloud OAuth client.
--   URL Configuration -> Site URL: the production domain.
--   URL Configuration -> Redirect URLs: <domain>/api/auth/callback and
--     http://localhost:3000/api/auth/callback for development.
