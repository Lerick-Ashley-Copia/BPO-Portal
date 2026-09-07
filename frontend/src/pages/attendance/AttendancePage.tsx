import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
import { formatDateOnly } from '../../utils/dates'
import type { AttendanceRecord } from './types'

const timeFmt = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'

export function AttendancePage() {
  const { effectiveRoles } = useAuth()
  const isReviewer = effectiveRoles.some((r) => r === 'hr' || r === 'admin')
  const { data, loading, error } = useApiData<AttendanceRecord[]>('/leave/attendance')

  return (
    <div>
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <p className="mt-1 text-sm text-gray-500">
        {isReviewer ? 'All employees.' : 'Your check-in/check-out history.'}
      </p>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No attendance records yet." />}

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
