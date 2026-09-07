import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { api, ApiError } from '../../services/api'

export function CheckInPrompt() {
  const { attendanceStatus, refreshAttendance } = useAuth()
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckIn() {
    setCheckingIn(true)
    setError(null)
    try {
      await api.post('/leave/attendance/checkin')
      refreshAttendance()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check in')
    } finally {
      setCheckingIn(false)
    }
  }

  if (!attendanceStatus || attendanceStatus.checkedIn) return null

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950">
      <div>
        <p className="font-medium">You haven't checked in today</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <button
        onClick={handleCheckIn}
        disabled={checkingIn}
        className="shrink-0 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {checkingIn ? 'Checking in…' : 'Check In'}
      </button>
    </div>
  )
}
