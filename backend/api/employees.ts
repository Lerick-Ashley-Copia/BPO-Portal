import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { logAudit } from '../lib/audit.js'
import { isNotFoundError } from '../lib/errors.js'
import { formatDisplayName } from '../lib/names.js'

// Consolidated into one function (Vercel Hobby caps at 12 serverless
// functions per deployment): GET /employees, GET /employees/me,
// PUT /employees/:id. The /me and /:id sub-paths are routed here via
// vercel.json rewrites, arriving as ?sub=me or ?sub=<id>.

const createSchema = z.object({
  userId: z.string().min(1),
  departmentId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  position: z.string().min(1).nullable().optional(),
})

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

const updateSchema = z.object({
  position: z.string().min(1).optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  dateHired: z.string().regex(dateOnlyPattern, 'dateHired must be YYYY-MM-DD').nullable().optional(),
  silBalance: z.number().int().min(0).optional(),
})

const employeeSelect = {
  include: {
    department: true,
    team: true,
    user: { select: { firstName: true, middleName: true, lastName: true, email: true } },
  },
} as const

function serialize(e: {
  id: string
  user: { firstName: string; middleName: string | null; lastName: string; email: string }
  department: { name: string } | null
  departmentId: string | null
  team: { name: string } | null
  teamId: string | null
  position: string | null
  status: string
  dateHired: Date | null
  silBalance: number
}) {
  return {
    id: e.id,
    name: formatDisplayName(e.user.firstName, e.user.middleName, e.user.lastName),
    email: e.user.email,
    departmentId: e.departmentId,
    department: e.department?.name ?? null,
    teamId: e.teamId,
    team: e.team?.name ?? null,
    position: e.position,
    status: e.status,
    dateHired: e.dateHired,
    silBalance: e.silBalance,
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
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
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

// Every User account needs a matching Employee row to show up anywhere
// in HRIS/Attendance/Leave — normally created automatically alongside
// the User (see users.ts handleCreate). This covers backfilling it for
// an account that predates that, or any other case where one's missing.
async function handleCreate(req: AuthedRequest, res: VercelResponse) {
  if (!isManager(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid employee payload' })
    return
  }

  const { userId, ...rest } = parsed.data
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }

  const existing = await prisma.employee.findUnique({ where: { userId } })
  if (existing) {
    res.status(409).json({ message: 'This user already has an employee profile' })
    return
  }

  const employee = await prisma.employee.create({ data: { userId, ...rest }, ...employeeSelect })
  logAudit(req.auth.sub, 'create', 'employee', employee.id)
  res.status(201).json(serialize(employee))
}

async function handleUpdate(req: AuthedRequest, res: VercelResponse, id: string) {
  if (!isManager(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid update payload' })
    return
  }

  const { dateHired, silBalance, ...rest } = parsed.data
  const data = {
    ...rest,
    ...(dateHired !== undefined && { dateHired: dateHired === null ? null : new Date(`${dateHired}T00:00:00.000Z`) }),
    ...(silBalance !== undefined && { silBalance }),
  }

  let employee
  try {
    employee = await prisma.employee.update({ where: { id }, data, ...employeeSelect })
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ message: 'Employee not found' })
      return
    }
    throw err
  }

  // SIL balance gets its own audit entry — a leave-day correction is a
  // more sensitive change than a position/status/team edit and is
  // worth being able to find in the log on its own.
  if (silBalance !== undefined) logAudit(req.auth.sub, 'update_sil_balance', 'employee', id)
  if (Object.keys(rest).length > 0 || dateHired !== undefined) logAudit(req.auth.sub, 'update', 'employee', id)

  res.status(200).json(serialize(employee))
}

async function handler(req: AuthedRequest, res: VercelResponse) {
  const sub = typeof req.query.sub === 'string' ? req.query.sub : undefined

  if (!sub && req.method === 'GET') return handleList(req, res)
  if (!sub && req.method === 'POST') return handleCreate(req, res)
  if (sub === 'me' && req.method === 'GET') return handleMe(req, res)
  if (sub && sub !== 'me' && req.method === 'PUT') return handleUpdate(req, res, sub)

  res.status(404).json({ message: 'Not found' })
}

export default requireAuth(handler)
