import { Prisma } from '@prisma/client'

// Prisma throws P2025 when update()/delete() targets a row that doesn't
// exist. Without catching it, that's an unhandled rejection — Vercel's
// platform safely turns it into a generic 500 (no internals leaked),
// but a routine "not found" shouldn't crash the function at all.
export function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'
}

// Prisma throws P2002 on a unique-constraint violation (e.g. renaming
// a department to a name another department already has).
export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}
