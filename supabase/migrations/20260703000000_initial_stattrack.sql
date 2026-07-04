-- StatTrack initial schema: profiles, shared projects, invitations, videos, and media.
create extension if not exists pgcrypto;

create type public.project_role as enum ('owner', 'editor');
create type public.profile_theme as enum ('light', 'dark', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  theme public.profile_theme not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  color text not null default '#f97316',
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.project_role not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  role public.project_role not null default 'editor',
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, email)
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  thumbnail_path text not null,
  views bigint not null check (views >= 0),
  watch_hours numeric not null check (watch_hours >= 0),
  ctr numeric not null check (ctr >= 0),
  avd text not null check (char_length(avd) between 1 and 20),
  likes bigint not null check (likes >= 0),
  comments bigint not null check (comments >= 0),
  hype text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_project_member(check_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members
    where project_id = check_project_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(check_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members
    where project_id = check_project_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.shares_project_with(other_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid() and theirs.user_id = other_user_id
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'New user'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.project_members (project_id, user_id, role)
  select project_id, new.id, role
  from public.project_invites
  where lower(email) = lower(new.email);

  delete from public.project_invites where lower(email) = lower(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.add_project_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_project_created
after insert on public.projects for each row execute procedure public.add_project_owner();

create or replace function public.claim_invite_for_existing_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare invited_user_id uuid;
begin
  select id into invited_user_id from auth.users where lower(email) = lower(new.email) limit 1;
  if invited_user_id is not null then
    insert into public.project_members (project_id, user_id, role)
    values (new.project_id, invited_user_id, new.role)
    on conflict (project_id, user_id) do nothing;
    delete from public.project_invites where id = new.id;
    return null;
  end if;
  return new;
end;
$$;

create trigger on_project_invite_created
after insert on public.project_invites for each row execute procedure public.claim_invite_for_existing_user();

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  delete from storage.objects where owner_id = current_user_id::text;
  delete from auth.users where id = current_user_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;
alter table public.videos enable row level security;

create policy "Profiles are visible to collaborators" on public.profiles
for select to authenticated using (id = auth.uid() or public.shares_project_with(id));
create policy "Users update their profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Members view projects" on public.projects
for select to authenticated using (public.is_project_member(id));
create policy "Users create projects" on public.projects
for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners update projects" on public.projects
for update to authenticated using (public.is_project_owner(id)) with check (public.is_project_owner(id));
create policy "Owners delete projects" on public.projects
for delete to authenticated using (public.is_project_owner(id));

create policy "Members view memberships" on public.project_members
for select to authenticated using (public.is_project_member(project_id));
create policy "Owners remove members" on public.project_members
for delete to authenticated using (public.is_project_owner(project_id) and role <> 'owner');

create policy "Owners view invitations" on public.project_invites
for select to authenticated using (public.is_project_owner(project_id));
create policy "Owners create invitations" on public.project_invites
for insert to authenticated with check (public.is_project_owner(project_id) and invited_by = auth.uid() and role = 'editor');
create policy "Owners cancel invitations" on public.project_invites
for delete to authenticated using (public.is_project_owner(project_id));

create policy "Members view videos" on public.videos
for select to authenticated using (public.is_project_member(project_id));
create policy "Members create videos" on public.videos
for insert to authenticated with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "Members update videos" on public.videos
for update to authenticated using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "Members delete videos" on public.videos
for delete to authenticated using (public.is_project_member(project_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-media', 'project-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Members read project media" on storage.objects for select to authenticated
using (bucket_id = 'project-media' and public.is_project_member(((storage.foldername(name))[1])::uuid));
create policy "Members upload project media" on storage.objects for insert to authenticated
with check (bucket_id = 'project-media' and public.is_project_member(((storage.foldername(name))[1])::uuid));
create policy "Members update project media" on storage.objects for update to authenticated
using (bucket_id = 'project-media' and public.is_project_member(((storage.foldername(name))[1])::uuid));
create policy "Members delete project media" on storage.objects for delete to authenticated
using (bucket_id = 'project-media' and public.is_project_member(((storage.foldername(name))[1])::uuid));

create policy "Anyone reads avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload their avatar" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update their avatar" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and owner_id = auth.uid()::text);
create policy "Users delete their avatar" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and owner_id = auth.uid()::text);

alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.project_members;
alter publication supabase_realtime add table public.videos;

grant execute on function public.delete_own_account() to authenticated;
