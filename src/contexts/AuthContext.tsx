import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isPasswordRecovery: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Invite + recovery links put type=invite|recovery in the URL before the client clears it. */
function detectPasswordSetupFromUrl() {
  if (typeof window === 'undefined') return false

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const hashParams = new URLSearchParams(hash)
  const queryParams = new URLSearchParams(window.location.search)
  const type = hashParams.get('type') ?? queryParams.get('type')
  return type === 'recovery' || type === 'invite'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(detectPasswordSetupFromUrl)

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to load profile:', error.message)
      setProfile(null)
      return
    }

    setProfile(data)
  }

  const refreshProfile = async () => {
    if (session?.user.id) {
      await fetchProfile(session.user.id)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      if (currentSession?.user.id) {
        fetchProfile(currentSession.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' || detectPasswordSetupFromUrl()) {
        setIsPasswordRecovery(true)
      }
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false)
      }

      setSession(nextSession)
      if (nextSession?.user.id) {
        fetchProfile(nextSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setIsPasswordRecovery(false)
  }

  const clearPasswordRecovery = () => setIsPasswordRecovery(false)

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isPasswordRecovery,
        signIn,
        signOut,
        refreshProfile,
        requestPasswordReset,
        updatePassword,
        clearPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
