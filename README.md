# BPO Portal

Internal portal for the BPO team. See [bpo_plan.md](./bpo_plan.md) for the full architecture and phased plan. (Working name — will rebrand to "JAE Philus Admin Portal" once approved.)

## Live

- Frontend: https://ashlerick.github.io/BPO-Portal/
- Backend: https://backend-xi-six-41.vercel.app

## Stack

- **Frontend** (`frontend/`) — React + Vite + TypeScript + Tailwind CSS, deployed to GitHub Pages
- **Backend** (`backend/`) — TypeScript serverless functions on Vercel, Prisma ORM
- **Database** — PostgreSQL via Neon (provisioned through Vercel's marketplace)
- **File storage** — Backblaze B2 (S3-compatible API — AWS S3 itself requires a credit card at signup, B2 doesn't)
- **Email** — Gmail API via OAuth (account setup links, not a shared third-party sender)
- **Auth** — JWT bearer tokens (frontend and backend run on different domains, so cookies aren't used)

## Repo layout

```text
frontend/   React SPA (GitHub Pages)
backend/    Vercel serverless API + Prisma schema
bpo_plan.md Full project plan
```

`frontend/` and `backend/` are independent npm projects (not a workspace) so each deploys cleanly to its own host.

## Environments

Production and local development use **separate** Postgres databases and S3 buckets (set up in Phase 8) — local testing can no longer touch real data:

| | Production/Preview | Development (local) |
|---|---|---|
| Database | Neon project `bpo-portal-...` (original) | Neon project `bpo-portal-dev` |
| File storage | B2 bucket `bpo-portal-lerick-2026` | B2 bucket `bpo-portal-lerick-2026-dev` |

Vercel keeps separate env var sets per environment (Production / Preview / Development) — see "Local development" below for pulling the development set.

## Local development

Easiest: double-click `start-all.bat` at the repo root — it opens the backend and frontend dev servers in separate windows. Or run them individually:

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
npx vercel link                                  # first time only, links to the Vercel project
npx vercel env pull .env.local --environment=development
cp .env.local .env
# then append ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME to .env for the seed script
npm install
npm run prisma:migrate   # creates tables from prisma/schema.prisma
npm run prisma:seed      # creates the first admin user + sample data
npm run local             # http://localhost:4310 (via `vercel dev`)
```

Fixed local ports (`4300` frontend, `4310` backend) are set with `strictPort` so a collision fails loudly instead of silently landing on a random port. The backend's dev script is named `local` rather than `dev` — Vercel CLI refuses to run if `package.json`'s `dev` script itself invokes `vercel dev` (a recursion guard).

**Managing env vars**: use `npx vercel env add/rm/ls <NAME> <environment>` from `backend/`. ⚠️ Vars added through a Marketplace integration connection (Neon) are stored as one record spanning all three environments — `vercel env rm <NAME> development` on one of these deletes it from **all** environments, not just development. Vars added individually via `vercel env add` (JWT_SECRET, S3_*, GMAIL_*, CORS_ORIGIN, FRONTEND_URL) don't have this problem and can be removed per-environment safely. When in doubt, check with `vercel env ls` first — a var listed as one row spanning multiple environments is the risky kind.

## Deploying changes

- **Frontend**: push to `main` with changes under `frontend/` — GitHub Actions builds and deploys to Pages automatically. Trigger manually with `gh workflow run deploy-frontend.yml` if needed (e.g. after only an env var change).
- **Backend**: no git integration — deploy manually from `backend/` with `npx vercel deploy --prod`.

## Status

All 8 phases in `bpo_plan.md` are done or substantially done, except:
- **Custom domain** — skipped for now (needs a purchased domain)
- **User acceptance testing** and **Production launch** — inherently yours to do, not something to automate

See `bpo_plan.md` section 26 for the full phase-by-phase checklist, including known gaps and simplifications called out honestly as they were found (e.g. Neon's free-tier 6-hour backup window, base Employee role not yet seeing Weekly Reports).
