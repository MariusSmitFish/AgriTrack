-- Farm users may update their company row to set the stud number.
-- That update must not be able to change the package, and the stud number
-- must be empty or 4 digits even if the request skips the form.
-- Signup metadata must not choose a role. Only app metadata, which the
-- service role can set, may assign one. Invites still correct the profile
-- in the create-user function after the row exists.

create or replace function public.companies_limit_farm_updates()
returns trigger
language plpgsql
as $$
begin
  if new.stud_number is not null and new.stud_number !~ '^\d{4}$' then
    raise exception 'Stud number must be 4 digits.';
  end if;

  if public.current_user_role() = 'superadmin' then
    return new;
  end if;

  if new.name is distinct from old.name
    or new.slug is distinct from old.slug
    or new.id is distinct from old.id
    or new.created_at is distinct from old.created_at
    or new.package_id is distinct from old.package_id
  then
    raise exception 'Only the stud number can be changed';
  end if;

  return new;
end;
$$;

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
  -- raw_user_meta_data is writable by the person signing up.
  -- raw_app_meta_data is writable only by the service role.
  begin
    assigned_role := coalesce(
      nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role,
      'company_user'
    );
  exception
    when invalid_text_representation then
      assigned_role := 'company_user';
  end;

  if assigned_role not in ('superadmin', 'company_admin', 'company_user') then
    assigned_role := 'company_user';
  end if;

  begin
    assigned_company_id := nullif(new.raw_app_meta_data ->> 'company_id', '')::uuid;
  exception
    when invalid_text_representation then
      assigned_company_id := null;
  end;

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

-- Invites insert the profile first, then assign the farm. The quota has to
-- run on that assignment as well, or a full farm could still gain a member.
create trigger profiles_package_quota_assign
  before update of company_id on public.profiles
  for each row
  when (old.company_id is null and new.company_id is not null)
  execute function public.enforce_package_quota('users', 'team members');
