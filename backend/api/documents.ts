import type { VercelResponse } from '@vercel/node'
import { prisma } from '../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { getDownloadUrl } from '../lib/s3.js'
import type { Role } from '@prisma/client'

// Consolidated into one function (Vercel Hobby caps at 12 serverless
// functions per deployment): GET /documents, GET /documents/:id/download.
// The /:id/download sub-path is routed here via a vercel.json rewrite,
// arriving as ?sub=<id>.

function canAccess(req: AuthedRequest, accessLevel: Role): boolean {
  return accessLevel === 'employee' || req.auth.roles.includes(accessLevel)
}

async function handleList(req: AuthedRequest, res: VercelResponse) {
  const documents = await prisma.document.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  })

  const visible = documents.filter((doc) => canAccess(req, doc.accessLevel))

  res.status(200).json(
    visible.map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category.name,
      accessLevel: doc.accessLevel,
      createdAt: doc.createdAt,
    })),
  )
}

async function handleDownload(req: AuthedRequest, res: VercelResponse, id: string) {
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) {
    res.status(404).json({ message: 'Document not found' })
    return
  }

  if (!canAccess(req, doc.accessLevel)) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }

  const url = await getDownloadUrl(doc.storageKey)
  res.status(200).json({ url })
}

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const sub = typeof req.query.sub === 'string' ? req.query.sub : undefined

  if (!sub) return handleList(req, res)
  return handleDownload(req, res, sub)
}

export default requireAuth(handler)
