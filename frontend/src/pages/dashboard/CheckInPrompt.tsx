import { useAuth } from '../../auth/AuthContext'
import { formatManilaTime } from '../../utils/dates'
import { Button } from '../../components/ui/Button'

// Check-in happens automatically on login (see AuthContext) — this is
// just a passive, dismissible confirmation so it doesn't happen
// invisibly. There's nothing to click and nothing to accidentally miss.
// If the automatic attempt failed, it falls back to a manual retry.
export function CheckInPrompt() {
  const { justCheckedIn, attendanceStatus, dismissJustCheckedIn, checkInError, retryCheckIn } = useAuth()

  if (checkInError) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-amber-900 dark:bg-amber-950/70">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          Couldn't check you in automatically: {checkInError}
        </p>
        <Button
          size="sm"
          onClick={retryCheckIn}
          className="!border-amber-300 !bg-amber-600 !text-white hover:!bg-amber-700 dark:!border-amber-800"
        >
          Retry Check In
        </Button>
      </div>
    )
  }

  if (!justCheckedIn) return null

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/90 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-brand-900 dark:bg-brand-950/70">
      <p className="font-medium text-brand-900 dark:text-brand-200">
        You were checked in at {formatManilaTime(attendanceStatus?.checkInAt ?? null)}.
      </p>
      <button
        onClick={dismissJustCheckedIn}
        className="shrink-0 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Dismiss
      </button>
    </div>
  )
}
