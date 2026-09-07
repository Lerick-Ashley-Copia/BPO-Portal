import type { VercelResponse } from '@vercel/node'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { formatDisplayName } from '../lib/names.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = await prisma.user.findUnique({ where: { id: req.auth.sub } })
  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }

  res.status(200).json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    name: formatDisplayName(user.firstName, user.middleName, user.lastName),
    roles: user.roles,
  })
}

export default requireAuth(handler)
