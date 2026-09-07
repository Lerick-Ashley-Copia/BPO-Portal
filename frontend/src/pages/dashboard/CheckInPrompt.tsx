import { useAuth } from '../../auth/AuthContext'

const timeFmt = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

// Check-in happens automatically on login (see AuthContext) — this is
// just a passive, dismissible confirmation so it doesn't happen
// invisibly. There's nothing to click and nothing to accidentally miss.
// If the automatic attempt failed, it falls back to a manual retry.
export function CheckInPrompt() {
  const { justCheckedIn, attendanceStatus, dismissJustCheckedIn, checkInError, retryCheckIn } = useAuth()

  if (checkInError) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
        <p className="font-medium">Couldn't check you in automatically: {checkInError}</p>
        <button
          onClick={retryCheckIn}
          className="shrink-0 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          Retry Check In
        </button>
      </div>
    )
  }

  if (!justCheckedIn) return null

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950">
      <p className="font-medium">
        You were checked in at {timeFmt(attendanceStatus?.checkInAt ?? null)}.
      </p>
      <button
        onClick={dismissJustCheckedIn}
        className="shrink-0 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        Dismiss
      </button>
    </div>
  )
}
