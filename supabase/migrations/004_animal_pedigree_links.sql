-- Link animals to recorded dams/sires for pedigree / family trees.
-- Free-text pedigree fields remain for parents not in the herd.

alter table public.animals
  add column if not exists dam_id uuid references public.animals (id) on delete set null,
  add column if not exists sire_id uuid references public.animals (id) on delete set null;

create index if not exists animals_dam_id_idx on public.animals (dam_id);
create index if not exists animals_sire_id_idx on public.animals (sire_id);

alter table public.animals
  drop constraint if exists animals_dam_not_self,
  drop constraint if exists animals_sire_not_self;

alter table public.animals
  add constraint animals_dam_not_self check (dam_id is null or dam_id <> id),
  add constraint animals_sire_not_self check (sire_id is null or sire_id <> id);

create or replace function public.animals_validate_parents()
returns trigger
language plpgsql
as $$
begin
  if new.dam_id is not null then
    if not exists (
      select 1 from public.animals a
      where a.id = new.dam_id and a.company_id = new.company_id
    ) then
      raise exception 'Dam must belong to the same farm';
    end if;
  end if;

  if new.sire_id is not null then
    if not exists (
      select 1 from public.animals a
      where a.id = new.sire_id and a.company_id = new.company_id
    ) then
      raise exception 'Sire must belong to the same farm';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists animals_validate_parents on public.animals;

create trigger animals_validate_parents
  before insert or update of dam_id, sire_id, company_id
  on public.animals
  for each row execute function public.animals_validate_parents();
