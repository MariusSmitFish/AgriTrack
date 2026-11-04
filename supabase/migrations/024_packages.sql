-- Farm packages: Entry, Intermediate, and Unlimited.
-- Blank limits mean unlimited. Existing farms stay on Unlimited so current herds are not locked.
-- New farms default to Entry. Super admin inserts (including demo seed) are not capped.

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  yearly_price numeric(12, 2) not null default 0,
  currency text not null default 'ZAR',
  max_users integer,
  max_animals integer,
  max_locations integer,
  max_encampments integer,
  max_photos integer,
  max_documents integer,
  max_backups integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packages_limits_nonnegative check (
    (max_users is null or max_users >= 0)
    and (max_animals is null or max_animals >= 0)
    and (max_locations is null or max_locations >= 0)
    and (max_encampments is null or max_encampments >= 0)
    and (max_photos is null or max_photos >= 0)
    and (max_documents is null or max_documents >= 0)
    and (max_backups is null or max_backups >= 0)
  ),
  constraint packages_price_nonnegative check (yearly_price >= 0),
  constraint packages_currency_len check (char_length(currency) between 3 and 8)
);

create trigger packages_updated_at
  before update on public.packages
  for each row execute function public.update_updated_at();

insert into public.packages (
  slug,
  name,
  description,
  sort_order,
  yearly_price,
  currency,
  max_users,
  max_animals,
  max_locations,
  max_encampments,
  max_photos,
  max_documents,
  max_backups
) values
  (
    'entry',
    'Entry',
    'A small herd and a small team. Enough to record animals, camps, photos, and backups while you get started.',
    1,
    0,
    'ZAR',
    3,
    100,
    5,
    15,
    200,
    50,
    3
  ),
  (
    'intermediate',
    'Intermediate',
    'A growing stud, with higher caps for the herd, team, camps, photos, documents, and backups.',
    2,
    0,
    'ZAR',
    10,
    500,
    20,
    80,
    2000,
    500,
    24
  ),
  (
    'unlimited',
    'Unlimited',
    'No caps on team size, animals, locations, camps, photos, documents, or backups.',
    3,
    0,
    'ZAR',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  );

create or replace function public.default_entry_package_id()
returns uuid
language sql
stable
as $$
  select id from public.packages where slug = 'entry'
$$;

alter table public.companies
  add column package_id uuid references public.packages (id) on delete restrict;

update public.companies
set package_id = (select id from public.packages where slug = 'unlimited');

alter table public.companies
  alter column package_id set default public.default_entry_package_id(),
  alter column package_id set not null;

create index companies_package_id_idx on public.companies (package_id);

alter table public.packages enable row level security;

create policy "Authenticated users read packages"
  on public.packages for select
  to authenticated
  using (true);

create policy "Superadmins manage packages"
  on public.packages for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Company members read own company"
  on public.companies for select
  using (
    id = public.current_user_company_id()
    and public.current_user_role() in ('company_admin', 'company_user')
  );

-- Rows inserted earlier in the same statement are not visible yet, so pending rows
-- are counted in a transaction-local temp table. The advisory lock stops two
-- sessions from slipping past the same cap.
create or replace function public.enforce_package_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resource text := tg_argv[0];
  label text := tg_argv[1];
  lim integer;
  pkg_name text;
  existing_count bigint;
  pending_count bigint;
begin
  if new.company_id is null or public.current_user_role() = 'superadmin' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.company_id::text || ':' || resource));

  select
    case resource
      when 'users' then p.max_users
      when 'animals' then p.max_animals
      when 'locations' then p.max_locations
      when 'encampments' then p.max_encampments
      when 'photos' then p.max_photos
      when 'documents' then p.max_documents
      when 'backups' then p.max_backups
      else null
    end,
    p.name
  into lim, pkg_name
  from public.companies c
  join public.packages p on p.id = c.package_id
  where c.id = new.company_id;

  if lim is null then
    return new;
  end if;

  if resource = 'users' then
    select count(*) into existing_count from public.profiles where company_id = new.company_id;
  elsif resource = 'animals' then
    select count(*) into existing_count from public.animals where company_id = new.company_id;
  elsif resource = 'locations' then
    select count(*) into existing_count from public.locations where company_id = new.company_id;
  elsif resource = 'encampments' then
    select count(*) into existing_count from public.encampments where company_id = new.company_id;
  elsif resource = 'photos' then
    select count(*) into existing_count from public.animal_photos where company_id = new.company_id;
  elsif resource = 'documents' then
    select count(*) into existing_count from public.animal_documents where company_id = new.company_id;
  elsif resource = 'backups' then
    select count(*) into existing_count from public.farm_backups where company_id = new.company_id;
  else
    existing_count := 0;
  end if;

  execute
    'create temp table if not exists package_quota_pending (
      company_id uuid not null,
      resource text not null
    ) on commit delete rows';

  execute
    'select count(*) from pg_temp.package_quota_pending where company_id = $1 and resource = $2'
    into pending_count
    using new.company_id, resource;

  if existing_count + pending_count >= lim then
    raise exception using
      message = format(
        'Your %s package limit for %s is %s. Ask a super admin to change the package if you need a higher limit.',
        coalesce(pkg_name, 'current'),
        label,
        lim
      ),
      errcode = 'P0001';
  end if;

  execute
    'insert into pg_temp.package_quota_pending (company_id, resource) values ($1, $2)'
    using new.company_id, resource;

  return new;
end;
$$;

create trigger profiles_package_quota
  before insert on public.profiles
  for each row execute function public.enforce_package_quota('users', 'team members');

create trigger animals_package_quota
  before insert on public.animals
  for each row execute function public.enforce_package_quota('animals', 'animals');

create trigger locations_package_quota
  before insert on public.locations
  for each row execute function public.enforce_package_quota('locations', 'locations');

create trigger encampments_package_quota
  before insert on public.encampments
  for each row execute function public.enforce_package_quota('encampments', 'camps');

create trigger animal_photos_package_quota
  before insert on public.animal_photos
  for each row execute function public.enforce_package_quota('photos', 'photos');

create trigger animal_documents_package_quota
  before insert on public.animal_documents
  for each row execute function public.enforce_package_quota('documents', 'documents');

create trigger farm_backups_package_quota
  before insert on public.farm_backups
  for each row execute function public.enforce_package_quota('backups', 'backups');

create or replace function public.company_plan_usage(target_company_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
  result jsonb;
begin
  if public.current_user_role() = 'superadmin' then
    cid := coalesce(target_company_id, public.current_user_company_id());
  else
    cid := public.current_user_company_id();
  end if;

  if cid is null then
    return null;
  end if;

  select jsonb_build_object(
    'company_id', c.id,
    'package', case
      when p.id is null then null
      else jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'name', p.name,
        'description', p.description,
        'yearly_price', p.yearly_price,
        'currency', p.currency,
        'max_users', p.max_users,
        'max_animals', p.max_animals,
        'max_locations', p.max_locations,
        'max_encampments', p.max_encampments,
        'max_photos', p.max_photos,
        'max_documents', p.max_documents,
        'max_backups', p.max_backups
      )
    end,
    'usage', jsonb_build_object(
      'users', (select count(*) from public.profiles where company_id = c.id),
      'animals', (select count(*) from public.animals where company_id = c.id),
      'locations', (select count(*) from public.locations where company_id = c.id),
      'encampments', (select count(*) from public.encampments where company_id = c.id),
      'photos', (select count(*) from public.animal_photos where company_id = c.id),
      'documents', (select count(*) from public.animal_documents where company_id = c.id),
      'backups', (select count(*) from public.farm_backups where company_id = c.id)
    )
  )
  into result
  from public.companies c
  left join public.packages p on p.id = c.package_id
  where c.id = cid;

  return result;
end;
$$;

revoke all on function public.company_plan_usage(uuid) from public, anon;
grant execute on function public.company_plan_usage(uuid) to authenticated, service_role;
