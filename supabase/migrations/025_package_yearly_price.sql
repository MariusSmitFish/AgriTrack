-- Package prices are yearly. Safe if 024 already created monthly_price, and a no-op rename if 024 already uses yearly_price.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'packages'
      and column_name = 'monthly_price'
  ) then
    alter table public.packages rename column monthly_price to yearly_price;
  end if;
end $$;

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
