import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import type { Prisma, ReportStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { logAudit } from '../lib/audit.js'
import { getDownloadUrl, putObject } from '../lib/s3.js'
import { buildCsv, buildPdf, buildXlsx, type ReportData } from '../lib/reports.js'

// GET /reports (list, role-scoped), POST /reports (create draft),
// PUT /reports/:id (lifecycle transitions, via a vercel.json rewrite
// arriving as ?sub=<id>), GET /reports/:id/export?format=csv|xlsx|pdf
// (also via a rewrite, arriving as ?sub=<id> with format still in the
// query string).

const reportDataSchema = z.object({
  client: z.string().optional(),
  headcount: z.number().optional(),
  attendance: z.string().optional(),
  productivity: z.string().optional(),
  qa: z.string().optional(),
  sla: z.string().optional(),
  performanceMetrics: z.string().optional(),
  issues: z.string().optional(),
  achievements: z.string().optional(),
  actionItems: z.string().optional(),
  managerComments: z.string().optional(),
})

const createSchema = z.object({
  teamId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  data: reportDataSchema.optional(),
})

const transitionSchema = z.object({
  action: z.enum(['save', 'submit', 'review', 'approve', 'reject', 'reopen']),
  data: reportDataSchema.optional(),
  comment: z.string().optional(),
})

function isReviewer(req: AuthedRequest): boolean {
  return req.auth.roles.some((r) => r === 'manager' || r === 'hr' || r === 'admin')
}

function isPrivileged(req: AuthedRequest): boolean {
  return req.auth.roles.some((r) => r === 'hr' || r === 'admin')
}

async function myTeamId(req: AuthedRequest): Promise<string | null> {
  const employee = await prisma.employee.findUnique({ where: { userId: req.auth.sub } })
  return employee?.teamId ?? null
}

async function canEditTeam(req: AuthedRequest, teamId: string): Promise<boolean> {
  if (isPrivileged(req)) return true
  if (!req.auth.roles.includes('team_leader')) return false
  return (await myTeamId(req)) === teamId
}

async function handleList(req: AuthedRequest, res: VercelResponse) {
  if (!req.auth.roles.some((r) => r === 'team_leader' || r === 'manager' || r === 'hr' || r === 'admin')) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }

  const where =
    req.auth.roles.includes('team_leader') && !isReviewer(req)
      ? { teamId: (await myTeamId(req)) ?? '__none__' }
      : {}

  const reports = await prisma.weeklyReport.findMany({
    where,
    include: { team: { include: { department: true } } },
    orderBy: { periodStart: 'desc' },
  })

  res.status(200).json(
    reports.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      team: r.team.name,
      department: r.team.department.name,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      status: r.status,
      submittedBy: r.submittedBy,
      data: r.data,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  )
}

async function handleCreate(req: AuthedRequest, res: VercelResponse) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid report payload' })
    return
  }

  const { teamId, periodStart, periodEnd, data } = parsed.data

  if (!(await canEditTeam(req, teamId))) {
    res.status(403).json({ message: 'You can only create reports for your own team' })
    return
  }

  const report = await prisma.weeklyReport.create({
    data: {
      teamId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      data: data ?? {},
    },
  })

  logAudit(req.auth.sub, 'create', 'weekly_report', report.id)
  res.status(201).json(report)
}

async function handleTransition(req: AuthedRequest, res: VercelResponse, id: string) {
  const parsed = transitionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request' })
    return
  }

  const report = await prisma.weeklyReport.findUnique({ where: { id } })
  if (!report) {
    res.status(404).json({ message: 'Report not found' })
    return
  }
  if (report.status === 'approved') {
    res.status(400).json({ message: 'Approved reports cannot be changed' })
    return
  }

  const { action, data, comment } = parsed.data
  const editableStatuses: ReportStatus[] = ['draft', 'rejected']

  let nextStatus: ReportStatus = report.status
  let nextData = report.data as ReportData
  let submittedBy = report.submittedBy

  if (action === 'save' || action === 'submit') {
    if (!editableStatuses.includes(report.status)) {
      res.status(400).json({ message: `Cannot edit a report with status "${report.status}"` })
      return
    }
    if (!(await canEditTeam(req, report.teamId))) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }
    if (data) nextData = { ...nextData, ...data }
    if (action === 'submit') {
      nextStatus = 'submitted'
      submittedBy = req.auth.sub
    }
  } else if (action === 'review') {
    if (report.status !== 'submitted') {
      res.status(400).json({ message: 'Only submitted reports can be reviewed' })
      return
    }
    if (!isReviewer(req)) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }
    nextStatus = 'reviewed'
  } else if (action === 'approve') {
    if (report.status !== 'reviewed') {
      res.status(400).json({ message: 'Only reviewed reports can be approved' })
      return
    }
    if (!isReviewer(req)) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }
    nextStatus = 'approved'
  } else if (action === 'reject') {
    if (report.status !== 'submitted' && report.status !== 'reviewed') {
      res.status(400).json({ message: 'Only submitted or reviewed reports can be rejected' })
      return
    }
    if (!isReviewer(req)) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }
    nextStatus = 'rejected'
    if (comment) nextData = { ...nextData, managerComments: comment }
  } else if (action === 'reopen') {
    if (report.status !== 'rejected') {
      res.status(400).json({ message: 'Only rejected reports can be reopened' })
      return
    }
    if (!(await canEditTeam(req, report.teamId))) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }
    nextStatus = 'draft'
  }

  const updated = await prisma.weeklyReport.update({
    where: { id },
    data: { status: nextStatus, data: nextData as Prisma.InputJsonValue, submittedBy },
  })

  logAudit(req.auth.sub, action, 'weekly_report', id)
  res.status(200).json(updated)
}

async function handleExport(req: AuthedRequest, res: VercelResponse, id: string) {
  if (!isReviewer(req) && !req.auth.roles.includes('team_leader')) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }

  const format = typeof req.query.format === 'string' ? req.query.format : 'csv'
  if (!['csv', 'xlsx', 'pdf'].includes(format)) {
    res.status(400).json({ message: 'format must be csv, xlsx, or pdf' })
    return
  }

  const report = await prisma.weeklyReport.findUnique({ where: { id }, include: { team: true } })
  if (!report) {
    res.status(404).json({ message: 'Report not found' })
    return
  }

  if (req.auth.roles.includes('team_leader') && !isReviewer(req)) {
    if ((await myTeamId(req)) !== report.teamId) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }
  }

  const input = {
    teamName: report.team.name,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    status: report.status,
    data: report.data as ReportData,
  }

  let buffer: Buffer
  let contentType: string
  if (format === 'csv') {
    buffer = buildCsv(input)
    contentType = 'text/csv'
  } else if (format === 'xlsx') {
    buffer = await buildXlsx(input)
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  } else {
    buffer = await buildPdf(input)
    contentType = 'application/pdf'
  }

  const storageKey = `reports/${format}/${report.id}-${Date.now()}.${format}`
  await putObject(storageKey, buffer, contentType)
  const url = await getDownloadUrl(storageKey)

  logAudit(req.auth.sub, 'export', 'weekly_report', id)
  res.status(200).json({ url })
}

async function handler(req: AuthedRequest, res: VercelResponse) {
  const sub = typeof req.query.sub === 'string' ? req.query.sub : undefined

  if (!sub && req.method === 'GET') return handleList(req, res)
  if (!sub && req.method === 'POST') return handleCreate(req, res)
  if (sub && req.method === 'PUT') return handleTransition(req, res, sub)
  if (sub && req.method === 'GET') return handleExport(req, res, sub)

  res.status(404).json({ message: 'Not found' })
}

export default requireAuth(handler)
