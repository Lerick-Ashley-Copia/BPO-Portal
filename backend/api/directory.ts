import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { logAudit } from '../lib/audit.js'

// Combines teams + departments into one function (Vercel Hobby caps at
// 12 serverless functions per deployment) — both are small reference
// lists usually fetched together for dropdowns. GET is open to any
// authenticated user; POST (create) is Admin only ("Manage teams",
// "Manage departments" in bpo_plan.md's role definitions). Renaming and
// deleting aren't built yet — only creation.

const createDepartmentSchema = z.object({ kind: z.literal('department'), name: z.string().min(1) })
const createTeamSchema = z.object({
  kind: z.literal('team'),
  name: z.string().min(1),
  departmentId: z.string().uuid(),
})
const createSchema = z.discriminatedUnion('kind', [createDepartmentSchema, createTeamSchema])

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

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method === 'GET') return handleList(res)
  if (req.method === 'POST') return handleCreate(req, res)
  res.status(405).json({ message: 'Method not allowed' })
}

export default requireAuth(handler)
