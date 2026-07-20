-- AgriTrack: livestock animals per farm (company)
-- Fields based on common herd record systems (visual tag, stud/backup tag, EID, pedigree, etc.)
-- All data columns are nullable — farmers capture what they have on hand.

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,

  -- Identification
  tag_number text,
  stud_tag_number text,
  electronic_id text,
  name text,

  -- Characteristics
  species text default 'cattle',
  breed text,
  sex text check (sex is null or sex in ('male', 'female', 'unknown')),
  birth_date date,
  color_markings text,

  -- Pedigree
  sire_name text,
  sire_stud_code text,
  dam_tag_number text,

  -- Management
  status text default 'active' check (
    status is null or status in ('active', 'sold', 'deceased', 'transferred')
  ),
  location text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index animals_company_id_idx on public.animals (company_id);
create index animals_tag_number_idx on public.animals (tag_number);
create index animals_stud_tag_number_idx on public.animals (stud_tag_number);
create index animals_created_at_idx on public.animals (created_at desc);

create trigger animals_updated_at
  before update on public.animals
  for each row execute function public.update_updated_at();

alter table public.animals enable row level security;

-- Superadmins: full access
create policy "Superadmins manage all animals"
  on public.animals for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

-- Farm users: read/write own company's animals
create policy "Farm users read company animals"
  on public.animals for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company animals"
  on public.animals for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company animals"
  on public.animals for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company animals"
  on public.animals for delete
  using (company_id = public.current_user_company_id());
