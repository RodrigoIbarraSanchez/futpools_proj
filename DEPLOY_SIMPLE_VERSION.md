# Deploy simple_version → production

This branch (`simple_version`) reshapes FutPools into the paid-pool model
($50 MXN entries, Stripe Checkout, manual bank-transfer payouts). It is
ready to replace `master` on Render. Below are the **exact** steps + the
env vars Render needs.

The recommended path is **A: merge simple_version → master**. Master's
existing Render services auto-deploy and pick up the new code. Path B
(parallel deploy) is documented at the bottom for reference.

---

## Path A — replace master (recommended)

### 1. Render env vars (futpools-backend service)

Set / verify these in Render Dashboard → futpools-backend → Environment:

| Variable | Value | Notes |
|---|---|---|
| `MONGODB_URI` | (existing Atlas URI) | unchanged |
| `JWT_SECRET` | (existing secret) | unchanged |
| `API_FOOTBALL_KEY` | (existing) | unchanged |
| `STRIPE_SECRET_KEY` | `sk_live_…` (existing) | unchanged — same key serves coin-pack + pool checkout |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (existing prod webhook secret) | unchanged — see step 2 |
| `STRIPE_PRICE_50` ... `STRIPE_PRICE_500` | (existing) | unchanged — legacy coin packs stay on schema |
| `WEB_APP_BASE_URL` | `https://futpools.com` | **NEW** — Stripe redirects here after checkout. Without it the redirect lands on localhost:5174. |
| `FUTPOOLS_SIMPLE_MODE` | `true` | **NEW (optional)** — when set, master-mode legacy routes (`/payments`, `/challenges`, `/sweepstakes`, `/daily-pick`, `/tickets`, `/ads`) are unmounted and `POST /quinielas` requires admin. Leaving it `false` keeps both modes serveable from the same backend — useful if you want a soft rollout. |
| `NODE_ENV` | `production` | unchanged |
| `FRONTEND_URL` | `https://futpools.com` | unchanged |

### 2. Stripe webhook (no change needed if it already exists)

The pool-entry webhook reuses the same endpoint as the coin-pack webhook
— dispatch happens by `session.metadata` inside
`paymentsController.handleWebhook`:

- `metadata.poolId`  → `poolPaymentService.handleCheckoutCompleted` (pool entry)
- `metadata.packId`  → coin pack credit (master-mode legacy)

Verify in Stripe Dashboard → Developers → Webhooks → your live endpoint:

- URL: `https://api.futpools.com/payments/webhook`
- Events selected: `checkout.session.completed` ✓
- Signing secret: matches `STRIPE_WEBHOOK_SECRET` on Render

If you don't have a live webhook yet (only test mode via `stripe listen`
in dev), create one now:
1. **+ Add endpoint** → URL `https://api.futpools.com/payments/webhook`
2. Select event `checkout.session.completed`
3. Copy the `whsec_…` it generates → paste into Render's
   `STRIPE_WEBHOOK_SECRET`

### 3. Schema migration

None. All simple_version schema additions are additive with defaults:
- `User.deviceTokens[]` defaults to `[]`
- `User.notificationPrefs` defaults to `{ globalEnabled: true, mutedTeams: [], mutedPools: [] }`
- `Quiniela.entryFeeMXN` defaults to `50`
- `Quiniela.winnerPaidAt` defaults to `null`
- `Quiniela.rakePercent` default flipped 10 → 35 (only affects pools created AFTER deploy; existing pools keep their stored value)
- `QuinielaEntry.stripeSessionId` sparse unique index (no backfill needed)

Existing master-mode pools (legacy coin economy) keep working untouched
— `entryFeeMXN` defaults in but `getMyEntries`/leaderboards never read it
unless > 0.

### 4. Merge + deploy

```bash
git checkout master
git pull
git merge simple_version
git push origin master
```

Render's auto-deploy picks it up. Watch the deploy log in Render
Dashboard → futpools-backend → Logs for any startup errors. The web
service (Render static site) rebuilds in parallel via `npm run build`.

### 5. Smoke test (5 min)

After deploy completes:

1. **Health**: `curl https://api.futpools.com/health` → `{ok: true, mode: 'simple'}` (or `'master'` if `FUTPOOLS_SIMPLE_MODE` is unset, which is fine).
2. **Web landing**: open `https://futpools.com`. Hero says "GANA DINERO REAL". Nav "Jugar" button → `/onboarding`.
3. **Onboarding**: complete the 3 screens, click "CREAR CUENTA GRATIS" → lands on `/register`. Sign up with a real email.
4. **Admin pool create** (your account): account page → "Crear Quiniela" → pick 3 fixtures, $50 fee, public, submit.
5. **Pool join**: sign up a second test account (incognito), open the pool, pay $50 MXN with a real card. Wait for the Stripe redirect to `/pool/:id?paid=1`. Verify entry shows up in the leaderboard.
6. **Admin payouts**: original admin account → `/admin/payouts` (after the pool's fixtures wrap up, settlement happens within 1 minute of all-FT). Mark paid.

### 6. iOS TestFlight

1. Xcode → futpoolsapp scheme → Edit Scheme → Run → set Build Configuration to **Release**, Archive to **Release**.
2. **Verify Info.plist** has `FPApiBaseURL = https://api.futpools.com` for Release builds (it's hardcoded in `.xcconfig` or scheme env — check). Debug builds keep the local Mac IP.
3. **Product → Archive** → Distribute App → **App Store Connect** → Upload.
4. Wait for processing (~15 min) → TestFlight tab → invite testers.
5. Test on real device: scores, onboarding, join via web → see active pool banner.

---

## Path B — parallel deploy (if you want master to stay live)

Useful if you want to soft-launch simple_version on a subdomain
(`simple.futpools.com`) without touching `futpools.com`.

1. **Render Dashboard → New + → Web Service**
   - Repo: same repo
   - Branch: `simple_version`
   - Root directory: `futpools_backend`
   - Build: `npm install`
   - Start: `npm start`
   - Name: `futpools-backend-simple`
   - Env vars: same as Path A step 1
2. **Render Dashboard → New + → Static Site**
   - Repo: same
   - Branch: `simple_version`
   - Root directory: `futpools_web`
   - Build: `npm install && npm run build`
   - Publish: `dist`
   - Name: `futpools-web-simple`
3. **DNS**: point `simple.futpools.com` to `futpools-web-simple` (Cloudflare CNAME → render URL). Point `api-simple.futpools.com` to `futpools-backend-simple`. Update web `VITE_API_URL` env to point at the new backend.
4. **Stripe webhook**: add a SECOND webhook endpoint pointing at `https://api-simple.futpools.com/payments/webhook`. Each endpoint has its own `whsec_…` — paste into the new backend service's `STRIPE_WEBHOOK_SECRET`.
5. iOS: TestFlight build needs a separate scheme with `FPApiBaseURL = https://api-simple.futpools.com`.

After validation, swap DNS so `futpools.com` → `futpools-web-simple`, and retire the master services.

---

## Rollback

If something breaks in prod after Path A:

```bash
git revert <merge_commit_sha> -m 1
git push origin master
```

Render auto-deploys the revert. All simple_version schema additions are
back-compat with master code (they're just optional fields), so no DB
restore is needed.

---

## Open items / future Phase 7+8

Push notifications (Phase 7-8 of the original simple_version plan) are
**not** in this deploy. The schema fields are there (`User.deviceTokens`,
`notificationPrefs`) but the APNs sender service + iOS token plumbing
ship in a follow-up PR. Users won't see any push notifications until
that lands.

You'll need an APNs P8 cert from Apple Developer Portal before that
phase can ship.
