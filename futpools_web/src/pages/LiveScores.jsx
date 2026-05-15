// LiveScores.jsx — web port of the iOS SCORES tab.
//
// Mirrors Features/LiveScores/LiveScoresView.swift + ViewModel:
//   • LIVE / TODAY / TOMORROW / FAVORITES tab strip (LIVE first)
//   • Active pools banner stacked above the strip (full-width hero rows)
//   • Fixtures grouped by league with sticky headers
//   • 30s polling while tab is mounted (matches backend cache TTL)
//   • Tap a fixture → /fixture/:fixtureId (existing LiveMatch view)
//
// Favorites come from the SAME localStorage keys WebOnboarding writes:
//   onboardingTeams, onboardingLeagues       (popular enum rawValues)
//   onboardingCustomTeamIDs, onboardingCustomLeagueIDs   (api-football ids)
// So the user's iOS + web favorites stay in sync via the /users/me/onboarding
// round-trip the AuthContext does at login/register.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { HudFrame, SectionLabel } from '../arena-ui/primitives';
import { useIsDesktop } from '../desktop/useIsDesktop';
import { LiveScoresDesktop, EditFavoritesModal } from './desktop/LiveScoresDesktop';

// ── Popular enum → api-football ID maps. Mirrors POPULAR_TEAMS/LEAGUES
//    in WebOnboarding.jsx and OnbTeam/OnboardingLeague on iOS so reading
//    localStorage rawValues resolves to the same numeric IDs everywhere.
const POPULAR_TEAM_IDS = {
  realMadrid: 541, barcelona: 529, manUnited: 33, psg: 85,
  manCity: 50, liverpool: 40, bayern: 157, juventus: 496, chelsea: 49,
};
const POPULAR_LEAGUE_IDS = {
  ligaMX: 262, champions: 2, laLiga: 140, premier: 39, mls: 253, worldCup: 1,
};

const LIVE_CODES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const DONE_CODES = new Set(['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO']);
const isLiveStatus = (s) => LIVE_CODES.has(String(s || '').toUpperCase());
const isFinishedStatus = (s) => DONE_CODES.has(String(s || '').toUpperCase());

function readFavoriteTeamIDs() {
  try {
    const popularRaws = JSON.parse(localStorage.getItem('onboardingTeams') || '[]');
    const popularIDs = popularRaws.map((k) => POPULAR_TEAM_IDS[k]).filter(Boolean);
    const customIDs = JSON.parse(localStorage.getItem('onboardingCustomTeamIDs') || '[]');
    return Array.from(new Set([...popularIDs, ...customIDs])).filter(Number.isFinite);
  } catch { return []; }
}
function readFavoriteLeagueIDs() {
  try {
    const popularRaws = JSON.parse(localStorage.getItem('onboardingLeagues') || '[]');
    const popularIDs = popularRaws.map((k) => POPULAR_LEAGUE_IDS[k]).filter(Boolean);
    const customIDs = JSON.parse(localStorage.getItem('onboardingCustomLeagueIDs') || '[]');
    return Array.from(new Set([...popularIDs, ...customIDs])).filter(Number.isFinite);
  } catch { return []; }
}

const isoDate = (d) => {
  // YYYY-MM-DD in the user's local calendar, matching what they see on their
  // device. Backend treats the date as UTC-anchored.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const TABS = ['live', 'today', 'tomorrow', 'favorites'];

// ─────────────────────────────────────────────────────────────────────
// Active pool banner row — full-width hero, one per active pool.
// Mirrors ActivePoolBanner in LiveScoresView.swift.
// ─────────────────────────────────────────────────────────────────────

function prizePoolDisplay(quiniela) {
  if (typeof quiniela?.entryFeeMXN === 'number' && quiniela.entryFeeMXN > 0) {
    const entries = quiniela?.entriesCount ?? 0;
    const pot = Math.floor(entries * quiniela.entryFeeMXN * 0.65);
    return pot > 0 ? `$${pot.toLocaleString('es-MX')} MXN` : '—';
  }
  return quiniela?.prize || '—';
}

function ActivePoolBanner({ entry, locale }) {
  const now = Date.now();
  const fixtures = entry?.quiniela?.fixtures || [];
  const hasLiveFixture = fixtures.some((fx) => {
    const ko = fx.kickoff ? new Date(fx.kickoff).getTime() : null;
    return ko && ko <= now && (fx.status || '') !== 'FT' && !isFinishedStatus(fx.status);
  });
  const statusColor = hasLiveFixture ? 'var(--fp-danger)' : 'var(--fp-primary)';

  let statusLabel;
  if (hasLiveFixture) {
    statusLabel = t(locale, 'LIVE');
  } else if (entry?.quiniela?.startDate && new Date(entry.quiniela.startDate) > new Date()) {
    const diffMs = new Date(entry.quiniela.startDate).getTime() - now;
    const mins = Math.round(diffMs / 60_000);
    if (mins < 60) statusLabel = `${mins} MIN`;
    else if (mins < 1440) statusLabel = `${Math.round(mins / 60)} H`;
    else statusLabel = `${Math.round(mins / 1440)} D`;
  } else {
    statusLabel = t(locale, 'OPEN');
  }

  const score = entry?.score ?? 0;
  const total = entry?.totalPossible ?? fixtures.length;
  const showPrize = (entry?.quiniela?.entryFeeMXN ?? 0) > 0;

  return (
    <Link
      to={`/pool/${entry.quiniela._id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <HudFrame clip="lg">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 8px',
              background: `color-mix(in srgb, ${statusColor} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${statusColor} 35%, transparent)`,
              clipPath: 'var(--fp-clip-sm)',
              color: statusColor,
              fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.6,
            }}>
              {hasLiveFixture && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--fp-danger)',
                  boxShadow: '0 0 6px var(--fp-danger)',
                }} />
              )}
              {statusLabel}
            </span>
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 800,
              color: 'var(--fp-text-muted)',
            }}>›</span>
          </div>

          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 20, fontWeight: 800,
            letterSpacing: 1, textTransform: 'uppercase',
            color: 'var(--fp-text)', lineHeight: 1.1,
          }}>
            {entry.quiniela.name}
          </div>

          {showPrize && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px',
              background: 'linear-gradient(90deg, color-mix(in srgb, var(--fp-gold) 18%, transparent), color-mix(in srgb, var(--fp-gold) 4%, transparent))',
              border: '1px solid color-mix(in srgb, var(--fp-gold) 35%, transparent)',
              clipPath: 'var(--fp-clip-sm)',
            }}>
              <span style={{ fontSize: 24, filter: 'drop-shadow(0 0 8px rgba(255,209,102,0.7))' }}>🏆</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                  color: 'var(--fp-text-muted)',
                }}>{t(locale, 'PRIZE POOL')}</span>
                <span style={{
                  fontFamily: 'var(--fp-display)', fontSize: 20, fontWeight: 800,
                  color: 'var(--fp-gold)',
                }}>{prizePoolDisplay(entry.quiniela)}</span>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                  color: 'var(--fp-text-muted)',
                }}>{t(locale, 'PLAYERS')}</div>
                <div style={{
                  fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
                  color: 'var(--fp-text)',
                }}>{entry.quiniela?.entriesCount ?? 0}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: 'var(--fp-display)', fontSize: 32, fontWeight: 800,
              color: statusColor,
            }}>{score}</span>
            <span style={{
              fontFamily: 'var(--fp-display)', fontSize: 20, fontWeight: 800,
              color: 'var(--fp-text-muted)',
            }}>/ {total}</span>
            <span style={{
              fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              color: 'var(--fp-text-muted)',
            }}>{t(locale, 'PTS')}</span>
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'var(--fp-mono)', fontSize: 10,
              color: 'var(--fp-text-dim)',
            }}>{fixtures.length} {t(locale, 'FIXTURES')}</span>
          </div>
        </div>
      </HudFrame>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Fixture row — one line per match inside a league section.
// ─────────────────────────────────────────────────────────────────────

function FixtureRow({ fixture, onTap }) {
  const live = isLiveStatus(fixture.status);
  const done = isFinishedStatus(fixture.status);

  let statusBlock;
  if (live) {
    statusBlock = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--fp-danger)',
            boxShadow: '0 0 4px var(--fp-danger)',
          }} />
          <span style={{
            fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700,
            color: 'var(--fp-danger)',
          }}>LIVE</span>
        </div>
        {fixture.elapsed != null && (
          <span style={{
            fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
            color: 'var(--fp-text)',
          }}>{fixture.elapsed}'</span>
        )}
      </div>
    );
  } else if (done) {
    statusBlock = (
      <span style={{
        fontFamily: 'var(--fp-mono)', fontSize: 11, fontWeight: 700,
        color: 'var(--fp-text-muted)',
      }}>FT</span>
    );
  } else if (fixture.date) {
    const d = new Date(fixture.date);
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    statusBlock = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: 'var(--fp-mono)', fontSize: 9,
          color: 'var(--fp-text-muted)',
        }}>{weekday}</span>
        <span style={{
          fontFamily: 'var(--fp-mono)', fontSize: 12, fontWeight: 700,
          color: 'var(--fp-text)',
        }}>{time}</span>
      </div>
    );
  } else {
    statusBlock = (
      <span style={{
        fontFamily: 'var(--fp-mono)', fontSize: 11,
        color: 'var(--fp-text-dim)',
      }}>—</span>
    );
  }

  const teamLine = (team, score) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {team?.logo && (
        <img
          src={team.logo}
          alt=""
          style={{ width: 18, height: 18, objectFit: 'contain' }}
        />
      )}
      <span style={{
        flex: 1,
        fontFamily: 'var(--fp-body)', fontSize: 13, fontWeight: 600,
        color: 'var(--fp-text)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{team?.name || '—'}</span>
      {score != null && (
        <span style={{
          fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
          color: live ? 'var(--fp-danger)' : 'var(--fp-text)',
        }}>{score}</span>
      )}
    </div>
  );

  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <HudFrame clip="sm">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
          <div style={{ width: 56, flexShrink: 0 }}>{statusBlock}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            {teamLine(fixture.teams?.home, fixture.goals?.home)}
            {teamLine(fixture.teams?.away, fixture.goals?.away)}
          </div>
        </div>
      </HudFrame>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// League header — sticky group label with league badge.
// ─────────────────────────────────────────────────────────────────────

function LeagueHeader({ group }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 2,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px',
      background: 'var(--fp-bg)',
    }}>
      {group.logo && (
        <img src={group.logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
      )}
      <span style={{
        fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 800,
        letterSpacing: 2, color: 'var(--fp-text-muted)',
        textTransform: 'uppercase',
      }}>{group.name}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab strip — one button per tab, mirrors HudCornerCutShape look.
// ─────────────────────────────────────────────────────────────────────

function TabStrip({ active, onChange, locale, isDesktop }) {
  const labels = {
    live: t(locale, 'LIVE'),
    today: t(locale, 'TODAY'),
    tomorrow: t(locale, 'TOMORROW'),
    favorites: t(locale, 'FAVORITES'),
  };
  // Desktop variant uses the design's pill-tabs (.fp-tabs) — softer
  // rounded pills inside a card. Mobile keeps the angular HUD-cut chips.
  if (isDesktop) {
    return (
      <div className="fp-tabs" style={{ marginBottom: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={tab === active ? 'active' : ''}
            onClick={() => onChange(tab)}
          >{labels[tab]}</button>
        ))}
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', gap: 6,
      padding: '0 16px 10px',
    }}>
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            style={{
              flex: 1,
              padding: '8px 6px',
              background: isActive ? 'var(--fp-primary)' : 'transparent',
              color: isActive ? 'var(--fp-on-primary)' : 'var(--fp-text-dim)',
              border: `1px solid ${isActive ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
              clipPath: 'var(--fp-clip-sm)',
              fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              cursor: 'pointer',
            }}
          >
            {labels[tab]}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────

export function LiveScores() {
  const { token, isAuthenticated } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();

  const [tab, setTab] = useState('live');
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePools, setActivePools] = useState([]);
  // EditFavoritesModal state — same modal mobile + desktop share.
  // favoritesVersion bumps after a save so the favoriteTeamIDs/LeagueIDs
  // reads re-fetch from localStorage and the FAVORITES tab refreshes.
  const [showEditFavorites, setShowEditFavorites] = useState(false);
  const [favoritesVersion, setFavoritesVersion] = useState(0);
  const pollTimer = useRef(null);

  // Snapshot of favorites once per render — re-read on tab change so a user
  // who just updated their picks in onboarding sees the new set.
  // favoritesVersion in deps so saving the modal triggers a re-read.
  const favoriteTeamIDs = useMemo(() => readFavoriteTeamIDs(), [tab, favoritesVersion]);
  const favoriteLeagueIDs = useMemo(() => readFavoriteLeagueIDs(), [tab, favoritesVersion]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let path;
      if (tab === 'live') {
        path = '/football/fixtures/feed?live=true';
      } else {
        if (favoriteLeagueIDs.length === 0 && favoriteTeamIDs.length === 0) {
          setFixtures([]);
          return;
        }
        const date = isoDate(
          tab === 'tomorrow'
            ? new Date(Date.now() + 24 * 60 * 60 * 1000)
            : new Date()
        );
        const leagues = favoriteLeagueIDs.join(',');
        const teams = favoriteTeamIDs.join(',');
        path = `/football/fixtures/feed?date=${date}&leagues=${leagues}&teams=${teams}`;
      }
      const payload = await api.get(path);
      setFixtures(Array.isArray(payload) ? payload : []);
    } catch {
      // Silent failure — keep the previous snapshot so a flaky network
      // doesn't blank the UI mid-poll.
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab, favoriteLeagueIDs, favoriteTeamIDs]);

  // Load active pools once per mount — pool state changes slowly relative
  // to live scores so no polling needed here.
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !token) { setActivePools([]); return undefined; }
    (async () => {
      try {
        const entries = await api.get('/quinielas/entries/me', token);
        if (cancelled || !Array.isArray(entries)) return;
        const now = Date.now();
        const isFx = (fx, predicate) => predicate(fx);
        const fxLive = (fx) => isLiveStatus(fx?.status);
        const fxUpcoming = (fx) => fx?.kickoff && new Date(fx.kickoff).getTime() > now;
        const poolActive = (e) => {
          const fixtures = e?.quiniela?.fixtures || [];
          if (!fixtures.length) return false;
          return fixtures.some((fx) => isFx(fx, fxLive) || isFx(fx, fxUpcoming));
        };
        const poolLive = (e) => (e?.quiniela?.fixtures || []).some(fxLive);
        const sorted = entries
          .filter(poolActive)
          .sort((a, b) => {
            const aLive = poolLive(a);
            const bLive = poolLive(b);
            if (aLive !== bLive) return aLive ? -1 : 1;
            const ad = a?.quiniela?.startDate ? new Date(a.quiniela.startDate).getTime() : Infinity;
            const bd = b?.quiniela?.startDate ? new Date(b.quiniela.startDate).getTime() : Infinity;
            return ad - bd;
          });
        setActivePools(sorted);
      } catch {
        setActivePools([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, token]);

  // Load + poll on tab change. 30s cadence matches the backend feed cache.
  useEffect(() => {
    refresh(false);
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => refresh(true), 30_000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [refresh]);

  // Group + sort: leagues sorted by earliest fixture; within each, fixtures
  // by kickoff (live-first sort happens at the backend already).
  const groups = useMemo(() => {
    const visible = tab === 'favorites' && favoriteTeamIDs.length
      ? fixtures.filter((f) => {
        const h = f?.teams?.home?.id ?? -1;
        const a = f?.teams?.away?.id ?? -1;
        return favoriteTeamIDs.includes(h) || favoriteTeamIDs.includes(a);
      })
      : fixtures;
    const byLeague = new Map();
    for (const fx of visible) {
      const lid = fx?.league?.id ?? -1;
      if (!byLeague.has(lid)) byLeague.set(lid, { id: lid, name: fx?.league?.name || 'FOOTBALL', logo: fx?.league?.logo, fixtures: [] });
      byLeague.get(lid).fixtures.push(fx);
    }
    const arr = Array.from(byLeague.values());
    for (const g of arr) {
      g.fixtures.sort((a, b) => {
        const ad = a?.date ? new Date(a.date).getTime() : Infinity;
        const bd = b?.date ? new Date(b.date).getTime() : Infinity;
        return ad - bd;
      });
    }
    arr.sort((a, b) => {
      const ad = a.fixtures[0]?.date ? new Date(a.fixtures[0].date).getTime() : Infinity;
      const bd = b.fixtures[0]?.date ? new Date(b.fixtures[0].date).getTime() : Infinity;
      return ad - bd;
    });
    return arr;
  }, [fixtures, tab, favoriteTeamIDs]);

  const hasFavorites = favoriteTeamIDs.length > 0 || favoriteLeagueIDs.length > 0;
  const isDesktop = useIsDesktop();

  // Desktop variant — full design_handoff_live_scores layout (4 tabs,
  // per-fixture favorites, league groups as unified cards). Mobile keeps
  // the existing in-frame layout below.
  if (isDesktop) return <LiveScoresDesktop />;

  // Desktop reduces the chrome (no big sticky header — the topbar already
  // shows the breadcrumb) and widens the fixture rows into a 2-col
  // responsive grid. Mobile stays a single-column phone-frame layout.
  const horizontalPad = isDesktop ? 0 : 16;
  const fixtureGrid = isDesktop
    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 8 }
    : { display: 'flex', flexDirection: 'column', gap: 6 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header — only render the big "LIVE SCORES" title on mobile.
          On desktop the breadcrumb in the topbar carries this. */}
      {!isDesktop && (
        <div style={{
          padding: '14px 16px 6px',
          borderBottom: '1px solid var(--fp-stroke)',
          background: 'linear-gradient(180deg, var(--fp-bg2), transparent)',
        }}>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 24, fontWeight: 800,
            letterSpacing: 3, textTransform: 'uppercase',
            color: 'var(--fp-text)',
          }}>{t(locale, 'LIVE SCORES')}</div>
        </div>
      )}
      {isDesktop && (
        <div className="fp-desktop-page-head">
          <div>
            <h1 className="fp-desktop-page-title">{t(locale, 'LIVE SCORES')}</h1>
            <p className="fp-desktop-page-sub">
              {t(locale, 'Live football and your active pools at a glance.')}
            </p>
          </div>
        </div>
      )}

      {/* Active pools banner (only when authed + has active pools) */}
      {activePools.length > 0 && (
        <div style={{ padding: isDesktop ? '0 0 24px' : '12px 16px 0' }}>
          <div style={{ marginBottom: 8 }}>
            <SectionLabel>◆ {t(locale, 'MY ACTIVE POOLS')}</SectionLabel>
          </div>
          <div style={isDesktop
            ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }
            : { display: 'flex', flexDirection: 'column', gap: 10 }
          }>
            {activePools.map((entry) => (
              <ActivePoolBanner key={entry._id} entry={entry} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {!isDesktop && <div style={{ height: 12 }} />}
      <TabStrip active={tab} onChange={setTab} locale={locale} isDesktop={isDesktop} />

      {/* Content */}
      {loading && fixtures.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--fp-text-dim)' }}>
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 2,
          }}>{t(locale, 'LOADING FIXTURES…')}</div>
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          tab={tab}
          hasFavorites={hasFavorites}
          locale={locale}
          navigate={navigate}
          onEditFavorites={() => setShowEditFavorites(true)}
        />
      ) : (
        <div style={{ paddingBottom: 24 }}>
          {groups.map((group) => (
            <section key={group.id} style={{ marginBottom: isDesktop ? 16 : 4 }}>
              <LeagueHeader group={group} />
              <div style={{ padding: `0 ${horizontalPad}px`, ...fixtureGrid }}>
                {group.fixtures.map((fx) => (
                  <FixtureRow
                    key={fx.fixtureId}
                    fixture={fx}
                    onTap={() => navigate(`/fixture/${fx.fixtureId}`)}
                  />
                ))}
              </div>
            </section>
          ))}
          {tab === 'favorites' && (
            <div style={{
              display: 'flex', justifyContent: 'center',
              padding: '8px 16px 16px',
            }}>
              <button
                type="button"
                onClick={() => setShowEditFavorites(true)}
                style={{
                  padding: '8px 14px',
                  background: 'var(--fp-surface)',
                  color: 'var(--fp-text)',
                  border: '1px solid var(--fp-stroke)',
                  clipPath: 'var(--fp-clip-sm)',
                  fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 700,
                  letterSpacing: 1.5, cursor: 'pointer',
                }}
              >✎ {t(locale, 'EDIT FAVORITES')}</button>
            </div>
          )}
        </div>
      )}

      {showEditFavorites && (
        <EditFavoritesModal
          locale={locale}
          onClose={() => setShowEditFavorites(false)}
          onSaved={() => {
            setShowEditFavorites(false);
            setFavoritesVersion((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state — distinct copy per tab (mirrors iOS).
// ─────────────────────────────────────────────────────────────────────

function EmptyState({ tab, hasFavorites, locale, navigate, onEditFavorites }) {
  if (tab === 'live') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 32px', textAlign: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
          letterSpacing: 2, color: 'var(--fp-text)',
        }}>{t(locale, 'NO LIVE GAMES')}</div>
        <div style={{
          fontFamily: 'var(--fp-body)', fontSize: 12, color: 'var(--fp-text-dim)',
        }}>{t(locale, 'Nothing kicking off worldwide right now. Check TODAY for upcoming.')}</div>
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '60px 32px', textAlign: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>⚽</div>
      <div style={{
        fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
        letterSpacing: 2, color: 'var(--fp-text)',
      }}>
        {hasFavorites
          ? t(locale, 'NO FIXTURES')
          : t(locale, 'PICK YOUR FAVORITES')}
      </div>
      <div style={{
        fontFamily: 'var(--fp-body)', fontSize: 12, color: 'var(--fp-text-dim)',
      }}>
        {hasFavorites
          ? t(locale, 'Nothing scheduled in your leagues today. Try TOMORROW.')
          : t(locale, 'Add favorite teams or leagues from your profile to see live scores.')}
      </div>
      {/* Always offer the editor on the FAVORITES tab — both when the
          user has nothing yet (CTA call to action) and when they have
          favorites but none are scheduled (lets them add more). On the
          other tabs the button only shows when no favorites exist
          (matches the original mobile UX). */}
      {(tab === 'favorites' || !hasFavorites) && onEditFavorites && (
        <button
          type="button"
          onClick={onEditFavorites}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            background: 'var(--fp-primary)',
            color: 'var(--fp-on-primary)',
            border: 'none',
            clipPath: 'var(--fp-clip-sm)',
            fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 800,
            letterSpacing: 2, cursor: 'pointer',
          }}
        >▶ {hasFavorites
            ? t(locale, 'EDIT FAVORITES')
            : t(locale, 'PICK FAVORITES')}</button>
      )}
    </div>
  );
}
