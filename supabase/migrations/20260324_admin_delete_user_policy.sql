drop policy if exists "admins_delete_non_admin_users" on public.users;

create policy "admins_delete_non_admin_users"
on public.users
for delete
to authenticated
using (
  public.current_user_role() = 'admin'
  and role <> 'admin'
);
