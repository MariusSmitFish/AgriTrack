-- Fix: profile trigger failing when company_id is missing for non-superadmin users.
-- Also helps avoid broken auth state from failed user creation.

alter table public.profiles
  drop constraint if exists profiles_company_required;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role;
  assigned_company_id uuid;
begin
  assigned_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'company_user'
  );

  assigned_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;

  if assigned_role = 'superadmin' then
    assigned_company_id := null;
  end if;

  insert into public.profiles (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    assigned_role,
    assigned_company_id
  );

  return new;
end;
$$;
