// Prize-ladder helpers for the web client — mirrors
// futpools_backend/src/lib/prizeLadder.js. Keep the two in sync.
//
// A ladder is an array of range tiers { min, max, prizeMXN, label? }:
// "if your correct-pick count is in [min, max], you win prizeMXN pesos".
// Ranges are NOT assumed monotonic (0 aciertos → $100 consolation sits
// below the 1–7 dead zone), so lookups never rely on ordering.

export const DEFAULT_LADDER = [
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

/** Prize (MXN) for a given number of correct picks; 0 if no tier matches. */
export function prizeForCorrect(ladder, correctCount) {
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
 * Closest paying tier above the current correct count — what the player is
 * chasing. Returns { tier, needed } or null when there's nothing higher.
 */
export function nextPrizeTier(ladder, currentCorrect) {
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

/** The biggest prize on the ladder (the headline "win up to" figure). */
export function maxPrize(ladder) {
  if (!Array.isArray(ladder)) return 0;
  return ladder.reduce((m, tier) => Math.max(m, Number(tier?.prizeMXN) || 0), 0);
}

/** Top paying tiers, highest prize first — for compact ladder previews. */
export function topTiers(ladder, n = 4) {
  if (!Array.isArray(ladder)) return [];
  return ladder
    .filter((tier) => (Number(tier?.prizeMXN) || 0) > 0)
    .sort((a, b) => (b.prizeMXN - a.prizeMXN) || (b.max - a.max))
    .slice(0, n);
}

/** Format MXN with thousands separators, e.g. 3000 → "$3,000". */
export function formatMXN(amount) {
  const n = Number(amount) || 0;
  return `$${n.toLocaleString('en-US')}`;
}

/**
 * Human label for a tier's acierto range, localized.
 * tierRangeLabel({min:1,max:7}, 'es') → "1–7 aciertos"
 * tierRangeLabel({min:10,max:10}, 'en') → "10 correct"
 */
export function tierRangeLabel(tier, locale = 'es') {
  const min = toInt(tier?.min);
  const max = toInt(tier?.max);
  const word = locale === 'es' ? 'aciertos' : 'correct';
  if (Number.isNaN(min) || Number.isNaN(max)) return '';
  return min === max ? `${min} ${word}` : `${min}–${max} ${word}`;
}

/** Full prize label used in notifications, e.g. "$700 (10 aciertos)". */
export function tierPrizeLabel(tier, locale = 'es') {
  return `${formatMXN(tier?.prizeMXN)} (${tierRangeLabel(tier, locale)})`;
}
