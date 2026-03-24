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
      nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
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

update public.users u
set username = coalesce(
  nullif(split_part(coalesce(au.email, ''), '@', 1), ''),
  'user_' || left(au.id::text, 8)
)
from auth.users au
where u.id = au.id
  and coalesce(btrim(u.username), '') = '';
