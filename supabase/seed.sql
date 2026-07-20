-- ============================================================
-- RESET & CREATE SUPERADMIN (Supabase SQL Editor)
-- 1) Run 002_fix_profile_trigger.sql first
-- 2) Replace email + password below
-- ============================================================

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'you@example.com';
  v_password text := 'YourSecurePassword123';
begin
  -- Remove broken user (cascades to identities + profiles)
  delete from auth.users where email = v_email;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Super Admin","role":"superadmin"}',
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  );

  -- REQUIRED: without this row, login returns 500
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );
end $$;

-- Verify user + identity + profile all exist
select
  u.id,
  u.email,
  i.provider as identity_provider,
  p.role,
  p.company_id
from auth.users u
left join auth.identities i on i.user_id = u.id
left join public.profiles p on p.id = u.id
where u.email = 'you@example.com';
