import { prisma } from './prisma.js'

export function logAudit(
  userId: string,
  action: string,
  resource: string,
  resourceId: string | null,
  result: 'success' | 'failure' = 'success',
) {
  // Fire-and-forget: an audit write failing should never block the
  // actual operation it's recording.
  prisma.auditLog.create({ data: { userId, action, resource, resourceId, result } }).catch((err) => {
    console.error('Failed to write audit log', err)
  })
}
