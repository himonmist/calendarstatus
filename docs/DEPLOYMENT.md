# Deploying to Vercel

## 1. Database (PostgreSQL)
Use Neon, Supabase or Vercel Postgres. Set `DATABASE_URL`, then apply the schema once:
```bash
DATABASE_URL=... npm run db:migrate     # runs migrations/*.sql in order (includes demo programs)
```
Migration 001 enables `btree_gist` (needed for the double-booking exclusion constraint).

## 2. Secrets
Generate and set in **Vercel → Settings → Environment Variables** (never commit them):
```bash
openssl rand -base64 48            # NEXTAUTH_SECRET
openssl rand -hex 32               # TOKEN_ENCRYPTION_KEY
openssl rand -base64 32            # CRON_SECRET (Vercel sends it as a Bearer token to cron routes)
npm run db:hash -- 'a-long-admin-passphrase'   # ADMIN_PASSWORD_HASH
```
Also: `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL` (https://your-domain), `GOOGLE_*` (see GOOGLE_OAUTH.md), `EMAIL_API_KEY` + `EMAIL_FROM` (Resend; verify your sending domain).

## 3. Deploy
Import the repo in Vercel (framework: Next.js). `vercel.json` registers two cron jobs:
- `/api/cron/reminders` hourly (24h and 1h reminders) — **Hobby plan only allows daily crons**; on Hobby, trigger this URL hourly from an external scheduler with header `Authorization: Bearer $CRON_SECRET`.
- `/api/cron/sync` every 30 min (calendar health + `last synchronized`).

## 4. Go-live checklist
- [ ] `npm test` and `npm run test:e2e` pass; `npm run build` succeeds
- [ ] Admin login works; **Google Calendar → Connect** succeeds; **Sync now** is healthy
- [ ] Create a test booking end-to-end; confirm the Google event appears and the emails arrive
- [ ] Cloudflare (optional) in front: SSL "Full (strict)", enable bot fight mode / rate rules on `/api/public/*`
- [ ] Set up Postgres backups; rotate `NEXTAUTH_SECRET` to invalidate all admin sessions if ever needed

## Local development
```bash
cp .env.example .env.local   # leave DATABASE_URL empty → in-memory demo store with seeded programs/bookings
npm install && npm run dev   # http://localhost:3000   (admin: set ADMIN_EMAIL + ADMIN_PASSWORD_HASH + NEXTAUTH_SECRET)
```
