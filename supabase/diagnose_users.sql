-- Run in Supabase SQL Editor to diagnose login 500 errors.
-- Every user MUST have an auth.identities row with provider = 'email'.

select
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  u.encrypted_password is not null as has_password,
  i.provider as identity_provider,
  i.provider_id as identity_provider_id,
  p.role as profile_role,
  p.company_id as profile_company_id,
  case
    when i.id is null then 'MISSING identity row — login will 500'
    when p.id is null then 'MISSING profile row — login works but app breaks'
    when u.email_confirmed_at is null then 'Email not confirmed'
    else 'OK'
  end as status
from auth.users u
left join auth.identities i on i.user_id = u.id
left join public.profiles p on p.id = u.id
order by u.created_at desc;
