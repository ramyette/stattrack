-- Safely parse project Presence topics and authorize StatTrack's private
-- Postgres Changes channels. Table RLS still filters every database row.

create or replace function public.realtime_project_id(topic text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if topic ~ '^project:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return split_part(topic, ':', 2)::uuid;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

drop policy if exists "Project members receive presence" on realtime.messages;
drop policy if exists "Project members publish presence" on realtime.messages;
drop policy if exists "Signed in users connect to StatTrack channels" on realtime.messages;

create policy "Project members receive presence" on realtime.messages
for select to authenticated using (
  realtime.messages.extension = 'presence'
  and public.is_project_member(public.realtime_project_id((select realtime.topic())))
);

create policy "Project members publish presence" on realtime.messages
for insert to authenticated with check (
  realtime.messages.extension = 'presence'
  and public.is_project_member(public.realtime_project_id((select realtime.topic())))
);
-
create policy "Signed in users connect to StatTrack channels" on realtime.messages
for select to authenticated using (
  (select realtime.topic()) in ('projects-list', 'my-invitations', 'invitation-inbox')
  or (select realtime.topic()) ~ '^project-[0-9a-fA-F-]{36}$'
  or (select realtime.topic()) ~ '^analytics-[0-9a-fA-F-]{36}$'
);
