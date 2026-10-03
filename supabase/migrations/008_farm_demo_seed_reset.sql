-- Superadmin RPCs to seed / clear demo livestock data for a farm.
-- Does NOT create farms or users.

alter table public.locations
  add column if not exists is_demo boolean not null default false;

alter table public.encampments
  add column if not exists is_demo boolean not null default false;

alter table public.animals
  add column if not exists is_demo boolean not null default false;

alter table public.animal_inoculations
  add column if not exists is_demo boolean not null default false;

create index if not exists locations_is_demo_idx on public.locations (company_id, is_demo);
create index if not exists animals_is_demo_idx on public.animals (company_id, is_demo);

create or replace function public.require_superadmin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_user_role() is distinct from 'superadmin' then
    raise exception 'Only superadmin can perform this action';
  end if;
end;
$$;

-- Remove only demo-tagged operational data for a farm
create or replace function public.clear_farm_demo_data(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animals int;
  v_inoculations int;
  v_camps int;
  v_locations int;
begin
  perform public.require_superadmin();

  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Farm not found';
  end if;

  delete from public.animal_inoculations
  where company_id = p_company_id and is_demo = true;
  get diagnostics v_inoculations = row_count;

  delete from public.animals
  where company_id = p_company_id and is_demo = true;
  get diagnostics v_animals = row_count;

  delete from public.encampments
  where company_id = p_company_id and is_demo = true;
  get diagnostics v_camps = row_count;

  delete from public.locations
  where company_id = p_company_id and is_demo = true;
  get diagnostics v_locations = row_count;

  return jsonb_build_object(
    'company_id', p_company_id,
    'deleted_animals', v_animals,
    'deleted_inoculations', v_inoculations,
    'deleted_encampments', v_camps,
    'deleted_locations', v_locations
  );
end;
$$;

-- Wipe ALL locations / encampments / animals / inoculations / photo rows for a farm
create or replace function public.reset_farm_data(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animals int;
  v_inoculations int;
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
    'deleted_photos', v_photos,
    'deleted_encampments', v_camps,
    'deleted_locations', v_locations
  );
end;
$$;

-- Seed demo locations, encampments, animals (with pedigree), inoculations
create or replace function public.seed_farm_demo_data(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loc_ids uuid[] := array[]::uuid[];
  v_camp_ids uuid[] := array[]::uuid[];
  v_animal_ids uuid[] := array[]::uuid[];
  v_founder_female uuid[] := array[]::uuid[];
  v_founder_male uuid[] := array[]::uuid[];
  v_gen1 uuid[] := array[]::uuid[];

  v_i int;
  v_j int;
  v_sex text;
  v_tag text;
  v_name text;
  v_breed text;
  v_status text;
  v_animal_id uuid;
  v_dam uuid;
  v_sire uuid;
  v_camp uuid;
  v_loc_name text;
  v_camp_name text;
  v_species text;
  v_birth date;
  v_vaccine text;
  v_tmp uuid;
  v_clear jsonb;
begin
  perform public.require_superadmin();

  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Farm not found';
  end if;

  -- Replace previous demo data for this farm
  v_clear := public.clear_farm_demo_data(p_company_id);

  -- Locations
  for v_i in 1..4 loop
    insert into public.locations (company_id, name, description, is_demo)
    values (
      p_company_id,
      format('Block %s', chr(64 + v_i)),
      format('Demo grazing block %s', v_i),
      true
    )
    returning id into v_tmp;
    v_loc_ids := v_loc_ids || v_tmp;
  end loop;

  -- Encampments
  for v_i in 1..array_length(v_loc_ids, 1) loop
    for v_j in 1..3 loop
      insert into public.encampments (company_id, location_id, name, description, is_demo)
      values (
        p_company_id,
        v_loc_ids[v_i],
        format('Camp %s-%s', chr(64 + v_i), v_j),
        format('Water point %s, capacity demo', v_j),
        true
      )
      returning id into v_tmp;
      v_camp_ids := v_camp_ids || v_tmp;
    end loop;
  end loop;

  -- Founders: 20 males + 60 females
  for v_i in 1..80 loop
    v_sex := case when v_i <= 20 then 'male' else 'female' end;
    v_tag := format('F%s', lpad(v_i::text, 4, '0'));
    v_name := case
      when v_sex = 'male' then format('Bull %s', v_i)
      else format('Cow %s', v_i - 20)
    end;
    v_breed := (array['Bonsmara', 'Nguni', 'Brahman', 'Angus', 'Hereford'])[1 + ((v_i - 1) % 5)];
    v_status := (array['active', 'active', 'active', 'sold', 'deceased'])[1 + ((v_i - 1) % 5)];
    v_birth := (current_date - ((1200 + v_i * 17) || ' days')::interval)::date;
    v_camp := v_camp_ids[1 + ((v_i - 1) % array_length(v_camp_ids, 1))];

    select l.name, e.name into v_loc_name, v_camp_name
    from public.encampments e
    join public.locations l on l.id = e.location_id
    where e.id = v_camp;

    insert into public.animals (
      company_id, tag_number, stud_tag_number, name, species, breed, sex,
      birth_date, color_markings, status, encampment_id, location, notes, is_demo
    ) values (
      p_company_id, v_tag, format('S%s', v_tag), v_name, 'cattle', v_breed, v_sex,
      v_birth,
      (array['Red', 'Black', 'Speckled', 'White face', 'Brown'])[1 + ((v_i - 1) % 5)],
      v_status, v_camp, v_loc_name || ' · ' || v_camp_name,
      'Demo founder animal', true
    )
    returning id into v_animal_id;

    v_animal_ids := v_animal_ids || v_animal_id;
    if v_sex = 'female' then
      v_founder_female := v_founder_female || v_animal_id;
    else
      v_founder_male := v_founder_male || v_animal_id;
    end if;
  end loop;

  -- Generation 1: 100 calves
  for v_i in 1..100 loop
    v_sex := case when v_i % 2 = 0 then 'female' else 'male' end;
    v_tag := format('G1%s', lpad(v_i::text, 4, '0'));
    v_name := format('Calf G1-%s', v_i);
    v_breed := (array['Bonsmara', 'Nguni', 'Brahman', 'Angus', 'Hereford'])[1 + ((v_i - 1) % 5)];
    v_birth := (current_date - ((180 + v_i * 3) || ' days')::interval)::date;
    v_dam := v_founder_female[1 + ((v_i - 1) % array_length(v_founder_female, 1))];
    v_sire := v_founder_male[1 + ((v_i - 1) % array_length(v_founder_male, 1))];
    v_camp := v_camp_ids[1 + ((v_i - 1) % array_length(v_camp_ids, 1))];

    select l.name, e.name into v_loc_name, v_camp_name
    from public.encampments e
    join public.locations l on l.id = e.location_id
    where e.id = v_camp;

    insert into public.animals (
      company_id, tag_number, stud_tag_number, name, species, breed, sex,
      birth_date, status, encampment_id, location, dam_id, sire_id,
      dam_tag_number, sire_name, notes, is_demo
    ) values (
      p_company_id, v_tag, format('S%s', v_tag), v_name, 'cattle', v_breed, v_sex,
      v_birth, 'active', v_camp, v_loc_name || ' · ' || v_camp_name,
      v_dam, v_sire,
      (select tag_number from public.animals where id = v_dam),
      (select coalesce(name, tag_number) from public.animals where id = v_sire),
      'Demo generation 1', true
    )
    returning id into v_animal_id;

    v_animal_ids := v_animal_ids || v_animal_id;
    v_gen1 := v_gen1 || v_animal_id;
  end loop;

  -- Generation 2: 70 calves
  for v_i in 1..70 loop
    v_sex := case when v_i % 3 = 0 then 'male' else 'female' end;
    v_tag := format('G2%s', lpad(v_i::text, 4, '0'));
    v_name := format('Calf G2-%s', v_i);
    v_breed := (array['Bonsmara', 'Nguni', 'Brahman', 'Angus', 'Hereford'])[1 + ((v_i - 1) % 5)];
    v_status := case when v_i % 11 = 0 then 'transferred' else 'active' end;
    v_birth := (current_date - ((40 + v_i * 2) || ' days')::interval)::date;

    select id into v_dam
    from public.animals
    where company_id = p_company_id and id = any(v_gen1) and sex = 'female'
    order by tag_number
    offset ((v_i - 1) % 40) limit 1;

    if v_i % 2 = 0 then
      v_sire := v_founder_male[1 + ((v_i - 1) % array_length(v_founder_male, 1))];
    else
      select id into v_sire
      from public.animals
      where company_id = p_company_id and id = any(v_gen1) and sex = 'male'
      order by tag_number
      offset ((v_i - 1) % 30) limit 1;
    end if;

    v_camp := v_camp_ids[1 + ((v_i - 1) % array_length(v_camp_ids, 1))];

    select l.name, e.name into v_loc_name, v_camp_name
    from public.encampments e
    join public.locations l on l.id = e.location_id
    where e.id = v_camp;

    insert into public.animals (
      company_id, tag_number, name, species, breed, sex,
      birth_date, status, encampment_id, location, dam_id, sire_id,
      dam_tag_number, sire_name, notes, is_demo
    ) values (
      p_company_id, v_tag, v_name, 'cattle', v_breed, v_sex,
      v_birth, v_status, v_camp, v_loc_name || ' · ' || v_camp_name,
      v_dam, v_sire,
      (select tag_number from public.animals where id = v_dam),
      (select coalesce(name, tag_number) from public.animals where id = v_sire),
      'Demo generation 2', true
    )
    returning id into v_animal_id;

    v_animal_ids := v_animal_ids || v_animal_id;
  end loop;

  -- Sheep / goats
  for v_i in 1..15 loop
    v_species := case when v_i <= 8 then 'sheep' else 'goat' end;
    v_sex := case when v_i % 2 = 0 then 'female' else 'male' end;
    v_tag := format('%s%s', upper(left(v_species, 1)), lpad(v_i::text, 3, '0'));
    v_camp := v_camp_ids[1 + ((v_i - 1) % array_length(v_camp_ids, 1))];

    select l.name, e.name into v_loc_name, v_camp_name
    from public.encampments e
    join public.locations l on l.id = e.location_id
    where e.id = v_camp;

    insert into public.animals (
      company_id, tag_number, name, species, breed, sex,
      birth_date, status, encampment_id, location, notes, is_demo
    ) values (
      p_company_id, v_tag, format('%s %s', initcap(v_species), v_i),
      v_species,
      case when v_species = 'sheep' then 'Dorper' else 'Boer' end,
      v_sex,
      (current_date - ((200 + v_i * 11) || ' days')::interval)::date,
      'active', v_camp, v_loc_name || ' · ' || v_camp_name,
      'Demo non-cattle stock', true
    );
  end loop;

  -- Refresh animal id list for inoculations
  select coalesce(array_agg(id order by created_at), array[]::uuid[])
  into v_animal_ids
  from public.animals
  where company_id = p_company_id and is_demo = true;

  for v_i in 1..least(array_length(v_animal_ids, 1), 200) loop
    v_animal_id := v_animal_ids[v_i];
    v_vaccine := (array[
      'Anthrax', 'Blackleg / Clostridial', 'Botulism',
      'Lumpy skin disease', 'Brucellosis', 'Rift Valley fever'
    ])[1 + ((v_i - 1) % 6)];

    insert into public.animal_inoculations (
      company_id, animal_id, name, administered_at, next_due_at,
      batch_number, dosage, administered_by, notes, is_demo
    ) values (
      p_company_id, v_animal_id, v_vaccine,
      (current_date - ((30 + (v_i % 400)) || ' days')::interval)::date,
      case when v_i % 4 = 0 then null
           else (current_date + (((v_i % 120) - 40) || ' days')::interval)::date
      end,
      format('LOT-%s-%s', to_char(current_date, 'YYMM'), lpad(v_i::text, 4, '0')),
      (array['2 ml', '5 ml', '1 ml', '2.5 ml'])[1 + ((v_i - 1) % 4)],
      (array['Dr. Nkosi', 'Farm Vet', 'Mobile Clinic', 'Demo Tech'])[1 + ((v_i - 1) % 4)],
      'Demo inoculation record', true
    );

    if v_i % 2 = 0 then
      insert into public.animal_inoculations (
        company_id, animal_id, name, administered_at, next_due_at,
        batch_number, dosage, administered_by, notes, is_demo
      ) values (
        p_company_id, v_animal_id,
        (array['Pasteurella', 'Tetanus', 'Rabies'])[1 + ((v_i - 1) % 3)],
        (current_date - ((400 + (v_i % 200)) || ' days')::interval)::date,
        (current_date - ((v_i % 60) || ' days')::interval)::date,
        format('OLD-%s', lpad(v_i::text, 4, '0')),
        '2 ml', 'Farm Vet', 'Prior season demo shot', true
      );
    end if;
  end loop;

  return jsonb_build_object(
    'company_id', p_company_id,
    'cleared_before_seed', v_clear,
    'locations', (select count(*) from public.locations where company_id = p_company_id and is_demo),
    'encampments', (select count(*) from public.encampments where company_id = p_company_id and is_demo),
    'animals', (select count(*) from public.animals where company_id = p_company_id and is_demo),
    'inoculations', (select count(*) from public.animal_inoculations where company_id = p_company_id and is_demo)
  );
end;
$$;

grant execute on function public.require_superadmin() to authenticated;
grant execute on function public.clear_farm_demo_data(uuid) to authenticated;
grant execute on function public.reset_farm_data(uuid) to authenticated;
grant execute on function public.seed_farm_demo_data(uuid) to authenticated;
