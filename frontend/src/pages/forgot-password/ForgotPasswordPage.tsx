import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { api, ApiError } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

export function ForgotPasswordPage() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the reset email')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm !p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="h-12 w-12" />
          <h1 className="mt-3 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Reset your password
          </h1>
        </div>
        <div className="space-y-4">
          {sent ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              If that email is registered, a reset link is on its way. Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm text-gray-600 dark:text-gray-400">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <Button type="submit" variant="primary" disabled={submitting} className="w-full">
                {submitting ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            <Link to="/login" className="text-brand-600 hover:underline dark:text-brand-400">
              Back to sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
