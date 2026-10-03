-- Track inoculations / vaccinations per animal.

create table public.animal_inoculations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  name text not null,
  administered_at date not null default (timezone('utc', now()))::date,
  next_due_at date,
  batch_number text,
  dosage text,
  administered_by text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index animal_inoculations_animal_id_idx on public.animal_inoculations (animal_id);
create index animal_inoculations_company_id_idx on public.animal_inoculations (company_id);
create index animal_inoculations_administered_at_idx on public.animal_inoculations (administered_at desc);
create index animal_inoculations_next_due_at_idx on public.animal_inoculations (next_due_at);

create trigger animal_inoculations_updated_at
  before update on public.animal_inoculations
  for each row execute function public.update_updated_at();

create or replace function public.animal_inoculations_validate_company()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.animals a
    where a.id = new.animal_id and a.company_id = new.company_id
  ) then
    raise exception 'Inoculation animal must belong to the same farm';
  end if;
  return new;
end;
$$;

create trigger animal_inoculations_validate_company
  before insert or update of animal_id, company_id
  on public.animal_inoculations
  for each row execute function public.animal_inoculations_validate_company();

alter table public.animal_inoculations enable row level security;

create policy "Superadmins manage all animal inoculations"
  on public.animal_inoculations for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company animal inoculations"
  on public.animal_inoculations for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company animal inoculations"
  on public.animal_inoculations for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company animal inoculations"
  on public.animal_inoculations for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company animal inoculations"
  on public.animal_inoculations for delete
  using (company_id = public.current_user_company_id());
