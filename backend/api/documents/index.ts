import type { VercelResponse } from '@vercel/node'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, type AuthedRequest } from '../../lib/middleware.js'

async function handler(req: AuthedRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const documents = await prisma.document.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  })

  const visible = documents.filter(
    (doc) => doc.accessLevel === 'employee' || req.auth.roles.includes(doc.accessLevel),
  )

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

export default requireAuth(handler)
