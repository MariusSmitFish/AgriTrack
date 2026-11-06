import { createClient, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import type { CreateUserPayload } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase credentials.',
  )
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
)

async function readFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error
      }
    } catch {
      // response body not json
    }
    return 'Something went wrong. Try again.'
  }

  if (error instanceof FunctionsRelayError) {
    return 'Could not reach the server. Check your connection and try again.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong. Try again.'
}

async function invokeAuthedFunction(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    throw new Error(await readFunctionError(error))
  }

  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error)
  }

  return data
}

export async function createUser(payload: CreateUserPayload) {
  return invokeAuthedFunction('create-user', {
    ...payload,
    redirect_to: payload.redirect_to ?? `${window.location.origin}/reset-password`,
  })
}

export async function deleteUser(userId: string) {
  return invokeAuthedFunction('delete-user', { user_id: userId })
}
