// LadderParticipants — shared participants list for prize_ladder pools,
// used by both the mobile (PoolDetail) and desktop (PoolDetailDesktop)
// pool screens. Lists every participant sorted by aciertos (desc, server
// side) with infinite-scroll lazy loading once a pool passes ~10 players.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { t, tFormat } from '../i18n/translations';
import { HudChip, SectionLabel } from './primitives';
import { prizeForCorrect, formatMXN } from '../lib/prizeLadder';

const PAGE = 10;

// 'displayName N' for 2nd+ entries; truncate the base so the suffix stays
// visible (mirrors PoolDetail.formatLeaderboardName).
function leaderboardName(displayName, entryNumber, maxBase = 16) {
  const base = String(displayName || 'player');
  const suffix = entryNumber && entryNumber > 1 ? ` ${entryNumber}` : '';
  if (base.length <= maxBase) return base + suffix;
  return base.slice(0, maxBase - 1) + '…' + suffix;
}

export function LadderParticipants({ quinielaId, locale, hasLiveFixtures, ladder, currentUserId }) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  const fetchPage = useCallback(async (offset) => {
    const res = await api.get(`/quinielas/${quinielaId}/leaderboard?offset=${offset}&limit=${PAGE}`);
    return res || {};
  }, [quinielaId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPage(0).then((res) => {
      if (cancelled) return;
      setRows(res.leaderboard || []);
      setTotalCount(res.totalCount ?? (res.leaderboard || []).length);
      setLoading(false);
    }).catch(() => { if (!cancelled) { setRows([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || rows.length >= totalCount) return;
    setLoadingMore(true);
    fetchPage(rows.length).then((res) => {
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.entryId));
        const fresh = (res.leaderboard || []).filter((r) => !seen.has(r.entryId));
        return [...prev, ...fresh];
      });
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [fetchPage, loadingMore, rows.length, totalCount]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: '120px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 11 }}>{t(locale, 'Loading…').toUpperCase()}</div>;
  }
  if (rows.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 11 }}>{t(locale, 'No participants yet').toUpperCase()}</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <SectionLabel color="var(--fp-accent)">{t(locale, 'PARTICIPANTS')}</SectionLabel>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
          {tFormat(locale, '{n} players', { n: totalCount })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row, i) => {
          const aciertos = hasLiveFixtures ? (row.liveScore ?? row.score ?? 0) : (row.score ?? 0);
          const prize = hasLiveFixtures
            ? (row.livePrizeMXN ?? prizeForCorrect(ladder, aciertos))
            : (row.settledPrizeMXN ?? prizeForCorrect(ladder, aciertos));
          const isMe = currentUserId && String(row.userId) === String(currentUserId);
          const won = prize > 0;
          return (
            <div key={row.entryId || i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              clipPath: 'var(--fp-clip-sm)',
              background: isMe ? 'color-mix(in srgb, var(--fp-primary) 14%, var(--fp-surface))' : 'var(--fp-surface)',
              border: `1px solid ${isMe ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
            }}>
              <div style={{
                width: 24, textAlign: 'center',
                fontFamily: 'var(--fp-display)', fontWeight: 900, fontSize: 13,
                color: i < 3 ? 'var(--fp-gold)' : 'var(--fp-text-muted)',
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0,
                fontFamily: 'var(--fp-display)', fontWeight: 700, fontSize: 13,
                color: 'var(--fp-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {leaderboardName(row.displayName, row.entryNumber)}
                {isMe && <span style={{ color: 'var(--fp-primary)', marginLeft: 6, fontSize: 10 }}>({t(locale, 'YOU')})</span>}
              </div>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 12, color: 'var(--fp-text-dim)', whiteSpace: 'nowrap' }}>
                {tFormat(locale, '{n} aciertos', { n: aciertos })}
              </div>
              <HudChip color={won ? 'var(--fp-primary)' : 'var(--fp-text-muted)'} showLiveDot={hasLiveFixtures && won}>
                {formatMXN(prize)}
              </HudChip>
            </div>
          );
        })}
      </div>

      {rows.length < totalCount && (
        <div ref={sentinelRef} style={{ padding: 16, textAlign: 'center', color: 'var(--fp-text-muted)', fontFamily: 'var(--fp-mono)', fontSize: 10 }}>
          {loadingMore ? t(locale, 'Loading…').toUpperCase() : '···'}
        </div>
      )}
    </div>
  );
}

export default LadderParticipants;
