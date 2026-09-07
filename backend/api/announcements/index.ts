import type { VercelResponse } from '@vercel/node'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const announcements = await prisma.announcement.findMany({
    where: {
      published: true,
      OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }],
    },
    orderBy: { publishAt: 'desc' },
  })

  res.status(200).json(announcements)
}

export default requireAuth(handler)
