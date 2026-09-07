import { useEffect, useState } from 'react'
import { api, ApiError } from '../../services/api'

interface AttendanceStatus {
  checkedIn: boolean
  checkedOut: boolean
  checkInAt: string | null
}

export function CheckInPrompt() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    api
      .get<AttendanceStatus>('/leave/attendance/today')
      .then(setStatus)
      .catch(() => setHidden(true)) // no employee profile yet — nothing to show
  }, [])

  async function handleCheckIn() {
    setCheckingIn(true)
    setError(null)
    try {
      const updated = await api.post<AttendanceStatus>('/leave/attendance/checkin')
      setStatus(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check in')
    } finally {
      setCheckingIn(false)
    }
  }

  if (hidden || !status || status.checkedIn) return null

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
