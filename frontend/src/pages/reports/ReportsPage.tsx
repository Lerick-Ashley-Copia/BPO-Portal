import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { api, ApiError } from '../../services/api'
import type { ReportData, ReportStatus, WeeklyReport } from './types'

interface Team {
  id: string
  name: string
  department: string
}

const statusColors: Record<ReportStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  reviewed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const dataFields: { key: keyof ReportData; label: string; multiline?: boolean }[] = [
  { key: 'client', label: 'Client/Account' },
  { key: 'headcount', label: 'Headcount' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'qa', label: 'Quality/QA' },
  { key: 'sla', label: 'SLA' },
  { key: 'performanceMetrics', label: 'Performance Metrics', multiline: true },
  { key: 'issues', label: 'Issues', multiline: true },
  { key: 'achievements', label: 'Achievements', multiline: true },
  { key: 'actionItems', label: 'Action Items', multiline: true },
]

function ReportDataFields({
  data,
  onChange,
}: {
  data: ReportData
  onChange: (data: ReportData) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {dataFields.map(({ key, label, multiline }) => {
        const value = data[key]
        const stringValue = value == null ? '' : String(value)
        const update = (v: string) =>
          onChange({ ...data, [key]: key === 'headcount' ? (v ? Number(v) : undefined) : v })
        return (
          <div key={key} className={multiline ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
            <label className="text-sm text-gray-600">{label}</label>
            {multiline ? (
              <textarea
                value={stringValue}
                onChange={(e) => update(e.target.value)}
                rows={2}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            ) : (
              <input
                type={key === 'headcount' ? 'number' : 'text'}
                value={stringValue}
                onChange={(e) => update(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CreateReportForm({ teams, onCreated }: { teams: Team[]; onCreated: (r: WeeklyReport) => void }) {
  const { guardedAction } = useAuth()
  const [teamId, setTeamId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    guardedAction(['team_leader', 'hr', 'admin'], async () => {
      setError(null)
      setSubmitting(true)
      try {
        const created = await api.post<WeeklyReport>('/reports', {
          teamId,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
        })
        onCreated(created)
        setPeriodStart('')
        setPeriodEnd('')
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not create report')
      } finally {
        setSubmitting(false)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Team</label>
        <select required value={teamId} onChange={(e) => setTeamId(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Select…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Period start</label>
        <input type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Period end</label>
        <input type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
        {submitting ? 'Creating…' : 'New report'}
      </button>
    </form>
  )
}

function ReportCard({ report, onUpdated }: { report: WeeklyReport; onUpdated: (r: WeeklyReport) => void }) {
  const { effectiveRoles, guardedAction } = useAuth()
  const [editing, setEditing] = useState(false)
  const [data, setData] = useState<ReportData>(report.data)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  const isReviewer = effectiveRoles.some((r) => r === 'manager' || r === 'hr' || r === 'admin')
  const canEdit = report.status === 'draft' || report.status === 'rejected'

  function transition(action: string, extra?: Record<string, unknown>) {
    const requiredRoles =
      action === 'review' || action === 'approve' || action === 'reject'
        ? (['manager', 'hr', 'admin'] as const)
        : (['team_leader', 'hr', 'admin'] as const)

    guardedAction([...requiredRoles], async () => {
      setBusy(true)
      setError(null)
      try {
        const updated = await api.put<WeeklyReport>(`/reports/${report.id}`, { action, ...extra })
        onUpdated(updated)
        setEditing(false)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not update report')
      } finally {
        setBusy(false)
      }
    })
  }

  async function handleExport(format: 'csv' | 'xlsx' | 'pdf') {
    setExporting(format)
    setError(null)
    try {
      const { url } = await api.get<{ url: string }>(`/reports/${report.id}/export?format=${format}`)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export report')
    } finally {
      setExporting(null)
    }
  }

  const dateFmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{report.team}</span>
          <span className="ml-2 text-sm text-gray-500">
            {dateFmt(report.periodStart)} – {dateFmt(report.periodEnd)}
          </span>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[report.status]}`}>
          {report.status}
        </span>
      </div>

      {report.data.managerComments && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Manager comments:</span> {report.data.managerComments}
        </p>
      )}

      {editing ? (
        <div className="mt-3 space-y-3">
          <ReportDataFields data={data} onChange={setData} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => transition('save', { data })}
              disabled={busy}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Save draft
            </button>
            <button
              onClick={() => transition('submit', { data })}
              disabled={busy}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              Submit
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Edit
            </button>
          )}
          {report.status === 'rejected' && (
            <button
              onClick={() => transition('reopen')}
              disabled={busy}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Reopen as draft
            </button>
          )}
          {isReviewer && report.status === 'submitted' && (
            <button
              onClick={() => transition('review')}
              disabled={busy}
              className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
            >
              Mark reviewed
            </button>
          )}
          {isReviewer && report.status === 'reviewed' && (
            <button
              onClick={() => transition('approve')}
              disabled={busy}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {isReviewer && (report.status === 'submitted' || report.status === 'reviewed') && (
            <button
              onClick={() => {
                const reason = window.prompt('Reason for rejecting this report:')
                if (reason === null) return // cancelled
                transition('reject', reason ? { comment: reason } : undefined)
              }}
              disabled={busy}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Reject
            </button>
          )}
          <span className="mx-1 self-center text-gray-300">|</span>
          {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={exporting === format}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm uppercase hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              {exporting === format ? '…' : format}
            </button>
          ))}
        </div>
      )}
      {!editing && error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

export function ReportsPage() {
  const { effectiveRoles } = useAuth()
  const canCreate = effectiveRoles.some((r) => r === 'team_leader' || r === 'hr' || r === 'admin')
  const [reports, setReports] = useState<WeeklyReport[] | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<WeeklyReport[]>('/reports'),
      api.get<{ teams: Team[] }>('/directory'),
    ])
      .then(([r, dir]) => {
        setReports(r)
        setTeams(dir.teams)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold">Weekly Reports</h1>

      {canCreate && (
        <div className="mt-4">
          <CreateReportForm teams={teams} onCreated={(r) => setReports((prev) => (prev ? [r, ...prev] : [r]))} />
        </div>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {reports && reports.length === 0 && <EmptyState label="No reports yet." />}

      {reports && reports.length > 0 && (
        <div className="mt-4 space-y-3">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              onUpdated={(updated) =>
                setReports((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
