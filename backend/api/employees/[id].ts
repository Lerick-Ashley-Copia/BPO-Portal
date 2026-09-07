import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'

const updateSchema = z.object({
  position: z.string().min(1).optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
})

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const id = req.query.id
  if (typeof id !== 'string') {
    res.status(400).json({ message: 'Invalid employee id' })
    return
  }

  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid update payload' })
    return
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: parsed.data,
    include: { department: true, team: true, user: { select: { name: true, email: true } } },
  })

  res.status(200).json({
    id: employee.id,
    name: employee.user.name,
    email: employee.user.email,
    departmentId: employee.departmentId,
    department: employee.department?.name ?? null,
    teamId: employee.teamId,
    team: employee.team?.name ?? null,
    position: employee.position,
    status: employee.status,
    dateHired: employee.dateHired,
  })
}

export default requireAuth(handler, { roles: ['hr', 'admin'] })
