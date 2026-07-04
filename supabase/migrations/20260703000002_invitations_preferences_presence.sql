-- Pending invitations, blocking/preferences, and private project presence.

alter table public.profiles
  add column if not exists allow_invites boolean not null default true,
  add column if not exists auto_accept_invites boolean not null default false;

alter table public.project_invites
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade;

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

drop policy if exists "Owners remove members" on public.project_members;
create policy "Owners remove members or editors leave" on public.project_members
for delete to authenticated using (
  (public.is_project_owner(project_id) and role <> 'owner')
  or (user_id = auth.uid() and role = 'editor')
);

create policy "Users view their blocks" on public.blocked_users
for select to authenticated using (blocker_id = auth.uid());
create policy "Users create their blocks" on public.blocked_users
for insert to authenticated with check (blocker_id = auth.uid());
create policy "Users remove their blocks" on public.blocked_users
for delete to authenticated using (blocker_id = auth.uid());

drop trigger if exists on_project_invite_created on public.project_invites;
drop function if exists public.claim_invite_for_existing_user();

create or replace function public.prepare_project_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
declare target_allows_invites boolean;
begin
  new.email := lower(trim(new.email));
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

create trigger prepare_project_invite
before insert or update on public.project_invites
for each row execute procedure public.prepare_project_invite();

create or replace function public.auto_accept_project_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.recipient_id is not null and exists (
    select 1 from public.profiles where id = new.recipient_id and auto_accept_invites = true
  ) then
    insert into public.project_members (project_id, user_id, role)
    values (new.project_id, new.recipient_id, new.role)
    on conflict (project_id, user_id) do nothing;
    delete from public.project_invites where id = new.id;
    return null;
  end if;
  return new;
end;
$$;

create trigger auto_accept_project_invite
after insert or update of recipient_id on public.project_invites
for each row execute procedure public.auto_accept_project_invite();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'New user'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  update public.project_invites
  set recipient_id = new.id
  where lower(email) = lower(new.email) and recipient_id is null;
  return new;
end;
$$;

create or replace function public.accept_project_invite(invite_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.project_invites;
begin
  select * into invite from public.project_invites where id = invite_id;
  if invite.id is null or not (
    invite.recipient_id = auth.uid()
    or lower(invite.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then raise exception 'Invitation not found'; end if;

  insert into public.project_members (project_id, user_id, role)
  values (invite.project_id, auth.uid(), invite.role)
  on conflict (project_id, user_id) do nothing;
  delete from public.project_invites where id = invite_id;
  return invite.project_id;
end;
$$;

create or replace function public.decline_project_invite(invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.project_invites
  where id = invite_id and (
    recipient_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
end;
$$;

create or replace function public.block_inviter(invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare sender_id uuid;
begin
  select invited_by into sender_id from public.project_invites
  where id = invite_id and (
    recipient_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
  if sender_id is null then raise exception 'Invitation not found'; end if;

  insert into public.blocked_users (blocker_id, blocked_id)
  values (auth.uid(), sender_id) on conflict do nothing;
  delete from public.project_invites
  where invited_by = sender_id and (
    recipient_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
end;
$$;

drop policy if exists "Owners view invitations" on public.project_invites;
create policy "Owners and recipients view invitations" on public.project_invites
for select to authenticated using (
  public.is_project_owner(project_id)
  or recipient_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create or replace function public.can_view_profile(other_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select other_user_id = auth.uid()
  or public.shares_project_with(other_user_id)
  or exists (
    select 1 from public.project_invites
    where invited_by = other_user_id and (
      recipient_id = auth.uid()
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  or exists (
    select 1 from public.blocked_users
    where blocker_id = auth.uid() and blocked_id = other_user_id
  );
$$;

drop policy if exists "Profiles are visible to collaborators" on public.profiles;
create policy "Profiles are visible when relevant" on public.profiles
for select to authenticated using (public.can_view_profile(id));

grant execute on function public.accept_project_invite(uuid) to authenticated;
grant execute on function public.decline_project_invite(uuid) to authenticated;
grant execute on function public.block_inviter(uuid) to authenticated;

alter publication supabase_realtime add table public.project_invites;

-- Private Presence topic format: project:<project_uuid>
create policy "Project members receive presence" on realtime.messages
for select to authenticated using (
  realtime.messages.extension = 'presence'
  and public.is_project_member(split_part((select realtime.topic()), ':', 2)::uuid)
);
create policy "Project members publish presence" on realtime.messages
for insert to authenticated with check (
  realtime.messages.extension = 'presence'
  and public.is_project_member(split_part((select realtime.topic()), ':', 2)::uuid)
);
