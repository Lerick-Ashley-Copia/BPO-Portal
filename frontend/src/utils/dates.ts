// For date-only values (leave request dates, report periods, date hired —
// no meaningful time-of-day), format using UTC explicitly. Without this,
// `new Date('2026-11-10').toLocaleDateString()` renders using the
// viewer's local timezone, which can shift a UTC-midnight date back a
// full day for anyone west of UTC. Genuine timestamps (createdAt,
// publishAt) should NOT use this — those correctly want local-time
// display.
export function formatDateOnly(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

// Attendance records are keyed off Manila's calendar day (see backend's
// todayInManila()), not the viewer's local day — a viewer west of
// Manila whose local clock hasn't crossed midnight there yet would
// otherwise default to a day the attendance system doesn't recognize
// as "today" yet, and see an empty range.
export function todayInManilaIso(): string {
  const manila = new Date(Date.now() + MANILA_OFFSET_MS)
  return `${manila.getUTCFullYear()}-${String(manila.getUTCMonth() + 1).padStart(2, '0')}-${String(manila.getUTCDate()).padStart(2, '0')}`
}

// Check-in/check-out timestamps should always read as Manila wall-clock
// time, not the viewer's browser/OS timezone — otherwise the same
// check-in shows a different time to a reviewer in a different zone
// than what the employee actually saw when they checked in.
export function formatManilaTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
}
