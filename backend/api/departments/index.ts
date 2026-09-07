import type { VercelResponse } from '@vercel/node'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } })
  res.status(200).json(departments.map((d) => ({ id: d.id, name: d.name })))
}

export default requireAuth(handler)
