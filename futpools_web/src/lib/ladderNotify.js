// Local notifications for prize_ladder pools (web). When the signed-in
// player's live aciertos count ticks up, we surface an in-app toast and —
// if the browser granted permission and the tab is in the foreground — a
// Web Notification. No service worker / background push (by design); this
// is the web counterpart of the iOS local-notification flow, and the copy
// is localized the same way.
import { useEffect, useRef, useState } from 'react';
import { t, tFormat } from '../i18n/translations';
import { prizeForCorrect, nextPrizeTier, tierPrizeLabel } from './prizeLadder';

const STORAGE_PREFIX = 'fp_ladder_score_';

/**
 * Build the localized title + body for an acierto event.
 * - If the player now holds a prize → celebrate the current prize.
 * - Otherwise → tell them how many more aciertos reach the next prize.
 */
export function buildAcertoMessage(locale, { aciertos, ladder }) {
  const prize = prizeForCorrect(ladder, aciertos);
  if (prize > 0) {
    const tier = (ladder || []).find((tr) => aciertos >= tr.min && aciertos <= tr.max);
    const label = tier ? tierPrizeLabel(tier, locale) : `$${prize}`;
    return {
      title: t(locale, 'New prize unlocked!'),
      body: tFormat(locale, 'You nailed your last pick! You have {n} correct, your current prize is: {prize}', { n: aciertos, prize: label }),
    };
  }
  const next = nextPrizeTier(ladder, aciertos);
  if (next) {
    return {
      title: t(locale, 'Keep going!'),
      body: tFormat(locale, 'You need {n} more correct to reach {prize}', { n: next.needed, prize: tierPrizeLabel(next.tier, locale) }),
    };
  }
  return null;
}

/**
 * Watches the player's live aciertos for a prize_ladder pool and fires a
 * toast + Web Notification when it increases. Returns { toast, dismiss }.
 *
 * Dedup/persistence: the last-seen score is stored per pool in
 * localStorage so a page reload mid-match doesn't replay an old event.
 */
export function useLiveAcertoNotifier({ poolId, enabled, liveScore, ladder, locale }) {
  const [toast, setToast] = useState(null);
  const lastRef = useRef(null);
  const timerRef = useRef(null);

  // Request permission once for joined ladder players (best-effort).
  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || poolId == null) return;
    const key = STORAGE_PREFIX + poolId;
    const score = Number(liveScore) || 0;

    // Seed from storage on first run so we only notify on genuine increases.
    if (lastRef.current === null) {
      const stored = Number(localStorage.getItem(key));
      lastRef.current = Number.isFinite(stored) ? stored : score;
      // If this load already shows MORE than what we last persisted, treat
      // it as already-seen (don't replay) but fall through to persist.
      if (score <= lastRef.current) {
        lastRef.current = score;
        localStorage.setItem(key, String(score));
        return;
      }
    }

    if (score > lastRef.current) {
      const msg = buildAcertoMessage(locale, { aciertos: score, ladder });
      if (msg) {
        setToast(msg);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setToast(null), 6000);
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            // eslint-disable-next-line no-new
            new Notification(msg.title, { body: msg.body });
          }
        } catch { /* notifications unsupported — toast still shows */ }
      }
    }
    lastRef.current = score;
    localStorage.setItem(key, String(score));
  }, [enabled, poolId, liveScore, ladder, locale]);

  return { toast, dismiss: () => setToast(null) };
}
