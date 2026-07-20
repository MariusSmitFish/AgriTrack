-- AgriTrack: initial schema for multi-tenant company & user management

create type public.user_role as enum ('superadmin', 'company_admin', 'company_user');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'company_user',
  company_id uuid references public.companies (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_company_id_idx on public.profiles (company_id);
create index profiles_role_idx on public.profiles (role);

-- Auto-create profile on signup (defaults to company_user; superadmin must be set manually)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role;
  assigned_company_id uuid;
begin
  assigned_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'company_user'
  );

  assigned_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;

  if assigned_role = 'superadmin' then
    assigned_company_id := null;
  end if;

  insert into public.profiles (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    assigned_role,
    assigned_company_id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- Helper: current user's role
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;

-- Companies policies
create policy "Superadmins manage all companies"
  on public.companies for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Company admins read own company"
  on public.companies for select
  using (
    public.current_user_role() = 'company_admin'
    and id = public.current_user_company_id()
  );

-- Profiles policies
create policy "Users read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Superadmins manage all profiles"
  on public.profiles for all
  using (public.current_user_role() = 'superadmin')
  with check (public.current_user_role() = 'superadmin');

create policy "Company admins read company profiles"
  on public.profiles for select
  using (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
  );

create policy "Company admins update company profiles"
  on public.profiles for update
  using (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
    and role != 'superadmin'
  )
  with check (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
    and role in ('company_admin', 'company_user')
  );

create policy "Company admins insert company profiles"
  on public.profiles for insert
  with check (
    public.current_user_role() = 'company_admin'
    and company_id = public.current_user_company_id()
    and role in ('company_admin', 'company_user')
  );
