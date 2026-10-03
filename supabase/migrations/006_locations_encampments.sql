-- Farm locations and encampments (camps/paddocks) where animals live.

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.encampments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index locations_company_id_idx on public.locations (company_id);
create index encampments_company_id_idx on public.encampments (company_id);
create index encampments_location_id_idx on public.encampments (location_id);

create trigger locations_updated_at
  before update on public.locations
  for each row execute function public.update_updated_at();

create trigger encampments_updated_at
  before update on public.encampments
  for each row execute function public.update_updated_at();

create or replace function public.encampments_validate_location()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.locations l
    where l.id = new.location_id and l.company_id = new.company_id
  ) then
    raise exception 'Encampment must belong to a location on the same farm';
  end if;
  return new;
end;
$$;

create trigger encampments_validate_location
  before insert or update of location_id, company_id
  on public.encampments
  for each row execute function public.encampments_validate_location();

alter table public.animals
  add column if not exists encampment_id uuid references public.encampments (id) on delete set null;

create index if not exists animals_encampment_id_idx on public.animals (encampment_id);

create or replace function public.animals_validate_encampment()
returns trigger
language plpgsql
as $$
begin
  if new.encampment_id is not null then
    if not exists (
      select 1 from public.encampments e
      where e.id = new.encampment_id and e.company_id = new.company_id
    ) then
      raise exception 'Encampment must belong to the same farm';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists animals_validate_encampment on public.animals;

create trigger animals_validate_encampment
  before insert or update of encampment_id, company_id
  on public.animals
  for each row execute function public.animals_validate_encampment();

alter table public.locations enable row level security;
alter table public.encampments enable row level security;

-- Locations: all farm users can read; farm admins + superadmins manage
create policy "Superadmins manage all locations"
  on public.locations for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company locations"
  on public.locations for select
  using (company_id = public.current_user_company_id());

create policy "Farm admins insert company locations"
  on public.locations for insert
  with check (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  );

create policy "Farm admins update company locations"
  on public.locations for update
  using (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  )
  with check (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  );

create policy "Farm admins delete company locations"
  on public.locations for delete
  using (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  );

-- Encampments
create policy "Superadmins manage all encampments"
  on public.encampments for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company encampments"
  on public.encampments for select
  using (company_id = public.current_user_company_id());

create policy "Farm admins insert company encampments"
  on public.encampments for insert
  with check (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  );

create policy "Farm admins update company encampments"
  on public.encampments for update
  using (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  )
  with check (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  );

create policy "Farm admins delete company encampments"
  on public.encampments for delete
  using (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  );
