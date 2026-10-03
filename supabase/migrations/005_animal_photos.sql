-- Animal photos stored in Supabase Storage, with editable capture dates.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'animal-photos',
  'animal-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.animal_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  storage_path text not null,
  captured_at timestamptz not null default now(),
  caption text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index animal_photos_animal_id_idx on public.animal_photos (animal_id);
create index animal_photos_company_id_idx on public.animal_photos (company_id);
create index animal_photos_captured_at_idx on public.animal_photos (captured_at desc);

create trigger animal_photos_updated_at
  before update on public.animal_photos
  for each row execute function public.update_updated_at();

create or replace function public.animal_photos_validate_company()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.animals a
    where a.id = new.animal_id and a.company_id = new.company_id
  ) then
    raise exception 'Photo animal must belong to the same farm';
  end if;
  return new;
end;
$$;

create trigger animal_photos_validate_company
  before insert or update of animal_id, company_id
  on public.animal_photos
  for each row execute function public.animal_photos_validate_company();

alter table public.animal_photos enable row level security;

create policy "Superadmins manage all animal photos"
  on public.animal_photos for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company animal photos"
  on public.animal_photos for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company animal photos"
  on public.animal_photos for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users update company animal photos"
  on public.animal_photos for update
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company animal photos"
  on public.animal_photos for delete
  using (company_id = public.current_user_company_id());

-- Storage path: {company_id}/{animal_id}/{photo_id}.ext
create policy "Farm users read company photo files"
  on storage.objects for select
  using (
    bucket_id = 'animal-photos'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create policy "Farm users upload company photo files"
  on storage.objects for insert
  with check (
    bucket_id = 'animal-photos'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create policy "Farm users update company photo files"
  on storage.objects for update
  using (
    bucket_id = 'animal-photos'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create policy "Farm users delete company photo files"
  on storage.objects for delete
  using (
    bucket_id = 'animal-photos'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );
