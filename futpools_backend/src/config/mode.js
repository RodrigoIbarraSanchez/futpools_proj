/**
 * simple_version vs master mode switch.
 *
 * The same backend codebase serves two products:
 *  - master (legacy): coins + tickets + 1v1 challenges + sweepstakes + IAP
 *    coin shop. POST /quinielas open to any authenticated user.
 *  - simple (this branch): paid pools only ($50 MXN via Stripe), no coins,
 *    no tickets, no challenges, no sweepstakes. POST /quinielas
 *    admin-only.
 *
 * The legacy default is intentional — set FUTPOOLS_SIMPLE_MODE=true on the
 * simple_version Render service. Local dev defaults to legacy unless the
 * .env explicitly enables it.
 *
 * This single source of truth keeps gating decisions out of `app.js` and
 * controllers; they import `isSimpleMode()` and branch.
 */
const isSimpleMode = () => process.env.FUTPOOLS_SIMPLE_MODE === 'true';

module.exports = { isSimpleMode };
