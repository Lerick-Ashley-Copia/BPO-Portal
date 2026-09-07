import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { hashPassword, signToken } from '../../lib/auth.js'
import { withCors } from '../../lib/middleware.js'
import { formatDisplayName } from '../../lib/names.js'

const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  withCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const parsed = setPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  const { token, password } = parsed.data

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    res.status(400).json({ message: 'This setup link is invalid or has expired' })
    return
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, passwordSet: true },
    })
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    })
    return updated
  })

  const jwt = signToken({ sub: user.id, email: user.email, roles: user.roles })

  res.status(200).json({
    token: jwt,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      name: formatDisplayName(user.firstName, user.middleName, user.lastName),
      roles: user.roles,
    },
  })
}
