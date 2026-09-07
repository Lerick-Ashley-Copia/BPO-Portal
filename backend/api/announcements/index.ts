import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'
import { logAudit } from '../../lib/audit.js'

// GET /announcements, POST /announcements (create), PUT/DELETE
// /announcements/:id (via a vercel.json rewrite arriving as ?sub=<id>).
// Create/update/delete are HR/Admin only ("Publish HR announcements" /
// "Manage portal content" in bpo_plan.md's role definitions).

const upsertSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  published: z.boolean().optional(),
  publishAt: z.string().datetime().optional(),
  expireAt: z.string().datetime().nullable().optional(),
})

function isManager(req: AuthedRequest): boolean {
  return req.auth.roles.includes('hr') || req.auth.roles.includes('admin')
}

async function handleList(req: AuthedRequest, res: VercelResponse) {
  const where = isManager(req)
    ? {}
    : { published: true, OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }] }

  const announcements = await prisma.announcement.findMany({ where, orderBy: { publishAt: 'desc' } })
  res.status(200).json(announcements)
}

async function handleCreate(req: AuthedRequest, res: VercelResponse) {
  if (!isManager(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const parsed = upsertSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid announcement payload' })
    return
  }

  const { title, content, published, publishAt, expireAt } = parsed.data
  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
      authorId: req.auth.sub,
      published: published ?? false,
      publishAt: publishAt ? new Date(publishAt) : new Date(),
      expireAt: expireAt ? new Date(expireAt) : null,
    },
  })

  logAudit(req.auth.sub, 'create', 'announcement', announcement.id)
  res.status(201).json(announcement)
}

async function handleUpdate(req: AuthedRequest, res: VercelResponse, id: string) {
  if (!isManager(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const parsed = upsertSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid announcement payload' })
    return
  }

  const { title, content, published, publishAt, expireAt } = parsed.data
  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(published !== undefined && { published }),
      ...(publishAt !== undefined && { publishAt: new Date(publishAt) }),
      ...(expireAt !== undefined && { expireAt: expireAt ? new Date(expireAt) : null }),
    },
  })

  logAudit(req.auth.sub, 'update', 'announcement', id)
  res.status(200).json(announcement)
}

async function handleDelete(req: AuthedRequest, res: VercelResponse, id: string) {
  if (!isManager(req)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  await prisma.announcement.delete({ where: { id } })
  logAudit(req.auth.sub, 'delete', 'announcement', id)
  res.status(204).end()
}

async function handler(req: AuthedRequest, res: VercelResponse) {
  const sub = typeof req.query.sub === 'string' ? req.query.sub : undefined

  if (!sub && req.method === 'GET') return handleList(req, res)
  if (!sub && req.method === 'POST') return handleCreate(req, res)
  if (sub && req.method === 'PUT') return handleUpdate(req, res, sub)
  if (sub && req.method === 'DELETE') return handleDelete(req, res, sub)

  res.status(404).json({ message: 'Not found' })
}

export default requireAuth(handler)
