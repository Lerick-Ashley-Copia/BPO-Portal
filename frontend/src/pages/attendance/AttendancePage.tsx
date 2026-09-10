import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
import { api, ApiError } from '../../services/api'
import type { EmployeeRecord } from '../hris/types'
import { formatDateOnly, formatManilaTime, todayInManilaIso } from '../../utils/dates'
import { Card, CardForm } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import type { AttendanceRecord } from './types'

const timeFmt = formatManilaTime

function MarkAbsentForm({ onMarked }: { onMarked: () => void }) {
  const { guardedAction } = useAuth()
  const { data: employees } = useApiData<EmployeeRecord[]>('/employees')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(todayInManilaIso())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!employeeId) {
      setError('Select an employee')
      return
    }

    guardedAction(['hr', 'admin'], async () => {
      setSubmitting(true)
      try {
        await api.post('/leave/attendance/mark-absent', { employeeId, date })
        const name = employees?.find((e) => e.id === employeeId)?.name ?? 'Employee'
        setSuccess(`${name} marked absent for ${date}.`)
        onMarked()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not mark absent')
      } finally {
        setSubmitting(false)
      }
    })
  }

  return (
    <CardForm onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-sm text-gray-600 dark:text-gray-400">
        Employee
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="field mt-1">
          <option value="">Select…</option>
          {employees?.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm text-gray-600 dark:text-gray-400">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field mt-1" />
      </label>
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? 'Marking…' : 'Mark Absent'}
      </Button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-sm text-brand-700 dark:text-brand-400">{success}</p>}
    </CardForm>
  )
}

function EmployeeFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: employees } = useApiData<EmployeeRecord[]>('/employees')

  return (
    <label className="flex flex-col text-sm text-gray-600 dark:text-gray-400">
      Employee
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field mt-1">
        <option value="">All employees</option>
        {employees?.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function AttendancePage() {
  const { effectiveRoles } = useAuth()
  const isReviewer = effectiveRoles.some((r) => r === 'hr' || r === 'admin')

  const [from, setFrom] = useState(todayInManilaIso())
  const [to, setTo] = useState(todayInManilaIso())
  const [employeeId, setEmployeeId] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const rangeInvalid = to < from
  const params = new URLSearchParams({ from, to })
  if (employeeId) params.set('employeeId', employeeId)
  if (reloadToken) params.set('_r', String(reloadToken))
  const path = rangeInvalid ? '/leave/attendance' : `/leave/attendance?${params.toString()}`
  const { data, loading, error } = useApiData<AttendanceRecord[]>(path)

  async function handleExport() {
    if (rangeInvalid) return
    setExporting(true)
    setExportError(null)
    try {
      const exportParams = new URLSearchParams({ from, to })
      if (employeeId) exportParams.set('employeeId', employeeId)
      const { url } = await api.get<{ url: string }>(`/leave/attendance/export?${exportParams.toString()}`)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Could not export attendance')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={isReviewer ? 'All employees.' : 'Your check-in/check-out history.'}
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm text-gray-600 dark:text-gray-400">
          From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="field mt-1" />
        </label>
        <label className="flex flex-col text-sm text-gray-600 dark:text-gray-400">
          To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="field mt-1" />
        </label>
        {isReviewer && <EmployeeFilter value={employeeId} onChange={setEmployeeId} />}
        <Button
          size="sm"
          onClick={() => {
            const t = todayInManilaIso()
            setFrom(t)
            setTo(t)
          }}
        >
          Today
        </Button>
        <Button size="sm" variant="primary" onClick={handleExport} disabled={exporting || rangeInvalid}>
          {exporting ? 'Exporting…' : 'Export to Excel'}
        </Button>
      </Card>
      {rangeInvalid && <p className="mb-2 text-sm text-red-600 dark:text-red-400">"To" can't be before "From".</p>}
      {exportError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{exportError}</p>}

      {isReviewer && <MarkAbsentForm onMarked={() => setReloadToken((t) => t + 1)} />}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No attendance records in this range." />}

      {data && data.length > 0 && (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                {isReviewer && <th className="py-3 pl-4 pr-4 font-medium">Employee</th>}
                <th className="py-3 pr-4 pl-4 font-medium first:pl-4">Date</th>
                <th className="py-3 pr-4 font-medium">Check In</th>
                <th className="py-3 pr-4 font-medium">Check Out</th>
                {isReviewer && <th className="py-3 pr-4 font-medium">Check-in IP</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-black/5 transition-colors last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
                >
                  {isReviewer && <td className="py-2.5 pl-4 pr-4">{r.employeeName}</td>}
                  <td className="py-2.5 pl-4 pr-4">{formatDateOnly(r.date)}</td>
                  {r.status === 'absent' ? (
                    <td colSpan={isReviewer ? 3 : 2} className="py-2.5 pr-4 text-amber-700 dark:text-amber-500">
                      Absent
                    </td>
                  ) : (
                    <>
                      <td className="py-2.5 pr-4">{timeFmt(r.checkInAt)}</td>
                      <td className="py-2.5 pr-4">{timeFmt(r.checkOutAt)}</td>
                      {isReviewer && (
                        <td className={`py-2.5 pr-4 ${r.checkInOffSite ? 'text-amber-700 dark:text-amber-500' : ''}`}>
                          {r.checkInIp ?? '—'}
                          {r.checkInOffSite && <span className="ml-1 text-xs">(off-site)</span>}
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
