import type { VercelResponse } from '@vercel/node'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'

// Combines teams + departments into one function (Vercel Hobby caps at
// 12 serverless functions per deployment) — both are small reference
// lists usually fetched together for dropdowns.

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

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

export default requireAuth(handler)
