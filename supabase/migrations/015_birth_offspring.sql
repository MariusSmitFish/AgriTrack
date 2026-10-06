-- A kidding can produce more than one kid. The breeding record keeps every offspring.

alter table public.breeding_events
  add column if not exists offspring_ids uuid[] not null default '{}';

create or replace function public.breeding_events_validate_animals()
returns trigger
language plpgsql
as $$
declare
  offspring_id uuid;
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
    raise exception 'Offspring must belong to the same farm';
  end if;

  if new.offspring_ids is not null then
    foreach offspring_id in array new.offspring_ids loop
      if not exists (
        select 1 from public.animals a
        where a.id = offspring_id and a.company_id = new.company_id
      ) then
        raise exception 'Offspring must belong to the same farm';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists breeding_events_validate_animals on public.breeding_events;

create trigger breeding_events_validate_animals
  before insert or update of dam_id, sire_id, calf_id, offspring_ids, company_id
  on public.breeding_events
  for each row execute function public.breeding_events_validate_animals();
