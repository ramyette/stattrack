-- Allow a project owner to read the project immediately during INSERT ... RETURNING,
-- then ensure every project has its required owner membership.

drop policy if exists "Members view projects" on public.projects;

create policy "Members view projects" on public.projects
for select to authenticated
using (owner_id = auth.uid() or public.is_project_member(id));

create or replace function public.add_project_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id)
  do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;

create trigger on_project_created
after insert on public.projects
for each row execute procedure public.add_project_owner();

insert into public.project_members (project_id, user_id, role)
select id, owner_id, 'owner'::public.project_role
from public.projects
on conflict (project_id, user_id)
do update set role = 'owner';
