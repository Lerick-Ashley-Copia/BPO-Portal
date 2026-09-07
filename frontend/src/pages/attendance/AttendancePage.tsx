import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
import { api, ApiError } from '../../services/api'
import { formatDateOnly } from '../../utils/dates'
import type { AttendanceRecord } from './types'

const timeFmt = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AttendancePage() {
  const { effectiveRoles } = useAuth()
  const isReviewer = effectiveRoles.some((r) => r === 'hr' || r === 'admin')

  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const rangeInvalid = to < from
  const path = rangeInvalid ? '/leave/attendance' : `/leave/attendance?from=${from}&to=${to}`
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
            const t = todayIso()
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
                  <td className="py-2 pr-4">{timeFmt(r.checkInAt)}</td>
                  <td className="py-2">{timeFmt(r.checkOutAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
