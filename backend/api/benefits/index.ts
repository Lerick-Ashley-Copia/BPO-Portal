import type { VercelResponse } from '@vercel/node'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const benefits = await prisma.benefit.findMany({ orderBy: { category: 'asc' } })

  res.status(200).json(benefits)
}

export default requireAuth(handler)
