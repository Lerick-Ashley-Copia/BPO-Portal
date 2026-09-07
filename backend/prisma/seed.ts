import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/auth.js'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Admin'

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running the seed script')
  }

  const passwordHash = await hashPassword(password)

  const admin = await prisma.user.upsert({
    where: { email },
    update: { roles: ['admin'] },
    create: { email, name, passwordHash, roles: ['admin'] },
  })

  console.log(`Admin user ready: ${admin.email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
