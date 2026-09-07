import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import type { Role } from '../../auth/types'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { api, ApiError } from '../../services/api'
import type { ManagedUser } from './types'

const ALL_ROLES: Role[] = ['employee', 'team_leader', 'manager', 'hr', 'admin']

function RoleCheckboxes({
  selected,
  onChange,
}: {
  selected: Role[]
  onChange: (roles: Role[]) => void
}) {
  function toggle(role: Role) {
    onChange(selected.includes(role) ? selected.filter((r) => r !== role) : [...selected, role])
  }

  return (
    <div className="flex flex-wrap gap-3">
      {ALL_ROLES.map((role) => (
        <label key={role} className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={selected.includes(role)} onChange={() => toggle(role)} />
          {role}
        </label>
      ))}
    </div>
  )
}

function CreateUserForm({ onCreated }: { onCreated: (user: ManagedUser) => void }) {
  const { guardedAction } = useAuth()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roles, setRoles] = useState<Role[]>(['employee'])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (roles.length === 0) {
      setError('Select at least one role')
      return
    }

    guardedAction(['admin'], async () => {
      setSubmitting(true)
      try {
        const created = await api.post<{ id: string; email: string; name: string; roles: Role[] }>(
          '/users',
          { email, name, roles },
        )
        onCreated({ ...created, passwordSet: false, createdAt: new Date().toISOString() })
        setSuccess(`Account created — a setup link was emailed to ${created.email}.`)
        setEmail('')
        setName('')
        setRoles(['employee'])
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not create the account')
      } finally {
        setSubmitting(false)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="new-email" className="text-sm text-gray-600">
            Email
          </label>
          <input
            id="new-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-name" className="text-sm text-gray-600">
            Name
          </label>
          <input
            id="new-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-sm text-gray-600">Roles</span>
        <RoleCheckboxes selected={roles} onChange={setRoles} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700 dark:text-green-500">{success}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}

function UserRow({ user, onSaved }: { user: ManagedUser; onSaved: (user: ManagedUser) => void }) {
  const [roles, setRoles] = useState<Role[]>(user.roles)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify([...roles].sort()) !== JSON.stringify([...user.roles].sort())
  const { guardedAction } = useAuth()

  function save() {
    guardedAction(['admin'], async () => {
      setSaving(true)
      setError(null)
      try {
        const updated = await api.put<ManagedUser>(`/users/${user.id}`, { roles })
        onSaved(updated)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not save roles')
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <tr className="border-b border-gray-100 align-top dark:border-gray-800">
      <td className="py-2 pr-4">
        <div className="font-medium">{user.name}</div>
        <div className="text-xs text-gray-500">{user.email}</div>
        {!user.passwordSet && (
          <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-300">
            Setup pending
          </span>
        )}
      </td>
      <td className="py-2 pr-4">
        <RoleCheckboxes selected={roles} onChange={setRoles} />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="py-2">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  )
}

export function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<ManagedUser[]>('/users')
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>

      <section className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Create Account
        </h2>
        <div className="mt-2">
          <CreateUserForm onCreated={(u) => setUsers((prev) => (prev ? [...prev, u] : [u]))} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">All Users</h2>
        <div className="mt-2">
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {users && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                    <th className="py-2 pr-4 font-medium">User</th>
                    <th className="py-2 pr-4 font-medium">Roles</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onSaved={(updated) =>
                        setUsers((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
