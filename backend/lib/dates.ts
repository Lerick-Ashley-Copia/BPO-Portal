const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

// Fixed-offset conversion (Asia/Manila has no DST) that works the same
// whether the server's local clock is UTC (Vercel) or something else
// (local dev) — Date.now() is always a true UTC epoch, so shifting it
// by the offset and reading the UTC fields back out gives the Manila
// wall-clock date without needing a timezone library.
// Attendance is keyed by "shift day", not literal Manila calendar day.
// The check-in window (7:30 PM-5:30 AM) is a night shift that crosses
// midnight, so a plain calendar-day split would give one shift two
// attendance records — the employee is still mid-shift when the clock
// rolls to a new calendar day, but a naive "today" would say no record
// exists yet and auto-check-in would fire a second time. The shift-day
// boundary is noon instead of midnight: anything before noon still
// belongs to the previous calendar day's shift (safe for any shift
// starting in the evening and ending well before noon).
export function todayInManila(): Date {
  const manilaMs = Date.now() + MANILA_OFFSET_MS
  const manila = new Date(manilaMs)
  if (manila.getUTCHours() < 12) {
    manila.setUTCDate(manila.getUTCDate() - 1)
  }
  return new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate()))
}

// Minutes since midnight, Manila wall-clock time — used to gate
// check-in to business hours (see handleCheckIn in api/leave.ts).
export function minutesIntoManilaDay(): number {
  const manila = new Date(Date.now() + MANILA_OFFSET_MS)
  return manila.getUTCHours() * 60 + manila.getUTCMinutes()
}

export function inclusiveDayCount(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  return Math.round((endDay - startDay) / msPerDay) + 1
}
