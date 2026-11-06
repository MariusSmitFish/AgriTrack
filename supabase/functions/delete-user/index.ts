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
      return jsonResponse({ error: 'Something went wrong. Try again later.' }, 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401)
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401)
    }

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401)
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', caller.id)
      .single()

    if (callerProfileError || !callerProfile) {
      return jsonResponse({ error: 'Your account could not be loaded. Sign in again.' }, 403)
    }

    if (!['superadmin', 'company_admin'].includes(callerProfile.role)) {
      return jsonResponse({ error: 'You do not have permission to do that.' }, 403)
    }

    const body = await req.json()
    const user_id = typeof body.user_id === 'string' ? body.user_id : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user_id)) {
      return jsonResponse({ error: 'Choose a person to remove.' }, 400)
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
      return jsonResponse({ error: 'That person could not be found.' }, 404)
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
      return jsonResponse({ error: 'Could not remove that person. Try again.' }, 400)
    }

    return jsonResponse({ ok: true, deleted_user_id: user_id })
  } catch (err) {
    return jsonResponse({ error: 'Something went wrong. Try again.' }, 500)
  }
})
