-- Relatives recorded on another farm, matched by animal ID, for a view-only family tree.
-- Does not expose the other farm's name, place, sale, notes, or health records.

drop function if exists public.lookup_other_company_animals(uuid, text[]);

create or replace function public.animal_identity_key(p_stud text, p_year text, p_number text)
returns text
language sql
immutable
as $$
  select case
    when nullif(btrim(p_stud), '') is null
      or nullif(btrim(p_year), '') is null
      or nullif(btrim(p_number), '') is null
    then null
    else upper(btrim(p_stud) || '-' || btrim(p_year) || '-' || btrim(p_number))
  end
$$;

create or replace function public.identity_text_matches(p_text text, p_key text)
returns boolean
language sql
immutable
as $$
  select p_text is not null
    and p_key is not null
    and (
      upper(btrim(p_text)) = p_key
      or (
        position('-' in btrim(p_text)) > 0
        and p_key like '%-' || upper(btrim(p_text))
      )
    )
$$;

create or replace function public.family_tree_other_farm(p_animal_id uuid)
returns table (
  relation text,
  animal_key text,
  sex text,
  birth_date date,
  breed text,
  name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_key text;
  v_dam_id uuid;
  v_sire_id uuid;
  v_dam_tag text;
  v_sire_name text;
begin
  if p_animal_id is null then
    return;
  end if;

  select
    a.company_id,
    public.animal_identity_key(a.stud_number, a.id_year, a.id_number),
    a.dam_id,
    a.sire_id,
    a.dam_tag_number,
    a.sire_name
  into v_company, v_key, v_dam_id, v_sire_id, v_dam_tag, v_sire_name
  from public.animals a
  where a.id = p_animal_id;

  if v_company is null or v_key is null then
    return;
  end if;

  if public.current_user_role() is distinct from 'superadmin'
     and v_company is distinct from public.current_user_company_id() then
    raise exception 'You can only open a family tree for your own farm';
  end if;

  return query
  select distinct on (public.animal_identity_key(child.stud_number, child.id_year, child.id_number))
    case
      when public.animal_identity_key(dam.stud_number, dam.id_year, dam.id_number) = v_key
        or public.identity_text_matches(child.dam_tag_number, v_key)
      then 'offspring_dam'
      else 'offspring_sire'
    end,
    public.animal_identity_key(child.stud_number, child.id_year, child.id_number),
    child.sex,
    child.birth_date,
    child.breed,
    child.name
  from public.animals child
  left join public.animals dam on dam.id = child.dam_id
  left join public.animals sire on sire.id = child.sire_id
  where child.company_id <> v_company
    and public.animal_identity_key(child.stud_number, child.id_year, child.id_number) is not null
    and public.animal_identity_key(child.stud_number, child.id_year, child.id_number) <> v_key
    and (
      public.animal_identity_key(dam.stud_number, dam.id_year, dam.id_number) = v_key
      or public.animal_identity_key(sire.stud_number, sire.id_year, sire.id_number) = v_key
      or public.identity_text_matches(child.dam_tag_number, v_key)
      or public.identity_text_matches(child.sire_name, v_key)
    )
    and not exists (
      select 1
      from public.animals local_animal
      where local_animal.company_id = v_company
        and public.animal_identity_key(local_animal.stud_number, local_animal.id_year, local_animal.id_number)
          = public.animal_identity_key(child.stud_number, child.id_year, child.id_number)
    )
  order by
    public.animal_identity_key(child.stud_number, child.id_year, child.id_number),
    (child.birth_date is not null) desc,
    child.created_at asc;

  if v_dam_id is null then
    return query
    with candidates as (
      select dam.*
      from public.animals dam
      where dam.company_id <> v_company
        and public.animal_identity_key(dam.stud_number, dam.id_year, dam.id_number) is not null
        and (
          public.identity_text_matches(v_dam_tag, public.animal_identity_key(dam.stud_number, dam.id_year, dam.id_number))
          or exists (
            select 1
            from public.animals copy
            where copy.company_id <> v_company
              and copy.dam_id = dam.id
              and public.animal_identity_key(copy.stud_number, copy.id_year, copy.id_number) = v_key
          )
        )
        and not exists (
          select 1
          from public.animals local_animal
          where local_animal.company_id = v_company
            and public.animal_identity_key(local_animal.stud_number, local_animal.id_year, local_animal.id_number)
              = public.animal_identity_key(dam.stud_number, dam.id_year, dam.id_number)
        )
      order by (dam.birth_date is not null) desc, dam.created_at asc
      limit 1
    )
    select 'dam', public.animal_identity_key(dam.stud_number, dam.id_year, dam.id_number), dam.sex, dam.birth_date, dam.breed, dam.name
    from candidates dam
    union all
    select 'maternal_granddam', public.animal_identity_key(granddam.stud_number, granddam.id_year, granddam.id_number), granddam.sex, granddam.birth_date, granddam.breed, granddam.name
    from candidates dam
    join public.animals granddam on granddam.id = dam.dam_id
    where public.animal_identity_key(granddam.stud_number, granddam.id_year, granddam.id_number) is not null
    union all
    select 'maternal_grandsire', public.animal_identity_key(grandsire.stud_number, grandsire.id_year, grandsire.id_number), grandsire.sex, grandsire.birth_date, grandsire.breed, grandsire.name
    from candidates dam
    join public.animals grandsire on grandsire.id = dam.sire_id
    where public.animal_identity_key(grandsire.stud_number, grandsire.id_year, grandsire.id_number) is not null;
  end if;

  if v_sire_id is null then
    return query
    with candidates as (
      select sire.*
      from public.animals sire
      where sire.company_id <> v_company
        and public.animal_identity_key(sire.stud_number, sire.id_year, sire.id_number) is not null
        and (
          public.identity_text_matches(v_sire_name, public.animal_identity_key(sire.stud_number, sire.id_year, sire.id_number))
          or exists (
            select 1
            from public.animals copy
            where copy.company_id <> v_company
              and copy.sire_id = sire.id
              and public.animal_identity_key(copy.stud_number, copy.id_year, copy.id_number) = v_key
          )
        )
        and not exists (
          select 1
          from public.animals local_animal
          where local_animal.company_id = v_company
            and public.animal_identity_key(local_animal.stud_number, local_animal.id_year, local_animal.id_number)
              = public.animal_identity_key(sire.stud_number, sire.id_year, sire.id_number)
        )
      order by (sire.birth_date is not null) desc, sire.created_at asc
      limit 1
    )
    select 'sire', public.animal_identity_key(sire.stud_number, sire.id_year, sire.id_number), sire.sex, sire.birth_date, sire.breed, sire.name
    from candidates sire
    union all
    select 'paternal_granddam', public.animal_identity_key(granddam.stud_number, granddam.id_year, granddam.id_number), granddam.sex, granddam.birth_date, granddam.breed, granddam.name
    from candidates sire
    join public.animals granddam on granddam.id = sire.dam_id
    where public.animal_identity_key(granddam.stud_number, granddam.id_year, granddam.id_number) is not null
    union all
    select 'paternal_grandsire', public.animal_identity_key(grandsire.stud_number, grandsire.id_year, grandsire.id_number), grandsire.sex, grandsire.birth_date, grandsire.breed, grandsire.name
    from candidates sire
    join public.animals grandsire on grandsire.id = sire.sire_id
    where public.animal_identity_key(grandsire.stud_number, grandsire.id_year, grandsire.id_number) is not null;
  end if;
end;
$$;

revoke all on function public.animal_identity_key(text, text, text) from public;
revoke all on function public.identity_text_matches(text, text) from public;
revoke all on function public.family_tree_other_farm(uuid) from public;
grant execute on function public.family_tree_other_farm(uuid) to authenticated;
