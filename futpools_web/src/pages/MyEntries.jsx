import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { HudFrame, HudChip, XpBar, ArcadeButton, TeamCrest } from '../arena-ui/primitives';
import { ChallengesContent } from './Challenges';

// ────────────────────────────────────────────────────────────────────
// Live fixture poll — mirrors iOS MyEntriesViewModel.

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Two segments inside the Entries route: pool entries (default) and 1V1
// challenges. Both are "active stakes" — sharing the tab keeps the bottom
// nav at 4 + FAB instead of growing to a 5th tab.
const SECTIONS = [
  { key: 'entries',    en: 'POOL ENTRIES',   es: 'PARTICIPACIONES' },
  { key: 'challenges', en: '1V1 CHALLENGES', es: 'RETOS 1V1' },
];

export function MyEntries() {
  const { token } = useAuth();
  const { locale } = useLocale();
  const [section, setSection] = useState('entries');
  const [entries, setEntries] = useState([]);
  const [liveFixtures, setLiveFixtures] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const pollTimer = useRef(null);

  const load = async () => {
    if (!token) { setEntries([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setEntries(await api.get('/quinielas/entries/me', token)); }
    catch (e) { setError(e.message); setEntries([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const allFixtureIds = Array.from(new Set(
    entries.flatMap(e => (e.quiniela?.fixtures || []).map(f => f.fixtureId).filter(Boolean))
  ));

  const refreshLive = async () => {
    if (!allFixtureIds.length) return;
    // Skip poll if nothing is live or imminent (matches iOS guard).
    const now = Date.now();
    const windowStart = now - 3 * 3600 * 1000;
    const windowEnd = now + 60 * 60 * 1000;
    const kickoffs = entries.flatMap(e => (e.quiniela?.fixtures || []).map(f => f.kickoff ? new Date(f.kickoff).getTime() : null).filter(Boolean));
    const inWindow = kickoffs.some(k => k >= windowStart && k <= windowEnd);
    const anyLive = Object.values(liveFixtures).some(f => f?.status?.isLive);
    if (!inWindow && !anyLive) return;

    const map = {};
    for (const part of chunk(allFixtureIds, 50)) {
      try {
        const data = await api.get(`/football/fixtures?ids=${part.join(',')}`);
        for (const f of data || []) if (f.fixtureId != null) map[f.fixtureId] = f;
      } catch {}
    }
    setLiveFixtures(map);
  };

  useEffect(() => {
    refreshLive();
    clearInterval(pollTimer.current);
    pollTimer.current = setInterval(refreshLive, 30000);
    return () => clearInterval(pollTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const grouped = entries.reduce((acc, entry) => {
    const qid = entry.quiniela?._id || entry.quiniela;
    if (!acc[qid]) acc[qid] = { quiniela: entry.quiniela, entries: [] };
    acc[qid].entries.push(entry);
    return acc;
  }, {});
  const groups = Object.values(grouped).sort((a, b) => {
    const da = a.quiniela?.startDate ? new Date(a.quiniela.startDate) : 0;
    const db = b.quiniela?.startDate ? new Date(b.quiniela.startDate) : 0;
    return db - da;
  });

  const toggleGroup = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Header */}
      <div style={{ padding: '18px 16px 10px' }}>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 28, fontWeight: 800,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>
          {t(locale, 'My Entries')}
        </div>
        {section === 'entries' && !loading && entries.length > 0 && (
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1,
            color: 'var(--fp-text-muted)', marginTop: 4,
          }}>
            [ {entries.length} {t(locale, 'TOTAL')} ]
          </div>
        )}
      </div>

      {/* Segmented control: pool entries vs 1V1 challenges */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: section === s.key ? 'var(--fp-primary)' : 'transparent',
              color: section === s.key ? 'var(--fp-on-primary)' : 'var(--fp-text-dim)',
              border: `1px solid ${section === s.key ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
              clipPath: 'var(--fp-clip-sm)',
              fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              cursor: 'pointer',
            }}
          >{locale === 'es' ? s.es : s.en}</button>
        ))}
      </div>

      {section === 'challenges' ? (
        <ChallengesContent />
      ) : (
      <div style={{ padding: '0 16px 120px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 28, color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
            {t(locale, 'Loading entries…').toUpperCase()}
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 12, textAlign: 'center', padding: 12 }}>
            {error}
          </div>
        )}
        {!loading && entries.length === 0 && !error && (
          <HudFrame>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
                letterSpacing: 2, color: 'var(--fp-text)',
              }}>{t(locale, 'NO ENTRIES YET')}</div>
              <div style={{
                fontFamily: 'var(--fp-body)', fontSize: 12,
                color: 'var(--fp-text-dim)', marginTop: 6, marginBottom: 14,
              }}>{t(locale, "You don't have any entries yet. Join a pool to create one.")}</div>
              <Link to="/" style={{ textDecoration: 'none' }}>
                <ArcadeButton size="sm" variant="surface">{t(locale, 'POOLS')}</ArcadeButton>
              </Link>
            </div>
          </HudFrame>
        )}

        {groups.map((group, gi) => (
          <div key={group.quiniela?._id} className="fp-slide-up" style={{ animationDelay: `${gi * 60}ms` }}>
            <GroupCard
              group={group}
              locale={locale}
              liveFixtures={liveFixtures}
              isExpanded={expanded.has(group.quiniela?._id)}
              onToggle={() => toggleGroup(group.quiniela?._id)}
            />
          </div>
        ))}
      </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Group card — per pool, mirrors iOS ArenaEntryGroup

function GroupCard({ group, locale, liveFixtures, isExpanded, onToggle }) {
  const best = group.entries.reduce((acc, e) => {
    const s = e.score ?? 0;
    const total = e.totalPossible ?? (group.quiniela?.fixtures?.length ?? 0);
    return s > (acc?.s ?? -1) ? { s, t: total } : acc;
  }, null) ?? { s: 0, t: group.quiniela?.fixtures?.length ?? 0 };

  const closed = group.quiniela?.endDate && new Date(group.quiniela.endDate) < new Date();
  const status = closed
    ? { label: t(locale, 'CLOSED'), color: 'var(--fp-text-muted)' }
    : { label: t(locale, 'PENDING'), color: 'var(--fp-accent)' };

  // "Scheduled" = pool hasn't started. Editable only in this state. All
  // fixtures must still be in the future AND the pool isn't closed.
  const fixturesArr = group.quiniela?.fixtures || [];
  const now = Date.now();
  const isScheduled = !closed
    && fixturesArr.length > 0
    && fixturesArr.every(f => f.kickoff && new Date(f.kickoff).getTime() > now);

  const dateRange = group.quiniela?.startDate
    ? new Date(group.quiniela.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  // Sort entries newest first (iOS parity).
  const sortedEntries = [...group.entries].sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da;
  });

  return (
    <div style={{ marginBottom: 10 }}>
      <HudFrame>
        <div style={{ padding: 12 }}>
          <Link to={`/pool/${group.quiniela?._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <div style={{
                flex: 1,
                fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
                letterSpacing: 1, textTransform: 'uppercase',
              }}>{group.quiniela?.name}</div>
              <HudChip color={status.color}>{status.label}</HudChip>
            </div>

            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 10,
              color: 'var(--fp-text-muted)', marginBottom: 10,
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <span>{t(locale, 'ENTRIES')} #{group.entries.length}</span>
              <span style={{ color: 'var(--fp-text-faint)' }}>·</span>
              <span>{dateRange}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <XpBar value={best.s} max={Math.max(best.t, 1)} color={status.color} segments={Math.max(best.t, 1)} height={8} />
              </div>
              <div style={{
                fontFamily: 'var(--fp-mono)', fontSize: 14, fontWeight: 800,
                color: status.color, minWidth: 44, textAlign: 'right',
              }}>
                {best.s}/{best.t}
              </div>
            </div>
          </Link>

          {/* Show/Hide picks toggle */}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onToggle(); }}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px',
              background: 'var(--fp-bg2)',
              border: 'none',
              clipPath: 'var(--fp-clip-sm)',
              cursor: 'pointer',
              color: 'var(--fp-text-dim)',
              fontFamily: 'var(--fp-display)', fontSize: 10, fontWeight: 700, letterSpacing: 2,
            }}
          >
            <span>{isExpanded ? t(locale, 'HIDE PICKS') : t(locale, 'SHOW PICKS')}</span>
            <span style={{ color: 'var(--fp-text-muted)', fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
          </button>

          {isExpanded && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sortedEntries.map((entry, idx) => (
                <EntryDetail
                  key={entry._id || idx}
                  entry={entry}
                  fallbackNumber={idx + 1}
                  fixtures={group.quiniela?.fixtures || []}
                  liveFixtures={liveFixtures}
                  locale={locale}
                  withDivider={idx < sortedEntries.length - 1}
                  isScheduled={isScheduled}
                  quinielaId={group.quiniela?._id}
                />
              ))}
            </div>
          )}
        </div>
      </HudFrame>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Entry detail + pick row — mirrors iOS EntryDetailArena + PickRow

function EntryDetail({ entry, fallbackNumber, fixtures, liveFixtures, locale, withDivider, isScheduled, quinielaId }) {
  const entryNumber = entry.entryNumber ?? fallbackNumber;
  const score = entry.score;
  const total = entry.totalPossible;
  const createdAt = entry.createdAt
    ? new Date(entry.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
            color: 'var(--fp-primary)',
          }}>
            {t(locale, 'ENTRY')} #{entryNumber}
          </div>
          {isScheduled && quinielaId && entry?._id && (
            <Link
              to={`/pool/${quinielaId}/pick?entryId=${entry._id}`}
              style={{
                fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                color: 'var(--fp-accent)',
                padding: '3px 7px',
                border: '1px solid color-mix(in srgb, var(--fp-accent) 45%, transparent)',
                clipPath: 'var(--fp-clip-sm)',
                textDecoration: 'none',
              }}
            >
              ✎ {t(locale, 'EDIT')}
            </Link>
          )}
          {typeof score === 'number' && typeof total === 'number' && total > 0 && (
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
              color: 'var(--fp-gold)',
            }}>
              {score}/{total} {t(locale, 'PTS')}
            </div>
          )}
          {/* ratingDelta is stamped by the backend at settlement time. Only show
              once settled — before that it would be misleading vs. live data. */}
          {typeof entry.ratingDelta === 'number' && entry.scoredAt && (
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 800, letterSpacing: 1,
              color: entry.ratingDelta >= 0 ? 'var(--fp-primary)' : 'var(--fp-danger)',
            }}>
              {entry.ratingDelta >= 0 ? '+' : ''}{Math.round(entry.ratingDelta)} {t(locale, 'RATING')}
            </div>
          )}
          <div style={{ flex: 1 }} />
          {createdAt && (
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-muted)',
            }}>{createdAt}</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fixtures.map(fx => {
            const pick = entry.picks?.find(p => p.fixtureId === fx.fixtureId)?.pick;
            return (
              <PickRow
                key={fx.fixtureId}
                fixture={fx}
                pick={pick}
                live={liveFixtures[fx.fixtureId]}
                locale={locale}
              />
            );
          })}
        </div>
      </div>
      {withDivider && (
        <div style={{ height: 1, background: 'var(--fp-stroke)' }} />
      )}
    </>
  );
}

function PickRow({ fixture, pick, live, locale }) {
  const home = live?.score?.home;
  const away = live?.score?.away;
  const liveResult = (typeof home === 'number' && typeof away === 'number')
    ? (home > away ? '1' : home < away ? '2' : 'X')
    : null;
  const short = (live?.status?.short || '').toUpperCase();
  const isLive = live?.status?.isLive === true;
  const isFinal = FINISHED_STATUSES.has(short);

  // missing / pending / leading / trailing / won / lost
  let state = 'missing';
  if (pick && pick !== '-' && pick !== '') {
    if (!liveResult) state = 'pending';
    else if (isFinal) state = pick === liveResult ? 'won' : 'lost';
    else state = pick === liveResult ? 'leading' : 'trailing';
  }

  const palette = {
    missing:  { badgeBg: 'var(--fp-bg2)', fg: 'var(--fp-text-dim)', accent: 'var(--fp-stroke)' },
    pending:  { badgeBg: 'color-mix(in srgb, var(--fp-accent) 18%, transparent)', fg: 'var(--fp-accent)', accent: 'color-mix(in srgb, var(--fp-accent) 50%, transparent)' },
    leading:  { badgeBg: 'color-mix(in srgb, var(--fp-primary) 22%, transparent)', fg: 'var(--fp-primary)', accent: 'var(--fp-primary)' },
    trailing: { badgeBg: 'color-mix(in srgb, var(--fp-danger) 18%, transparent)',  fg: 'var(--fp-danger)',  accent: 'color-mix(in srgb, var(--fp-danger) 70%, transparent)' },
    won:      { badgeBg: 'color-mix(in srgb, var(--fp-primary) 22%, transparent)', fg: 'var(--fp-primary)', accent: 'var(--fp-primary)' },
    lost:     { badgeBg: 'color-mix(in srgb, var(--fp-danger) 18%, transparent)',  fg: 'var(--fp-danger)',  accent: 'color-mix(in srgb, var(--fp-danger) 70%, transparent)' },
  }[state];

  const pickLabel = pick === '1' ? `${t(locale, 'YOUR PICK')} · ${t(locale, 'HOME')}`
                  : pick === 'X' ? `${t(locale, 'YOUR PICK')} · ${t(locale, 'Draw').toUpperCase()}`
                  : pick === '2' ? `${t(locale, 'YOUR PICK')} · ${t(locale, 'AWAY')}`
                  : t(locale, 'NO PICK');

  const statusEl = (() => {
    switch (state) {
      case 'missing':
        return <span style={{ color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>{t(locale, 'NO PICK')}</span>;
      case 'pending':
        return isLive && live?.status?.elapsed
          ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>
               <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-danger)' }} />
               LIVE {live.status.elapsed}'
             </span>)
          : <span style={{ color: 'var(--fp-accent)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>{t(locale, 'PENDING').toUpperCase()}</span>;
      case 'leading':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--fp-primary)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-primary)' }} />
          {t(locale, 'LEADING')}
        </span>;
      case 'trailing':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-danger)' }} />
          {t(locale, 'TRAILING')}
        </span>;
      case 'won':
        return <span style={{ color: 'var(--fp-primary)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>✓ +1 {t(locale, 'PT')}</span>;
      case 'lost':
        return <span style={{ color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>✗ {t(locale, 'MISSED')}</span>;
      default: return null;
    }
  })();

  return (
    <div style={{
      padding: '10px',
      background: 'var(--fp-surface-alt)',
      clipPath: 'var(--fp-clip-sm)',
      borderLeft: `3px solid ${palette.accent}`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Row 1: teams + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <TeamCrest name={fixture.homeTeam} color="var(--fp-accent)" size={22} logoURL={fixture.homeLogo} />
        <span style={{
          flex: 1,
          fontFamily: 'var(--fp-display)', fontSize: 12,
          fontWeight: pick === '1' ? 800 : 500,
          color: pick === '1' ? 'var(--fp-text)' : 'var(--fp-text-dim)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{fixture.homeTeam}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 60, justifyContent: 'center' }}>
          {typeof home === 'number' && typeof away === 'number' ? (
            <>
              <span style={{ fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800, color: 'var(--fp-text)' }}>{home}</span>
              <span style={{ fontFamily: 'var(--fp-display)', fontSize: 14, color: 'var(--fp-text-dim)' }}>-</span>
              <span style={{ fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800, color: 'var(--fp-text)' }}>{away}</span>
            </>
          ) : (
            <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)' }}>vs</span>
          )}
        </div>
        <span style={{
          flex: 1, textAlign: 'right',
          fontFamily: 'var(--fp-display)', fontSize: 12,
          fontWeight: pick === '2' ? 800 : 500,
          color: pick === '2' ? 'var(--fp-text)' : 'var(--fp-text-dim)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{fixture.awayTeam}</span>
        <TeamCrest name={fixture.awayTeam} color="var(--fp-hot)" size={22} logoURL={fixture.awayLogo} />
      </div>

      {/* Row 2: pick badge + label + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: palette.badgeBg, clipPath: 'var(--fp-clip-sm)',
          fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 900,
          color: palette.fg,
        }}>
          {pick === '1' || pick === 'X' || pick === '2' ? pick : '—'}
        </div>
        <div style={{
          flex: 1,
          fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
          color: 'var(--fp-text-muted)',
        }}>{pickLabel}</div>
        {statusEl}
      </div>
    </div>
  );
}
