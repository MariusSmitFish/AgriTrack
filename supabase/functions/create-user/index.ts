import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Function misconfigured: missing Supabase env vars' }, 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401)
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return jsonResponse({ error: 'Missing authorization token' }, 401)
    }

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      return jsonResponse({
        error: authError?.message ?? 'Unauthorized — sign out and sign in again',
      }, 401)
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', caller.id)
      .single()

    if (callerProfileError || !callerProfile) {
      return jsonResponse({ error: 'Caller profile not found' }, 403)
    }

    if (!['superadmin', 'company_admin'].includes(callerProfile.role)) {
      return jsonResponse({ error: 'Forbidden: admin role required' }, 403)
    }

    const { email, password, full_name, role, company_id } = await req.json()

    if (!email || !password || !role) {
      return jsonResponse({ error: 'email, password, and role are required' }, 400)
    }

    if (callerProfile.role === 'company_admin') {
      if (role === 'superadmin' || company_id !== callerProfile.company_id) {
        return jsonResponse({ error: 'Cannot create user with these permissions' }, 403)
      }
    }

    if (role !== 'superadmin' && !company_id) {
      return jsonResponse({ error: 'company_id required for non-superadmin users' }, 400)
    }

    const resolvedCompanyId = role === 'superadmin' ? null : company_id

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        company_id: resolvedCompanyId ?? '',
      },
    })

    if (createError) {
      return jsonResponse({ error: createError.message }, 400)
    }

    if (!newUser.user) {
      return jsonResponse({ error: 'User was not created' }, 500)
    }

    // Upsert in case trigger already created a partial profile
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: newUser.user.id,
        email,
        full_name,
        role,
        company_id: resolvedCompanyId,
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      // Roll back auth user so we don't leave a broken account
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return jsonResponse({ error: `Profile error: ${profileError.message}` }, 400)
    }

    return jsonResponse({ user: newUser.user })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
