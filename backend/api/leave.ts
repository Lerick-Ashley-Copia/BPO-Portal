import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { logAudit } from '../lib/audit.js'
import { sendEmail } from '../lib/email.js'
import { isNotFoundError } from '../lib/errors.js'
import { inclusiveDayCount, todayInManila } from '../lib/dates.js'

// Consolidated into one function (Vercel Hobby caps at 12 serverless
// functions per deployment): leave requests + daily attendance
// check-in/out, routed here via vercel.json rewrites as
// ?resource=requests|attendance&sub=<id|today|checkin|checkout>.

function isHrOrAdmin(req: AuthedRequest): boolean {
  return req.auth.roles.includes('hr') || req.auth.roles.includes('admin')
}

async function myEmployee(req: AuthedRequest) {
  return prisma.employee.findUnique({ where: { userId: req.auth.sub } })
}

// ---- Leave requests ----

const createLeaveSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().optional(),
})

const reviewLeaveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
})

async function handleListLeaveRequests(req: AuthedRequest, res: VercelResponse) {
  const where = isHrOrAdmin(req) ? {} : { employee: { userId: req.auth.sub } }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: { employee: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { createdAt: 'desc' },
  })

  res.status(200).json(
    requests.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee.user.name,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      reason: r.reason,
      status: r.status,
      reviewComment: r.reviewComment,
      createdAt: r.createdAt,
    })),
  )
}

async function handleCreateLeaveRequest(req: AuthedRequest, res: VercelResponse) {
  const parsed = createLeaveSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid leave request payload' })
    return
  }

  const employee = await myEmployee(req)
  if (!employee) {
    res.status(404).json({ message: 'No employee profile on file — ask HR to set one up first' })
    return
  }

  const startDate = new Date(parsed.data.startDate)
  const endDate = new Date(parsed.data.endDate)
  if (endDate < startDate) {
    res.status(400).json({ message: 'End date cannot be before start date' })
    return
  }
  const days = inclusiveDayCount(startDate, endDate)

  const leaveRequest = await prisma.leaveRequest.create({
    data: { employeeId: employee.id, startDate, endDate, days, reason: parsed.data.reason },
  })

  logAudit(req.auth.sub, 'create', 'leave_request', leaveRequest.id)

  const hrAndAdmins = await prisma.user.findMany({
    where: { roles: { hasSome: ['hr', 'admin'] } },
    select: { email: true, name: true },
  })
  const requesterName = req.auth.email
  for (const recipient of hrAndAdmins) {
    sendEmail(
      recipient.email,
      'New leave request submitted',
      `<p>Hi ${recipient.name},</p>
       <p>${requesterName} submitted a leave request for ${days} day(s), from ${startDate.toDateString()} to ${endDate.toDateString()}.</p>
       <p>Review it in the BPO Portal under Leave Requests.</p>`,
    )
  }

  res.status(201).json(leaveRequest)
}

async function handleReviewLeaveRequest(req: AuthedRequest, res: VercelResponse, id: string) {
  if (!isHrOrAdmin(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }

  const parsed = reviewLeaveSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid review payload' })
    return
  }

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } })
  if (!leaveRequest) {
    res.status(404).json({ message: 'Leave request not found' })
    return
  }
  if (leaveRequest.status !== 'pending') {
    res.status(400).json({ message: 'This request has already been reviewed' })
    return
  }

  const { action, comment } = parsed.data
  const nextStatus = action === 'approve' ? 'approved' : 'rejected'

  const updated = await prisma.$transaction(async (tx) => {
    if (action === 'approve') {
      await tx.employee.update({
        where: { id: leaveRequest.employeeId },
        data: { silBalance: { decrement: leaveRequest.days } },
      })
    }
    return tx.leaveRequest.update({
      where: { id },
      data: { status: nextStatus, reviewedBy: req.auth.sub, reviewComment: comment },
    })
  })

  logAudit(req.auth.sub, action, 'leave_request', id)
  res.status(200).json(updated)
}

// ---- Attendance ----

async function handleListAttendance(req: AuthedRequest, res: VercelResponse) {
  const where = isHrOrAdmin(req) ? {} : { employee: { userId: req.auth.sub } }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: { employee: { include: { user: { select: { name: true } } } } },
    orderBy: { date: 'desc' },
    take: 200,
  })

  res.status(200).json(
    records.map((r) => ({
      id: r.id,
      employeeName: r.employee.user.name,
      date: r.date,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
    })),
  )
}

async function handleAttendanceToday(req: AuthedRequest, res: VercelResponse) {
  const employee = await myEmployee(req)
  if (!employee) {
    res.status(404).json({ message: 'No employee profile on file yet' })
    return
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: todayInManila() } },
  })

  res.status(200).json({
    checkedIn: !!record,
    checkedOut: !!record?.checkOutAt,
    checkInAt: record?.checkInAt ?? null,
    checkOutAt: record?.checkOutAt ?? null,
  })
}

async function handleCheckIn(req: AuthedRequest, res: VercelResponse) {
  const employee = await myEmployee(req)
  if (!employee) {
    res.status(404).json({ message: 'No employee profile on file yet' })
    return
  }

  const date = todayInManila()
  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date } },
  })
  if (existing) {
    res.status(400).json({ message: 'Already checked in today' })
    return
  }

  const record = await prisma.attendanceRecord.create({
    data: { employeeId: employee.id, date, checkInAt: new Date() },
  })
  logAudit(req.auth.sub, 'check_in', 'attendance', record.id)
  res.status(201).json({ checkedIn: true, checkedOut: false, checkInAt: record.checkInAt, checkOutAt: null })
}

async function handleCheckOut(req: AuthedRequest, res: VercelResponse) {
  const employee = await myEmployee(req)
  if (!employee) {
    res.status(404).json({ message: 'No employee profile on file yet' })
    return
  }

  const date = todayInManila()
  let record
  try {
    record = await prisma.attendanceRecord.update({
      where: { employeeId_date: { employeeId: employee.id, date } },
      data: { checkOutAt: new Date() },
    })
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(400).json({ message: "You haven't checked in today yet" })
      return
    }
    throw err
  }

  logAudit(req.auth.sub, 'check_out', 'attendance', record.id)
  res.status(200).json({ checkedIn: true, checkedOut: true, checkInAt: record.checkInAt, checkOutAt: record.checkOutAt })
}

async function handler(req: AuthedRequest, res: VercelResponse) {
  const resource = typeof req.query.resource === 'string' ? req.query.resource : undefined
  const sub = typeof req.query.sub === 'string' ? req.query.sub : undefined

  if (resource === 'requests') {
    if (!sub && req.method === 'GET') return handleListLeaveRequests(req, res)
    if (!sub && req.method === 'POST') return handleCreateLeaveRequest(req, res)
    if (sub && req.method === 'PUT') return handleReviewLeaveRequest(req, res, sub)
  }

  if (resource === 'attendance') {
    if (!sub && req.method === 'GET') return handleListAttendance(req, res)
    if (sub === 'today' && req.method === 'GET') return handleAttendanceToday(req, res)
    if (sub === 'checkin' && req.method === 'POST') return handleCheckIn(req, res)
    if (sub === 'checkout' && req.method === 'POST') return handleCheckOut(req, res)
  }

  res.status(404).json({ message: 'Not found' })
}

export default requireAuth(handler)
