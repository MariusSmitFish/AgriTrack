-- One animal ID per farm. The same visual tag may be used again only when the stud number differs.

create unique index if not exists animals_company_animal_id_uidx
  on public.animals (company_id, stud_number, id_year, id_number)
  where stud_number is not null
    and btrim(stud_number) <> ''
    and id_year is not null
    and btrim(id_year) <> ''
    and id_number is not null
    and btrim(id_number) <> '';

create unique index if not exists animals_company_bare_tag_uidx
  on public.animals (company_id, id_year, id_number)
  where (stud_number is null or btrim(stud_number) = '')
    and id_year is not null
    and btrim(id_year) <> ''
    and id_number is not null
    and btrim(id_number) <> '';
