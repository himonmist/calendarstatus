# Security model

| Area | Control | Where |
|---|---|---|
| Private calendar data | Public API uses Google **freeBusy** (no titles ever fetched); public slot objects have only `start/end/available`; admin event titles only via authenticated `/api/admin/calendar` | `calendar/google.ts`, `availability.ts`, tests in `api.test.ts` |
| Authorization | Enforced in every admin handler (`handler({admin:true})`), not in the UI; middleware only improves UX | `server/http.ts` |
| Sessions | HS256 JWT, 8h, `HttpOnly; SameSite=Strict; Secure; __Host-` cookie, `alg` pinned | `security/session.ts` |
| Passwords | scrypt (N=16384) + constant-time compare; identical response/work for unknown email | `security/password.ts`, `admin/login` |
| Brute force | Login 5/15min/IP; booking lookup 10/15min/IP; reservations 20/10min/IP; bookings 10/10min/IP | `http.ts` rate option |
| CSRF | Origin must match host on all admin state changes; SameSite=Strict | `security/csrf.ts` |
| Token storage | Google refresh token AES-256-GCM encrypted at rest; never sent to the browser | `security/crypto.ts` |
| OAuth callback | Signed `state` (bound to admin) + HttpOnly nonce cookie | `security/state.ts` |
| Injection | All SQL parameterised; zod validation with length caps & control-char stripping; HTML email escaping; subject CRLF stripped | `pg-store.ts`, `validation.ts`, `email/templates.ts` |
| XSS / headers | React escaping; nonce-based CSP with `strict-dynamic`, HSTS, X-Frame-Options DENY, nosniff, Referrer/Permissions-Policy | `middleware.ts`, `next.config.mjs` |
| Double booking | Hold tokens (hashed, 10 min) → advisory-lock transaction → live Google re-check → DB exclusion constraint | `booking/service.ts`, `migrations/001_init.sql` |
| Error hygiene | Generic 500 + request id; no stack traces; calendar outage fails **closed** | `http.ts` |
| Audit | Admin actions, customer submissions, sync results with actor/IP/before/after | `audit_logs` |
| Cron | Constant-time Bearer check against `CRON_SECRET` | `server/cron-auth.ts` |

## Known limitations (be aware before launch)
- **Rate limiting is in-memory per serverless instance.** It slows casual abuse but is not a global limit; put Cloudflare/Vercel Firewall rate rules in front, or swap `RateLimiter` for a Redis (Upstash) implementation behind the same interface.
- Reservations/locking live in Postgres (not Redis). That is sufficient and consistent for this scale.
- Google push webhooks are not wired; freshness comes from a 60 s busy cache + mandatory live re-check at booking time + 30 min cron sync.
- `npm audit` reports advisories in the PostCSS copy bundled with Next 15 (build-time only, processes first-party CSS). Upgrade to Next 16 when ready.
- Single admin account (email + password). Add MFA / Google sign-in before granting access to others.
- No CAPTCHA on public forms; add Cloudflare Turnstile if you see spam.
