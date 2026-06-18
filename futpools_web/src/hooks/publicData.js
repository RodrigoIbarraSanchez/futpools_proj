/**
 * Shared public-data hooks for the SEO landings and the calendar funnel.
 *
 * Extracted from PronosticosFutbol.jsx / PronosticosFutbolHoy.jsx so the
 * World Cup landing + calendar tool can use them WITHOUT creating ESM
 * cycles (those pages import LANDING_CSS/WC_CSS from the WC files, so
 * importing back from them would be circular). The original files keep
 * re-exports for their existing importers.
 *
 * All hooks are fail-safe: a fetch error leaves the state at its evergreen
 * default (null) so callers always render a valid fallback.
 */

import { useEffect, useState } from 'react';
import { api } from '../api/client';

/** Next public pool still open for registration (no match started), or
 *  null. Shape: { id, name, firstKickoff, entriesCount, entryFeeMXN,
 *  currency }. Backed by GET /public/pools/next-open (60s server cache). */
export function useNextOpenPool() {
  const [pool, setPool] = useState(null);
  useEffect(() => {
    let on = true;
    api.get('/public/pools/next-open')
      .then((d) => { if (on) setPool(d?.pool || null); })
      .catch(() => {}); // fetch failure → pool stays null → /onboarding
    return () => { on = false; };
  }, []);
  return pool;
}

/** Today's fixtures (CDMX calendar day, priority leagues — World Cup
 *  first while it runs). null = loading/error, [] = none today.
 *  Backed by GET /public/fixtures/today (10-min server cache). */
export function useTodayFixtures() {
  const [fixtures, setFixtures] = useState(null);
  useEffect(() => {
    let on = true;
    api.get('/public/fixtures/today?limit=6')
      .then((d) => { if (on) setFixtures(Array.isArray(d) ? d : null); })
      .catch(() => {});
    return () => { on = false; };
  }, []);
  return fixtures;
}

export function formatKickoff(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function kickoffTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
