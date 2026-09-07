import type { VercelResponse } from '@vercel/node'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: req.auth.sub },
    include: { department: true, team: true, user: { select: { name: true, email: true } } },
  })

  if (!employee) {
    res.status(404).json({ message: 'No employee profile on file yet' })
    return
  }

  res.status(200).json({
    id: employee.id,
    name: employee.user.name,
    email: employee.user.email,
    department: employee.department?.name ?? null,
    team: employee.team?.name ?? null,
    position: employee.position,
    status: employee.status,
    dateHired: employee.dateHired,
  })
}

export default requireAuth(handler)
