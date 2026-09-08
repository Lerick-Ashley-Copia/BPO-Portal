import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { hashPassword, signToken } from '../../lib/auth.js'
import { sendEmail } from '../../lib/email.js'
import { withCors } from '../../lib/middleware.js'
import { formatDisplayName } from '../../lib/names.js'

// Consolidated into one function (Vercel Hobby caps at 12 serverless
// functions per deployment): POST /auth/set-password (consume a token) and
// POST /auth/forgot-password (request a reset link) share this file, the
// latter routed here via a vercel.json rewrite arriving as ?action=forgot.

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

async function handleForgotPassword(req: VercelRequest, res: VercelResponse) {
  const parsed = forgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid email' })
    return
  }

  const { email } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })

  if (user) {
    const token = randomBytes(32).toString('base64url')
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    })

    const resetUrl = `${requireEnv('FRONTEND_URL')}/set-password?token=${token}`

    await sendEmail(
      email,
      'Reset your BPO Portal password',
      `<p>Hi ${user.firstName},</p>
       <p>We received a request to reset your BPO Portal password.</p>
       <p><a href="${resetUrl}">Click here to choose a new password</a>. This link expires in 1 hour.</p>
       <p>If you didn't request this, you can ignore this email — your password won't change.</p>`,
    )
  }

  // Same response whether or not the email is registered, so this
  // endpoint can't be used to enumerate accounts.
  res.status(200).json({ message: 'If that email is registered, a reset link is on its way.' })
}

async function handleSetPassword(req: VercelRequest, res: VercelResponse) {
  const parsed = setPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid request' })
    return
  }

  const { token, password } = parsed.data

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    res.status(400).json({ message: 'This link is invalid or has expired' })
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

  if (req.query.action === 'forgot') {
    await handleForgotPassword(req, res)
  } else {
    await handleSetPassword(req, res)
  }
}
