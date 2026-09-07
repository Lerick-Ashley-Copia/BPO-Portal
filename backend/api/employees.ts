import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { logAudit } from '../lib/audit.js'
import { isNotFoundError } from '../lib/errors.js'

// Consolidated into one function (Vercel Hobby caps at 12 serverless
// functions per deployment): GET /employees, GET /employees/me,
// PUT /employees/:id. The /me and /:id sub-paths are routed here via
// vercel.json rewrites, arriving as ?sub=me or ?sub=<id>.

const updateSchema = z.object({
  position: z.string().min(1).optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
})

const employeeSelect = {
  include: { department: true, team: true, user: { select: { name: true, email: true } } },
} as const

function serialize(e: {
  id: string
  user: { name: string; email: string }
  department: { name: string } | null
  departmentId: string | null
  team: { name: string } | null
  teamId: string | null
  position: string | null
  status: string
  dateHired: Date | null
}) {
  return {
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
  }
}

function isManager(req: AuthedRequest): boolean {
  return req.auth.roles.includes('hr') || req.auth.roles.includes('admin')
}

async function handleList(req: AuthedRequest, res: VercelResponse) {
  if (!isManager(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const employees = await prisma.employee.findMany({
    ...employeeSelect,
    orderBy: { user: { name: 'asc' } },
  })
  res.status(200).json(employees.map(serialize))
}

async function handleMe(req: AuthedRequest, res: VercelResponse) {
  const employee = await prisma.employee.findUnique({
    where: { userId: req.auth.sub },
    ...employeeSelect,
  })
  if (!employee) {
    res.status(404).json({ message: 'No employee profile on file yet' })
    return
  }
  res.status(200).json(serialize(employee))
}

async function handleUpdate(req: AuthedRequest, res: VercelResponse, id: string) {
  if (!isManager(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid update payload' })
    return
  }
  let employee
  try {
    employee = await prisma.employee.update({ where: { id }, data: parsed.data, ...employeeSelect })
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ message: 'Employee not found' })
      return
    }
    throw err
  }
  logAudit(req.auth.sub, 'update', 'employee', id)
  res.status(200).json(serialize(employee))
}

async function handler(req: AuthedRequest, res: VercelResponse) {
  const sub = typeof req.query.sub === 'string' ? req.query.sub : undefined

  if (!sub && req.method === 'GET') return handleList(req, res)
  if (sub === 'me' && req.method === 'GET') return handleMe(req, res)
  if (sub && sub !== 'me' && req.method === 'PUT') return handleUpdate(req, res, sub)

  res.status(404).json({ message: 'Not found' })
}

export default requireAuth(handler)
