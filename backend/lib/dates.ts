const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

// Fixed-offset conversion (Asia/Manila has no DST) that works the same
// whether the server's local clock is UTC (Vercel) or something else
// (local dev) — Date.now() is always a true UTC epoch, so shifting it
// by the offset and reading the UTC fields back out gives the Manila
// wall-clock date without needing a timezone library.
export function todayInManila(): Date {
  const manilaMs = Date.now() + MANILA_OFFSET_MS
  const manila = new Date(manilaMs)
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
