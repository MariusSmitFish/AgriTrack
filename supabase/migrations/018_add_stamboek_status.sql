-- Add 'stamboek' as a valid animal status

alter table public.animals
  drop constraint if exists animals_status_check;

alter table public.animals
  add constraint animals_status_check check (
    status is null or status in ('active', 'sold', 'deceased', 'transferred', 'stamboek')
  );
