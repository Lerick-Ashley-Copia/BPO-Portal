import type { VercelRequest } from '@vercel/node'

// Vercel sits behind a proxy, so the real client IP arrives via
// x-forwarded-for (first entry in the comma-separated chain), not
// req.socket.remoteAddress (that's the proxy's own address).
export function getClientIp(req: VercelRequest): string | null {
  const header = req.headers['x-forwarded-for']
  const forwarded = Array.isArray(header) ? header[0] : header
  const first = forwarded?.split(',')[0]?.trim()
  return first || req.socket?.remoteAddress || null
}

const officeIps = (process.env.OFFICE_IPS ?? '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean)

// Only flags anything if OFFICE_IPS is actually configured — otherwise
// every check-in would be (mis)labeled off-site.
export function isOffSiteIp(ip: string | null): boolean {
  if (!ip || officeIps.length === 0) return false
  return !officeIps.includes(ip)
}
