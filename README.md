# JAE Philus Admin Portal

Internal portal for the BPO team. See [bpo_plan.md](./bpo_plan.md) for the full architecture and phased plan. (Repo and infrastructure are still named `BPO-Portal`/`bpo-portal-*` — see note below.)

## Live

- Frontend: https://lerick-ashley-copia.github.io/BPO-Portal/
- Backend: https://backend-xi-six-41.vercel.app

## Stack

- **Frontend** (`frontend/`) — React + Vite + TypeScript + Tailwind CSS, deployed to GitHub Pages
- **Backend** (`backend/`) — TypeScript serverless functions on Vercel, Prisma ORM
- **Database** — PostgreSQL via Neon (provisioned through Vercel's marketplace)
- **File storage** — Backblaze B2 (S3-compatible API — AWS S3 itself requires a credit card at signup, B2 doesn't)
- **Auth** — JWT bearer tokens (frontend and backend run on different domains, so cookies aren't used)

## Repo layout

```text
frontend/   React SPA (GitHub Pages)
backend/    Vercel serverless API + Prisma schema
bpo_plan.md Full project plan
```

`frontend/` and `backend/` are independent npm projects (not a workspace) so each deploys cleanly to its own host.

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
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, S3_* (ask for real values, or provision your own)
npm install
npm run prisma:migrate # creates tables from prisma/schema.prisma
npm run prisma:seed    # creates the first admin user + sample data from ADMIN_EMAIL/ADMIN_PASSWORD
npm run local           # http://localhost:4310 (via `vercel dev`)
```

Fixed local ports (`4300` frontend, `4310` backend) are set with `strictPort` so a collision fails loudly instead of silently landing on a random port. The backend's dev script is named `local` rather than `dev` — Vercel CLI refuses to run if `package.json`'s `dev` script itself invokes `vercel dev` (a recursion guard).

## Deploying changes

- **Frontend**: push to `main` with changes under `frontend/` — GitHub Actions builds and deploys to Pages automatically. Trigger manually with `gh workflow run deploy-frontend.yml` if needed (e.g. after only an env var change).
- **Backend**: no git integration — deploy manually from `backend/` with `npx vercel deploy --prod`.

## Status

Phase 1 (foundation) and most of Phase 2 (authentication) are done — see `bpo_plan.md` section 26 for the full phase checklist. Dashboard, Announcements, and Benefits have real pages wired to the database; HRIS, Weekly Reports, and Documents are still placeholders (Phase 3 onward).

One known simplification: dev/preview/production currently share the same Neon database and B2 bucket. Fine for now; worth splitting before real HR data goes in.
