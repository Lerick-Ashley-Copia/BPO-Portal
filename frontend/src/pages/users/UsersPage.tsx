import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import type { Role } from '../../auth/types'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { api, ApiError } from '../../services/api'
import type { ManagedUser } from './types'
import type { Department, Team } from '../hris/types'

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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [roles, setRoles] = useState<Role[]>(['employee'])
  const [position, setPosition] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ departments: Department[]; teams: Team[] }>('/directory')
      .then(({ departments, teams }) => {
        setDepartments(departments)
        setTeams(teams)
      })
      .catch(() => {})
  }, [])

  const teamsInDepartment = teams.filter((t) => t.departmentId === departmentId)

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
        const created = await api.post<ManagedUser>('/users', {
          email,
          firstName,
          lastName,
          middleName: middleName || undefined,
          roles,
          position: position || undefined,
          departmentId: departmentId || undefined,
          teamId: teamId || undefined,
        })
        onCreated(created)
        setSuccess(`Account created — a setup link was emailed to ${created.email}.`)
        setEmail('')
        setFirstName('')
        setLastName('')
        setMiddleName('')
        setRoles(['employee'])
        setPosition('')
        setDepartmentId('')
        setTeamId('')
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
          <label htmlFor="new-first-name" className="text-sm text-gray-600">
            First Name
          </label>
          <input
            id="new-first-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-last-name" className="text-sm text-gray-600">
            Last Name
          </label>
          <input
            id="new-last-name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-middle-name" className="text-sm text-gray-600">
            Middle Name <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="new-middle-name"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="new-position" className="text-sm text-gray-600">
            Position <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="new-position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-department" className="text-sm text-gray-600">
            Department <span className="text-gray-400">(optional)</span>
          </label>
          <select
            id="new-department"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value)
              setTeamId('')
            }}
            className="w-full rounded border border-gray-300 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="new-team" className="text-sm text-gray-600">
            Team <span className="text-gray-400">(optional)</span>
          </label>
          <select
            id="new-team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={!departmentId}
            className="w-full rounded border border-gray-300 px-2 py-2 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">—</option>
            {teamsInDepartment.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
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
        className="rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}

function UserRow({
  user,
  onSaved,
  onDeleted,
}: {
  user: ManagedUser
  onSaved: (user: ManagedUser) => void
  onDeleted: (id: string) => void
}) {
  const { guardedAction, user: currentUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [middleName, setMiddleName] = useState(user.middleName ?? '')
  const [roles, setRoles] = useState<Role[]>(user.roles)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendingReset, setSendingReset] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const isSelf = user.id === currentUser?.id

  function remove() {
    if (!window.confirm(`Delete ${user.name}'s account? This cannot be undone.`)) return
    setDeleteError(null)

    guardedAction(['admin'], async () => {
      setDeleting(true)
      try {
        await api.delete(`/users/${user.id}`)
        onDeleted(user.id)
      } catch (err) {
        setDeleteError(err instanceof ApiError ? err.message : 'Could not delete this account')
        setDeleting(false)
      }
    })
  }

  function sendResetLink() {
    setResetError(null)
    setResetMessage(null)

    guardedAction(['admin'], async () => {
      setSendingReset(true)
      try {
        const { message } = await api.post<{ message: string }>('/auth/admin-reset-password', {
          userId: user.id,
        })
        setResetMessage(message)
      } catch (err) {
        setResetError(err instanceof ApiError ? err.message : 'Could not send the reset link')
      } finally {
        setSendingReset(false)
      }
    })
  }

  const nameDirty =
    firstName !== user.firstName || lastName !== user.lastName || middleName !== (user.middleName ?? '')
  const rolesDirty = JSON.stringify([...roles].sort()) !== JSON.stringify([...user.roles].sort())
  const dirty = nameDirty || rolesDirty

  function startEditing() {
    setFirstName(user.firstName)
    setLastName(user.lastName)
    setMiddleName(user.middleName ?? '')
    setRoles(user.roles)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setError(null)
    setEditing(false)
  }

  function save() {
    if (roles.length === 0) {
      setError('Select at least one role')
      return
    }

    guardedAction(['admin'], async () => {
      setSaving(true)
      setError(null)
      try {
        // Only the fields that actually changed are sent, so the audit
        // trail records specifically what happened (a name edit and a
        // role change are logged as separate entries server-side).
        const payload: { roles?: Role[]; firstName?: string; lastName?: string; middleName?: string | null } = {}
        if (rolesDirty) payload.roles = roles
        if (nameDirty) {
          payload.firstName = firstName
          payload.lastName = lastName
          payload.middleName = middleName || null
        }
        const updated = await api.put<ManagedUser>(`/users/${user.id}`, payload)
        onSaved(updated)
        setEditing(false)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not save changes')
      } finally {
        setSaving(false)
      }
    })
  }

  if (!editing) {
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
        <td className="py-2 pr-4 text-sm text-gray-600 dark:text-gray-400">{user.roles.join(', ')}</td>
        <td className="py-2">
          <div className="flex gap-1">
            <button
              onClick={startEditing}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Edit
            </button>
            <button
              onClick={sendResetLink}
              disabled={sendingReset}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {sendingReset ? 'Sending…' : 'Send reset link'}
            </button>
            {!isSelf && (
              <button
                onClick={remove}
                disabled={deleting}
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          {resetMessage && <p className="mt-1 text-xs text-green-700 dark:text-green-500">{resetMessage}</p>}
          {resetError && <p className="mt-1 text-xs text-red-600">{resetError}</p>}
          {deleteError && <p className="mt-1 text-xs text-red-600">{deleteError}</p>}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100 align-top dark:border-gray-800">
      <td className="py-2 pr-4">
        <div className="space-y-1">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            placeholder="Middle name (optional)"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div className="mt-1 text-xs text-gray-500">{user.email}</div>
      </td>
      <td className="py-2 pr-4">
        <RoleCheckboxes selected={roles} onChange={setRoles} />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="py-2">
        <div className="flex gap-1">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={cancel}
            disabled={saving}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
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
                      onDeleted={(id) => setUsers((prev) => prev?.filter((x) => x.id !== id) ?? null)}
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
