// LiveScoresDesktop — desktop layout for /scores.
//
// Two tabs only — both operate on the same global live-feed:
//   • EN VIVO — every live football fixture worldwide
//     (/football/fixtures/feed?live=true)
//   • FAVORITOS — that same feed filtered to the user's favorite TEAMS
//     and LEAGUES picked at onboarding. There is no per-fixture
//     favoriting on this page — favorites = onboarding selections,
//     stored in localStorage by WebOnboarding under
//     onboardingTeams / onboardingLeagues / onboardingCustom*IDs.
//
// 30s polling silent (matches the backend feed cache).
// Page width capped to 960px so the score column stays close to the
// teams (a row at 1920-wide drifted the score ~1500px from the left).
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { t, tFormat } from '../../i18n/translations';

// NOTE: do NOT wrap this page in <DesktopShellChrome>. /scores is a
// nested route under MainTabs which already mounts the desktop shell
// (sidebar + topbar) via the routed <DesktopShell>. Wrapping again
// produces a double shell. Top-level routes (PoolDetail, QuinielaPick)
// are the ones that need DesktopShellChrome.

// Popular team + league catalogs — the same ones WebOnboarding offers.
// Kept inline rather than imported so this file is self-contained AND so
// the EditFavoritesModal below can render the picker rows without
// pulling onboarding internals.
const POPULAR_TEAMS = [
  { id: 541, key: 'realMadrid', name: 'Real Madrid' },
  { id: 529, key: 'barcelona',  name: 'Barcelona' },
  { id: 33,  key: 'manUnited',  name: 'Manchester United' },
  { id: 85,  key: 'psg',        name: 'PSG' },
  { id: 50,  key: 'manCity',    name: 'Manchester City' },
  { id: 40,  key: 'liverpool',  name: 'Liverpool' },
  { id: 157, key: 'bayern',     name: 'Bayern Munich' },
  { id: 496, key: 'juventus',   name: 'Juventus' },
  { id: 49,  key: 'chelsea',    name: 'Chelsea' },
];
const POPULAR_LEAGUES = [
  { id: 1,   key: 'worldCup',  name: 'World Cup',         flag: '🏆' },
  { id: 262, key: 'ligaMX',    name: 'Liga MX',           flag: '🇲🇽' },
  { id: 2,   key: 'champions', name: 'Champions League',  flag: '⚽' },
  { id: 140, key: 'laLiga',    name: 'LaLiga',            flag: '🇪🇸' },
  { id: 39,  key: 'premier',   name: 'Premier League',    flag: '🇬🇧' },
  { id: 253, key: 'mls',       name: 'MLS',               flag: '🇺🇸' },
];
// Lookup tables used by readFavoriteTeamIDs/LeagueIDs to resolve enum
// rawValues ('realMadrid' → 541) into api-football IDs.
const POPULAR_TEAM_IDS = Object.fromEntries(POPULAR_TEAMS.map((t) => [t.key, t.id]));
const POPULAR_LEAGUE_IDS = Object.fromEntries(POPULAR_LEAGUES.map((l) => [l.key, l.id]));
const teamLogo = (id) => `https://media.api-sports.io/football/teams/${id}.png`;
const leagueLogo = (id) => `https://media.api-sports.io/football/leagues/${id}.png`;
const LIVE_CODES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const isLiveStatus = (s) => LIVE_CODES.has(String(s || '').toUpperCase());

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

// YYYY-MM-DD in the user's local calendar (matches what they see on their
// device). The backend treats the date as UTC-anchored.
const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtKick = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Stable hue per league name so the badge gradient is consistent across
// reloads. Hash → 0-360.
function hueFor(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

// ─────────────────────────────────────────────────────────────────────
// League badge — small colored chip with the league initial.
// ─────────────────────────────────────────────────────────────────────

function LeagueBadge({ name, logo }) {
  // Real league crest from api-football when present (mapFixturePreview
  // ships f.league.logo). Falls back to the colored-initial badge so a
  // missing logo doesn't leave a hole.
  if (logo) {
    return (
      <img
        src={logo} alt=""
        style={{
          width: 18, height: 18, borderRadius: 4,
          objectFit: 'contain', flexShrink: 0,
          background: 'rgba(255,255,255,0.04)',
          padding: 1,
        }}
      />
    );
  }
  const hue = hueFor(name);
  return (
    <div style={{
      width: 18, height: 18, borderRadius: 5,
      background: `linear-gradient(135deg, hsl(${hue} 60% 36%), hsl(${hue} 60% 22%))`,
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'grid', placeItems: 'center',
      color: '#fff', fontSize: 9, fontWeight: 800,
      flexShrink: 0,
    }}>{(name?.[0] || '?').toUpperCase()}</div>
  );
}

// Small circular crest with team initials. Logo image rendered when
// available (api-football URLs); falls back to initials in a gradient.
function TeamCrest({ name, logo }) {
  if (logo) {
    return (
      <img
        src={logo} alt=""
        style={{
          width: 28, height: 28, borderRadius: '50%',
          objectFit: 'contain', flexShrink: 0,
          background: 'var(--fp-surface-alt)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />
    );
  }
  const hue = hueFor(name);
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: `linear-gradient(135deg, hsl(${hue} 50% 30%), hsl(${hue} 60% 18%))`,
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'grid', placeItems: 'center',
      color: '#fff', fontSize: 11, fontWeight: 700,
      flexShrink: 0,
    }}>{(name?.[0] || '?').toUpperCase()}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Score row — compact single line per fixture.
// ─────────────────────────────────────────────────────────────────────

function ScoreRow({ fixture, onTap }) {
  const live = isLiveStatus(fixture.status);
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  return (
    <div
      onClick={onTap}
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr 64px',
        alignItems: 'center', gap: 14,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {live ? (
          <>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
              color: 'var(--fp-danger)', textTransform: 'uppercase',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--fp-danger)',
                animation: 'fp-pulse 1.6s infinite ease-out',
              }} />
              LIVE
            </span>
            <span style={{
              fontSize: 14, fontWeight: 800,
              color: 'var(--fp-danger)',
              fontVariantNumeric: 'tabular-nums',
            }}>{fixture.elapsed != null ? `${fixture.elapsed}'` : ''}</span>
          </>
        ) : (
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: 'var(--fp-text-dim)',
            fontVariantNumeric: 'tabular-nums',
          }}>{fixture.date ? fmtKick(fixture.date) : '—'}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <TeamCrest name={home?.name} logo={home?.logo} />
          <span style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--fp-text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{home?.name || '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <TeamCrest name={away?.name} logo={away?.logo} />
          <span style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--fp-text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{away?.name || '—'}</span>
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        alignItems: 'flex-end', justifyContent: 'center',
        textAlign: 'right',
      }}>
        {live ? (
          <>
            <span style={{
              fontSize: 18, fontWeight: 800, lineHeight: 1.4,
              color: 'var(--fp-text)',
              fontVariantNumeric: 'tabular-nums',
            }}>{fixture.goals?.home ?? 0}</span>
            <span style={{
              fontSize: 18, fontWeight: 800, lineHeight: 1.4,
              color: 'var(--fp-text)',
              fontVariantNumeric: 'tabular-nums',
            }}>{fixture.goals?.away ?? 0}</span>
          </>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--fp-text-muted)',
          }}>VS</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// League group — header + unified row card.
// ─────────────────────────────────────────────────────────────────────

function LeagueGroup({ group, onTap, locale }) {
  const country = group.country || '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px',
        color: 'var(--fp-text-dim)',
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        <LeagueBadge name={group.name} logo={group.logo} />
        <span style={{ color: 'var(--fp-text)' }}>{group.name}</span>
        {country && (
          <span style={{ color: 'var(--fp-text-muted)', fontSize: 11 }}>· {country}</span>
        )}
        <span style={{
          color: 'var(--fp-text-muted)', fontSize: 11,
          marginLeft: 'auto',
        }}>
          {group.fixtures.length === 1
            ? t(locale, '1 match')
            : tFormat(locale, '{n} matches', { n: group.fixtures.length })}
        </span>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--fp-stroke)',
        borderRadius: 16,
        background: 'var(--fp-surface)',
        overflow: 'hidden',
      }}>
        {group.fixtures.map((fx, idx) => {
          // Strip the bottom border on the last row so the card edge
          // doesn't show a stray hairline.
          const isLast = idx === group.fixtures.length - 1;
          return (
            <div
              key={fx.fixtureId}
              style={{
                borderBottom: isLast ? 'none' : undefined,
              }}
            >
              <ScoreRow
                fixture={fx}
                onTap={() => onTap(fx.fixtureId)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

// Two tabs only — this page is 'Marcadores en vivo'. Hoy/Mañana belonged
// to a 'fixture browser' surface; for live scores they don't add value.
const TABS = ['live', 'favorites'];

export function LiveScoresDesktop() {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const [tab, setTab] = useState('live');
  const [showEditFavorites, setShowEditFavorites] = useState(false);
  // Bumped after the EditFavoritesModal saves so the useMemo readers
  // for favoriteTeamIDs/LeagueIDs re-fetch from localStorage.
  const [favoritesVersion, setFavoritesVersion] = useState(0);

  // Single feed: all globally-live fixtures. Both EN VIVO and FAVORITOS
  // render from this list — favorites just filters by the user's
  // onboarding-selected teams + leagues.
  const [liveFixtures, setLiveFixtures] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollTimer = useRef(null);

  // Onboarding-derived favorites. WebOnboarding writes these to
  // localStorage at signup; the EditFavoritesModal below also writes
  // them. favoritesVersion is bumped after a save so these re-read.
  const favoriteTeamIDs = useMemo(
    () => readFavoriteTeamIDs(),
    [tab, liveFixtures, favoritesVersion],
  );
  const favoriteLeagueIDs = useMemo(
    () => readFavoriteLeagueIDs(),
    [tab, liveFixtures, favoritesVersion],
  );
  const hasAnyFavorite = favoriteTeamIDs.length > 0 || favoriteLeagueIDs.length > 0;

  // Refresh the live feed. Used on mount and every 30s by the poll.
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.get('/football/fixtures/feed?live=true');
      setLiveFixtures(Array.isArray(data) ? data : []);
    } catch {
      // Silent — keep previous snapshot so a flaky network doesn't blank
      // the UI mid-poll.
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Reload + 30s poll on mount. The poll is silent so it doesn't flicker
  // the loading state.
  useEffect(() => {
    refresh(false);
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => refresh(true), 30_000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [refresh]);

  // Live fixtures matching ANY of the user's favorite teams or leagues.
  // Spec: "FAVORITOS = solo partidos en vivo de los favoritos". Match
  // is OR — home or away in favorite teams, OR fixture's league in
  // favorite leagues. That way a Real Madrid fan sees their match even
  // when LaLiga isn't in their league favorites, and an MLS fan sees
  // every MLS match without having to add every team.
  const favoriteLive = useMemo(() => {
    if (!hasAnyFavorite) return [];
    const teamSet = new Set(favoriteTeamIDs);
    const leagueSet = new Set(favoriteLeagueIDs);
    return liveFixtures.filter((fx) => {
      const h = fx?.teams?.home?.id;
      const a = fx?.teams?.away?.id;
      const l = fx?.league?.id;
      return (h != null && teamSet.has(h))
        || (a != null && teamSet.has(a))
        || (l != null && leagueSet.has(l));
    });
  }, [liveFixtures, favoriteTeamIDs, favoriteLeagueIDs, hasAnyFavorite]);
  const visible = useMemo(() => {
    if (tab === 'live') return liveFixtures;
    // FAVORITOS: only live fixtures matching the user's favorite teams
    // or leagues. We do NOT fall through to the full list — the spec is
    // explicit that this tab shows ONLY favorites' live games. Empty
    // state below explains why nothing's there + how to add favorites.
    return favoriteLive;
  }, [tab, liveFixtures, favoriteLive]);

  // Group visible fixtures by league. Sort leagues by earliest fixture;
  // within each, fixtures by kickoff (live ones are already up top from
  // the backend's fixturePreviewSort).
  const groups = useMemo(() => {
    const byLeague = new Map();
    for (const fx of visible) {
      const lid = fx?.league?.id ?? -1;
      if (!byLeague.has(lid)) {
        byLeague.set(lid, {
          id: lid,
          name: fx?.league?.name || 'FOOTBALL',
          country: fx?.league?.country || '',
          logo: fx?.league?.logo,
          fixtures: [],
        });
      }
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
  }, [visible]);

  // Tab counts. Both come from the live feed; FAVORITOS count is how
  // many of those live fixtures involve a favorite team or league.
  const totals = useMemo(() => ({
    live: liveFixtures.length,
    favorites: favoriteLive.length,
  }), [liveFixtures, favoriteLive]);

  const labels = {
    live: t(locale, 'Live'),
    favorites: t(locale, 'Favorites'),
  };

  return (
    // Cap the content width so the score column doesn't drift to the
    // edge of a 1920-wide monitor — the user's eye should track at most
    // ~960px to read a row, not the full viewport.
    <div style={{ maxWidth: 960, marginInline: 'auto' }}>
      {/* Page head — title, sub, and right-aligned LIVE pill */}
      <div className="fp-desktop-page-head">
        <div>
          <h1 className="fp-desktop-page-title">{t(locale, 'Live scores')}</h1>
          <p className="fp-desktop-page-sub">
            {t(locale, 'Live football and your active pools at a glance.')}
          </p>
        </div>
        {totals.live > 0 && (
          <span className="fp-status live" style={{ padding: '6px 14px', fontSize: 13 }}>
            <span className="pulse" />
            {tFormat(locale, '{n} live', { n: totals.live })}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'inline-flex', gap: 4,
        padding: 4,
        background: 'var(--fp-surface)',
        border: '1px solid var(--fp-stroke)',
        borderRadius: 12,
        marginBottom: 'var(--app-space-5)',
        width: 'fit-content',
      }}>
        {TABS.map((k) => {
          const isActive = tab === k;
          const showPulse = k === 'live' && isActive && totals.live > 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 18px',
                background: isActive ? 'var(--fp-surface-alt)' : 'transparent',
                border: 'none',
                borderRadius: 8,
                color: isActive ? 'var(--fp-text)' : 'var(--fp-text-dim)',
                fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background 120ms ease, color 120ms ease',
              }}
            >
              {showPulse && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--fp-danger)',
                  animation: 'fp-pulse 1.6s infinite ease-out',
                }} />
              )}
              {labels[k]}
              {totals[k] > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: '1px 7px', borderRadius: 999,
                  background: isActive
                    ? 'rgba(33,226,140,0.16)'
                    : 'rgba(255,255,255,0.06)',
                  color: isActive ? 'var(--fp-primary)' : 'var(--fp-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}>{totals[k]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading && groups.length === 0 ? (
        <div style={{
          padding: 60, textAlign: 'center',
          color: 'var(--fp-text-dim)',
          fontFamily: 'var(--app-font-mono)', fontSize: 11,
          letterSpacing: 2,
        }}>{t(locale, 'LOADING FIXTURES…')}</div>
      ) : groups.length === 0 ? (
        <EmptyState
          tab={tab}
          hasAnyFavorite={hasAnyFavorite}
          liveCount={liveFixtures.length}
          locale={locale}
          onEditFavorites={() => setShowEditFavorites(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-6)' }}>
          {groups.map((group) => (
            <LeagueGroup
              key={group.id}
              group={group}
              onTap={(id) => navigate(`/fixture/${id}`)}
              locale={locale}
            />
          ))}
          {tab === 'favorites' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <button
                type="button"
                className="fp-btn ghost sm"
                onClick={() => setShowEditFavorites(true)}
              >✎ {t(locale, 'Edit favorites')}</button>
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

function EmptyState({ tab, hasAnyFavorite, liveCount, locale, onEditFavorites }) {
  // FAVORITOS-specific empty states distinguish the two failure modes:
  //   • user has 0 favorites → CTA opens the in-place editor modal
  //   • user has favorites but none are playing right now → wait copy
  if (tab === 'favorites' && !hasAnyFavorite) {
    return (
      <div className="fp-empty">
        <h4>{t(locale, 'No favorite teams or leagues yet')}</h4>
        {t(locale, 'Pick your favorite teams and leagues so we can surface their live matches here.')}
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="fp-btn primary"
            onClick={onEditFavorites}
          >▶ {t(locale, 'PICK FAVORITES')}</button>
        </div>
      </div>
    );
  }
  if (tab === 'favorites' && liveCount > 0) {
    // Live football is happening, just none involves their favorites.
    return (
      <div className="fp-empty">
        <h4>{t(locale, 'No favorites playing now')}</h4>
        {t(locale, 'None of your favorite teams or leagues are live right now. Check back later.')}
      </div>
    );
  }
  // EN VIVO empty (or favorites empty because nothing live anywhere).
  return (
    <div className="fp-empty">
      <h4>{t(locale, 'No live matches')}</h4>
      {t(locale, 'Come back later for upcoming matches.')}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EditFavoritesModal — in-place editor for the user's favorite teams +
// leagues. Reuses the same localStorage keys WebOnboarding writes
// (onboardingTeams / onboardingLeagues / onboardingCustom*IDs) so the
// changes flow back to mobile too. POSTs to /users/me/onboarding when
// a token is available — silently best-effort, the localStorage write
// is the source of truth for this page either way.
// ─────────────────────────────────────────────────────────────────────

function EditFavoritesModal({ locale, onClose, onSaved }) {
  // Initial state pulls the same enum keys the onboarding wrote so a
  // returning user sees their existing selections checked.
  const [teamKeys, setTeamKeys] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('onboardingTeams') || '[]')); }
    catch { return new Set(); }
  });
  const [leagueKeys, setLeagueKeys] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('onboardingLeagues') || '[]')); }
    catch { return new Set(); }
  });
  const [saving, setSaving] = useState(false);

  const toggleTeam = (k) => setTeamKeys((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const toggleLeague = (k) => setLeagueKeys((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      // localStorage is the source of truth for the desktop page; mobile
      // LiveScores reads the same keys. Customs left as-is — this modal
      // only edits the popular set; full search-based editing is a
      // follow-up if needed.
      localStorage.setItem('onboardingTeams', JSON.stringify(Array.from(teamKeys)));
      localStorage.setItem('onboardingLeagues', JSON.stringify(Array.from(leagueKeys)));
      // Best-effort sync to the backend so iOS picks it up too. Not
      // load-bearing — failure is silent.
      try {
        // Same token key AuthContext writes to.
        const token = localStorage.getItem('futpools_token');
        if (token) {
          const customTeams = JSON.parse(localStorage.getItem('onboardingCustomTeamIDs') || '[]');
          const customLeagues = JSON.parse(localStorage.getItem('onboardingCustomLeagueIDs') || '[]');
          await api.put('/users/me/onboarding', {
            teams: [
              ...Array.from(teamKeys),
              ...customTeams.map((id) => `api:${id}`),
            ],
            leagues: [
              ...Array.from(leagueKeys),
              ...customLeagues.map((id) => `api:${id}`),
            ],
          }, token);
        }
      } catch { /* silent */ }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div
        className="fp-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
          {t(locale, 'Favorite teams & leagues')}
        </h3>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 18px' }}>
          {t(locale, 'Pick the ones you want to follow. We\'ll surface their live matches in the FAVORITOS tab.')}
        </p>

        <div style={{ marginBottom: 18 }}>
          <h4 className="fp-section-title" style={{ marginBottom: 10 }}>
            ⚽ {t(locale, 'TEAMS')}
          </h4>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {POPULAR_TEAMS.map((p) => {
              const active = teamKeys.has(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => toggleTeam(p.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: active
                      ? 'rgba(33,226,140,0.12)'
                      : 'var(--fp-surface-alt)',
                    border: `1px solid ${active ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
                    borderRadius: 10,
                    color: 'var(--fp-text)',
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                    transition: 'all 120ms ease',
                  }}
                >
                  <img
                    src={teamLogo(p.id)} alt=""
                    style={{ width: 24, height: 24, objectFit: 'contain' }}
                  />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                  {active && (
                    <span style={{ color: 'var(--fp-primary)', fontWeight: 800, fontSize: 13 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <h4 className="fp-section-title" style={{ marginBottom: 10 }}>
            🏆 {t(locale, 'LEAGUES')}
          </h4>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {POPULAR_LEAGUES.map((p) => {
              const active = leagueKeys.has(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => toggleLeague(p.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: active
                      ? 'rgba(33,226,140,0.12)'
                      : 'var(--fp-surface-alt)',
                    border: `1px solid ${active ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
                    borderRadius: 10,
                    color: 'var(--fp-text)',
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                    transition: 'all 120ms ease',
                  }}
                >
                  <img
                    src={leagueLogo(p.id)} alt=""
                    style={{
                      width: 24, height: 24, objectFit: 'contain',
                      background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: 1,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                  {active && (
                    <span style={{ color: 'var(--fp-primary)', fontWeight: 800, fontSize: 13 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" className="fp-btn ghost block" onClick={onClose}>
            {t(locale, 'Cancel')}
          </button>
          <button
            type="button" className="fp-btn primary block"
            disabled={saving}
            onClick={save}
          >{saving ? t(locale, 'Saving…') : t(locale, 'Save')}</button>
        </div>
      </div>
    </div>
  );
}
