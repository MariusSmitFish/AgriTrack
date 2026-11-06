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

const ROLES = ['superadmin', 'company_admin', 'company_user'] as const

function roleLabel(role: string) {
  if (role === 'superadmin') return 'Super Admin'
  if (role === 'company_admin') return 'Farm Admin'
  if (role === 'company_user') return 'Farm User'
  return 'Farm User'
}

function inviteRedirect(value: unknown) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    const allowedProtocol = url.protocol === 'https:' || url.protocol === 'http:'
    if (!allowedProtocol || url.username || url.password || url.search || url.hash) return undefined
    if (url.pathname !== '/reset-password') return undefined
    return `${url.origin}${url.pathname}`
  } catch {
    return undefined
  }
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
      .select('role, company_id, full_name, email')
      .eq('id', caller.id)
      .single()

    if (callerProfileError || !callerProfile) {
      return jsonResponse({ error: 'Your account could not be loaded. Sign in again.' }, 403)
    }

    if (!['superadmin', 'company_admin'].includes(callerProfile.role)) {
      return jsonResponse({ error: 'You do not have permission to do that.' }, 403)
    }

    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const role = body.role
    const company_id = typeof body.company_id === 'string' ? body.company_id : ''
    const redirectTo = inviteRedirect(body.redirect_to)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return jsonResponse({ error: 'Enter a valid email address.' }, 400)
    }

    if (full_name.length > 120) {
      return jsonResponse({ error: 'Name is too long.' }, 400)
    }

    if (!ROLES.includes(role)) {
      return jsonResponse({ error: 'Choose a valid role.' }, 400)
    }

    if (role !== 'superadmin' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(company_id)) {
      return jsonResponse({ error: 'Choose a farm for this user.' }, 400)
    }

    if (callerProfile.role === 'company_admin') {
      if (role === 'superadmin' || company_id !== callerProfile.company_id) {
        return jsonResponse({ error: 'Cannot create user with these permissions' }, 403)
      }
    }

    const resolvedCompanyId = role === 'superadmin' ? null : company_id

    let farmName = ''
    if (resolvedCompanyId) {
      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('name, packages(name, max_users)')
        .eq('id', resolvedCompanyId)
        .maybeSingle()

      if (companyError) {
        const { data: fallback, error: fallbackError } = await supabaseAdmin
          .from('companies')
          .select('name')
          .eq('id', resolvedCompanyId)
          .maybeSingle()

        if (fallbackError) {
          return jsonResponse({ error: 'Could not load the farm. Try again.' }, 400)
        }
        farmName = fallback?.name?.trim() ?? ''
        if (!farmName && !fallback) {
          return jsonResponse({ error: 'Choose a farm for this user.' }, 400)
        }
      } else if (!company) {
        return jsonResponse({ error: 'Choose a farm for this user.' }, 400)
      } else {
        farmName = company?.name?.trim() ?? ''

        const nested = company?.packages as
          | { name: string; max_users: number | null }
          | { name: string; max_users: number | null }[]
          | null
          | undefined
        const plan = Array.isArray(nested) ? nested[0] : nested

        if (plan && plan.max_users != null) {
          const { count, error: countError } = await supabaseAdmin
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)

          if (countError) {
            return jsonResponse({ error: 'Could not check the team size. Try again.' }, 400)
          }

          if ((count ?? 0) >= plan.max_users) {
            return jsonResponse({
              error: `Your ${plan.name} package limit for team members is ${plan.max_users}. Ask a super admin to change the package if you need a higher limit.`,
            }, 403)
          }
        }
      }
    }

    const invitedBy =
      (typeof callerProfile.full_name === 'string' && callerProfile.full_name.trim()) ||
      (typeof callerProfile.email === 'string' && callerProfile.email.trim()) ||
      caller.email ||
      'An AgriScale Farm admin'

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
          app_name: 'AgriScale Farm',
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
      return jsonResponse({ error: 'The invitation could not be finished. Try again.' }, 400)
    }

    return jsonResponse({ user: invited.user })
  } catch (err) {
    return jsonResponse({ error: 'Something went wrong. Try again.' }, 500)
  }
})
