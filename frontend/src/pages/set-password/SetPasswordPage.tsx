import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import type { AuthUser } from '../../auth/types'
import { api, ApiError } from '../../services/api'

export function SetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { user, setSession } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  if (!token) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center">
        <p className="text-sm text-gray-500">This setup link is missing a token. Ask your administrator for a new one.</p>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const { token: jwt, user: loggedInUser } = await api.post<{ token: string; user: AuthUser }>(
        '/auth/set-password',
        { token, password },
      )
      setSession(jwt, loggedInUser)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set your password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-semibold">Set your password</h1>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-gray-600">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="confirm" className="text-sm text-gray-600">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Setting password…' : 'Set password and log in'}
        </button>
      </form>
    </div>
  )
}
