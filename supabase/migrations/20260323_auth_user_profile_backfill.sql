create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, role, branch_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(coalesce(new.email, ''), '@', 1),
      'user_' || left(new.id::text, 8)
    ),
    coalesce(new.raw_user_meta_data ->> 'role', 'customer'),
    case
      when coalesce(new.raw_user_meta_data ->> 'branch_id', '') ~ '^\d+$'
        then (new.raw_user_meta_data ->> 'branch_id')::integer
      else null
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

drop policy if exists "users_insert_self" on public.users;

create policy "users_insert_self"
on public.users
for insert
to authenticated
with check (id = auth.uid());

insert into public.users (id, username, role, branch_id)
select
  au.id,
  coalesce(
    au.raw_user_meta_data ->> 'username',
    split_part(coalesce(au.email, ''), '@', 1),
    'user_' || left(au.id::text, 8)
  ),
  coalesce(au.raw_user_meta_data ->> 'role', 'customer'),
  case
    when coalesce(au.raw_user_meta_data ->> 'branch_id', '') ~ '^\d+$'
      then (au.raw_user_meta_data ->> 'branch_id')::integer
    else null
  end
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;
