// HomeDesktop — desktop variant of the Pools list.
//
// Mirrors Claude Design's `screen-home.jsx`: hero featured pool +
// status filter chips + 2/3-col responsive grid of pool cards.
// Pulls the same /quinielas list + live-fixtures polling as the
// mobile Home, and reuses the shared formatters (`formatEntryFee`,
// `formatPrizePool` definitions are duplicated here to avoid a
// circular import — both files own one source-of-truth copy).
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { t, tFormat } from '../../i18n/translations';
import { maxPrize, topTiers, formatMXN } from '../../lib/prizeLadder';
import { resolvePoolStatus, canJoinPool, isFreePool, freeToEnter, poolLockAtISO } from '../../lib/poolStatus';

const WINNER_SHARE = 0.65;

function formatMxn(n) {
  return '$' + Number(n).toLocaleString('es-MX');
}
function formatEntryFee(q, locale) {
  if (freeToEnter(q)) return t(locale, 'FREE');
  if (typeof q?.entryFeeMXN === 'number' && q.entryFeeMXN > 0) {
    return `$${q.entryFeeMXN} MXN`;
  }
  return q?.cost && String(q.cost).trim() !== '0' ? q.cost : '—';
}
// Returns the prize as a number when the pool uses simple_version's
// entryFeeMXN flow. Returns null for legacy pools (master-mode coin
// economy) so callers can fall back to the string `q.prize` field.
// Returns 0 when the pool is on the new flow but nobody has entered
// yet — that's a real value, not 'unknown', so the UI should render
// it as $0 instead of '—'.
function prizePoolMxn(q) {
  if (typeof q?.entryFeeMXN === 'number' && q.entryFeeMXN > 0) {
    const entries = q?.entriesCount ?? 0;
    return Math.floor(entries * q.entryFeeMXN * WINNER_SHARE);
  }
  return null;
}

// Display string for the prize. Falls back to the legacy `q.prize`
// field for pools that predate the entryFeeMXN migration. Mirrors the
// mobile Home formatter so the two surfaces never disagree.
function prizeDisplay(q, locale) {
  // Free ($0) pools have no prize.
  if (isFreePool(q)) return t(locale, 'NO PRIZE');
  // prize_ladder pools don't have a pot — show the headline "up to" prize.
  if (q?.poolType === 'prize_ladder') {
    const top = maxPrize(q.prizeLadder || []);
    return top > 0 ? `${t(locale, 'UP TO')} ${formatMXN(top)}` : '—';
  }
  const mxn = prizePoolMxn(q);
  if (mxn !== null) {
    if (mxn > 0) return formatMxn(mxn);
    // 0 entries on a paid pool — be explicit instead of showing '—'.
    return locale === 'es' ? '$0 MXN' : '$0 MXN';
  }
  return q?.prize || '—';
}

// Delegates to the shared helper. The previous local implementation
// only checked the legacy `q.status` field (often empty) + endDate, so a
// pool whose fixtures had FT codes but stale kickoff/endDate appeared as
// 'open' on the grid (the "Partidos de media semana" bug).
const poolStatus = (q, liveFixtures) => resolvePoolStatus(q, liveFixtures);

function statusLabel(key, locale) {
  switch (key) {
    case 'live':      return 'LIVE';
    case 'open':      return t(locale, 'Open').toUpperCase();
    case 'upcoming':  return t(locale, 'Upcoming').toUpperCase();
    case 'completed': return t(locale, 'Closed').toUpperCase();
    default:          return key.toUpperCase();
  }
}

function fmtRange(start, end) {
  const opt = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  if (!start) return '—';
  const a = new Date(start).toLocaleString(undefined, opt);
  if (!end) return a;
  const b = new Date(end).toLocaleString(undefined, opt);
  return `${a} → ${b}`;
}

// Live countdown chip — ticks every second; renders 'cerrado' once past.
function Countdown({ iso, locale }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return <span className="muted">—</span>;
  const ms = Math.max(0, new Date(iso).getTime() - now);
  if (ms <= 0) return <span className="muted">{t(locale, 'closed')}</span>;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms / 3600000) % 24);
  const m = Math.floor((ms / 60000) % 60);
  const s = Math.floor((ms / 1000) % 60);
  const pad = (x) => String(x).padStart(2, '0');
  return (
    <span className="num" style={{ fontWeight: 700 }}>
      {d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hero — featured pool with prize-glow trophy on the right
// ─────────────────────────────────────────────────────────────────────

function Hero({ pool, kind, isLive, canJoin, locale, navigate }) {
  if (!pool) return null;
  // Prize for the trophy block. Three states:
  //   • simple_version pool with entries → real $ amount
  //   • simple_version pool with 0 entries → '$0' + 'sé el primero' sub
  //   • legacy pool without entryFeeMXN → use the legacy q.prize string
  // prize_ladder pools: the medallion shows the headline "win up to" prize
  // (the pot math gives a misleading $0 with no entries) and a mini ladder
  // of the top tiers sits under the description.
  const isLadder = pool.poolType === 'prize_ladder';
  const isFree = isFreePool(pool);
  const ladder = pool.prizeLadder || [];
  const ladderTop = maxPrize(ladder);

  const prizeMxn = prizePoolMxn(pool);
  const medallionLbl = isFree ? t(locale, 'TEST POOL') : isLadder ? t(locale, 'WIN UP TO') : t(locale, 'PRIZE POOL');
  const prizeMain = isFree
    ? t(locale, 'FREE')
    : isLadder
      ? formatMXN(ladderTop)
      : (prizeMxn !== null ? (prizeMxn > 0 ? formatMxn(prizeMxn) : '$0') : (pool.prize || '—'));
  const prizeSub = isFree
    ? t(locale, 'NO PRIZE')
    : isLadder
      ? t(locale, 'PRIZE LADDER')
      : (prizeMxn === 0 ? t(locale, 'be the first to enter') : t(locale, 'paid to the winner'));
  // Tag honesty: only say 'QUINIELA DESTACADA' when an admin explicitly
  // flipped the featured flag. Auto-picks (upcoming fallback) get a
  // status-accurate tag. The LIVE indicator is rendered separately so a
  // featured pool that's also live shows BOTH tags side by side.
  const primaryTag = kind === 'featured'
    ? `⚡ ${t(locale, 'FEATURED POOL')}`
    : kind === 'live'
      ? null  // LIVE tag below covers this
      : `▶ ${t(locale, 'NEXT POOL')}`;
  return (
    <section className="fp-hero">
      <div>
        <div className="fp-hero-tags">
          {primaryTag && <span className="tag">{primaryTag}</span>}
          {isLive && (
            <span className="tag live">
              <span className="pulse" />
              {t(locale, 'LIVE NOW')}
            </span>
          )}
        </div>
        <h2>{pool.name}</h2>
        {pool.description ? (
          <p>{pool.description}</p>
        ) : isLadder ? (
          <p>{tFormat(locale, 'Win a fixed prize based on your correct picks — up to {prize}.', { prize: formatMXN(ladderTop) })}</p>
        ) : (
          <p>
            {t(locale, 'Make your picks before the first kickoff. Winner takes 65% of the pot, paid by bank transfer.')}
          </p>
        )}
        {/* Mini prize ladder — the top paying tiers as chips. */}
        {isLadder && ladderTop > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '2px 0 16px' }}>
            {topTiers(ladder, 4).map((tr, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px',
                borderRadius: 8,
                background: 'color-mix(in srgb, var(--fp-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--fp-primary) 30%, transparent)',
                fontFamily: 'var(--fp-mono)', fontSize: 12,
              }}>
                <b style={{ color: 'var(--fp-text-dim)' }}>{tr.min === tr.max ? tr.max : `${tr.min}–${tr.max}`}✓</b>
                <span style={{ color: 'var(--fp-primary)', fontWeight: 800 }}>{formatMXN(tr.prizeMXN)}</span>
              </span>
            ))}
          </div>
        )}
        <div className="fp-hero-stats">
          <div className="cell">
            <div className="label">{t(locale, 'Entry')}</div>
            <div className="value">{formatEntryFee(pool, locale)}</div>
          </div>
          <div className="cell">
            <div className="label">{t(locale, 'Players').toUpperCase()}</div>
            <div className="value num">{(pool.entriesCount ?? 0).toLocaleString('es-MX')}</div>
          </div>
          <div className="cell">
            <div className="label">{t(locale, 'Closes in')}</div>
            <div className="value"><Countdown iso={poolLockAtISO(pool)} locale={locale} /></div>
          </div>
        </div>
        <div className="fp-hero-cta">
          {/* Once picks are locked there's no point sending the user to
              the pick screen — it would only tell them participation is
              closed. View details becomes the sole primary CTA. */}
          {canJoin ? (
            <>
              <button
                type="button"
                className="fp-btn primary lg"
                onClick={() => navigate(`/pool/${pool._id}/pick`)}
              >⚽ {t(locale, 'Play now')}</button>
              <button
                type="button"
                className="fp-btn ghost lg"
                onClick={() => navigate(`/pool/${pool._id}`)}
              >{t(locale, 'View details')} ›</button>
            </>
          ) : (
            <button
              type="button"
              className="fp-btn primary lg"
              onClick={() => navigate(`/pool/${pool._id}`)}
            >{t(locale, 'View details')} ›</button>
          )}
        </div>
      </div>
      <div className="fp-hero-right">
        <div className="fp-hero-trophy">
          <div className="halo" />
          <div className="medallion">
            <div className="prize-num">
              <div className="lbl">{medallionLbl}</div>
              <div className="divider" />
              <div className="v">{prizeMain}</div>
              <div className="sub">{prizeSub}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pool card — used in the responsive grid
// ─────────────────────────────────────────────────────────────────────

function PoolCard({ q, liveFixtures, locale, navigate }) {
  const status = poolStatus(q, liveFixtures);
  const isClosed = status === 'completed';
  const previewFixtures = (q.fixtures || []).slice(0, 3);
  const more = (q.fixtures?.length || 0) - previewFixtures.length;
  const prizeStr = prizeDisplay(q, locale);
  return (
    <div
      className="fp-card hoverable"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-4)', padding: 0 }}
      onClick={() => navigate(`/pool/${q._id}`)}
    >
      <div style={{ padding: 'var(--app-space-5)', paddingBottom: 'var(--app-space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className={`fp-status ${status}`}>
                {status === 'live' && <span className="pulse" />}
                {statusLabel(status, locale)}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {(q.entriesCount ?? 0).toLocaleString('es-MX')} {t(locale, 'players')}
              </span>
            </div>
            <h3 style={{
              margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{q.name}</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {fmtRange(q.startDate, q.endDate)}
            </div>
          </div>
          <span className="faint" style={{ fontSize: 18, fontWeight: 700, flexShrink: 0 }}>›</span>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr',
          gap: 'var(--app-space-3)', marginTop: 'var(--app-space-4)',
        }}>
          <div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t(locale, 'Prize')}
            </div>
            <div className="gold num" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
              {prizeStr}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t(locale, 'Entry')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{formatEntryFee(q, locale)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isClosed ? t(locale, 'Closed') : t(locale, 'Closes in')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {isClosed
                ? new Date(q.endDate || q.startDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                : <Countdown iso={poolLockAtISO(q)} locale={locale} />}
            </div>
          </div>
        </div>
      </div>

      {previewFixtures.length > 0 && (
        <div style={{
          padding: 'var(--app-space-4) var(--app-space-5) var(--app-space-5)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.015)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {q.fixtures.length} {t(locale, 'fixtures')} · {q.fixtures[0]?.leagueName || ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {previewFixtures.map((f) => (
              <div key={f.fixtureId} style={{
                display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center', gap: 8, fontSize: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {f.homeLogo && <img src={f.homeLogo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.homeTeam}</span>
                </div>
                <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>vs</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexDirection: 'row-reverse' }}>
                  {f.awayLogo && <img src={f.awayLogo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.awayTeam}</span>
                </div>
              </div>
            ))}
            {more > 0 && (
              <div className="muted" style={{ fontSize: 11 }}>
                + {more} {t(locale, 'more matches')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

export function HomeDesktop() {
  const { user, token } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();

  const [quinielas, setQuinielas] = useState([]);
  const [liveFixtures, setLiveFixtures] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const pollTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/quinielas', token)
      .then((list) => { if (!cancelled) setQuinielas(list || []); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  // 30s live-fixtures polling, scoped to whatever fixture IDs are
  // currently visible. Mirror of the mobile Home polling.
  const refreshLive = useCallback(async () => {
    const ids = Array.from(new Set(
      (quinielas || []).flatMap((q) => (q.fixtures || []).map((f) => f.fixtureId))
    )).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const chunks = [];
      for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
      const responses = await Promise.all(
        chunks.map((c) => api.get(`/football/fixtures?ids=${c.join(',')}`).catch(() => []))
      );
      const map = {};
      responses.flat().forEach((f) => { if (f?.fixtureId != null) map[f.fixtureId] = f; });
      setLiveFixtures(map);
    } catch { /* keep prev */ }
  }, [quinielas]);

  useEffect(() => {
    refreshLive();
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (quinielas.length > 0) {
      pollTimer.current = setInterval(refreshLive, 30_000);
    }
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [refreshLive, quinielas.length]);

  // Hero pool selection. Returns { pool, kind } so the tag in the
  // header is honest about WHY this pool is in the hero:
  //   featured → admin pinned it via Edit pool
  //   live     → no featured, but something's playing now
  //   next     → no featured / no live, but something's joinable soon
  //   null     → nothing worth heroing, hide the section entirely
  //
  // Selection runs over the full `quinielas` list, NOT just public pools.
  // The backend's getQuinielas already gates visibility per caller (admin
  // sees all, owner sees their own, participants see the ones they joined),
  // so anything in `quinielas` is already authorised — no need for a second
  // visibility filter that would also exclude an admin's own private pool
  // from being heroed when they explicitly mark it as featured.
  const heroPick = useMemo(() => {
    const adminFeatured = quinielas.find((q) => q.featured);
    if (adminFeatured) return { pool: adminFeatured, kind: 'featured' };
    const live = quinielas.find((q) => poolStatus(q, liveFixtures) === 'live');
    if (live) return { pool: live, kind: 'live' };
    const upcoming = [...quinielas]
      .filter((q) => {
        const s = poolStatus(q, liveFixtures);
        return s === 'upcoming' || s === 'open';
      })
      .sort((a, b) => {
        const ad = a.startDate ? new Date(a.startDate).getTime() : Infinity;
        const bd = b.startDate ? new Date(b.startDate).getTime() : Infinity;
        return ad - bd;
      })[0];
    if (upcoming) return { pool: upcoming, kind: 'next' };
    return { pool: null, kind: null };
  }, [quinielas, liveFixtures]);

  // Strip the hero pool from the grid below — it's already showcased
  // up top, repeating it just adds visual noise. Applies to every
  // filter (including 'mine' and 'live') since the hero represents it.
  const heroId = heroPick.pool?._id;
  const filtered = useMemo(() => {
    const base = quinielas.filter((q) => q._id !== heroId);
    if (filter === 'all') return base;
    if (filter === 'mine' && user?._id) {
      // Mine = pools I created OR pools I have entries in. The /quinielas
      // endpoint already returns the union (controller pins user-entry
      // pools to the top), so a simple filter by createdBy keeps this
      // honest with the mobile filter.
      return base.filter((q) => q.createdBy === user._id);
    }
    return base.filter((q) => poolStatus(q, liveFixtures) === filter);
  }, [filter, quinielas, liveFixtures, user, heroId]);

  // Counts mirror what the grid actually shows — the hero pool is
  // excluded everywhere so the chip number matches the cards below.
  const counts = useMemo(() => {
    const list = quinielas.filter((q) => q._id !== heroId);
    const c = { all: list.length, mine: 0, open: 0, live: 0, upcoming: 0, completed: 0 };
    for (const q of list) {
      const s = poolStatus(q, liveFixtures);
      c[s] = (c[s] || 0) + 1;
      if (user?._id && q.createdBy === user._id) c.mine += 1;
    }
    return c;
  }, [quinielas, liveFixtures, user, heroId]);

  const filterChips = [
    { id: 'all',       label: t(locale, 'All') },
    { id: 'mine',      label: t(locale, 'Mine') },
    { id: 'open',      label: t(locale, 'Open') },
    { id: 'live',      label: 'LIVE' },
    { id: 'upcoming',  label: t(locale, 'Upcoming') },
    { id: 'completed', label: t(locale, 'Closed') },
  ];

  return (
    <div className="fp-desktop-wide">
      {heroPick.pool && (
        <Hero
          pool={heroPick.pool}
          kind={heroPick.kind}
          isLive={poolStatus(heroPick.pool, liveFixtures) === 'live'}
          canJoin={canJoinPool(heroPick.pool, liveFixtures)}
          locale={locale}
          navigate={navigate}
        />
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginTop: 'var(--app-space-8)', marginBottom: 'var(--app-space-5)',
        gap: 'var(--app-space-4)', flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t(locale, 'All pools')}
          </h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {t(locale, 'Pick a pool and submit your predictions before the first kickoff.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filterChips.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`fp-chip ${filter === c.id ? 'active' : ''}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
              <span className="count num">{counts[c.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && quinielas.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--fp-text-dim)' }}>
          {t(locale, 'Loading pools…')}
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--fp-danger)', fontSize: 13, padding: 16 }}>{error}</div>
      )}

      {!loading && filtered.length === 0 ? (
        <div className="fp-empty">
          <h4>{t(locale, 'No pools right now')}</h4>
          {t(locale, "Check back soon or we'll notify you when new pools are available to play.")}
        </div>
      ) : (
        <div style={{
          display: 'grid', gap: 'var(--app-space-5)',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        }}>
          {filtered.map((q) => (
            <PoolCard
              key={q._id}
              q={q}
              liveFixtures={liveFixtures}
              locale={locale}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
