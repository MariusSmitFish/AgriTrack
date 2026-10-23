-- Treatments capture a condition/symptom and a medication.
-- Both lists are managed in Configurations.
-- Existing treatment option names (Dewormer, Antibiotic, ...) become medications.

alter table public.animal_inoculations
  add column condition text,
  add column medication text;

update public.animal_inoculations
set medication = name
where kind = 'treatment'
  and medication is null;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'health_options'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%kind%';

  if constraint_name is not null then
    execute format('alter table public.health_options drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.health_options
  add constraint health_options_kind_check
  check (kind in ('vaccination', 'treatment', 'condition', 'medication'));

update public.health_options
set kind = 'medication'
where kind = 'treatment';

alter table public.health_options drop constraint health_options_kind_check;

alter table public.health_options
  add constraint health_options_kind_check
  check (kind in ('vaccination', 'condition', 'medication'));

create or replace function public.seed_company_health_options(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.health_options (company_id, kind, name)
  select p_company_id, defaults.kind, defaults.name
  from (
    values
      ('vaccination', 'Pulpy kidney'),
      ('vaccination', 'Clostridial'),
      ('vaccination', 'Pasteurella'),
      ('vaccination', 'Enzootic abortion'),
      ('vaccination', 'Tetanus'),
      ('vaccination', 'Orf'),
      ('vaccination', 'Bluetongue'),
      ('condition', 'Diarrhea'),
      ('condition', 'Cough'),
      ('condition', 'Lameness'),
      ('condition', 'Mastitis'),
      ('condition', 'Worms'),
      ('condition', 'Wound'),
      ('condition', 'Fever'),
      ('condition', 'Bloat'),
      ('condition', 'Eye infection'),
      ('condition', 'Abscess'),
      ('medication', 'Dewormer'),
      ('medication', 'Antibiotic'),
      ('medication', 'Pain relief'),
      ('medication', 'Wound care'),
      ('medication', 'Vitamin / mineral')
  ) as defaults(kind, name)
  where not exists (
    select 1
    from public.health_options existing
    where existing.company_id = p_company_id
      and existing.kind = defaults.kind
      and lower(btrim(existing.name)) = lower(btrim(defaults.name))
  );
end;
$$;

do $$
declare
  company_row record;
begin
  for company_row in select id from public.companies loop
    perform public.seed_company_health_options(company_row.id);
  end loop;
end;
$$;
