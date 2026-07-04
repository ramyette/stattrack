-- Keep private Presence authorization limited to valid project topics.
-- The CASE prevents UUID casts for unrelated Realtime channel names.

drop policy if exists "Project members receive presence" on realtime.messages;
drop policy if exists "Project members publish presence" on realtime.messages;

create policy "Project members receive presence" on realtime.messages
for select to authenticated using (
  realtime.messages.extension = 'presence'
  and case
    when (select realtime.topic()) ~ '^project:[0-9a-fA-F-]{36}$'
    then public.is_project_member(split_part((select realtime.topic()), ':', 2)::uuid)
    else false
  end
);

create policy "Project members publish presence" on realtime.messages
for insert to authenticated with check (
  realtime.messages.extension = 'presence'
  and case
    when (select realtime.topic()) ~ '^project:[0-9a-fA-F-]{36}$'
    then public.is_project_member(split_part((select realtime.topic()), ':', 2)::uuid)
    else false
  end
);
