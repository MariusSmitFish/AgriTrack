import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Logo } from '../../components/ui/Logo'

export function ForgotPasswordPage() {
  const { requestPasswordReset, session, profile, loading, isPasswordRecovery } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && isPasswordRecovery) {
    return <Navigate to="/reset-password" replace />
  }

  if (!loading && session && profile && !isPasswordRecovery) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Could not send reset email'
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
            Forgot password
          </h1>
          <p className="mt-1 text-sm text-soil-500">
            Enter your email and we&apos;ll send a reset link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="rounded-xl bg-pasture-50 px-3 py-3 text-sm text-pasture-800">
              If an account exists for <span className="font-semibold">{email}</span>, a reset link
              has been sent. Check your inbox (and spam folder).
            </p>
            <Link
              to="/login"
              className="inline-block text-sm font-semibold text-pasture-800 hover:text-pasture-700"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </Button>
            <p className="text-center text-sm text-soil-500">
              <Link to="/login" className="font-semibold text-pasture-800 hover:text-pasture-700">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  )
}
