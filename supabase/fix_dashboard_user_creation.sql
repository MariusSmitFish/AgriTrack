-- ============================================================
-- RUN THIS NOW in Supabase SQL Editor
-- Fixes "Failed to create user" from the Dashboard
-- ============================================================

-- Remove constraint that blocks new users without a company
alter table public.profiles
  drop constraint if exists profiles_company_required;

-- Update trigger to read role/company from user metadata
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
