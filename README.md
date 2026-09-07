# BPO Portal

Internal portal for the BPO team. See [bpo_plan.md](./bpo_plan.md) for the full architecture and phased plan.

## Stack

- **Frontend** (`frontend/`) — React + Vite + TypeScript + Tailwind CSS, deployed to GitHub Pages
- **Backend** (`backend/`) — TypeScript serverless functions on Vercel, Prisma ORM
- **Database** — Managed PostgreSQL (not yet provisioned)
- **File storage** — Amazon S3 (not yet provisioned)
- **Auth** — JWT bearer tokens (frontend and backend run on different domains, so cookies aren't used)

## Repo layout

```text
frontend/   React SPA (GitHub Pages)
backend/    Vercel serverless API + Prisma schema
bpo_plan.md Full project plan
```

`frontend/` and `backend/` are independent npm projects (not a workspace) so each deploys cleanly to its own host.

## Local development

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev   # http://localhost:4300
```

### Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm install
npm run prisma:migrate # creates tables from prisma/schema.prisma
npm run prisma:seed    # creates the first admin user from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev             # http://localhost:4310 (via `vercel dev`)
```

Fixed local ports (`4300` frontend, `4310` backend) are set with `strictPort` so a collision fails loudly instead of silently landing on a random port.

## Status

Phase 1 (foundation) in progress. No cloud resources (GitHub repo remote, Vercel project, Postgres, S3) are provisioned yet — see `bpo_plan.md` section 26 for the phase checklist.
