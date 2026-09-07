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

  if ((await prisma.announcement.count()) === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          title: 'Welcome to the BPO Portal',
          content:
            'This is the new home for team announcements, benefits, and reports. More modules are on the way.',
          authorId: admin.id,
          published: true,
          publishAt: new Date(),
        },
        {
          title: 'Holiday Schedule Posted',
          content: 'The updated holiday schedule for this quarter is now available under Documents.',
          authorId: admin.id,
          published: true,
          publishAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        },
        {
          title: 'Weekly Reports Due Fridays',
          content: 'Team leaders: weekly reports are due by end of day every Friday going forward.',
          authorId: admin.id,
          published: true,
          publishAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
        },
      ],
    })
    console.log('Seeded sample announcements')
  }

  if ((await prisma.benefit.count()) === 0) {
    await prisma.benefit.createMany({
      data: [
        {
          title: 'HMO Coverage',
          category: 'Health',
          description: 'Company-provided HMO covering the employee and up to two dependents.',
          eligibility: 'Regular employees after 3 months of tenure',
        },
        {
          title: 'Paid Time Off',
          category: 'Leave',
          description: '15 days of combined vacation and sick leave per year, convertible to cash at year-end.',
          eligibility: 'All employees',
        },
        {
          title: 'SSS, PhilHealth, Pag-IBIG',
          category: 'Government',
          description: 'Statutory government benefits remitted monthly on your behalf.',
          eligibility: 'All employees',
        },
        {
          title: 'Night Differential Pay',
          category: 'Allowances',
          description: 'Additional pay for hours worked between 10 PM and 6 AM per Philippine labor law.',
          eligibility: 'Employees on night shift schedules',
        },
      ],
    })
    console.log('Seeded sample benefits')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
