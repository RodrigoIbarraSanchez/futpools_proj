// LiveScoresDesktop — desktop layout for /scores per design_handoff_live_scores.
//
// Mirrors the handoff bundle's screen-live.jsx 1:1:
//   • 4 tabs: En vivo / Hoy / Mañana / Favoritos (each with a count chip;
//     LIVE tab shows a pulsing red dot when there's any live fixture)
//   • League groups: header with colored badge (initial) + name · country
//     + 'N partidos' right-aligned, then a unified card holding compact
//     rows for every fixture in that league
//   • Compact row layout: [⭐ fav] [time] [home/away stacked] [score]
//   • Per-fixture favorites — starred IDs persist to localStorage; the
//     'Favoritos' tab unions live + today + tomorrow filtered by starred set
//   • 30s polling for the LIVE tab (matches the backend feed cache)
//
// Adapted for simple_version data:
//   • LIVE tab → /football/fixtures/feed?live=true (all global live fixtures)
//   • TODAY/TOMORROW → /football/fixtures/feed?date=...&leagues=...&teams=...
//     scoped to the user's favorite leagues + teams from onboarding
//     (so the "all leagues" claim is bounded — full-firehose isn't usable)
//   • FAVORITES → fetch live + today + tomorrow once and intersect with the
//     starred-fixture set
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

// Same popular-key → api-football ID maps used by mobile LiveScores. Kept
// inline rather than imported so this file is self-contained.
const POPULAR_TEAM_IDS = {
  realMadrid: 541, barcelona: 529, manUnited: 33, psg: 85,
  manCity: 50, liverpool: 40, bayern: 157, juventus: 496, chelsea: 49,
};
const POPULAR_LEAGUE_IDS = {
  ligaMX: 262, champions: 2, laLiga: 140, premier: 39, mls: 253, worldCup: 1,
};
const LIVE_CODES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const isLiveStatus = (s) => LIVE_CODES.has(String(s || '').toUpperCase());

const FAV_STORAGE_KEY = 'fp:liveFavorites';

function readFavorites() {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch { return new Set(); }
}
function writeFavorites(set) {
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch { /* private mode etc */ }
}

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

function StarIcon({ filled }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill={filled ? 'var(--fp-warning, #F5B82E)' : 'none'}
      stroke={filled ? 'var(--fp-warning, #F5B82E)' : 'var(--fp-text-faint)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="m12 2 3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
    </svg>
  );
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

function ScoreRow({ fixture, isFav, onToggleFav, onTap }) {
  const live = isLiveStatus(fixture.status);
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  return (
    <div
      onClick={onTap}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 64px 1fr 64px',
        alignItems: 'center', gap: 14,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFav(fixture.fixtureId); }}
        title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        aria-pressed={isFav}
        style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'transparent', border: 'none',
          display: 'grid', placeItems: 'center',
          cursor: 'pointer',
          transition: 'background 120ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <StarIcon filled={isFav} />
      </button>

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

function LeagueGroup({ group, favorites, onToggleFav, onTap, locale }) {
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
                isFav={favorites.has(String(fx.fixtureId))}
                onToggleFav={onToggleFav}
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
  const [favorites, setFavorites] = useState(() => readFavorites());

  // Single feed: all globally-live fixtures. Both EN VIVO and FAVORITOS
  // operate on the same dataset (favorites just intersects with the
  // starred set), so one fetch + one poll covers both tabs.
  const [liveFixtures, setLiveFixtures] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollTimer = useRef(null);

  // Persist starred fixtures.
  useEffect(() => { writeFavorites(favorites); }, [favorites]);

  const toggleFav = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  // Reload + 30s poll on tab change. The poll is silent so it doesn't
  // flicker the loading state.
  useEffect(() => {
    refresh(false);
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => refresh(true), 30_000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [refresh]);

  // Filtered live set for the favorites tab. When the user has no
  // favorites yet, fall through to the full live list so the tab isn't
  // a dead end — they can star fixtures from there directly. The empty-
  // state hint banner explains this so it doesn't look like a bug.
  const favoriteLive = useMemo(
    () => liveFixtures.filter((fx) => favorites.has(String(fx.fixtureId))),
    [liveFixtures, favorites],
  );
  const visible = useMemo(() => {
    if (tab === 'live') return liveFixtures;
    // favorites tab: starred-live if any, else all live (so user can star).
    return favoriteLive.length > 0 ? favoriteLive : liveFixtures;
  }, [tab, liveFixtures, favoriteLive]);
  const showFavEmptyHint = tab === 'favorites' && favoriteLive.length === 0 && liveFixtures.length > 0;

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

  // Tab counts. Both reflect the live feed because that's the only
  // dataset we hold — favorites count means 'starred fixtures currently
  // in play', not 'starred fixtures across all time'.
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
        <EmptyState tab={tab} locale={locale} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-6)' }}>
          {/* On the favorites tab, when nothing's starred yet, the page
              shows the full live list so the user can star from here.
              The hint banner explains why the count is 0 and the list
              is full. */}
          {showFavEmptyHint && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(245,184,46,0.08)',
              border: '1px solid rgba(245,184,46,0.32)',
              color: 'var(--fp-text-dim)',
              fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ color: '#F5B82E', fontSize: 16 }}>⭐</span>
              {t(locale, 'No favorites yet — tap the star on any match to save it here.')}
            </div>
          )}
          {groups.map((group) => (
            <LeagueGroup
              key={group.id}
              group={group}
              favorites={favorites}
              onToggleFav={toggleFav}
              onTap={(id) => navigate(`/fixture/${id}`)}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab, locale }) {
  // Reaches this branch only when the live feed itself is empty (no
  // football live anywhere). Both tabs share the same copy because in
  // both cases the cause is the same — nothing's playing.
  return (
    <div className="fp-empty">
      <h4>{t(locale, 'No live matches')}</h4>
      {t(locale, 'Come back later for upcoming matches.')}
    </div>
  );
}
