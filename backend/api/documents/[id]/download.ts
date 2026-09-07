import type { VercelResponse } from '@vercel/node'
import { prisma } from '../../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../../lib/middleware.js'
import { getDownloadUrl } from '../../../lib/s3.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const id = req.query.id
  if (typeof id !== 'string') {
    res.status(400).json({ message: 'Invalid document id' })
    return
  }

  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) {
    res.status(404).json({ message: 'Document not found' })
    return
  }

  const allowed = doc.accessLevel === 'employee' || req.auth.roles.includes(doc.accessLevel)
  if (!allowed) {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }

  const url = await getDownloadUrl(doc.storageKey)
  res.status(200).json({ url })
}

export default requireAuth(handler)
