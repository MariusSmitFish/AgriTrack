-- Saved CSV backups of a farm's animals.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'farm-backups',
  'farm-backups',
  false,
  10485760,
  array['text/csv']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.farm_backups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  animal_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index farm_backups_company_id_idx on public.farm_backups (company_id, created_at desc);

alter table public.farm_backups enable row level security;

create policy "Superadmins manage all farm backups"
  on public.farm_backups for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Farm users read company farm backups"
  on public.farm_backups for select
  using (company_id = public.current_user_company_id());

create policy "Farm users insert company farm backups"
  on public.farm_backups for insert
  with check (company_id = public.current_user_company_id());

create policy "Farm users delete company farm backups"
  on public.farm_backups for delete
  using (company_id = public.current_user_company_id());

-- Storage path: {company_id}/{backup_id}.csv
create policy "Farm users read company backup files"
  on storage.objects for select
  using (
    bucket_id = 'farm-backups'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create policy "Farm users upload company backup files"
  on storage.objects for insert
  with check (
    bucket_id = 'farm-backups'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );

create policy "Farm users delete company backup files"
  on storage.objects for delete
  using (
    bucket_id = 'farm-backups'
    and (
      public.current_user_role() = 'superadmin'
      or (storage.foldername(name))[1] = public.current_user_company_id()::text
    )
  );
