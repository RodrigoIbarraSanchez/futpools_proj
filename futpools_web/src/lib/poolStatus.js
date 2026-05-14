// Pool status + join-eligibility helpers.
//
// Single source of truth for *all* "is this pool joinable?" and "what
// status badge do we show?" decisions. Mobile Home, HomeDesktop, and
// PoolDetail used to each have their own logic with subtly different
// rules (see bug 2026-05-14: a pool whose fixtures had FT statuses but
// missing kickoff dates appeared as OPEN on Home and the JOIN button
// stayed enabled, even though the backend rejected the checkout).
//
// Rules (must stay aligned with backend's poolPaymentService.firstKickoff
// + Quiniela.settlementStatus):
//   • A pool is JOINABLE iff EVERY fixture has a future kickoff AND no
//     fixture is in a finished/cancelled status. Either condition alone
//     is enough to lock the pool.
//   • Status priority for the badge:
//       'live'      — at least one fixture is currently in-play (1H/HT/2H/ET/BT/P)
//       'completed' — settled/explicit-completed OR every fixture is final OR
//                     endDate is in the past
//       'open'      — joinable per the rule above
//       'upcoming'  — startDate is still in the future (sub-state of joinable)
//
//   Anything that's "past first kickoff but not yet all-final" falls into
//   'live' — that's the in-progress bucket. Joining is closed there.

const LIVE_STATUS_CODES = new Set([
  '1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT',
]);
const FINISHED_STATUS_CODES = new Set([
  'FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO',
]);

const norm = (s) => String(s || '').toUpperCase();
const isLiveCode = (s) => LIVE_STATUS_CODES.has(norm(s));
const isFinishedCode = (s) => FINISHED_STATUS_CODES.has(norm(s));

/**
 * Returns true if the user can submit a new entry for this pool.
 *
 * Mirrors the backend's POOL_STARTED gate (poolPaymentService.js) plus a
 * defensive check on fixture statuses for cases where kickoff dates were
 * never populated or were stale (the original bug).
 */
export function canJoinPool(quiniela, liveFixtures = {}) {
  if (!quiniela || !Array.isArray(quiniela.fixtures) || quiniela.fixtures.length === 0) {
    return false;
  }
  if (quiniela.status === 'completed' || quiniela.settlementStatus === 'settled') {
    return false;
  }
  const now = Date.now();
  if (quiniela.endDate && new Date(quiniela.endDate).getTime() < now) {
    return false;
  }
  for (const f of quiniela.fixtures) {
    // Pool's own snapshot of fixture status (set when the pool was
    // refreshed from the football provider). Authoritative for "is this
    // already done" even if `kickoff` is missing or stale.
    if (isFinishedCode(f.status) || isLiveCode(f.status)) return false;
    // Live polling overlay (Home polls /football/fixtures every 30s and
    // overlays current status into liveFixtures map). If polling shows
    // the fixture as in-play or final, lock the pool too.
    const live = liveFixtures[f.fixtureId];
    if (live?.status?.short && (isLiveCode(live.status.short) || isFinishedCode(live.status.short))) {
      return false;
    }
    // Finally, kickoff time. A future kickoff with no live/finished
    // signal anywhere = still joinable.
    const kick = f.kickoff ? new Date(f.kickoff) : null;
    if (kick && kick.getTime() <= now) return false;
  }
  return true;
}

/**
 * Returns one of: 'live' | 'completed' | 'upcoming' | 'open'.
 *
 * Status badges in the UI should only ever come from this — the legacy
 * `q.status` field is unreliable (often empty string).
 */
export function resolvePoolStatus(quiniela, liveFixtures = {}) {
  if (!quiniela) return 'completed';
  const fixtures = Array.isArray(quiniela.fixtures) ? quiniela.fixtures : [];
  const now = Date.now();

  // 1) Anything currently in-play wins.
  for (const f of fixtures) {
    if (isLiveCode(f.status)) return 'live';
    const live = liveFixtures[f.fixtureId];
    if (live?.status?.short && isLiveCode(live.status.short)) return 'live';
  }

  // 2) Explicit completion signals.
  if (quiniela.status === 'completed' || quiniela.settlementStatus === 'settled') {
    return 'completed';
  }
  if (quiniela.endDate && new Date(quiniela.endDate).getTime() < now) return 'completed';

  // 3) Every fixture finalised → completed (covers the pool whose
  //    settlementStatus hasn't flipped yet, e.g. the bug case).
  if (fixtures.length > 0 && fixtures.every((f) => isFinishedCode(f.status))) {
    return 'completed';
  }

  // 4) Some fixture has kicked off (past) but not all are done → 'live'
  //    bucket. Joining is closed here even without a live status code,
  //    because at least one match has started.
  if (fixtures.some((f) => f.kickoff && new Date(f.kickoff).getTime() <= now)) {
    return 'live';
  }

  // 5) startDate in the future → upcoming (still joinable).
  if (quiniela.startDate && new Date(quiniela.startDate).getTime() > now) {
    return 'upcoming';
  }

  return 'open';
}
