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

function roleLabel(role: string) {
  if (role === 'superadmin') return 'Super Admin'
  if (role === 'company_admin') return 'Farm Admin'
  if (role === 'company_user') return 'Farm User'
  return role
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
      .select('role, company_id, full_name, email')
      .eq('id', caller.id)
      .single()

    if (callerProfileError || !callerProfile) {
      return jsonResponse({ error: 'Caller profile not found' }, 403)
    }

    if (!['superadmin', 'company_admin'].includes(callerProfile.role)) {
      return jsonResponse({ error: 'Forbidden: admin role required' }, 403)
    }

    const { email, full_name, role, company_id, redirect_to } = await req.json()

    if (!email || !role) {
      return jsonResponse({ error: 'email and role are required' }, 400)
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
    const redirectTo =
      typeof redirect_to === 'string' && redirect_to.startsWith('http')
        ? redirect_to
        : undefined

    let farmName = ''
    if (resolvedCompanyId) {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', resolvedCompanyId)
        .maybeSingle()
      farmName = company?.name?.trim() ?? ''
    }

    const invitedBy =
      (typeof callerProfile.full_name === 'string' && callerProfile.full_name.trim()) ||
      (typeof callerProfile.email === 'string' && callerProfile.email.trim()) ||
      caller.email ||
      'An AgriTrack admin'

    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: full_name ?? '',
          role,
          role_label: roleLabel(role),
          company_id: resolvedCompanyId ?? '',
          farm_name: farmName,
          invited_by: invitedBy,
          app_name: 'AgriTrack',
        },
        redirectTo,
      },
    )

    if (inviteError) {
      return jsonResponse({ error: inviteError.message }, 400)
    }

    if (!invited.user) {
      return jsonResponse({ error: 'User was not invited' }, 500)
    }

    // Upsert in case trigger already created a partial profile
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: invited.user.id,
        email,
        full_name,
        role,
        company_id: resolvedCompanyId,
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(invited.user.id)
      return jsonResponse({ error: `Profile error: ${profileError.message}` }, 400)
    }

    return jsonResponse({ user: invited.user })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
