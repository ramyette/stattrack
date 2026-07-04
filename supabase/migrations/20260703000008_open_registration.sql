-- Allow anyone with a Google account to register for StatTrack.
-- This also reverses the allowlist if an earlier version of migration 07 ran.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'New user'),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do nothing;

  update public.project_invites
  set recipient_id = new.id
  where lower(email) = lower(new.email) and recipient_id is null;

  return new;
end;
$$;

drop table if exists private.allowed_emails;
