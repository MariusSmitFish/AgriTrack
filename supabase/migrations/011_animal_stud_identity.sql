-- Boer-goat style identity: stud number – year – number, plus studbook fields.
-- Tag number (year – number) is still stored on tag_number so existing lists keep working.

alter table public.animals
  add column stud_number text,
  add column id_year text,
  add column id_number text,
  add column studbook_number text,
  add column studbook_schedule text,
  add column selection text;

alter table public.animals
  add constraint animals_studbook_schedule_check
    check (
      studbook_schedule is null
      or studbook_schedule in ('Base', 'A', 'B', 'SP')
    );

alter table public.animals
  add constraint animals_selection_check
    check (
      selection is null
      or selection in ('F', 'FC', 'FR', 'FT', 'Stud')
    );

alter table public.animals
  alter column species set default 'goat';

create index animals_stud_number_idx on public.animals (stud_number);
create index animals_studbook_number_idx on public.animals (studbook_number);
