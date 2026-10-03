import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Logo } from '../../components/ui/Logo'

export function LoginPage() {
  const { signIn, session, profile, loading, isPasswordRecovery } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && isPasswordRecovery) {
    return <Navigate to="/reset-password" replace />
  }

  if (!loading && session && profile) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signIn(email, password)
    } catch (err: unknown) {
      console.error('Login error:', err)

      let message = 'Login failed'
      if (err && typeof err === 'object') {
        if ('message' in err && typeof err.message === 'string' && err.message) {
          message = err.message
        }
        if ('status' in err) {
          message += ` (HTTP ${String(err.status)})`
        }
        if ('code' in err && err.code) {
          message += ` — ${String(err.code)}`
        }
      }

      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="field-pattern flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="lg" showTagline />
          <h1 className="mt-5 font-display text-xl font-bold text-pasture-900 sm:text-2xl">Sign in</h1>
          <p className="mt-1 text-sm text-soil-500">Your farm, tracked — all in one place</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <div className="space-y-1">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-pasture-800 hover:text-pasture-700"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
