-- The farm's stud number is set in Configurations and used for new kids.
-- Farm users may change only this field on their company.

alter table public.companies
  add column if not exists stud_number text;

create policy "Farm users read own company"
  on public.companies for select
  using (
    public.current_user_role() in ('company_admin', 'company_user')
    and id = public.current_user_company_id()
  );

create policy "Farm users set own company stud number"
  on public.companies for update
  using (
    public.current_user_role() in ('company_admin', 'company_user')
    and id = public.current_user_company_id()
  )
  with check (
    public.current_user_role() in ('company_admin', 'company_user')
    and id = public.current_user_company_id()
  );

create or replace function public.companies_limit_farm_updates()
returns trigger
language plpgsql
as $$
begin
  if public.current_user_role() = 'superadmin' then
    return new;
  end if;

  if new.name is distinct from old.name
    or new.slug is distinct from old.slug
    or new.id is distinct from old.id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only the stud number can be changed';
  end if;

  return new;
end;
$$;

create trigger companies_limit_farm_updates
  before update on public.companies
  for each row execute function public.companies_limit_farm_updates();
