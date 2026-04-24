import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import {
  HudFrame, HudChip, LiveDot, TeamCrest, ArcadeButton, SectionLabel, IconButton,
} from '../arena-ui/primitives';
import { InsufficientBalanceModal } from '../components/InsufficientBalanceModal';

function ShareButton({ pool }) {
  // Pull locale from context — previously referenced as a free variable
  // which threw ReferenceError at runtime, crashing the whole PoolDetail
  // subtree into a blank screen whenever the share button tried to render.
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  // Route share links through the backend so WhatsApp / Telegram bots
  // receive a server-rendered page with og: meta tags and a fixture-card
  // image. VITE_API_URL must be an absolute URL (https://…) for this to
  // work; if it's relative or unset we fall back to the current origin.
  const apiBase = import.meta.env.VITE_API_URL || '';
  const shareOrigin = apiBase.startsWith('http')
    ? apiBase.replace(/\/$/, '')
    : (typeof window !== 'undefined' ? window.location.origin : '');
  const url = pool.inviteCode ? `${shareOrigin}/p/${pool.inviteCode}` : '';

  /// Use native share ONLY on mobile devices — desktop share sheets (Chrome,
  /// macOS) sometimes concatenate the `text`/`title` fields onto the `url`
  /// when forwarding to a target, producing garbled links like
  /// `/p/CODE Join my FutPools: Foo!`. On desktop, plain clipboard copy is
  /// both more predictable AND more useful (the user probably wants to paste
  /// the link into Slack/email/etc). We also pass ONLY the `url` field to
  /// `navigator.share` on mobile — dropping `title`/`text` prevents the same
  /// concatenation bug on any OS share targets that don't honor separation.
  const isMobileShareAvailable = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && ((navigator.userAgentData && navigator.userAgentData.mobile === true)
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''));

  const copyFallback = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Last-ditch: open a prompt so the user can copy manually.
      window.prompt(t(locale, 'Copy this link'), url);
    }
  };

  const handleClick = async () => {
    if (isMobileShareAvailable) {
      try { await navigator.share({ url }); return; }
      catch { /* fall through to copy */ }
    }
    await copyFallback();
  };

  return (
    <button type="button" onClick={handleClick} title={t(locale, 'Share invite link')}
      style={{
        width: 32, height: 32,
        background: 'var(--fp-surface)',
        border: '1px solid var(--fp-stroke)',
        color: copied ? 'var(--fp-primary)' : 'var(--fp-text)',
        fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 14,
        clipPath: 'var(--fp-clip-sm)',
        cursor: 'pointer',
      }}>{copied ? '✓' : '↗'}</button>
  );
}

function parseEntryCost(cost) {
  if (typeof cost === 'number') return cost;
  const s = String(cost || '').replace(/[^0-9.-]/g, '');
  return parseFloat(s) || 0;
}

function formatDateRange(start, end) {
  if (!start) return '—';
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  const d1 = new Date(start);
  if (!end) return d1.toLocaleString(undefined, opts);
  return `${d1.toLocaleString(undefined, opts)} – ${new Date(end).toLocaleString(undefined, opts)}`;
}

/// Derives live/upcoming/finished from actual fixture kickoffs. Prevents showing
/// "LIVE NOW" on pools whose matches are all already finished.
function statusMeta(q, locale) {
  const now = new Date();
  const fixtures = q?.fixtures || [];
  const endedByStatus = q?.status === 'completed';
  const endedByDate = q?.endDate && new Date(q.endDate) < now;
  if (endedByStatus || endedByDate) {
    return { label: t(locale, 'POOL FINISHED'), color: 'var(--fp-text-muted)', showDot: false };
  }
  const anyStarted = fixtures.some(f => f.kickoff && new Date(f.kickoff) <= now);
  if (q?.status === 'live' && anyStarted) {
    return { label: t(locale, 'LIVE NOW'), color: 'var(--fp-danger)', showDot: true };
  }
  const upcoming = fixtures
    .map(f => f.kickoff && new Date(f.kickoff))
    .filter(d => d && d > now)
    .sort((a, b) => a - b);
  if (upcoming.length) {
    const when = upcoming[0].toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }).toUpperCase();
    return { label: `${t(locale, 'OPENS')} · ${when}`, color: 'var(--fp-accent)', showDot: false };
  }
  return { label: t(locale, 'POOL FINISHED'), color: 'var(--fp-text-muted)', showDot: false };
}

export function PoolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const { locale } = useLocale();
  const [quiniela, setQuiniela] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('fixtures');
  const [entryCount, setEntryCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState(null);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showManage, setShowManage] = useState(false);
  // Map fixtureId → "1"|"X"|"2" so we can pass the user's pick into LiveMatch
  // when they tap a fixture. Mirrors iOS loadMyPicks.
  const [myPicks, setMyPicks] = useState({});
  // Map fixtureId → live fixture payload (status, score, elapsed). Polled
  // every 30s with a smart skip: only hit the API if the pool has at least
  // one fixture that's live or within ±3h of kickoff — otherwise the data
  // is stable and polling wastes quota.
  const [liveByFixture, setLiveByFixture] = useState({});

  const userBalance = user?.balance ?? 0;
  const entryCost = quiniela ? parseEntryCost(quiniela.cost) : 0;
  const hasEnoughBalance = userBalance >= entryCost;

  // Creator-only admin surface is gated by ownership AND "pool hasn't started
  // yet" (same gate the backend enforces). `isScheduled` mirrors the server's
  // computePoolStatus === 'scheduled' — we can't rely on a persisted flag
  // since status is derived on-read.
  const isOwner = !!(user?.id && quiniela?.createdBy && String(user.id) === String(quiniela.createdBy));
  const now = Date.now();
  const isScheduled = !!quiniela?.fixtures?.length && quiniela.fixtures.every(
    (f) => f.kickoff && new Date(f.kickoff).getTime() > now
  );
  const canManage = isOwner && isScheduled;
  // Once the pool starts, the manage button morphs into "view predictions" —
  // same modal, same fetch, but the backend now ships picks per entry. The
  // creator still sees the participant list either way; only the action
  // surface (delete vs. read-only picks) differs by phase.
  const canViewPicks = isOwner && !isScheduled && (quiniela?.entriesCount ?? 0) > 0;

  const canJoin = () => {
    if (!quiniela?.fixtures?.length) return false;
    const now = new Date();
    for (const f of quiniela.fixtures) {
      const kick = f.kickoff ? new Date(f.kickoff) : null;
      if (kick && kick <= now) return false;
    }
    return true;
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try { setQuiniela(await api.get(`/quinielas/${id}`)); }
    catch { setQuiniela(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  // Live score/minute polling — mirrors iOS behavior so fixtures in this
  // view animate the same way (2-2 · 81' red dot, etc.). Smart skip keeps
  // us off API-Football when the pool is all future or all finished.
  useEffect(() => {
    const fixtures = quiniela?.fixtures || [];
    if (fixtures.length === 0) return undefined;
    const ids = fixtures.map((f) => f.fixtureId).filter(Boolean);
    if (ids.length === 0) return undefined;

    const isWorthPolling = () => {
      const now = Date.now();
      const WINDOW_MS = 3 * 60 * 60 * 1000;
      return fixtures.some((f) => {
        const live = liveByFixture[f.fixtureId];
        if (live?.status?.isLive) return true;
        if (!f.kickoff) return false;
        const k = new Date(f.kickoff).getTime();
        return Math.abs(now - k) < WINDOW_MS;
      });
    };

    const refresh = async () => {
      try {
        const arr = await api.get(`/football/fixtures?ids=${ids.join(',')}`);
        const next = {};
        for (const f of arr || []) next[f.fixtureId] = f;
        setLiveByFixture(next);
      } catch { /* keep previous snapshot */ }
    };

    // Fire once on mount regardless of window, so the first paint has data.
    refresh();
    const interval = setInterval(() => {
      if (isWorthPolling()) refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [quiniela]);

  useEffect(() => {
    if (id && token) {
      api.get(`/quinielas/${id}/entries/me`, token).then(entries => {
        setEntryCount(entries?.length ?? 0);
        // Latest entry's picks win if the user has multiple entries.
        const latest = (entries || [])
          .slice()
          .sort((a, b) => (b.entryNumber ?? 0) - (a.entryNumber ?? 0))[0];
        const map = {};
        for (const p of latest?.picks || []) map[p.fixtureId] = p.pick;
        setMyPicks(map);
      }).catch(() => { setEntryCount(0); setMyPicks({}); });
    }
    if (id) {
      api.get(`/quinielas/${id}/leaderboard`).then(setLeaderboard).catch(() => setLeaderboard(null));
    }
  }, [id, token]);

  const handleJoin = () => {
    if (!canJoin()) return;
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    if (entryCost > 0 && !hasEnoughBalance) { setShowInsufficient(true); return; }
    navigate(`/pool/${id}/pick`);
  };

  if (loading || !quiniela) {
    return (
      <>
        <AppBackground />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
          {loading ? t(locale, 'Loading pools…').toUpperCase() : 'POOL NOT FOUND'}
        </div>
      </>
    );
  }

  const status = statusMeta(quiniela, locale);

  return (
    <>
      <AppBackground />

      {/* Header */}
      <div style={{ padding: '14px 16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <IconButton onClick={() => navigate(-1)}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 2,
            color: 'var(--fp-text-muted)',
          }}>
            [ POOL · {String(id).slice(-6).toUpperCase()} ]
          </div>
          {/* Right-side actions stacked: share first, rules below. Rules
              used to live in its own tab, but it's reference content that
              most users only open once — a modal off a "?" icon is a better
              fit than stealing a tab slot. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quiniela.inviteCode ? (
              <ShareButton pool={quiniela} />
            ) : (
              <div style={{ width: 32, height: 32 }} />
            )}
            <IconButton onClick={() => setShowRules(true)} aria-label={t(locale, 'GAME RULES')}>?</IconButton>
          </div>
        </div>

        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 24, fontWeight: 800,
          letterSpacing: 1, lineHeight: 1.1, marginBottom: 4,
          textTransform: 'uppercase',
        }}>{quiniela.name}</div>

        {quiniela.createdByUsername && (
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1.5,
            color: 'var(--fp-text-dim)', marginBottom: 6,
          }}>
            {t(locale, 'CREATED BY')} @{quiniela.createdByUsername.toUpperCase()}
          </div>
        )}

        {/* v3: creator's message to participants. Replaces the old
            🏆 prizeLabel row — prize is now real coins shown elsewhere. */}
        {quiniela.description && (
          <div style={{
            fontFamily: 'var(--fp-body)', fontSize: 12,
            color: 'var(--fp-text)', marginBottom: 6,
            whiteSpace: 'pre-wrap',
          }}>💬 {quiniela.description}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 8 }}>
          {status.showDot && <LiveDot color={status.color} />}
          <span style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 1, fontWeight: 700,
            color: status.color,
          }}>{status.label}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
            {(quiniela.entriesCount ?? 0)} {t(locale, 'PLAYERS')}
          </span>
        </div>

        {(canManage || canViewPicks) && (
          <button
            type="button"
            onClick={() => setShowManage(true)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'color-mix(in srgb, var(--fp-accent) 10%, var(--fp-surface) 90%)',
              border: '1px solid color-mix(in srgb, var(--fp-accent) 45%, transparent)',
              clipPath: 'var(--fp-clip-sm)',
              marginBottom: 14,
              cursor: 'pointer',
              color: 'var(--fp-accent)',
              fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800, letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            <span>◆ {t(locale, canManage ? 'MANAGE PARTICIPANTS' : 'VIEW PREDICTIONS')}</span>
            <span style={{ fontSize: 14 }}>→</span>
          </button>
        )}

        {/* Prize hero */}
        <HudFrame
          glow="var(--fp-gold)"
          bg="linear-gradient(135deg, color-mix(in srgb, var(--fp-gold) 20%, transparent), var(--fp-bg2))"
        >
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 32, filter: 'drop-shadow(0 0 8px var(--fp-gold))' }}>🏆</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--fp-text-muted)' }}>
                {t(locale, 'PRIZE POOL')}
              </div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 26, fontWeight: 800,
                color: 'var(--fp-gold)', letterSpacing: 1, lineHeight: 1,
              }}>{quiniela.prize}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--fp-text-muted)' }}>
                {t(locale, 'ENTRY')}
              </div>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 18, fontWeight: 700, color: 'var(--fp-text)' }}>
                {quiniela.cost}
              </div>
            </div>
          </div>
        </HudFrame>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 4, marginBottom: 10 }}>
        {[
          ['fixtures', t(locale, 'FIXTURES')],
          ['ranking',  t(locale, 'RANKING')],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              flex: 1, padding: '9px 8px',
              background: tab === k ? 'var(--fp-primary)' : 'var(--fp-surface-alt)',
              color: tab === k ? 'var(--fp-on-primary)' : 'var(--fp-text-dim)',
              fontFamily: 'var(--fp-display)', fontWeight: 700, fontSize: 11, letterSpacing: 2,
              clipPath: 'var(--fp-clip-sm)',
              border: 'none',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '6px 16px 140px' }}>
        {tab === 'fixtures' && (quiniela.fixtures || []).map((f) => {
          const live = liveByFixture[f.fixtureId];
          const isLive = live?.status?.isLive === true;
          const isHT = (live?.status?.short || '').toUpperCase() === 'HT';
          const FINISHED = new Set(['FT', 'AET', 'PEN']);
          const isFinal = FINISHED.has((live?.status?.short || '').toUpperCase());
          const hasScore = typeof live?.score?.home === 'number'
            && typeof live?.score?.away === 'number';
          const showScoreBlock = hasScore && (isLive || isFinal);
          const minute = live?.status?.elapsed;
          return (
            <button
              key={f.fixtureId}
              type="button"
              onClick={() => navigate(`/fixture/${f.fixtureId}`, {
                state: { fixture: f, userPick: myPicks[f.fixtureId] || null },
              })}
              style={{
                width: '100%', padding: 0, marginBottom: 8, cursor: 'pointer',
                background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left',
                // Red glow around rows that are live right now — matches the
                // iOS "live card" treatment so the user's eye jumps to them.
                filter: isLive && !isHT
                  ? 'drop-shadow(0 0 10px color-mix(in srgb, var(--fp-danger) 45%, transparent))'
                  : undefined,
              }}
            >
              <HudFrame>
                <div style={{ padding: 12 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', marginBottom: 10,
                    fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
                    color: 'var(--fp-text-muted)',
                  }}>
                    <span>
                      {f.kickoff ? new Date(f.kickoff).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase() : ''}
                    </span>
                    <span style={{ flex: 1 }} />
                    {isLive && !isHT && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        color: 'var(--fp-danger)', fontWeight: 800,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--fp-danger)',
                          boxShadow: '0 0 6px var(--fp-danger)',
                        }} />
                        {minute != null ? `${minute}'` : 'LIVE'}
                      </span>
                    )}
                    {isHT && (
                      <span style={{ color: 'var(--fp-gold)', fontWeight: 800 }}>HT</span>
                    )}
                    {isFinal && (
                      <span style={{ color: 'var(--fp-text-muted)', fontWeight: 800 }}>FT</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <TeamCrest name={f.homeTeam} logoURL={live?.logos?.home || f.homeLogo} size={32} />
                      <div style={{
                        fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 700,
                        letterSpacing: 0.5, textTransform: 'uppercase',
                      }}>{String(f.homeTeam).slice(0, 3)}</div>
                    </div>
                    {showScoreBlock ? (
                      <div style={{
                        padding: '4px 12px',
                        background: 'var(--fp-bg2)',
                        border: `1px solid ${isLive && !isHT ? 'color-mix(in srgb, var(--fp-danger) 50%, transparent)' : 'var(--fp-stroke)'}`,
                        clipPath: 'var(--fp-clip-sm)',
                        fontFamily: 'var(--fp-display)', fontSize: 18, fontWeight: 900,
                        letterSpacing: 1, color: 'var(--fp-text)',
                        minWidth: 64, textAlign: 'center',
                      }}>
                        {live.score.home}–{live.score.away}
                      </div>
                    ) : (
                      <div style={{
                        fontFamily: 'var(--fp-display)', fontSize: 10, letterSpacing: 2,
                        color: 'var(--fp-text-muted)',
                      }}>VS</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                      <div style={{
                        fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 700,
                        letterSpacing: 0.5, textTransform: 'uppercase',
                      }}>{String(f.awayTeam).slice(0, 3)}</div>
                      <TeamCrest name={f.awayTeam} logoURL={live?.logos?.away || f.awayLogo} size={32} />
                    </div>
                  </div>
                </div>
              </HudFrame>
            </button>
          );
        })}

        {tab === 'ranking' && (
          <LeaderboardPanel leaderboard={leaderboard} locale={locale} />
        )}
      </div>

      {/* Sticky CTA */}
      <div style={{
        position: 'fixed',
        bottom: 104, // clear the tab bar (88 + 16 margin)
        left: 0, right: 0,
        maxWidth: 430, margin: '0 auto',
        padding: '8px 16px 0',
        background: 'linear-gradient(180deg, transparent, var(--fp-bg) 40%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <ArcadeButton
            size="lg"
            fullWidth
            disabled={!canJoin()}
            onClick={handleJoin}
          >
            {canJoin()
              ? `▶ ${entryCount > 0 ? t(locale, 'NEW ENTRY') : t(locale, 'MAKE PICKS')} · ${quiniela.cost}`
              : t(locale, 'POOL LOCKED')}
          </ArcadeButton>
        </div>
      </div>

      {showInsufficient && (
        <InsufficientBalanceModal
          entryCost={entryCost}
          currentBalance={userBalance}
          onRecharge={() => { setShowInsufficient(false); navigate('/shop'); }}
          onClose={() => setShowInsufficient(false)}
        />
      )}

      {showRules && (
        <RulesModal
          locale={locale}
          quiniela={quiniela}
          onClose={() => setShowRules(false)}
        />
      )}

      {showManage && (
        <ParticipantManageModal
          locale={locale}
          quinielaId={id}
          token={token}
          fixtures={quiniela.fixtures || []}
          liveByFixture={liveByFixture}
          onClose={() => setShowManage(false)}
          onMutated={() => load()}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Leaderboard — podium for top 3 + compact table below. Mirrors iOS
// ArenaLeaderboardPanel so the two platforms feel identical.
// ────────────────────────────────────────────────────────────────────

function LeaderboardPanel({ leaderboard, locale }) {
  const rows = leaderboard?.entries || leaderboard?.leaderboard || [];
  // `totalPossible` = 0 for every row until at least one fixture is FT. We
  // still render participants so the board doesn't look broken, but swap the
  // podium for a "ranked by join order" banner until real scores land.
  const awaitingFirstResult = rows.length > 0 && (rows[0]?.totalPossible ?? 0) === 0;
  const showPodium = rows.length >= 3 && !awaitingFirstResult;

  return (
    <HudFrame>
      <div style={{ padding: 14 }}>
        <SectionLabel color="var(--fp-primary)">◆ {t(locale, 'LEADERBOARD')}</SectionLabel>
        <div style={{ height: 14 }} />

        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--fp-text-dim)' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>👥</div>
            <div style={{
              fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 13,
              color: 'var(--fp-text-muted)',
            }}>{t(locale, 'No entries yet')}</div>
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, marginTop: 4 }}>
              {t(locale, 'Be the first to join!')}
            </div>
          </div>
        ) : (
          <>
            {awaitingFirstResult && (
              <div style={{
                fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                color: 'var(--fp-accent)', marginBottom: 10,
              }}>
                {t(locale, 'RANKED BY JOIN ORDER · RESULTS PENDING')}
              </div>
            )}

            {showPodium && (
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 8, height: 140,
                paddingBottom: 2, marginBottom: 14,
                borderBottom: '1px solid var(--fp-stroke)',
              }}>
                <PodiumColumn rank={2} row={rows[1]} height={70}  tint="#C6CED9" />
                <PodiumColumn rank={1} row={rows[0]} height={100} tint="#FFD166" />
                <PodiumColumn rank={3} row={rows[2]} height={55}  tint="#C8925B" />
              </div>
            )}

            {(awaitingFirstResult ? rows : rows.slice(3)).slice(0, 12).map((e, idx) => {
              const displayRank = awaitingFirstResult ? (idx + 1) : (idx + 4);
              return (
                <div
                  key={e.entryId || e.userId || e.rank || displayRank}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 4px',
                    background: e.isSelf ? 'color-mix(in srgb, var(--fp-primary) 15%, transparent)' : 'transparent',
                    borderBottom: '1px solid var(--fp-stroke)',
                    clipPath: e.isSelf ? 'var(--fp-clip-sm)' : 'none',
                  }}
                >
                  <div style={{
                    width: 24, textAlign: 'center',
                    fontFamily: 'var(--fp-mono)', fontSize: 12, fontWeight: 700,
                    color: 'var(--fp-text-dim)',
                  }}>{displayRank}</div>
                  <div style={{
                    flex: 1,
                    fontFamily: 'var(--fp-mono)', fontSize: 12,
                    color: 'var(--fp-text)',
                  }}>{e.displayName || e.userId || 'player'}</div>
                  <div style={{
                    fontFamily: 'var(--fp-mono)', fontSize: 13, fontWeight: 700,
                    color: awaitingFirstResult ? 'var(--fp-text-dim)' : 'var(--fp-primary)',
                  }}>
                    {awaitingFirstResult ? '—' : `${e.score}/${e.totalPossible}`}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </HudFrame>
  );
}

function PodiumColumn({ rank, row, height, tint }) {
  const name = row?.displayName || row?.userId || 'player';
  const score = row?.score ?? 0;
  const total = row?.totalPossible ?? 0;
  const initial = String(name).charAt(0).toUpperCase();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* Avatar medallion */}
      <div style={{
        width: 40, height: 40, borderRadius: 6,
        background: `color-mix(in srgb, ${tint} 30%, transparent)`,
        border: `2px solid ${tint}`,
        boxShadow: `0 0 12px ${tint}aa`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--fp-display)', fontSize: 18, fontWeight: 900,
        color: 'var(--fp-on-primary)',
      }}>{initial}</div>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 600,
        color: 'var(--fp-text)', maxWidth: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</div>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700,
        color: tint,
      }}>{score}/{total}</div>
      {/* Pillar — cut-corner block scaled by rank */}
      <div style={{
        width: '100%', height,
        background: `linear-gradient(180deg, ${tint}, color-mix(in srgb, ${tint} 40%, transparent))`,
        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)',
        position: 'relative',
        marginTop: 4,
      }}>
        <div style={{
          position: 'absolute', top: 6, left: 0, right: 0, textAlign: 'center',
          fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 900,
          color: 'var(--fp-on-primary)',
        }}>{rank}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Rules modal — moved out of the tab bar. Triggered by the "?" icon
// in the header. Content is tailored to the pool's funding model so
// users only read the rules that actually apply to them.
// ────────────────────────────────────────────────────────────────────

function rulesForPool(q, locale) {
  const fundingModel = q?.fundingModel || 'none';
  const entryCost = q?.entryCostCoins || 0;
  const prizeCoins = q?.platformPrizeCoins || 0;
  const rakePct = q?.rakePercent ?? 10;

  // Prize mechanic varies by funding model — only show the one that's live.
  let prizeRule;
  if (fundingModel === 'sponsored') {
    prizeRule = prizeCoins > 0
      ? tFormat(locale, 'The creator sponsored a {n}-coin prize. Winner takes it all — no split.', { n: prizeCoins })
      : t(locale, 'The creator sponsored the prize. Winner takes it all.');
  } else if (fundingModel === 'peer' && entryCost > 0) {
    prizeRule = tFormat(locale, 'Every player pays {n} coins. Winner takes the full pot (minus a {r}% platform fee).', {
      n: entryCost, r: rakePct,
    });
  } else if (fundingModel === 'platform') {
    prizeRule = t(locale, 'Platform-funded prize. Winner takes it all if the pool fills to the minimum.');
  } else {
    prizeRule = t(locale, 'Winner takes the whole prize — no splits.');
  }

  return [
    ['01', t(locale, 'Pick 1 (home), X (draw) or 2 (away) for each match in the pool.')],
    ['02', t(locale, '+1 point for every correct pick. All matches count the same.')],
    ['03', t(locale, 'Picks lock the moment the first match kicks off. No edits after that.')],
    ['04', prizeRule],
    ['05', t(locale, 'Every pool you finish earns rating for your global rank and can unlock achievements.')],
  ];
}

function RulesModal({ locale, quiniela, onClose }) {
  const rules = rulesForPool(quiniela, locale);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 220,
        background: 'color-mix(in srgb, var(--fp-bg) 88%, transparent)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <HudFrame glow="var(--fp-primary)" brackets>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SectionLabel color="var(--fp-primary)">◆ {t(locale, 'GAME RULES')}</SectionLabel>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 16,
                  padding: 4,
                }}
              >✕</button>
            </div>
            {rules.map(([n, text]) => (
              <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 12, fontWeight: 700,
                  color: 'var(--fp-primary)', minWidth: 22,
                }}>{n}</div>
                <div style={{
                  fontFamily: 'var(--fp-body)', fontSize: 12,
                  color: 'var(--fp-text-dim)', lineHeight: 1.5,
                }}>{text}</div>
              </div>
            ))}
          </div>
        </HudFrame>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// ParticipantManageModal — creator-only admin surface. Two modes off
// the same fetch:
//   • scheduled  → manage mode: per-entry delete + full-player removal,
//                  picks hidden by the backend so the creator can't kick
//                  on the basis of who guessed well.
//   • started/   → read-only predictions view: picks per entry rendered
//     completed    with the same PickRow visual language used in
//                  MyEntries (won/lost/leading/trailing/pending).
// Mirrors the shape of `GET /quinielas/:id/participants` (see
// quinielaController.getParticipants for the contract).

function ParticipantManageModal({ locale, quinielaId, token, fixtures, liveByFixture, onClose, onMutated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Track which row is currently executing a delete so we can disable the
  // button and avoid double-click double-deletes. Keys: entryId or userId.
  const [pending, setPending] = useState(new Set());
  // In view-picks mode entries are collapsed by default — even a 5-player
  // pool with 1 entry each blows up the modal otherwise. Set holds entryIds.
  const [openEntries, setOpenEntries] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/quinielas/${quinielaId}/participants`, token);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [quinielaId, token]);

  useEffect(() => { load(); }, [load]);

  const toggleEntry = (entryId) => {
    setOpenEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId); else next.add(entryId);
      return next;
    });
  };

  const markPending = (key, on) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  };

  const handleDeleteEntry = async (entryId) => {
    const ok = window.confirm(t(locale, 'Delete this entry? Coins will be refunded if paid.'));
    if (!ok) return;
    markPending(entryId, true);
    try {
      await api.delete(`/quinielas/${quinielaId}/entries/${entryId}`, token);
      await load();
      onMutated?.();
    } catch (e) {
      setError(e.message || 'Delete failed');
    } finally {
      markPending(entryId, false);
    }
  };

  const handleRemoveParticipant = async (participant) => {
    const entries = participant.entries || [];
    if (entries.length === 0) return;
    const who = participant.user?.displayName || participant.user?.username || 'this player';
    const ok = window.confirm(
      tFormat(locale, 'Remove {who}? All {n} of their entries will be deleted (coins refunded).', {
        who, n: entries.length,
      })
    );
    if (!ok) return;
    markPending(participant.user?.id, true);
    try {
      // Fire all deletes in parallel. Backend idempotency on refund keys
      // means a partial failure followed by a retry is safe.
      await Promise.all(
        entries.map((e) => api.delete(`/quinielas/${quinielaId}/entries/${e._id}`, token))
      );
      await load();
      onMutated?.();
    } catch (e) {
      setError(e.message || 'Remove failed');
    } finally {
      markPending(participant.user?.id, false);
    }
  };

  const participants = data?.participants || [];
  const status = data?.status;
  const isScheduled = status === 'scheduled';
  // Backend authority — never assume from local state. `picksHidden` is true
  // exactly when the server suppressed picks (scheduled phase); flip the UI
  // mode off the same flag so we never render a "view picks" UI with no
  // picks attached.
  const showPicks = data?.picksHidden === false;
  const title = showPicks ? 'PARTICIPANT PREDICTIONS' : 'MANAGE PARTICIPANTS';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 430, maxHeight: '88vh', overflowY: 'auto' }}
      >
        <HudFrame>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                flex: 1,
                fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800, letterSpacing: 2,
                color: 'var(--fp-accent)',
              }}>◆ {t(locale, title)}</div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--fp-text-muted)',
                  fontSize: 20, cursor: 'pointer', padding: 4,
                }}
              >✕</button>
            </div>

            {loading ? (
              <div style={{
                padding: 24, textAlign: 'center',
                fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-dim)',
              }}>{t(locale, 'Loading…')}</div>
            ) : error ? (
              <div style={{
                padding: 10, color: 'var(--fp-danger)',
                fontFamily: 'var(--fp-mono)', fontSize: 11,
              }}>{error}</div>
            ) : participants.length === 0 ? (
              <div style={{
                padding: 24, textAlign: 'center',
                fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-muted)',
              }}>{t(locale, 'No entries yet')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {participants.map((p) => {
                  const name = p.user?.displayName || p.user?.username || '—';
                  const handle = p.user?.username ? `@${p.user.username}` : '';
                  const isPending = pending.has(p.user?.id);
                  return (
                    <div key={p.user?.id || name} style={{
                      padding: 10,
                      background: 'var(--fp-bg2)',
                      clipPath: 'var(--fp-clip-sm)',
                      border: '1px solid var(--fp-stroke)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800,
                            letterSpacing: 1, textTransform: 'uppercase',
                          }}>{name}</div>
                          <div style={{
                            fontFamily: 'var(--fp-mono)', fontSize: 9,
                            color: 'var(--fp-text-muted)',
                          }}>
                            {handle && <>{handle} · </>}{p.entryCount} {t(locale, 'ENTRIES')}
                          </div>
                        </div>
                        {isScheduled && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRemoveParticipant(p)}
                            style={{
                              padding: '6px 10px',
                              background: 'transparent',
                              border: '1px solid color-mix(in srgb, var(--fp-danger) 55%, transparent)',
                              color: 'var(--fp-danger)',
                              clipPath: 'var(--fp-clip-sm)',
                              fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 800,
                              letterSpacing: 1.5, cursor: isPending ? 'default' : 'pointer',
                              opacity: isPending ? 0.5 : 1,
                            }}
                          >{isPending ? '…' : t(locale, 'REMOVE')}</button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {p.entries.map((e) => {
                          const entryPending = pending.has(e._id);
                          const isOpen = openEntries.has(e._id);
                          const hasScore = typeof e.score === 'number' && typeof e.totalPossible === 'number' && e.totalPossible > 0;
                          // Whole row is the toggle in view-picks mode; in
                          // manage mode we keep the static header with a
                          // delete affordance (no expansion needed — picks
                          // are hidden anyway).
                          return (
                            <div key={e._id} style={{
                              background: 'var(--fp-surface)',
                              clipPath: 'var(--fp-clip-sm)',
                            }}>
                              <div
                                onClick={showPicks ? () => toggleEntry(e._id) : undefined}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '5px 8px',
                                  cursor: showPicks ? 'pointer' : 'default',
                                }}
                              >
                                <span style={{
                                  fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700,
                                  color: 'var(--fp-primary)', minWidth: 28,
                                }}>#{e.entryNumber}</span>
                                <span style={{
                                  flex: 1,
                                  fontFamily: 'var(--fp-mono)', fontSize: 9,
                                  color: 'var(--fp-text-muted)',
                                }}>
                                  {e.createdAt
                                    ? new Date(e.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                                    : ''}
                                </span>
                                {showPicks && hasScore && (
                                  <span style={{
                                    fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 800,
                                    color: 'var(--fp-gold)', letterSpacing: 1,
                                  }}>{e.score}/{e.totalPossible} {t(locale, 'PTS')}</span>
                                )}
                                {isScheduled ? (
                                  <button
                                    type="button"
                                    disabled={entryPending}
                                    onClick={() => handleDeleteEntry(e._id)}
                                    style={{
                                      background: 'transparent', border: 'none',
                                      color: 'var(--fp-danger)',
                                      fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 800,
                                      letterSpacing: 1, cursor: entryPending ? 'default' : 'pointer',
                                      opacity: entryPending ? 0.5 : 1,
                                    }}
                                  >{entryPending ? '…' : t(locale, 'DELETE')}</button>
                                ) : showPicks ? (
                                  <span style={{
                                    fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)',
                                  }}>{isOpen ? '▲' : '▼'}</span>
                                ) : null}
                              </div>

                              {showPicks && isOpen && (
                                <div style={{
                                  padding: '6px 8px 8px',
                                  display: 'flex', flexDirection: 'column', gap: 6,
                                  borderTop: '1px solid var(--fp-stroke)',
                                }}>
                                  {(fixtures || []).length === 0 ? (
                                    <div style={{
                                      fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-muted)',
                                    }}>{t(locale, 'NO PICKS YET')}</div>
                                  ) : (
                                    (fixtures || []).map((fx) => {
                                      const pick = (e.picks || []).find((p) => p.fixtureId === fx.fixtureId)?.pick;
                                      return (
                                        <ParticipantPickRow
                                          key={fx.fixtureId}
                                          fixture={fx}
                                          pick={pick}
                                          live={liveByFixture?.[fx.fixtureId]}
                                          locale={locale}
                                        />
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !error && showPicks && participants.length > 0 && (
              <div style={{
                marginTop: 12, padding: '8px 10px',
                background: 'var(--fp-surface-alt)',
                clipPath: 'var(--fp-clip-sm)',
                fontFamily: 'var(--fp-mono)', fontSize: 9,
                color: 'var(--fp-text-muted)', letterSpacing: 1,
              }}>
                {t(locale, 'Tap an entry to reveal picks.')}
              </div>
            )}
          </div>
        </HudFrame>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// ParticipantPickRow — read-only pick row for the creator's view of a
// participant's entry. Mirrors MyEntries.PickRow's color states (won /
// lost / leading / trailing / pending / missing) so picks read the same
// across surfaces — the only difference is the label says "PICK" instead
// of "YOUR PICK" since the creator isn't the picker.

const FINISHED_PICK_STATUSES = new Set(['FT', 'AET', 'PEN']);

function ParticipantPickRow({ fixture, pick, live, locale }) {
  const home = live?.score?.home;
  const away = live?.score?.away;
  const liveResult = (typeof home === 'number' && typeof away === 'number')
    ? (home > away ? '1' : home < away ? '2' : 'X')
    : null;
  const short = (live?.status?.short || '').toUpperCase();
  const isLive = live?.status?.isLive === true;
  const isFinal = FINISHED_PICK_STATUSES.has(short);

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

  const statusEl = (() => {
    switch (state) {
      case 'missing':
        return <span style={{ color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>{t(locale, 'NO PICK')}</span>;
      case 'pending':
        return <span style={{ color: 'var(--fp-accent)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>{t(locale, 'PENDING').toUpperCase()}</span>;
      case 'leading':
        return <span style={{ color: 'var(--fp-primary)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>● {t(locale, 'LEADING')}</span>;
      case 'trailing':
        return <span style={{ color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>● {t(locale, 'TRAILING')}</span>;
      case 'won':
        return <span style={{ color: 'var(--fp-primary)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>✓ +1 {t(locale, 'PT')}</span>;
      case 'lost':
        return <span style={{ color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>✗ {t(locale, 'MISSED')}</span>;
      default: return null;
    }
  })();

  const showScore = typeof home === 'number' && typeof away === 'number';

  return (
    <div style={{
      padding: '8px',
      background: 'var(--fp-surface-alt)',
      clipPath: 'var(--fp-clip-sm)',
      borderLeft: `3px solid ${palette.accent}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TeamCrest name={fixture.homeTeam} logoURL={fixture.homeLogo} size={18} />
        <span style={{
          flex: 1,
          fontFamily: 'var(--fp-display)', fontSize: 11,
          fontWeight: pick === '1' ? 800 : 500,
          color: pick === '1' ? 'var(--fp-text)' : 'var(--fp-text-dim)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{fixture.homeTeam}</span>
        <div style={{ minWidth: 46, textAlign: 'center' }}>
          {showScore ? (
            <span style={{ fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800, color: 'var(--fp-text)' }}>
              {home}–{away}
            </span>
          ) : (
            <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-dim)' }}>vs</span>
          )}
        </div>
        <span style={{
          flex: 1, textAlign: 'right',
          fontFamily: 'var(--fp-display)', fontSize: 11,
          fontWeight: pick === '2' ? 800 : 500,
          color: pick === '2' ? 'var(--fp-text)' : 'var(--fp-text-dim)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{fixture.awayTeam}</span>
        <TeamCrest name={fixture.awayTeam} logoURL={fixture.awayLogo} size={18} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: palette.badgeBg, clipPath: 'var(--fp-clip-sm)',
          fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 900,
          color: palette.fg,
        }}>
          {pick === '1' || pick === 'X' || pick === '2' ? pick : '—'}
        </div>
        <div style={{ flex: 1 }}>
          {isLive && live?.status?.elapsed != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              color: 'var(--fp-danger)',
              fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-danger)' }} />
              LIVE {live.status.elapsed}'
            </span>
          )}
        </div>
        {statusEl}
      </div>
    </div>
  );
}
