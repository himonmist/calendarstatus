# Google OAuth & Calendar setup

The app talks to Google **only from the server**. Refresh tokens are encrypted (AES-256-GCM) before they touch the database and are never sent to the browser.

## 1. Create the Google Cloud project
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **OAuth consent screen** → External (or Internal for Workspace) → add your email as a test user. Scopes used:
   - `https://www.googleapis.com/auth/calendar.events` – create/update/delete the booking events
   - `https://www.googleapis.com/auth/calendar.freebusy` – busy/free only (no titles) for the public calendar
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly` – choose which calendars count as "busy"
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorized redirect URI (must match exactly):
   `https://YOUR-DOMAIN/api/admin/calendar/callback`  (and `http://localhost:3000/api/admin/calendar/callback` for dev)
5. Copy the client ID/secret into `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and set `GOOGLE_REDIRECT_URI`.

> While the consent screen is in "Testing", Google expires refresh tokens after 7 days. Publish the app (or use Workspace *Internal*) for a durable connection.

## 2. Connect
Sign in at `/admin/login` → **Google Calendar → Connect Google Calendar**. The flow uses a signed, 10-minute `state` bound to your admin session plus an HttpOnly nonce cookie, so a forged callback is rejected.

## 3. Troubleshooting
| Symptom | Fix |
|---|---|
| `redirect_uri_mismatch` | Redirect URI in Google Console differs from `GOOGLE_REDIRECT_URI` (scheme, host, path). |
| "needs to be re-authorized" | Token revoked/expired → **Reconnect Google Calendar**. |
| No refresh token returned | Remove the app at https://myaccount.google.com/permissions and reconnect (the app always requests `prompt=consent`). |
