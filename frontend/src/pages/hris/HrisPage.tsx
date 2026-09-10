import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { api, ApiError } from '../../services/api'
import { Card, CardForm } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import type { Department, EmployeeRecord, MyEmployeeProfile, Team } from './types'

// dateHired is a date-only value with no meaningful time-of-day, so
// force UTC display — otherwise a viewer west of UTC sees it shifted
// back a day (new Date('2026-09-07') is midnight UTC, which is still
// Sep 6 evening in e.g. US timezones).
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
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
    return <p className="text-sm text-gray-500 dark:text-gray-400">No employee profile on file for your account yet.</p>
  }
  if (!profile) return null

  const fields: [string, string][] = [
    ['Position', profile.position ?? '—'],
    ['Department', profile.department ?? '—'],
    ['Team', profile.team ?? '—'],
    ['Status', profile.status],
    ['Date Hired', profile.dateHired ? dateFormatter.format(new Date(profile.dateHired)) : '—'],
    ['Work Email', profile.email],
    ['SIL Balance', `${profile.silBalance} day${profile.silBalance === 1 ? '' : 's'}`],
  ]

  return (
    <Card>
      <h3 className="font-medium text-gray-900 dark:text-gray-100">{profile.name}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="mt-0.5 text-gray-900 dark:text-gray-200">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
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
  const [dateHired, setDateHired] = useState(employee.dateHired ? employee.dateHired.slice(0, 10) : '')
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
          dateHired: dateHired || null,
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
      <tr className="border-b border-black/5 transition-colors last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]">
        <td className="py-2.5 pl-4 pr-4">
          <div className="font-medium text-gray-900 dark:text-gray-100">{employee.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{employee.email}</div>
        </td>
        <td className="py-2.5 pr-4">{employee.position ?? '—'}</td>
        <td className="py-2.5 pr-4">{employee.department ?? '—'}</td>
        <td className="py-2.5 pr-4">{employee.team ?? '—'}</td>
        <td className="py-2.5 pr-4">{employee.status}</td>
        <td className="py-2.5 pr-4">
          {employee.dateHired ? dateFormatter.format(new Date(employee.dateHired)) : '—'}
        </td>
        <SilBalanceCell employee={employee} onSaved={onSaved} />
        <td className="py-2.5 pr-4">
          <Button size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="py-2.5 pl-4 pr-4 align-top">
        <div className="font-medium text-gray-900 dark:text-gray-100">{employee.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{employee.email}</div>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <input value={position} onChange={(e) => setPosition(e.target.value)} className="field w-32 py-1" />
      </td>
      <td className="py-2.5 pr-4 align-top">
        <select
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value)
            setTeamId('')
          }}
          className="field py-1"
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="field py-1">
          <option value="">—</option>
          {teamsInDepartment.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="field py-1">
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <input
          type="date"
          value={dateHired}
          onChange={(e) => setDateHired(e.target.value)}
          className="field py-1"
        />
      </td>
      <SilBalanceCell employee={employee} onSaved={onSaved} />
      <td className="py-2.5 pr-4 align-top">
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
        </div>
      </td>
    </tr>
  )
}

// Deliberately kept out of the regular position/department/team/status
// edit form — a leave-balance correction is a different, more
// sensitive kind of edit ("just in case" territory), so it gets its
// own out-of-band interaction instead of sitting next to routine
// fields where it'd be easy to change by accident.
function SilBalanceCell({
  employee,
  onSaved,
}: {
  employee: EmployeeRecord
  onSaved: (updated: EmployeeRecord) => void
}) {
  const { guardedAction } = useAuth()
  const [saving, setSaving] = useState(false)

  function editBalance(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (saving) return

    guardedAction(['hr', 'admin'], async () => {
      const input = window.prompt(`New SIL balance for ${employee.name} (days):`, String(employee.silBalance))
      if (input === null) return
      const value = Number(input)
      if (!Number.isInteger(value) || value < 0) {
        alert('Enter a whole number of days, 0 or more')
        return
      }

      setSaving(true)
      try {
        const updated = await api.put<EmployeeRecord>(`/employees/${employee.id}`, { silBalance: value })
        onSaved(updated)
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Could not update SIL balance')
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <td
      className="py-2.5 pr-4 cursor-context-menu select-none align-top"
      onContextMenu={editBalance}
      title="Right-click to edit"
    >
      {saving ? '…' : `${employee.silBalance} day${employee.silBalance === 1 ? '' : 's'}`}
    </td>
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
    <CardForm onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-sm text-gray-600 dark:text-gray-400">Type</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as 'department' | 'team')} className="field">
          <option value="department">Department</option>
          <option value="team">Team</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm text-gray-600 dark:text-gray-400">Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="field" />
      </div>
      {kind === 'team' && (
        <div className="space-y-1">
          <label className="text-sm text-gray-600 dark:text-gray-400">Department</label>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="field">
            <option value="">Select…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create'}
      </Button>
    </CardForm>
  )
}

function EmployeeDirectory() {
  const { effectiveRoles } = useAuth()
  const isAdmin = effectiveRoles.includes('admin')
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
        <p className="text-sm text-gray-500 dark:text-gray-400">No employee records yet.</p>
      )}

      {employees && employees.length > 0 && (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                <th className="py-3 pl-4 pr-4 font-medium">Employee</th>
                <th className="py-3 pr-4 font-medium">Position</th>
                <th className="py-3 pr-4 font-medium">Department</th>
                <th className="py-3 pr-4 font-medium">Team</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Date Hired</th>
                <th className="py-3 pr-4 font-medium" title="Right-click a value to edit">
                  SIL Balance
                </th>
                <th className="py-3 pr-4 font-medium">Actions</th>
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
        </Card>
      )}
    </div>
  )
}

export function HrisPage() {
  const { effectiveRoles } = useAuth()
  const canManage = effectiveRoles.some((r) => r === 'hr' || r === 'admin')

  return (
    <div>
      <PageHeader title="HRIS" />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          My Profile
        </h2>
        <div className="mt-2">
          <MyProfile />
        </div>
      </section>

      {canManage && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
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
