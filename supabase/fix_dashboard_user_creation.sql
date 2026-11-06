-- ============================================================
-- RUN THIS NOW in Supabase SQL Editor
-- Fixes "Failed to create user" from the Dashboard
-- ============================================================

-- Remove constraint that blocks new users without a company
alter table public.profiles
  drop constraint if exists profiles_company_required;

-- Role comes from app metadata only. User metadata is writable at signup.
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
