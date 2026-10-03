-- Breeding / service events and expected calving dates.

create table public.breeding_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  dam_id uuid not null references public.animals (id) on delete cascade,
  sire_id uuid references public.animals (id) on delete set null,
  served_at date not null default (timezone('utc', now()))::date,
  expected_calving_at date,
  outcome text not null default 'open' check (
    outcome in ('open', 'pregnant', 'calved', 'failed')
  ),
  calf_id uuid references public.animals (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index breeding_events_company_id_idx on public.breeding_events (company_id);
create index breeding_events_dam_id_idx on public.breeding_events (dam_id);
create index breeding_events_expected_calving_at_idx on public.breeding_events (expected_calving_at);
create index breeding_events_served_at_idx on public.breeding_events (served_at desc);

create trigger breeding_events_updated_at
  before update on public.breeding_events
  for each row execute function public.update_updated_at();

create or replace function public.breeding_events_validate_animals()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.animals a
    where a.id = new.dam_id and a.company_id = new.company_id
  ) then
    raise exception 'Breeding dam must belong to the same farm';
  end if;

  if new.sire_id is not null and not exists (
    select 1 from public.animals a
    where a.id = new.sire_id and a.company_id = new.company_id
  ) then
    raise exception 'Breeding sire must belong to the same farm';
  end if;

  if new.calf_id is not null and not exists (
    select 1 from public.animals a
    where a.id = new.calf_id and a.company_id = new.company_id
  ) then
    raise exception 'Calf must belong to the same farm';
  end if;

  return new;
end;
$$;

create trigger breeding_events_validate_animals
  before insert or update of dam_id, sire_id, calf_id, company_id
  on public.breeding_events
  for each row execute function public.breeding_events_validate_animals();

alter table public.breeding_events enable row level security;

create policy "Superadmins manage all breeding events"
  on public.breeding_events for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company breeding events"
  on public.breeding_events for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company breeding events"
  on public.breeding_events for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company breeding events"
  on public.breeding_events for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company breeding events"
  on public.breeding_events for delete
  using (company_id = public.current_user_company_id());
