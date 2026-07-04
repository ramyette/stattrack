-- StatTrack public beta hardening.
-- Adds quotas, write throttles, safer Storage paths,
-- indexes, value validation, and explicit function permissions.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.usage_events (
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_lookup_idx
on private.usage_events (user_id, action, created_at desc);
create index if not exists usage_events_created_idx
on private.usage_events (created_at);

create or replace function private.check_rate_limit(
  action_name text,
  maximum_events integer,
  window_size interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid();
declare recent_events integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || action_name, 0));

  delete from private.usage_events where created_at < now() - interval '24 hours';
  select count(*) into recent_events
  from private.usage_events
  where user_id = current_user_id
    and action = action_name
    and created_at >= now() - window_size;

  if recent_events >= maximum_events then
    raise exception 'Too many requests. Please wait and try again.' using errcode = 'P0001';
  end if;

  insert into private.usage_events (user_id, action) values (current_user_id, action_name);
end;
$$;

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.limit_project_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.check_rate_limit('project_insert', 6, interval '1 hour');
    if (select count(*) from public.projects where owner_id = auth.uid()) >= 10 then
      raise exception 'Project limit reached';
    end if;
  elsif tg_op = 'UPDATE' then
    perform private.check_rate_limit('project_update', 30, interval '1 minute');
    if new.owner_id <> old.owner_id then raise exception 'Project ownership cannot be changed'; end if;
  end if;
  new.name := trim(new.name);
  if new.name = '' or new.color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Project values are invalid'; end if;
  if new.image_path is not null and new.image_path !~ ('^' || new.id::text || '/project/[A-Za-z0-9_.-]+$') then
    raise exception 'Project image path is invalid';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_project_writes on public.projects;
create trigger limit_project_writes
before insert or update on public.projects
for each row execute procedure private.limit_project_writes();

create or replace function private.limit_video_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.title := trim(new.title);
  if new.title = '' then raise exception 'Video title is required'; end if;
  if new.thumbnail_path !~ ('^' || new.project_id::text || '/videos/[A-Za-z0-9_.-]+$') then
    raise exception 'Thumbnail path is invalid';
  end if;
  if new.hype is not null and char_length(new.hype) > 200 then raise exception 'Hype value is too long'; end if;
  if new.views > 1000000000000
    or new.watch_hours > 1000000000
    or new.ctr > 100
    or new.likes > 1000000000000
    or new.comments > 1000000000000
    or new.avd !~ '^[0-9]{1,3}:[0-5][0-9]$' then
    raise exception 'One or more video values are invalid';
  end if;

  if tg_op = 'INSERT' then
    perform private.check_rate_limit('video_insert', 60, interval '1 hour');
    if (select count(*) from public.videos where project_id = new.project_id) >= 300 then
      raise exception 'Video limit reached for this project';
    end if;
  else
    perform private.check_rate_limit('video_update', 120, interval '1 minute');
    if new.project_id <> old.project_id or new.created_by <> old.created_by then
      raise exception 'Video ownership cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists limit_video_writes on public.videos;
create trigger limit_video_writes
before insert or update on public.videos
for each row execute procedure private.limit_video_writes();

create or replace function private.limit_profile_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_rate_limit('profile_update', 20, interval '1 minute');
  return new;
end;
$$;

drop trigger if exists limit_profile_writes on public.profiles;
create trigger limit_profile_writes
before update on public.profiles
for each row execute procedure private.limit_profile_writes();

create or replace function public.prepare_project_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_id uuid;
declare target_allows_invites boolean;
begin
  new.email := lower(trim(new.email));
  if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;

  if tg_op = 'INSERT' then
    perform private.check_rate_limit('project_invite', 20, interval '1 hour');
    if (select count(*) from public.project_invites where project_id = new.project_id) >= 20 then
      raise exception 'Pending invitation limit reached';
    end if;
    if (select count(*) from public.project_members where project_id = new.project_id) >= 10 then
      raise exception 'Project member limit reached';
    end if;
  end if;

  select id into target_id from auth.users where lower(email) = new.email limit 1;
  if target_id = auth.uid() then raise exception 'You cannot invite yourself'; end if;

  if target_id is not null then
    new.recipient_id := target_id;
    select allow_invites into target_allows_invites from public.profiles where id = target_id;
    if target_allows_invites = false then raise exception 'This person is not accepting invitations'; end if;
    if exists (
      select 1 from public.blocked_users
      where blocker_id = target_id and blocked_id = new.invited_by
    ) then raise exception 'This person is not accepting invitations'; end if;
  end if;
  return new;
end;
$$;

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
  update public.project_invites set recipient_id = new.id
  where lower(email) = lower(new.email) and recipient_id is null;
  return new;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  delete from auth.users where id = current_user_id;
end;
$$;

create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists videos_project_idx on public.videos (project_id, created_at desc);
create index if not exists project_invites_recipient_idx on public.project_invites (recipient_id);
create index if not exists project_invites_email_lower_idx on public.project_invites (lower(email));
create index if not exists project_presence_recent_idx on public.project_presence (project_id, last_seen desc);

create or replace function private.limit_presence_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.last_seen > now() - interval '10 seconds' then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists limit_presence_updates on public.project_presence;
create trigger limit_presence_updates
before update on public.project_presence
for each row execute procedure private.limit_presence_updates();

create or replace function public.can_upload_project_media(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare folders text[] := storage.foldername(object_name);
declare target_project_id uuid := public.try_uuid(folders[1]);
declare media_kind text := folders[2];
begin
  if target_project_id is null or media_kind not in ('videos', 'project') then return false; end if;
  if media_kind = 'project' and not public.is_project_owner(target_project_id) then return false; end if;
  if media_kind = 'videos' and not public.is_project_member(target_project_id) then return false; end if;
  if (select count(*) from storage.objects where bucket_id = 'project-media' and owner_id = auth.uid()::text) >= 200 then return false; end if;
  return true;
end;
$$;

update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'project-media';

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

drop policy if exists "Members read project media" on storage.objects;
drop policy if exists "Members upload project media" on storage.objects;
drop policy if exists "Members update project media" on storage.objects;
drop policy if exists "Members delete project media" on storage.objects;
drop policy if exists "Users upload their avatar" on storage.objects;
drop policy if exists "Users update their avatar" on storage.objects;
drop policy if exists "Users delete their avatar" on storage.objects;

create policy "Members read project media" on storage.objects
for select to authenticated using (
  bucket_id = 'project-media'
  and public.is_project_member(public.try_uuid((storage.foldername(name))[1]))
);

create policy "Authorized members upload project media" on storage.objects
for insert to authenticated with check (
  bucket_id = 'project-media' and public.can_upload_project_media(name)
);

create policy "Owners update project media" on storage.objects
for update to authenticated using (
  bucket_id = 'project-media'
  and owner_id = auth.uid()::text
) with check (
  bucket_id = 'project-media'
  and owner_id = auth.uid()::text
  and public.can_upload_project_media(name)
);

create policy "Uploaders or project owners delete media" on storage.objects
for delete to authenticated using (
  bucket_id = 'project-media'
  and (
    owner_id = auth.uid()::text
    or public.is_project_owner(public.try_uuid((storage.foldername(name))[1]))
  )
);

create policy "Users upload one avatar" on storage.objects
for insert to authenticated with check (
  bucket_id = 'avatars'
  and name = auth.uid()::text || '/avatar'
);

create policy "Users update their avatar" on storage.objects
for update to authenticated using (
  bucket_id = 'avatars' and owner_id = auth.uid()::text
) with check (
  bucket_id = 'avatars'
  and owner_id = auth.uid()::text
  and name = auth.uid()::text || '/avatar'
);

create policy "Users delete their avatar" on storage.objects
for delete to authenticated using (
  bucket_id = 'avatars' and owner_id = auth.uid()::text
);

revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public;

grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.shares_project_with(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.try_uuid(text) to authenticated;
grant execute on function public.can_upload_project_media(text) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.accept_project_invite(uuid) to authenticated;
grant execute on function public.decline_project_invite(uuid) to authenticated;
grant execute on function public.block_inviter(uuid) to authenticated;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
