# AI Training Booking Platform

Public availability calendar + booking engine + Google Calendar sync + admin dashboard for an AI trainer/consultant.
Next.js 15 · React 19 · TypeScript · Tailwind · Zod · PostgreSQL · Google Calendar API · Vitest · Playwright.

```
Google Calendar ─► Google provider (server only) ─► Availability engine ─► Booking engine (holds, locks, re-validation) ─► Public UI / Admin UI
                                                                              └─► PostgreSQL (+ exclusion constraint) ─► Email provider
```

## Quick start
```bash
npm install
cp .env.example .env.local        # empty DATABASE_URL = in-memory demo mode (seeded programs + fake private calendar)
npm run dev
```
- Public: `/` · `/book-training` · `/manage` · `/custom-request`
- Admin: `/admin` (needs `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` via `npm run db:hash -- '<passphrase>'`, `NEXTAUTH_SECRET`)

## Tests (TDD — every module was written test-first)
```bash
npm test                 # 98 unit/integration tests (availability, time zones, booking race, security, API, Postgres SQL via PGlite, Google client w/ mocked fetch)
npm run build && CHROMIUM_PATH=/path/to/chrome npm run test:e2e   # 8 browser tests (desktop + mobile), incl. simultaneous booking
npm run typecheck
```

## Docs
[Google OAuth setup](docs/GOOGLE_OAUTH.md) · [Vercel deployment](docs/DEPLOYMENT.md) · [Security model & limitations](docs/SECURITY.md)

## API
Public: `GET /api/public/training-programs`, `GET /api/public/availability?program&month`, `GET /api/public/availability/:date?program`, `POST /api/public/reservations`, `POST /api/public/bookings`, `POST /api/public/bookings/:ref` (lookup; POST so email stays out of URLs), `POST …/:ref/reschedule`, `POST …/:ref/cancel`, `POST /api/public/custom-requests`.
Admin (session required): `dashboard`, `bookings`, `bookings/:id (PATCH)`, `calendar`, `calendar/{connect,callback,sync,status,calendars}`, `availability`, `blocked-dates`, `auto-confirm`, `programs`, `customers`, `custom-requests`, `audit`.
