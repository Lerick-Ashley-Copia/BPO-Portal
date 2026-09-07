import type { VercelResponse } from '@vercel/node'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const teams = await prisma.team.findMany({
    include: { department: true },
    orderBy: { name: 'asc' },
  })

  res.status(200).json(
    teams.map((t) => ({ id: t.id, name: t.name, departmentId: t.departmentId, department: t.department.name })),
  )
}

export default requireAuth(handler)
