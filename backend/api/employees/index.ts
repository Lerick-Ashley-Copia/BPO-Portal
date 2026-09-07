import type { VercelResponse } from '@vercel/node'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const employees = await prisma.employee.findMany({
    include: { department: true, team: true, user: { select: { name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  })

  res.status(200).json(
    employees.map((e) => ({
      id: e.id,
      name: e.user.name,
      email: e.user.email,
      departmentId: e.departmentId,
      department: e.department?.name ?? null,
      teamId: e.teamId,
      team: e.team?.name ?? null,
      position: e.position,
      status: e.status,
      dateHired: e.dateHired,
    })),
  )
}

export default requireAuth(handler, { roles: ['hr', 'admin'] })
