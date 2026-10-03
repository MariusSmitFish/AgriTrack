-- Weight history per animal.

create table public.animal_weights (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  weighed_at date not null default (timezone('utc', now()))::date,
  weight_kg numeric(10, 2) not null check (weight_kg > 0),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index animal_weights_animal_id_idx on public.animal_weights (animal_id);
create index animal_weights_company_id_idx on public.animal_weights (company_id);
create index animal_weights_weighed_at_idx on public.animal_weights (weighed_at desc);

create trigger animal_weights_updated_at
  before update on public.animal_weights
  for each row execute function public.update_updated_at();

create or replace function public.animal_weights_validate_company()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.animals a
    where a.id = new.animal_id and a.company_id = new.company_id
  ) then
    raise exception 'Weight animal must belong to the same farm';
  end if;
  return new;
end;
$$;

create trigger animal_weights_validate_company
  before insert or update of animal_id, company_id
  on public.animal_weights
  for each row execute function public.animal_weights_validate_company();

alter table public.animal_weights enable row level security;

create policy "Superadmins manage all animal weights"
  on public.animal_weights for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company animal weights"
  on public.animal_weights for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company animal weights"
  on public.animal_weights for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company animal weights"
  on public.animal_weights for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company animal weights"
  on public.animal_weights for delete
  using (company_id = public.current_user_company_id());

-- Ensure farm reset clears weights explicitly (also cascaded from animals).
create or replace function public.reset_farm_data(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animals int;
  v_inoculations int;
  v_weights int;
  v_photos int;
  v_camps int;
  v_locations int;
begin
  perform public.require_superadmin();

  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Farm not found';
  end if;

  delete from public.animal_photos where company_id = p_company_id;
  get diagnostics v_photos = row_count;

  delete from public.animal_inoculations where company_id = p_company_id;
  get diagnostics v_inoculations = row_count;

  delete from public.animal_weights where company_id = p_company_id;
  get diagnostics v_weights = row_count;

  delete from public.breeding_events where company_id = p_company_id;

  delete from public.animals where company_id = p_company_id;
  get diagnostics v_animals = row_count;

  delete from public.encampments where company_id = p_company_id;
  get diagnostics v_camps = row_count;

  delete from public.locations where company_id = p_company_id;
  get diagnostics v_locations = row_count;

  return jsonb_build_object(
    'company_id', p_company_id,
    'deleted_animals', v_animals,
    'deleted_inoculations', v_inoculations,
    'deleted_weights', v_weights,
    'deleted_photos', v_photos,
    'deleted_encampments', v_camps,
    'deleted_locations', v_locations
  );
end;
$$;
