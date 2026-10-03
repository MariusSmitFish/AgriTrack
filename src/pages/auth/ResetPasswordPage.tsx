import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Logo } from '../../components/ui/Logo'

export function ResetPasswordPage() {
  const {
    session,
    loading,
    isPasswordRecovery,
    updatePassword,
    clearPasswordRecovery,
  } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)

  // Give Supabase a moment to process the recovery link tokens from the URL
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 800)
    return () => window.clearTimeout(timer)
  }, [])

  if (!loading && ready && !session) {
    return <Navigate to="/forgot-password" replace />
  }

  const canReset = Boolean(session && (isPasswordRecovery || ready))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      await updatePassword(password)
      clearPasswordRecovery()
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Could not update password'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="field-pattern flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-5 font-display text-xl font-bold text-pasture-900 sm:text-2xl">
            Set your password
          </h1>
          <p className="mt-1 text-sm text-soil-500">
            Choose a password to finish setting up your account.
          </p>
        </div>

        {loading || !ready ? (
          <p className="text-center text-sm text-soil-500">Verifying your link...</p>
        ) : !canReset ? (
          <div className="space-y-4 text-center">
            <p className="rounded-xl bg-barn-100 px-3 py-3 text-sm text-barn-800">
              This link is invalid or has expired. Request a new one.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block text-sm font-semibold text-pasture-800 hover:text-pasture-700"
            >
              Request new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save password'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
