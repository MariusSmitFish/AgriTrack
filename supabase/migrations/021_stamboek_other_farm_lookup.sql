-- Read-only lookup of an animal identity that already exists on another farm.
-- Returns studbook details only. Farm name, place, sale, notes, and health stay private.

create or replace function public.lookup_other_company_animals(
  p_company_id uuid,
  p_keys text[]
)
returns table (
  animal_key text,
  sex text,
  birth_date date,
  breed text,
  studbook_number text,
  studbook_schedule text,
  dam_tag text,
  sire_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_company_id is null or p_keys is null or cardinality(p_keys) = 0 then
    return;
  end if;

  if cardinality(p_keys) > 5000 then
    raise exception 'Too many animals to look up at once';
  end if;

  if public.current_user_role() is distinct from 'superadmin'
     and p_company_id is distinct from public.current_user_company_id() then
    raise exception 'You can only look up animals for your own farm';
  end if;

  return query
  select distinct on (upper(a.stud_number || '-' || a.id_year || '-' || a.id_number))
    upper(a.stud_number || '-' || a.id_year || '-' || a.id_number),
    a.sex,
    a.birth_date,
    a.breed,
    a.studbook_number,
    a.studbook_schedule,
    coalesce(
      case
        when d.stud_number is not null and d.id_year is not null and d.id_number is not null
          then d.stud_number || '-' || d.id_year || '-' || d.id_number
      end,
      a.dam_tag_number
    ),
    coalesce(
      case
        when s.stud_number is not null and s.id_year is not null and s.id_number is not null
          then s.stud_number || '-' || s.id_year || '-' || s.id_number
      end,
      a.sire_name
    )
  from public.animals a
  left join public.animals d on d.id = a.dam_id
  left join public.animals s on s.id = a.sire_id
  where a.company_id <> p_company_id
    and a.stud_number is not null
    and a.id_year is not null
    and a.id_number is not null
    and upper(a.stud_number || '-' || a.id_year || '-' || a.id_number) = any (p_keys)
  order by
    upper(a.stud_number || '-' || a.id_year || '-' || a.id_number),
    (a.birth_date is not null) desc,
    (a.studbook_number is not null) desc,
    a.created_at asc;
end;
$$;

revoke all on function public.lookup_other_company_animals(uuid, text[]) from public;
grant execute on function public.lookup_other_company_animals(uuid, text[]) to authenticated;
