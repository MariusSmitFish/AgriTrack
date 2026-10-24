-- Auto-link parent relationships when animals are added
-- When a new animal is inserted/updated, check if any animals reference
-- this animal's tag in their free-text parent fields and link them.

create or replace function public.auto_link_parent_references()
returns trigger
language plpgsql
as $$
declare
  child_record record;
begin
  -- Only proceed if the animal has a tag
  if new.tag_number is null or new.tag_number = '' then
    return new;
  end if;

  -- Find children that reference this animal as mother (dam_tag_number)
  -- and link them if dam_id is not already set
  for child_record in
    select id
    from public.animals
    where company_id = new.company_id
      and id <> new.id
      and dam_tag_number = new.tag_number
      and dam_id is null
  loop
    update public.animals
    set dam_id = new.id
    where id = child_record.id;
  end loop;

  -- Find children that reference this animal as father (sire_name)
  -- Match against various formats: tag, animal ID, or name
  for child_record in
    select id
    from public.animals
    where company_id = new.company_id
      and id <> new.id
      and (
        sire_name = new.tag_number
        or (new.name is not null and new.name <> '' and sire_name = new.name)
        or (new.stud_number is not null and new.id_year is not null and new.id_number is not null
            and sire_name = new.stud_number || '-' || new.id_year || '-' || new.id_number)
      )
      and sire_id is null
  loop
    update public.animals
    set sire_id = new.id
    where id = child_record.id;
  end loop;

  return new;
end;
$$;

drop trigger if exists auto_link_parent_references on public.animals;

create trigger auto_link_parent_references
  after insert or update of tag_number, name, stud_number, id_year, id_number
  on public.animals
  for each row execute function public.auto_link_parent_references();

comment on function public.auto_link_parent_references is
  'Automatically links parent relationships when an animal is added or updated. '
  'Searches for animals with matching free-text parent references (dam_tag_number or sire_name) '
  'and populates their dam_id or sire_id fields.';
