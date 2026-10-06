-- Split animal health records into vaccinations and treatments.
-- Farms manage the option lists in Configurations.

alter table public.animal_inoculations
  add column kind text not null default 'vaccination'
  check (kind in ('vaccination', 'treatment'));

create table public.health_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('vaccination', 'treatment')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index health_options_company_kind_name_idx
  on public.health_options (company_id, kind, lower(btrim(name)));

create index health_options_company_kind_idx on public.health_options (company_id, kind);

create trigger health_options_updated_at
  before update on public.health_options
  for each row execute function public.update_updated_at();

alter table public.health_options enable row level security;

create policy "Superadmins manage all health options"
  on public.health_options for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company health options"
  on public.health_options for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company health options"
  on public.health_options for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company health options"
  on public.health_options for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company health options"
  on public.health_options for delete
  using (company_id = public.current_user_company_id());

create or replace function public.seed_company_health_options(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.health_options (company_id, kind, name)
  select p_company_id, defaults.kind, defaults.name
  from (
    values
      ('vaccination', 'Pulpy kidney'),
      ('vaccination', 'Clostridial'),
      ('vaccination', 'Pasteurella'),
      ('vaccination', 'Enzootic abortion'),
      ('vaccination', 'Tetanus'),
      ('vaccination', 'Orf'),
      ('vaccination', 'Bluetongue'),
      ('treatment', 'Dewormer'),
      ('treatment', 'Antibiotic'),
      ('treatment', 'Pain relief'),
      ('treatment', 'Wound care'),
      ('treatment', 'Vitamin / mineral')
  ) as defaults(kind, name)
  where not exists (
    select 1
    from public.health_options existing
    where existing.company_id = p_company_id
      and existing.kind = defaults.kind
      and lower(btrim(existing.name)) = lower(btrim(defaults.name))
  );
end;
$$;

create or replace function public.seed_health_options_for_new_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_company_health_options(new.id);
  return new;
end;
$$;

create trigger companies_seed_health_options
  after insert on public.companies
  for each row execute function public.seed_health_options_for_new_company();

do $$
declare
  company_row record;
begin
  for company_row in select id from public.companies loop
    perform public.seed_company_health_options(company_row.id);
  end loop;
end;
$$;
