const ACRONYMS: Record<string, string> = {
  sil: 'SIL',
}

// Audit log actions/resources are stored as snake_case (or occasionally
// hyphenated) identifiers like "check_in" or "reset-password" — this
// turns them into "Check In" / "Reset Password" for display.
export function humanize(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
