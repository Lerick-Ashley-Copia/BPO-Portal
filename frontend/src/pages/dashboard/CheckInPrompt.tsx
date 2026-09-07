import { useAuth } from '../../auth/AuthContext'

const timeFmt = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

// Check-in happens automatically on login (see AuthContext) — this is
// just a passive, dismissible confirmation so it doesn't happen
// invisibly. There's nothing to click and nothing to accidentally miss.
export function CheckInPrompt() {
  const { justCheckedIn, attendanceStatus, dismissJustCheckedIn } = useAuth()

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
