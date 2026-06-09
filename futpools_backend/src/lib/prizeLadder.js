/**
 * Prize-ladder helpers — the single source of truth for the
 * "Escalera de Premios" (prize_ladder) pool type, where each
 * participant wins a fixed prize based on how many correct picks
 * ("aciertos") they have, instead of competing for a single pot.
 *
 * A ladder is an array of range tiers:
 *   { min, max, prizeMXN, label? }
 * meaning "if your correct-pick count is between min and max
 * (inclusive), you win prizeMXN pesos". Ranges let the spec's
 * "1–7 aciertos → $0" collapse into one tier, and the consolation
 * "0 aciertos → $100" sit below the dead zone — the ladder is
 * intentionally NOT monotonic, so lookups never assume ordering.
 *
 * Shared verbatim by the backend (settlement + leaderboard +
 * create validation). The web/iOS clients mirror prizeForCorrect /
 * nextPrizeTier so they can render the live prize without a second
 * round-trip; keep the three implementations in sync.
 */

// Reference ladder from the product spec (12-fixture pool). Used as the
// default prefill in the admin CreatePool editor. Stored desc by `min`
// for natural top-to-bottom display in the thermometer.
const DEFAULT_LADDER = [
  { min: 12, max: 12, prizeMXN: 3000 },
  { min: 11, max: 11, prizeMXN: 1500 },
  { min: 10, max: 10, prizeMXN: 700 },
  { min: 9, max: 9, prizeMXN: 300 },
  { min: 8, max: 8, prizeMXN: 100 },
  { min: 1, max: 7, prizeMXN: 0 },
  { min: 0, max: 0, prizeMXN: 100 },
];

function toInt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : NaN;
}

/**
 * Prize (MXN) won by a given number of correct picks. First tier whose
 * [min, max] range contains `correctCount` wins; 0 if none match.
 * Order-independent so non-monotonic ladders (0 → $100) work.
 */
function prizeForCorrect(ladder, correctCount) {
  if (!Array.isArray(ladder)) return 0;
  const c = toInt(correctCount);
  if (Number.isNaN(c)) return 0;
  for (const tier of ladder) {
    const min = toInt(tier?.min);
    const max = toInt(tier?.max);
    if (Number.isNaN(min) || Number.isNaN(max)) continue;
    if (c >= min && c <= max) {
      const prize = Number(tier.prizeMXN);
      return Number.isFinite(prize) ? prize : 0;
    }
  }
  return 0;
}

/**
 * The closest *paying* tier above the current correct count — what the
 * user is chasing. Returns { tier, needed } where needed = tier.min -
 * currentCorrect, or null if there's nothing higher to win. Powers the
 * "Necesitas X aciertos más para conseguir Y" notification copy.
 */
function nextPrizeTier(ladder, currentCorrect) {
  if (!Array.isArray(ladder)) return null;
  const c = toInt(currentCorrect);
  if (Number.isNaN(c)) return null;
  let best = null;
  for (const tier of ladder) {
    const min = toInt(tier?.min);
    const prize = Number(tier?.prizeMXN);
    if (Number.isNaN(min) || !Number.isFinite(prize) || prize <= 0) continue;
    if (min > c && (best === null || min < toInt(best.min))) best = tier;
  }
  if (!best) return null;
  return { tier: best, needed: toInt(best.min) - c };
}

/**
 * Validate + normalize an admin-supplied ladder for a pool of
 * `fixtureCount` fixtures. Returns { ok, error?, ladder? } where the
 * returned ladder is coerced to ints and sorted desc by `min`.
 *
 * Rules:
 *   - non-empty array
 *   - each tier: integer min/max with 0 ≤ min ≤ max ≤ fixtureCount,
 *     finite prizeMXN ≥ 0
 *   - ranges must not overlap (overlap → ambiguous prizeForCorrect)
 * Gaps are allowed (uncovered counts simply pay $0).
 */
function validateLadder(ladder, fixtureCount) {
  if (!Array.isArray(ladder) || ladder.length === 0) {
    return { ok: false, error: 'Prize ladder must be a non-empty array' };
  }
  const max = toInt(fixtureCount);
  const cap = Number.isNaN(max) ? Infinity : max;
  const normalized = [];
  for (const tier of ladder) {
    const tMin = toInt(tier?.min);
    const tMax = toInt(tier?.max);
    const prize = Number(tier?.prizeMXN);
    if (Number.isNaN(tMin) || Number.isNaN(tMax)) {
      return { ok: false, error: 'Each tier needs integer min and max' };
    }
    if (tMin < 0 || tMax < tMin || tMax > cap) {
      return { ok: false, error: `Tier range ${tMin}-${tMax} is out of bounds (0-${cap})` };
    }
    if (!Number.isFinite(prize) || prize < 0) {
      return { ok: false, error: 'Each tier needs a prizeMXN ≥ 0' };
    }
    const out = { min: tMin, max: tMax, prizeMXN: prize };
    const label = typeof tier?.label === 'string' ? tier.label.trim() : '';
    if (label) out.label = label;
    normalized.push(out);
  }
  // Overlap check.
  const sorted = [...normalized].sort((a, b) => a.min - b.min);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].min <= sorted[i - 1].max) {
      return { ok: false, error: 'Prize ladder tiers must not overlap' };
    }
  }
  normalized.sort((a, b) => b.min - a.min);
  return { ok: true, ladder: normalized };
}

module.exports = {
  DEFAULT_LADDER,
  prizeForCorrect,
  nextPrizeTier,
  validateLadder,
};
