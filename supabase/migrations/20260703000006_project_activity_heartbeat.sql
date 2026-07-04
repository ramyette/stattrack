-- A simple authenticated heartbeat for active project viewers.
-- This replaces Realtime Presence while keeping database changes realtime.

create table if not exists public.project_presence (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_seen timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_presence enable row level security;

create policy "Members view project activity" on public.project_presence
for select to authenticated using (public.is_project_member(project_id));

create policy "Members create their activity" on public.project_presence
for insert to authenticated with check (
  user_id = auth.uid() and public.is_project_member(project_id)
);

create policy "Members update their activity" on public.project_presence
for update to authenticated using (
  user_id = auth.uid() and public.is_project_member(project_id)
) with check (
  user_id = auth.uid() and public.is_project_member(project_id)
);

create policy "Members delete their activity" on public.project_presence
for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Project members receive presence" on realtime.messages;
drop policy if exists "Project members publish presence" on realtime.messages;
