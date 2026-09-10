import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { logAudit } from '../lib/audit.js'
import { isNotFoundError, isUniqueConstraintError } from '../lib/errors.js'

// Combines teams + departments into one function (Vercel Hobby caps at
// 12 serverless functions per deployment) — both are small reference
// lists usually fetched together for dropdowns. GET is open to any
// authenticated user; POST/PUT/DELETE (create/rename/delete) are Admin
// only ("Manage teams", "Manage departments" in bpo_plan.md's role
// definitions). PUT/DELETE are routed here via vercel.json rewrites as
// ?kind=department|team&sub=<id>.

const createDepartmentSchema = z.object({ kind: z.literal('department'), name: z.string().min(1) })
const createTeamSchema = z.object({
  kind: z.literal('team'),
  name: z.string().min(1),
  departmentId: z.string().uuid(),
})
const createSchema = z.discriminatedUnion('kind', [createDepartmentSchema, createTeamSchema])

const renameSchema = z.object({ name: z.string().min(1) })

async function handleList(res: VercelResponse) {
  const [teams, departments] = await Promise.all([
    prisma.team.findMany({ include: { department: true }, orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ])

  res.status(200).json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      departmentId: t.departmentId,
      department: t.department.name,
    })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
  })
}

async function handleCreate(req: AuthedRequest, res: VercelResponse) {
  if (!req.auth.roles.includes('admin')) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload' })
    return
  }

  if (parsed.data.kind === 'department') {
    const department = await prisma.department.create({ data: { name: parsed.data.name } })
    logAudit(req.auth.sub, 'create', 'department', department.id)
    res.status(201).json({ id: department.id, name: department.name })
    return
  }

  const team = await prisma.team.create({
    data: { name: parsed.data.name, departmentId: parsed.data.departmentId },
    include: { department: true },
  })
  logAudit(req.auth.sub, 'create', 'team', team.id)
  res.status(201).json({
    id: team.id,
    name: team.name,
    departmentId: team.departmentId,
    department: team.department.name,
  })
}

async function handleRename(req: AuthedRequest, res: VercelResponse, kind: 'department' | 'team', id: string) {
  if (!req.auth.roles.includes('admin')) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const parsed = renameSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload' })
    return
  }

  try {
    if (kind === 'department') {
      const department = await prisma.department.update({ where: { id }, data: { name: parsed.data.name } })
      logAudit(req.auth.sub, 'rename', 'department', id)
      res.status(200).json({ id: department.id, name: department.name })
      return
    }

    const team = await prisma.team.update({
      where: { id },
      data: { name: parsed.data.name },
      include: { department: true },
    })
    logAudit(req.auth.sub, 'rename', 'team', id)
    res.status(200).json({ id: team.id, name: team.name, departmentId: team.departmentId, department: team.department.name })
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ message: `${kind === 'department' ? 'Department' : 'Team'} not found` })
      return
    }
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ message: 'A department with that name already exists' })
      return
    }
    throw err
  }
}

async function handleDelete(req: AuthedRequest, res: VercelResponse, kind: 'department' | 'team', id: string) {
  if (!req.auth.roles.includes('admin')) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }

  if (kind === 'department') {
    const department = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { teams: true, employees: true } } },
    })
    if (!department) {
      res.status(404).json({ message: 'Department not found' })
      return
    }
    if (department._count.teams > 0 || department._count.employees > 0) {
      res.status(409).json({
        message: 'This department still has teams or employees assigned. Reassign them first.',
      })
      return
    }
    await prisma.department.delete({ where: { id } })
    logAudit(req.auth.sub, 'delete', 'department', id)
    res.status(204).end()
    return
  }

  const team = await prisma.team.findUnique({
    where: { id },
    include: { _count: { select: { employees: true, weeklyReports: true } } },
  })
  if (!team) {
    res.status(404).json({ message: 'Team not found' })
    return
  }
  if (team._count.employees > 0 || team._count.weeklyReports > 0) {
    res.status(409).json({
      message: 'This team still has employees or weekly reports attached. Reassign them first.',
    })
    return
  }
  await prisma.team.delete({ where: { id } })
  logAudit(req.auth.sub, 'delete', 'team', id)
  res.status(204).end()
}

async function handler(req: AuthedRequest, res: VercelResponse) {
  const kind = req.query.kind === 'team' ? 'team' : req.query.kind === 'department' ? 'department' : undefined
  const sub = typeof req.query.sub === 'string' ? req.query.sub : undefined

  if (!kind && req.method === 'GET') return handleList(res)
  if (!kind && req.method === 'POST') return handleCreate(req, res)
  if (kind && sub && req.method === 'PUT') return handleRename(req, res, kind, sub)
  if (kind && sub && req.method === 'DELETE') return handleDelete(req, res, kind, sub)

  res.status(405).json({ message: 'Method not allowed' })
}

export default requireAuth(handler)
