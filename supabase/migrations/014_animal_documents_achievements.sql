-- Supporting documents (files) and show-result achievements per animal.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'animal-documents',
  'animal-documents',
  false,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.animal_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  title text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  document_date date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index animal_documents_animal_id_idx on public.animal_documents (animal_id);
create index animal_documents_company_id_idx on public.animal_documents (company_id);

create trigger animal_documents_updated_at
  before update on public.animal_documents
  for each row execute function public.update_updated_at();

create or replace function public.animal_documents_validate_company()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.animals a
    where a.id = new.animal_id and a.company_id = new.company_id
  ) then
    raise exception 'Document animal must belong to the same farm';
  end if;
  return new;
end;
$$;

create trigger animal_documents_validate_company
  before insert or update of animal_id, company_id
  on public.animal_documents
  for each row execute function public.animal_documents_validate_company();

alter table public.animal_documents enable row level security;

create policy "Superadmins manage all animal documents"
  on public.animal_documents for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company animal documents"
  on public.animal_documents for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company animal documents"
  on public.animal_documents for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company animal documents"
  on public.animal_documents for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company animal documents"
  on public.animal_documents for delete
  using (company_id = public.current_user_company_id());

-- Storage path: {company_id}/{animal_id}/{document_id}.ext
create policy "Farm users read company document files"
  on storage.objects for select
  using (
    bucket_id = 'animal-documents'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create policy "Farm users upload company document files"
  on storage.objects for insert
  with check (
    bucket_id = 'animal-documents'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create policy "Farm users update company document files"
  on storage.objects for update
  using (
    bucket_id = 'animal-documents'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create policy "Farm users delete company document files"
  on storage.objects for delete
  using (
    bucket_id = 'animal-documents'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create table public.animal_achievements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  show_name text not null,
  shown_at date not null default (timezone('utc', now()))::date,
  class_name text,
  result text not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index animal_achievements_animal_id_idx on public.animal_achievements (animal_id);
create index animal_achievements_company_id_idx on public.animal_achievements (company_id);
create index animal_achievements_shown_at_idx on public.animal_achievements (shown_at desc);

create trigger animal_achievements_updated_at
  before update on public.animal_achievements
  for each row execute function public.update_updated_at();

create or replace function public.animal_achievements_validate_company()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.animals a
    where a.id = new.animal_id and a.company_id = new.company_id
  ) then
    raise exception 'Achievement animal must belong to the same farm';
  end if;
  return new;
end;
$$;

create trigger animal_achievements_validate_company
  before insert or update of animal_id, company_id
  on public.animal_achievements
  for each row execute function public.animal_achievements_validate_company();

alter table public.animal_achievements enable row level security;

create policy "Superadmins manage all animal achievements"
  on public.animal_achievements for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company animal achievements"
  on public.animal_achievements for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company animal achievements"
  on public.animal_achievements for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company animal achievements"
  on public.animal_achievements for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company animal achievements"
  on public.animal_achievements for delete
  using (company_id = public.current_user_company_id());

create or replace function public.reset_farm_data(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animals int;
  v_inoculations int;
  v_weights int;
  v_photos int;
  v_documents int;
  v_achievements int;
  v_camps int;
  v_locations int;
begin
  perform public.require_superadmin();

  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Farm not found';
  end if;

  delete from public.animal_photos where company_id = p_company_id;
  get diagnostics v_photos = row_count;

  delete from public.animal_documents where company_id = p_company_id;
  get diagnostics v_documents = row_count;

  delete from public.animal_achievements where company_id = p_company_id;
  get diagnostics v_achievements = row_count;

  delete from public.animal_inoculations where company_id = p_company_id;
  get diagnostics v_inoculations = row_count;

  delete from public.animal_weights where company_id = p_company_id;
  get diagnostics v_weights = row_count;

  delete from public.breeding_events where company_id = p_company_id;

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
    'deleted_weights', v_weights,
    'deleted_photos', v_photos,
    'deleted_documents', v_documents,
    'deleted_achievements', v_achievements,
    'deleted_encampments', v_camps,
    'deleted_locations', v_locations
  );
end;
$$;
