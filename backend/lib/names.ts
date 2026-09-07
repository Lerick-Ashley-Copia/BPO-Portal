// Full name display convention across the app: "First M. Last" — the
// middle name (optional) is abbreviated to an initial, matching the
// common Philippine formal name format. The Dashboard greeting is the
// one deliberate exception (first name only, handled by its own caller).
export function formatDisplayName(
  firstName: string,
  middleName: string | null | undefined,
  lastName: string,
): string {
  const parts = [firstName]
  const trimmedMiddle = middleName?.trim()
  if (trimmedMiddle) parts.push(`${trimmedMiddle.charAt(0).toUpperCase()}.`)
  if (lastName) parts.push(lastName)
  return parts.join(' ')
}
