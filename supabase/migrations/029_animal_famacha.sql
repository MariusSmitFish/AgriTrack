-- FAMACHA eye-score history per animal. Score 1 is healthy, 5 is severely anemic.

create table public.animal_famacha (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  checked_at date not null default (timezone('utc', now()))::date,
  score smallint not null check (score between 1 and 5),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index animal_famacha_animal_id_idx on public.animal_famacha (animal_id);
create index animal_famacha_company_id_idx on public.animal_famacha (company_id);
create index animal_famacha_checked_at_idx on public.animal_famacha (checked_at desc);

create trigger animal_famacha_updated_at
  before update on public.animal_famacha
  for each row execute function public.update_updated_at();

create or replace function public.animal_famacha_validate_company()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.animals a
    where a.id = new.animal_id and a.company_id = new.company_id
  ) then
    raise exception 'FAMACHA animal must belong to the same farm';
  end if;
  return new;
end;
$$;

create trigger animal_famacha_validate_company
  before insert or update of animal_id, company_id
  on public.animal_famacha
  for each row execute function public.animal_famacha_validate_company();

alter table public.animal_famacha enable row level security;

create policy "Superadmins manage all animal famacha"
  on public.animal_famacha for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company animal famacha"
  on public.animal_famacha for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company animal famacha"
  on public.animal_famacha for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company animal famacha"
  on public.animal_famacha for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company animal famacha"
  on public.animal_famacha for delete
  using (company_id = public.current_user_company_id());
