import type { VercelResponse } from '@vercel/node'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { hashPassword } from '../lib/auth.js'
import { sendEmail } from '../lib/email.js'
import { requireAuth, type AuthedRequest } from '../lib/middleware.js'
import { logAudit } from '../lib/audit.js'
import { isNotFoundError } from '../lib/errors.js'

// Consolidated into one function (Vercel Hobby caps at 12 serverless
// functions per deployment): GET /users, POST /users, PUT /users/:id.
// The /:id sub-path is routed here via a vercel.json rewrite, arriving
// as ?sub=<id>. All admin-only.

const ROLES = ['employee', 'team_leader', 'manager', 'hr', 'admin'] as const
const SETUP_TOKEN_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  roles: z.array(z.enum(ROLES)).min(1),
})

const updateUserSchema = z.object({
  roles: z.array(z.enum(ROLES)).min(1),
})

const userSelect = { id: true, email: true, name: true, roles: true, passwordSet: true, createdAt: true } as const

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

async function handleList(res: VercelResponse) {
  const users = await prisma.user.findMany({ select: userSelect, orderBy: { name: 'asc' } })
  res.status(200).json(users)
}

async function handleCreate(req: AuthedRequest, res: VercelResponse) {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid email, name, or roles' })
    return
  }

  const { email, name, roles } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ message: 'A user with that email already exists' })
    return
  }

  // Placeholder hash: nobody can log in with a password until the setup
  // link below is used, since the random bytes are never revealed.
  const placeholderHash = await hashPassword(randomBytes(32).toString('hex'))

  const user = await prisma.user.create({
    data: { email, name, roles, passwordHash: placeholderHash, passwordSet: false },
  })

  const token = randomBytes(32).toString('base64url')
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS) },
  })

  const setupUrl = `${requireEnv('FRONTEND_URL')}/set-password?token=${token}`

  await sendEmail(
    email,
    'Set up your BPO Portal account',
    `<p>Hi ${name},</p>
     <p>An administrator created an account for you on the BPO Portal.</p>
     <p><a href="${setupUrl}">Click here to set your password</a> and log in. This link expires in 48 hours.</p>
     <p>If you weren't expecting this, you can ignore this email.</p>`,
  )

  logAudit(req.auth.sub, 'create', 'user', user.id)
  res.status(201).json({ id: user.id, email: user.email, name: user.name, roles: user.roles })
}

async function handleUpdate(req: AuthedRequest, res: VercelResponse, id: string) {
  const parsed = updateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid roles payload' })
    return
  }

  let user
  try {
    user = await prisma.user.update({ where: { id }, data: { roles: parsed.data.roles }, select: userSelect })
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ message: 'User not found' })
      return
    }
    throw err
  }

  logAudit(req.auth.sub, 'update_roles', 'user', id)
  res.status(200).json(user)
}

async function handler(req: AuthedRequest, res: VercelResponse) {
  const sub = typeof req.query.sub === 'string' ? req.query.sub : undefined

  if (!sub && req.method === 'GET') return handleList(res)
  if (!sub && req.method === 'POST') return handleCreate(req, res)
  if (sub && req.method === 'PUT') return handleUpdate(req, res, sub)

  res.status(404).json({ message: 'Not found' })
}

export default requireAuth(handler, { roles: ['admin'] })
