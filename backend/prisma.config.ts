import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

// Local dev reads DATABASE_URL etc. from .env; on Vercel these are
// injected directly into process.env and no .env file is present.
if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
