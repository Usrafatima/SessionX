# Production Notification Scheduling — External Scheduler Setup

Trading Time Pro needs minute-level execution to deliver the 10 / 5 / 1 / 0-minute
reminders. **Vercel Hobby cannot do this with Vercel Cron**: the Hobby plan limits
cron jobs to **once per day**, and any more frequent expression (including the
previous `* * * * *`) **fails deployment** with:

> *Hobby accounts are limited to daily cron jobs. This cron expression would run
> more than once per day.*

See <https://vercel.com/docs/cron-jobs/usage-and-pricing>.

**Solution:** an external (free) scheduler calls the existing production endpoint
`GET /api/cron/notifications` once per minute. Nothing else changes — the endpoint,
FCM delivery, service worker, notification history, deduplication, preferences, and
event matching are untouched. The scheduler only needs to fire a single
authenticated HTTP GET.

---

## 1. The endpoint

| | |
|---|---|
| Method | `GET` |
| Path | `/api/cron/notifications` |
| Production URL | `https://<YOUR-PROJECT>.vercel.app/api/cron/notifications` |
| Schedule | every minute (`*/1 * * * *`) |
| Runtime | Node.js, `force-dynamic`, `maxDuration = 60` |

What each invocation does: reads the trading schedule, matches every reminder trigger
(10 / 5 / 1 / 0 minutes before each event) that became due since the last run, applies
per-user preferences, enforces deduplication (per `token:eventId:reminder`), sends FCM
pushes to all eligible tokens, writes Recent-Notifications history, and updates
`cronState/notifications.lastCheckedAt`.

## 2. Authentication (CRON_SECRET)

The endpoint is protected by the `CRON_SECRET` environment variable. Send it as a
bearer token:

```
Header:  Authorization: Bearer <CRON_SECRET>
```

where `<CRON_SECRET>` is the exact value configured in Vercel
(**Settings → Environment Variables → Production → `CRON_SECRET`**).

Behavior:

- Missing/incorrect secret → **401** `{"error":"Unauthorized"}` — nothing runs.
- Correct secret → **200** with the run result JSON.
- `Authorization: <CRON_SECRET>` (without `Bearer`) is also accepted for schedulers
  that only allow plain header values.
- `x-vercel-cron: 1` is additionally accepted without a secret, but only Vercel Cron
  (Pro/Enterprise) can send that legitimately; the external scheduler must use the
  Authorization header.
- If `CRON_SECRET` is **not set** in the environment, the route logs
  `CRON_SECRET not set — endpoint is UNAUTHENTICATED` and runs without auth. **Always
  set it in production.**

## 3. Required Vercel Production environment variables

Set these in Vercel (names only — never commit values):

- `CRON_SECRET`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` (paste with `\n` line breaks, as in `.env`)
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
  `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (browser-side config)

If the Firebase Admin variables are missing, the route returns **503**.

## 4. Exact scheduler configuration

### Option A — cron-job.org (recommended: free, minutely, custom headers)

1. Create a free account at <https://cron-job.org>.
2. **New cron job**:
   - **Job name:** `Trading Time Pro notifications`
   - **URL:** `https://<YOUR-PROJECT>.vercel.app/api/cron/notifications`
   - **Method:** `GET`
   - **Execution / schedule:** every minute (cron expression `*/1 * * * *`).
   - **Headers** (cron-job.org supports arbitrary custom headers on the free plan):
     - Name: `Authorization`
     - Value: `Bearer <CRON_SECRET>`
3. Save. The job now fires every minute.

### Option B — GitHub Actions (secondary; schedule is best-effort)

A ready workflow is included at `.github/workflows/cron-notifications.yml`. Add
`CRON_SECRET` as a repository secret (Settings → Secrets and variables → Actions) and
set `CRON_URL` as a repository variable to the production URL.

Caveats: GitHub schedules are *best-effort* and can be delayed 10–40 minutes, which
degrades reminder timing (an event may arrive late; the 30-minute push-freshness
window absorbs short delays). On **private** repos the ~43,200 monthly runs exceed the
free Actions minutes — use it only on a public repo, or use cron-job.org instead.

### Option C — any other scheduler

Any service that can send an HTTP GET with a custom `Authorization` header every
minute works: EasyCron, FastCron, QStash (free tier), UptimeRobot (if it sends
headers), a home server `cron` entry, etc.

## 5. Verifying it is actually running in production

Do **not** trust a one-off manual request. Confirm the scheduler is genuinely
invoking the endpoint every minute:

1. **Firestore:** `cronState` collection → document `notifications` →
   `lastCheckedAt`. It must be **seconds old** whenever you look (the route writes it
   on every successful run, including runs where nothing was due).
2. **Vercel Function Logs** (Vercel dashboard → your project → Logs): every minute you
   should see a pair of lines:
   ```
   [cron/notifications] run start {"now":"...","lastCheckedAt":"...",...}
   [cron/notifications] run complete {"ok":true,"sent":0,"matched":0,...}
   ```
3. **401s in the logs** = the scheduler is calling but with a wrong/missing secret.

## 6. Re-enabling Vercel Cron (only on Pro/Enterprise)

On a Pro plan Vercel Cron supports once-per-minute and the previous config can be
restored in `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/notifications", "schedule": "* * * * *" }]
}
```

Both Vercel Cron and an external scheduler can then call the same endpoint safely —
the per-`token:eventId:reminder` delivery claims and the deterministic history IDs
prevent double delivery. (The current repo keeps `vercel.json` as `{}` so the project
deploys on Hobby.)

## 7. Status

Verified (local, against a production build): the endpoint under the exact
external-scheduler contract — `GET` + `Authorization: Bearer <CRON_SECRET>` → 200,
no/incorrect secret → 401, `x-vercel-cron: 1` → 200, and runs with nothing due return
`matched: 0 / sent: 0` while still advancing `cronState`.

Not yet verified: the **deployed** endpoint being invoked automatically by an external
scheduler, and closed-browser/system push on a real device. Those are confirmed only
by the checks in section 5 after the scheduler is configured and deployed.
