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

    const { user_id } = await req.json()
    if (!user_id || typeof user_id !== 'string') {
      return jsonResponse({ error: 'user_id is required' }, 400)
    }

    if (user_id === caller.id) {
      return jsonResponse({ error: 'You cannot delete your own account' }, 403)
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, company_id, email')
      .eq('id', user_id)
      .single()

    if (targetError || !targetProfile) {
      return jsonResponse({ error: 'User not found' }, 404)
    }

    if (callerProfile.role === 'company_admin') {
      if (
        targetProfile.role === 'superadmin' ||
        targetProfile.company_id !== callerProfile.company_id
      ) {
        return jsonResponse({ error: 'Cannot delete user with these permissions' }, 403)
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 400)
    }

    return jsonResponse({ ok: true, deleted_user_id: user_id })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
