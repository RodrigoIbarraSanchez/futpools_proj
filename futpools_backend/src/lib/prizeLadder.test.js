/**
 * Run with: node --test src/lib/
 * No test framework dependency — uses Node's built-in test runner.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_LADDER,
  prizeForCorrect,
  nextPrizeTier,
  validateLadder,
} = require('./prizeLadder');

test('prizeForCorrect matches the spec table', () => {
  const expected = {
    12: 3000,
    11: 1500,
    10: 700,
    9: 300,
    8: 100,
    7: 0,
    6: 0,
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
    0: 100, // consolation
  };
  for (const [hits, prize] of Object.entries(expected)) {
    assert.equal(prizeForCorrect(DEFAULT_LADDER, Number(hits)), prize, `hits=${hits}`);
  }
});

test('prizeForCorrect handles out-of-range / garbage input', () => {
  assert.equal(prizeForCorrect(DEFAULT_LADDER, 99), 0);
  assert.equal(prizeForCorrect(DEFAULT_LADDER, -1), 0);
  assert.equal(prizeForCorrect(DEFAULT_LADDER, NaN), 0);
  assert.equal(prizeForCorrect(null, 5), 0);
  assert.equal(prizeForCorrect(DEFAULT_LADDER, '10'), 700); // numeric string coerced
});

test('nextPrizeTier finds the closest reachable paying tier', () => {
  // From 0 aciertos, the next paying tier is 8 (the 1-7 dead zone pays 0).
  let next = nextPrizeTier(DEFAULT_LADDER, 0);
  assert.equal(next.tier.min, 8);
  assert.equal(next.needed, 8);

  // From 5 aciertos, still chasing 8.
  next = nextPrizeTier(DEFAULT_LADDER, 5);
  assert.equal(next.tier.min, 8);
  assert.equal(next.needed, 3);

  // From 11, chasing the top tier (12 → $3,000).
  next = nextPrizeTier(DEFAULT_LADDER, 11);
  assert.equal(next.tier.min, 12);
  assert.equal(next.needed, 1);

  // At the top there's nothing higher.
  assert.equal(nextPrizeTier(DEFAULT_LADDER, 12), null);
});

test('validateLadder accepts the default ladder', () => {
  const res = validateLadder(DEFAULT_LADDER, 12);
  assert.equal(res.ok, true);
  assert.equal(res.ladder.length, DEFAULT_LADDER.length);
  // Sorted desc by min.
  assert.equal(res.ladder[0].min, 12);
});

test('validateLadder rejects bad input', () => {
  assert.equal(validateLadder([], 12).ok, false);
  assert.equal(validateLadder('nope', 12).ok, false);
  // Out of bounds (max > fixtureCount).
  assert.equal(validateLadder([{ min: 0, max: 20, prizeMXN: 1 }], 12).ok, false);
  // Negative prize.
  assert.equal(validateLadder([{ min: 0, max: 1, prizeMXN: -5 }], 12).ok, false);
  // Overlapping ranges.
  assert.equal(validateLadder([
    { min: 0, max: 5, prizeMXN: 0 },
    { min: 4, max: 8, prizeMXN: 100 },
  ], 12).ok, false);
});

test('validateLadder allows a custom non-default ladder (e.g. 9 fixtures)', () => {
  const ladder = [
    { min: 9, max: 9, prizeMXN: 1000 },
    { min: 7, max: 8, prizeMXN: 200 },
    { min: 0, max: 6, prizeMXN: 0 },
  ];
  const res = validateLadder(ladder, 9);
  assert.equal(res.ok, true);
  assert.equal(prizeForCorrect(res.ladder, 9), 1000);
  assert.equal(prizeForCorrect(res.ladder, 8), 200);
  assert.equal(prizeForCorrect(res.ladder, 3), 0);
});
