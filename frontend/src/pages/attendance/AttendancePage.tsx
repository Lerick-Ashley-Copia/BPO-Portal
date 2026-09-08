import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
import { api, ApiError } from '../../services/api'
import type { EmployeeRecord } from '../hris/types'
import { formatDateOnly, todayInManilaIso } from '../../utils/dates'
import type { AttendanceRecord } from './types'

const timeFmt = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'

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
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <label className="flex flex-col text-sm">
        Employee
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">Select…</option>
          {employees?.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        {submitting ? 'Marking…' : 'Mark Absent'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700 dark:text-green-500">{success}</p>}
    </form>
  )
}

export function AttendancePage() {
  const { effectiveRoles } = useAuth()
  const isReviewer = effectiveRoles.some((r) => r === 'hr' || r === 'admin')

  const [from, setFrom] = useState(todayInManilaIso())
  const [to, setTo] = useState(todayInManilaIso())
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const rangeInvalid = to < from
  const path = rangeInvalid
    ? '/leave/attendance'
    : `/leave/attendance?from=${from}&to=${to}${reloadToken ? `&_r=${reloadToken}` : ''}`
  const { data, loading, error } = useApiData<AttendanceRecord[]>(path)

  async function handleExport() {
    if (rangeInvalid) return
    setExporting(true)
    setExportError(null)
    try {
      const { url } = await api.get<{ url: string }>(`/leave/attendance/export?from=${from}&to=${to}`)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Could not export attendance')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <p className="mt-1 text-sm text-gray-500">
        {isReviewer ? 'All employees.' : 'Your check-in/check-out history.'}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <button
          onClick={() => {
            const t = todayInManilaIso()
            setFrom(t)
            setTo(t)
          }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Today
        </button>
        <button
          onClick={handleExport}
          disabled={exporting || rangeInvalid}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>
      {rangeInvalid && <p className="mt-2 text-sm text-red-600">"To" can't be before "From".</p>}
      {exportError && <p className="mt-2 text-sm text-red-600">{exportError}</p>}

      {isReviewer && <MarkAbsentForm onMarked={() => setReloadToken((t) => t + 1)} />}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No attendance records in this range." />}

      {data && data.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                {isReviewer && <th className="py-2 pr-4 font-medium">Employee</th>}
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Check In</th>
                <th className="py-2 font-medium">Check Out</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                  {isReviewer && <td className="py-2 pr-4">{r.employeeName}</td>}
                  <td className="py-2 pr-4">{formatDateOnly(r.date)}</td>
                  {r.status === 'absent' ? (
                    <td colSpan={2} className="py-2 text-amber-700 dark:text-amber-500">
                      Absent
                    </td>
                  ) : (
                    <>
                      <td className="py-2 pr-4">{timeFmt(r.checkInAt)}</td>
                      <td className="py-2">{timeFmt(r.checkOutAt)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
