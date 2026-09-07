import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { api, ApiError } from '../../services/api'
import type { Department, EmployeeRecord, MyEmployeeProfile, Team } from './types'

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const statusOptions = ['active', 'on_leave', 'terminated'] as const

function MyProfile() {
  const [profile, setProfile] = useState<MyEmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<MyEmployeeProfile>('/employees/me')
      .then(setProfile)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError(err instanceof ApiError ? err.message : 'Something went wrong')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (notFound) {
    return <p className="text-sm text-gray-500">No employee profile on file for your account yet.</p>
  }
  if (!profile) return null

  const fields: [string, string][] = [
    ['Position', profile.position ?? '—'],
    ['Department', profile.department ?? '—'],
    ['Team', profile.team ?? '—'],
    ['Status', profile.status],
    ['Date Hired', profile.dateHired ? dateFormatter.format(new Date(profile.dateHired)) : '—'],
    ['Work Email', profile.email],
  ]

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="font-medium">{profile.name}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-gray-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function EmployeeRow({
  employee,
  departments,
  teams,
  onSaved,
}: {
  employee: EmployeeRecord
  departments: Department[]
  teams: Team[]
  onSaved: (updated: EmployeeRecord) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState(employee.position ?? '')
  const [status, setStatus] = useState(employee.status)
  const [departmentId, setDepartmentId] = useState(employee.departmentId ?? '')
  const [teamId, setTeamId] = useState(employee.teamId ?? '')
  const { guardedAction } = useAuth()

  const teamsInDepartment = teams.filter((t) => t.departmentId === departmentId)

  function save() {
    guardedAction(['hr', 'admin'], async () => {
      setSaving(true)
      setError(null)
      try {
        const updated = await api.put<EmployeeRecord>(`/employees/${employee.id}`, {
          position,
          status,
          departmentId: departmentId || null,
          teamId: teamId || null,
        })
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
      <tr className="border-b border-gray-100 dark:border-gray-800">
        <td className="py-2 pr-4">
          <div className="font-medium">{employee.name}</div>
          <div className="text-xs text-gray-500">{employee.email}</div>
        </td>
        <td className="py-2 pr-4">{employee.position ?? '—'}</td>
        <td className="py-2 pr-4">{employee.department ?? '—'}</td>
        <td className="py-2 pr-4">{employee.team ?? '—'}</td>
        <td className="py-2 pr-4">{employee.status}</td>
        <td className="py-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Edit
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 pr-4 align-top">
        <div className="font-medium">{employee.name}</div>
        <div className="text-xs text-gray-500">{employee.email}</div>
      </td>
      <td className="py-2 pr-4 align-top">
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 pr-4 align-top">
        <select
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value)
            setTeamId('')
          }}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4 align-top">
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {teamsInDepartment.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4 align-top">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 align-top">
        <div className="flex flex-col gap-1">
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </td>
    </tr>
  )
}

function CreateTeamOrDepartment({
  departments,
  onCreated,
}: {
  departments: Department[]
  onCreated: (result: { department?: Department; team?: Team }) => void
}) {
  const [kind, setKind] = useState<'department' | 'team'>('department')
  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { guardedAction } = useAuth()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (kind === 'team' && !departmentId) {
      setError('Choose a department for the new team')
      return
    }
    guardedAction(['admin'], async () => {
      setSubmitting(true)
      try {
        if (kind === 'department') {
          const dept = await api.post<Department>('/directory', { kind: 'department', name })
          onCreated({ department: dept })
        } else {
          const team = await api.post<Team>('/directory', { kind: 'team', name, departmentId })
          onCreated({ team })
        }
        setName('')
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not create')
      } finally {
        setSubmitting(false)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Type</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as 'department' | 'team')} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          <option value="department">Department</option>
          <option value="team">Team</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      {kind === 'team' && (
        <div className="space-y-1">
          <label className="text-sm text-gray-600">Department</label>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Select…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {submitting ? 'Creating…' : 'Create'}
      </button>
    </form>
  )
}

function EmployeeDirectory() {
  const { user } = useAuth()
  const isAdmin = user?.roles.includes('admin') ?? false
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<EmployeeRecord[]>('/employees'),
      api.get<{ departments: Department[]; teams: Team[] }>('/directory'),
    ])
      .then(([e, dir]) => {
        setEmployees(e)
        setDepartments(dir.departments)
        setTeams(dir.teams)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      {isAdmin && (
        <div className="mb-4">
          <CreateTeamOrDepartment
            departments={departments}
            onCreated={(result) => {
              if (result.department) setDepartments((prev) => [...prev, result.department!])
              if (result.team) setTeams((prev) => [...prev, result.team!])
            }}
          />
        </div>
      )}

      {(!employees || employees.length === 0) && (
        <p className="text-sm text-gray-500">No employee records yet.</p>
      )}

      {employees && employees.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                <th className="py-2 pr-4 font-medium">Employee</th>
                <th className="py-2 pr-4 font-medium">Position</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Team</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <EmployeeRow
                  key={employee.id}
                  employee={employee}
                  departments={departments}
                  teams={teams}
                  onSaved={(updated) =>
                    setEmployees((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? null)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function HrisPage() {
  const { user } = useAuth()
  const canManage = user?.roles.some((r) => r === 'hr' || r === 'admin') ?? false

  return (
    <div>
      <h1 className="text-2xl font-semibold">HRIS</h1>

      <section className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">My Profile</h2>
        <div className="mt-2">
          <MyProfile />
        </div>
      </section>

      {canManage && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Employee Directory
          </h2>
          <div className="mt-2">
            <EmployeeDirectory />
          </div>
        </section>
      )}
    </div>
  )
}
