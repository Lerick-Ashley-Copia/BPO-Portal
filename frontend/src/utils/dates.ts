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
