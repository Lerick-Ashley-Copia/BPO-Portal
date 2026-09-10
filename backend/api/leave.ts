import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { logAudit } from '../lib/audit.js'
import { sendEmail } from '../lib/email.js'
import { inclusiveDayCount, minutesIntoManilaDay, todayInManila } from '../lib/dates.js'
import { buildAttendanceXlsx } from '../lib/attendanceReport.js'
import { getDownloadUrl, putObject } from '../lib/s3.js'
import { formatDisplayName } from '../lib/names.js'

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
  useSil: z.boolean().optional(),
})

const reviewLeaveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
})

async function handleListLeaveRequests(req: AuthedRequest, res: VercelResponse) {
  const where = isHrOrAdmin(req) ? {} : { employee: { userId: req.auth.sub } }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      employee: {
        include: { user: { select: { firstName: true, middleName: true, lastName: true, email: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.status(200).json(
    requests.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: formatDisplayName(r.employee.user.firstName, r.employee.user.middleName, r.employee.user.lastName),
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      reason: r.reason,
      useSil: r.useSil,
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
    data: {
      employeeId: employee.id,
      startDate,
      endDate,
      days,
      reason: parsed.data.reason,
      useSil: parsed.data.useSil ?? false,
    },
  })

  logAudit(req.auth.sub, 'create', 'leave_request', leaveRequest.id)

  const hrAndAdmins = await prisma.user.findMany({
    where: { roles: { hasSome: ['hr', 'admin'] } },
    select: { email: true, firstName: true },
  })
  const requesterName = req.auth.email
  for (const recipient of hrAndAdmins) {
    sendEmail(
      recipient.email,
      'New leave request submitted',
      `<p>Hi ${recipient.firstName},</p>
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
    if (action === 'approve' && leaveRequest.useSil) {
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

const CHECK_IN_WINDOW_START_MIN = 8 * 60 // 8:00 AM
const CHECK_IN_WINDOW_END_MIN = 17 * 60 + 30 // 5:30 PM

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

// Query params come in as plain YYYY-MM-DD strings (a single date, or
// the endpoints of a range — the frontend sends the same value for
// both when the user picks just one day). Parsed as UTC midnight to
// match how `date` is stored (see todayInManila()).
function parseDateRange(req: AuthedRequest): { gte: Date; lte: Date } | null {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined
  const to = typeof req.query.to === 'string' ? req.query.to : undefined
  if (!from && !to) return null
  const fromStr = from && dateOnlyPattern.test(from) ? from : undefined
  const toStr = to && dateOnlyPattern.test(to) ? to : fromStr
  if (!fromStr || !toStr) return null
  return { gte: new Date(`${fromStr}T00:00:00.000Z`), lte: new Date(`${toStr}T00:00:00.000Z`) }
}

function parseEmployeeFilter(req: AuthedRequest): { employeeId: string } | Record<string, never> {
  const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined
  return employeeId ? { employeeId } : {}
}

async function handleListAttendance(req: AuthedRequest, res: VercelResponse) {
  const scope = isHrOrAdmin(req) ? {} : { employee: { userId: req.auth.sub } }
  const range = parseDateRange(req)
  const where = { ...scope, ...parseEmployeeFilter(req), ...(range ? { date: range } : {}) }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: { employee: { include: { user: { select: { firstName: true, middleName: true, lastName: true } } } } },
    orderBy: [
      { date: 'desc' },
      { employee: { user: { lastName: 'asc' } } },
      { employee: { user: { firstName: 'asc' } } },
    ],
    take: range ? 1000 : 200,
  })

  res.status(200).json(
    records.map((r) => ({
      id: r.id,
      employeeName: formatDisplayName(r.employee.user.firstName, r.employee.user.middleName, r.employee.user.lastName),
      date: r.date,
      status: r.status,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
    })),
  )
}

async function handleExportAttendance(req: AuthedRequest, res: VercelResponse) {
  const range = parseDateRange(req)
  if (!range) {
    res.status(400).json({ message: 'from (and optionally to) is required, as YYYY-MM-DD' })
    return
  }

  const scope = isHrOrAdmin(req) ? {} : { employee: { userId: req.auth.sub } }
  const records = await prisma.attendanceRecord.findMany({
    where: { ...scope, ...parseEmployeeFilter(req), date: range },
    include: { employee: { include: { user: { select: { firstName: true, middleName: true, lastName: true } } } } },
    orderBy: [
      { date: 'asc' },
      { employee: { user: { lastName: 'asc' } } },
      { employee: { user: { firstName: 'asc' } } },
    ],
    take: 1000,
  })

  const buffer = await buildAttendanceXlsx(
    records.map((r) => ({
      date: r.date,
      employeeName: formatDisplayName(r.employee.user.firstName, r.employee.user.middleName, r.employee.user.lastName),
      status: r.status,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
    })),
  )

  const storageKey = `attendance-exports/${req.auth.sub}-${Date.now()}.xlsx`
  await putObject(
    storageKey,
    buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  const url = await getDownloadUrl(storageKey)

  logAudit(req.auth.sub, 'export', 'attendance', storageKey)
  res.status(200).json({ url })
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
    status: record?.status ?? null,
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

  const minutesNow = minutesIntoManilaDay()
  if (minutesNow < CHECK_IN_WINDOW_START_MIN || minutesNow > CHECK_IN_WINDOW_END_MIN) {
    res.status(400).json({ message: 'Check-in is only recorded between 8:00 AM and 5:30 PM' })
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
  res.status(201).json({ checkedIn: true, checkedOut: false, status: record.status, checkInAt: record.checkInAt, checkOutAt: null })
}

async function handleCheckOut(req: AuthedRequest, res: VercelResponse) {
  const employee = await myEmployee(req)
  if (!employee) {
    res.status(404).json({ message: 'No employee profile on file yet' })
    return
  }

  const date = todayInManila()
  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date } },
  })
  if (!existing || !existing.checkInAt) {
    res.status(400).json({ message: "You haven't checked in today yet" })
    return
  }

  const record = await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: { checkOutAt: new Date() },
  })

  logAudit(req.auth.sub, 'check_out', 'attendance', record.id)
  res.status(200).json({ checkedIn: true, checkedOut: true, status: record.status, checkInAt: record.checkInAt, checkOutAt: record.checkOutAt })
}

const markAbsentSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(dateOnlyPattern, 'date must be YYYY-MM-DD'),
})

// HR/admin override for a day the portal's auto check-in got wrong —
// e.g. someone logged in (and so got auto-checked-in) but was actually
// out that day. Overwrites whatever was on record for that date so the
// attendance report reflects reality instead of erroring or showing
// them as present.
async function handleMarkAbsent(req: AuthedRequest, res: VercelResponse) {
  if (!isHrOrAdmin(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }

  const parsed = markAbsentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  const { employeeId, date: dateStr } = parsed.data
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) {
    res.status(404).json({ message: 'Employee not found' })
    return
  }

  const date = new Date(`${dateStr}T00:00:00.000Z`)
  const record = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: { employeeId, date, status: 'absent', checkInAt: null, checkOutAt: null, markedBy: req.auth.sub },
    update: { status: 'absent', checkInAt: null, checkOutAt: null, markedBy: req.auth.sub },
  })

  logAudit(req.auth.sub, 'mark_absent', 'attendance', record.id)
  res.status(200).json({ id: record.id, employeeId: record.employeeId, date: record.date, status: record.status })
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
    if (sub === 'export' && req.method === 'GET') return handleExportAttendance(req, res)
    if (sub === 'mark-absent' && req.method === 'POST') return handleMarkAbsent(req, res)
  }

  res.status(404).json({ message: 'Not found' })
}

export default requireAuth(handler)
