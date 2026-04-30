# App Store Review Notes — Futpools v2.4 (Tickets + Sweepstakes)

> **Audience**: Apple App Review reviewer evaluating Futpools' Tickets +
> sweepstakes flow against Apple Guideline 5.3 (Gaming, Gambling, and
> Lotteries).
>
> **Paste this content** into App Store Connect → App Information →
> "Review Notes" / "Notes for Reviewer" before each submission that
> changes the Tickets system.

---

## What Futpools is

A Mexican football pool ("quiniela") app where users predict 1/X/2 results
of Liga MX, Champions League, and other leagues. Two completely separate
in-app currencies, by design and enforced at the service layer:

1. **Coins** — purchasable via In-App Purchase (StoreKit 2). Used to enter
   peer-funded football pools (quinielas) where users pool entries and
   the winner takes the pot minus a 10% rake. **Coins NEVER convert to
   real money or to Tickets.** This is standard real-money-skill-game
   territory but with virtual-currency outputs only.

2. **Tickets** — earn-only virtual currency. **Cannot be purchased.**
   Earned exclusively through:
   - **Daily Pick check-in** (free, no purchase, no ad): predict the
     featured fixture once per day → +1 Ticket immediately, +1 bonus
     Ticket if the prediction was correct at full time.
   - **Rewarded ads** (free, no purchase): watch a video ad → +1 Ticket.
     Provided through Google AdMob with server-side verification.
   - Tickets are spent **only** on entries to the weekly Sweepstakes
     (real-world prize raffle).

The legal wall between the two economies is strict:
- `User.balance` (Coins) and `User.tickets` (Tickets) are separate fields.
- Two parallel ledger collections (`BalanceTransaction` vs
  `TicketTransaction`) with separate idempotency-keyed services.
- No code path converts between them.

## Why this is sweepstakes (5.3.1–5.3.2), not real-money gaming (5.3.4)

Per Apple's Review Guideline 5.3:

- **5.3.4** ("real money gaming, lotteries, or charitable
  fundraising"): requires explicit permits for *every* jurisdiction
  where the app is distributed, and crucially, prohibits using IAP
  for the entry currency. This is **not** Futpools.

- **5.3.2** (sweepstakes): explicitly permitted with conditions. Apple
  requires:
  - **AMOE** (Alternative Method of Entry) — a free, non-purchase path
    to a sweepstakes entry.
  - Full official rules ("bases del concurso") visible inside the app.
  - "Apple is not a sponsor" disclaimer in the rules.

Futpools meets **all three** of these requirements:

### AMOE — verifiable in code

A user can earn a sweepstakes entry without spending money or watching
ads. The Daily Pick check-in is gated only by the user opening the app
and tapping a 1/X/2 prediction — no purchase, no ad view required to
collect the +1 Ticket.

Math: 7 daily check-ins (one per day for a week) = 7 Tickets = exactly
1 sweepstakes entry. Free, deterministic, and visible in the
`/daily-pick/today` and `/daily-pick/today/predict` endpoints
(`futpools_backend/src/controllers/dailyPickController.js`).

The AMOE disclaimer is rendered:
- On every sweepstakes detail screen above the ENTER button (see
  `SweepstakesDetailView.swift` actionCard).
- In the embedded `ContestRulesView`, section 2 ("No purchase
  necessary").

### Full official rules embedded in-app

Tappable "View contest rules" link from every sweepstakes detail screen
opens a sheet with the complete bases del concurso, in both English and
Spanish. Sections: eligibility, AMOE, how to enter, prize, winner
selection, minimum participation, Apple disclaimer, operator info.

File: `futpoolsapp/futpoolsapp/Features/Sweepstakes/ContestRulesView.swift`

### "Apple is not a sponsor" disclaimer

Inside the rules, section 7 reads:

> "This sweepstakes is in no way sponsored, endorsed, administered by,
> or associated with Apple Inc."

Visible in both EN and ES localizations.

## Geo-restriction

Sweepstakes are restricted to Mexico (MX) for v2.4 launch. Enforced:
1. App Store: app is published on the MX storefront only at launch.
2. Backend: each sweepstakes has an `allowedCountries` array (default
   `['MX']`). The `/sweepstakes/:id/enter` endpoint refuses entries from
   users whose `countryCode` is not in the list (HTTP 403,
   `code: GEO_RESTRICTED`).
3. Registration: country picker on `RegisterView` defaults to MX.

The bases del concurso explicitly state eligibility is limited to legal
residents of Mexico aged 18 or older.

## Age gate

`User.dob` (date of birth) is collected at registration. Backend rejects
under-18 with HTTP 400 `code: UNDERAGE`. Sweepstakes entry endpoint
re-validates age at entry time as defense-in-depth.

`futpoolsapp/futpoolsapp/Features/Auth/RegisterView.swift` shows a
DatePicker; the form's submit button is disabled when the computed age
is below 18.

## Rewarded ads compliance

Google AdMob is the primary ad network. Reward UI explicitly says
"+1 Ticket", **not** "+1 sweepstakes entry" — what the user does with
their Tickets afterward is a separate, independent action.

This matches the documented model of long-running App Store apps using
the same pattern:
- **Mistplay** (App Store ID 6739352969) — earn virtual units from
  ads/games, redeem for real-world gift cards.
- **Skillz / Solitaire Cube** (App Store ID 1114214294) — real cash
  prize tournaments with rewarded ads.
- **Lucktastic** — sweepstakes entries directly tied to ad views.

Futpools' model is more conservative than Lucktastic's: ads give a
virtual currency the user *may then choose* to spend on a sweepstakes
entry. The two actions are separate — there is no UI affordance that
says "watch ad → enter sweepstakes".

## Server-side verification (SSV)

All ad-credit Tickets are gated by a signed callback from AdMob's
servers, verified against Google's rotating public keys before any
balance change.

Implementation: `futpools_backend/src/services/admobSSV.js`

## Key file paths the reviewer can audit

| Concern | File |
|---|---|
| Tickets-cannot-be-purchased wall | `futpools_backend/src/services/ticketService.js` (no IAP code path; mirrors `transactionService.js` but for tickets only) |
| Daily Pick AMOE earning | `futpools_backend/src/controllers/dailyPickController.js`, `futpools_backend/src/services/dailyPickService.js` |
| Sweepstakes entry endpoint with age + geo gates | `futpools_backend/src/controllers/sweepstakesController.js` |
| Bases del concurso (in-app rules) | `futpoolsapp/futpoolsapp/Features/Sweepstakes/ContestRulesView.swift` |
| Sweepstakes detail UI with AMOE disclaimer | `futpoolsapp/futpoolsapp/Features/Sweepstakes/SweepstakesDetailView.swift` (actionCard at the bottom of the file) |
| Age gate at registration | `futpools_backend/src/controllers/authController.js` (lines around the `dob` validation), `futpoolsapp/futpoolsapp/Features/Auth/RegisterView.swift` |
| Apple-not-a-sponsor disclaimer | `ContestRulesView.swift`, section "7. Apple disclaimer" |

## Test account for reviewer

| Field | Value |
|---|---|
| Email | `apple-reviewer@futpools.com` |
| Password | (provided in App Store Connect "Demo Account" field) |

This account has:
- Country: MX
- Date of birth set to a date 30 years ago (clears 18+ gate).
- A small Tickets balance pre-seeded so the reviewer can hit the ENTER
  button on the active sweepstakes without having to wait for ads to
  serve in the simulator.

## Operator entity

Sweepstakes are run by the legal entity registered in Mexico under the
Federal Law of Games and Raffles (LFJS). The relevant SEGOB permission
("Permiso de Sorteo con Fines Promocionales") is on file and can be
provided to App Review on request.

## Contact

For questions during review, contact: **rodrigoibarrasanchez@gmail.com**.
