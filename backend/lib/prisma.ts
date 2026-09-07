import { PrismaClient } from '@prisma/client'

// Reuse the client across warm serverless invocations instead of
// opening a new connection pool on every request.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
