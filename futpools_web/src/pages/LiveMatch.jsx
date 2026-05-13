import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSafeBack } from '../lib/safeBack';
import { api } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { HudFrame, TeamCrest } from '../arena-ui/primitives';

// ────────────────────────────────────────────────────────────────────
// Constants

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

function threeLetter(name = '') {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0] + (parts[2]?.[0] || parts[1][1] || '')).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

// ────────────────────────────────────────────────────────────────────
// Event row

function eventCategory(ev) {
  const type = (ev.type || '').toLowerCase();
  const detail = (ev.detail || '').toLowerCase();
  if (type.includes('goal')) return 'goal';
  if (type.includes('card') && detail.includes('yellow')) return 'yellow';
  if (type.includes('card') && detail.includes('red')) return 'red';
  if (type.includes('subst')) return 'sub';
  if (type.includes('var')) return 'var';
  return 'other';
}

const CAT_META = {
  goal:   { color: 'var(--fp-primary)', labelKey: 'GOL',          icon: '⚽' },
  yellow: { color: 'var(--fp-gold)',    labelKey: 'AMONESTACIÓN', icon: '🟨' },
  red:    { color: 'var(--fp-danger)',  labelKey: 'EXPULSIÓN',    icon: '🟥' },
  sub:    { color: 'var(--fp-accent)',  labelKey: 'CAMBIO',       icon: '↻'  },
  var:    { color: 'var(--fp-hot)',     labelKey: 'VAR',          icon: 'V'  },
  other:  { color: 'var(--fp-text-dim)', labelKey: null,          icon: '•'  },
};

function EventRow({ ev, locale }) {
  const cat = eventCategory(ev);
  const meta = CAT_META[cat];
  const minute = ev.minute != null
    ? (ev.extra > 0 ? `${ev.minute}+${ev.extra}'` : `${ev.minute}'`)
    : "—'";
  const label = meta.labelKey ? t(locale, meta.labelKey) : (ev.type || 'EVENT').toUpperCase();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: 'var(--fp-surface)',
      borderLeft: `3px solid ${meta.color}`,
      marginBottom: 6,
    }}>
      <span style={{
        fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700,
        color: 'var(--fp-text-dim)', width: 36,
      }}>{minute}</span>
      <span style={{ width: 22, textAlign: 'center', color: meta.color, fontSize: 14 }}>{meta.icon}</span>
      <span style={{
        fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
        color: meta.color,
      }}>{label}</span>
      <span style={{ color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 10 }}>·</span>
      <span style={{ flex: 1, fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text)' }}>
        {ev.player || '—'}
      </span>
      {/* Team crest + abbreviation — tells the user which side the
          event belongs to without forcing them to cross-reference. */}
      {ev.team && (ev.team.logo || ev.team.name) && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {ev.team.logo && (
            <img
              src={ev.team.logo}
              alt=""
              width={20}
              height={20}
              style={{ objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          {ev.team.name && (
            <span style={{
              fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700,
              letterSpacing: 1, color: 'var(--fp-text-muted)',
            }}>{threeLetter(ev.team.name)}</span>
          )}
        </span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Your pick card

function YourPickCard({ pick, live, locale }) {
  if (!pick) return null;
  const home = live?.score?.home;
  const away = live?.score?.away;
  const short = (live?.status?.short || '').toUpperCase();
  const isLive = live?.status?.isLive === true;
  const isFinal = FINISHED_STATUSES.has(short);
  const result = (typeof home === 'number' && typeof away === 'number')
    ? (home > away ? '1' : home < away ? '2' : 'X')
    : null;

  let state = 'waiting';
  if (result != null) {
    if (isFinal) state = pick === result ? 'earned' : 'missed';
    else if (pick === result) state = 'leading';
    // 0-0 (or any draw mid-game) when the pick is 1 or 2 → 'tied'.
    // The user is not currently winning, but the opposite team is
    // not winning either — calling it 'trailing' would lie about the
    // game state and trigger needless loss-aversion. See iOS
    // LiveMatchView for the same rule + a longer rationale.
    else if (result === 'X' && pick !== 'X') state = 'tied';
    else state = 'trailing';
  }

  const pickLabel = pick === '1' ? t(locale, 'HOME WIN')
                  : pick === 'X' ? t(locale, 'DRAW')
                  : pick === '2' ? t(locale, 'AWAY WIN')
                  : pick;

  const palette = {
    waiting:  { bg: 'var(--fp-surface)', stroke: 'var(--fp-stroke)', badgeBg: 'var(--fp-surface-alt)', badgeFg: 'var(--fp-text)' },
    leading:  { bg: 'color-mix(in srgb, var(--fp-primary) 15%, transparent)', stroke: 'var(--fp-primary)', badgeBg: 'var(--fp-primary)', badgeFg: 'var(--fp-on-primary)' },
    tied:     { bg: 'var(--fp-surface)', stroke: 'color-mix(in srgb, var(--fp-accent) 45%, transparent)', badgeBg: 'var(--fp-surface-alt)', badgeFg: 'var(--fp-text)' },
    trailing: { bg: 'var(--fp-surface)', stroke: 'color-mix(in srgb, var(--fp-danger) 35%, transparent)', badgeBg: 'var(--fp-surface-alt)', badgeFg: 'var(--fp-text-dim)' },
    earned:   { bg: 'color-mix(in srgb, var(--fp-primary) 22%, transparent)', stroke: 'var(--fp-primary)', badgeBg: 'var(--fp-primary)', badgeFg: 'var(--fp-on-primary)' },
    missed:   { bg: 'color-mix(in srgb, var(--fp-surface) 60%, transparent)', stroke: 'color-mix(in srgb, var(--fp-danger) 35%, transparent)', badgeBg: 'var(--fp-surface-alt)', badgeFg: 'var(--fp-text-dim)' },
  }[state];

  const statusLine = (() => {
    switch (state) {
      case 'waiting':
        return <><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-accent)' }} />
          <span style={{ color: 'var(--fp-accent)' }}>{t(locale, 'WAITING FOR KICKOFF')}</span></>;
      case 'leading':
        return <><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-primary)' }} />
          <span style={{ color: 'var(--fp-primary)' }}>{t(locale, 'LEADING · +1 PT IF IT HOLDS')}</span></>;
      case 'tied':
        return <><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-accent)' }} />
          <span style={{ color: 'var(--fp-accent)' }}>{t(locale, 'TIED · 0 PTS IF IT HOLDS')}</span></>;
      case 'trailing':
        return <><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-danger)' }} />
          <span style={{ color: 'var(--fp-danger)' }}>{isLive ? t(locale, 'TRAILING · 0 PTS IF IT HOLDS') : t(locale, 'TRAILING')}</span></>;
      case 'earned':
        return <span style={{ color: 'var(--fp-primary)' }}>✓ {t(locale, 'EARNED · +1 PT')}</span>;
      case 'missed':
        return <span style={{ color: 'var(--fp-danger)' }}>✗ {t(locale, 'MISSED · 0 PTS')}</span>;
    }
  })();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: 12,
      background: palette.bg,
      border: `1px solid ${palette.stroke}`,
      clipPath: 'var(--fp-clip)',
      margin: '0 16px',
    }}>
      <div style={{
        width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: palette.badgeBg, clipPath: 'var(--fp-clip-sm)',
        fontFamily: 'var(--fp-display)', fontSize: 30, fontWeight: 900,
        color: palette.badgeFg,
      }}>
        {pick}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.8,
          color: 'var(--fp-text-muted)',
        }}>{t(locale, 'YOUR PICK')}</div>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 18, fontWeight: 900,
          color: 'var(--fp-text)',
        }}>{pickLabel}</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, marginTop: 3,
          fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
        }}>
          {statusLine}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Title bar

function TitleBar({ live, locale, onBack }) {
  const short = (live?.status?.short || '').toUpperCase();
  const isLive = live?.status?.isLive === true;
  const isHT = short === 'HT';
  const isFinal = FINISHED_STATUSES.has(short);

  const chip = (() => {
    // HT must be checked before isLive — the API reports HT as isLive=true,
    // but the match is paused so we want the gold "HALF TIME" chip.
    if (isHT) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px',
          background: 'color-mix(in srgb, var(--fp-gold) 14%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fp-gold) 45%, transparent)',
          clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
          fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: 'var(--fp-gold)',
        }}>{t(locale, 'HALF TIME')}</span>
      );
    }
    if (isLive) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px',
          background: 'color-mix(in srgb, var(--fp-danger) 16%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fp-danger) 55%, transparent)',
          boxShadow: '0 0 10px color-mix(in srgb, var(--fp-danger) 35%, transparent)',
          clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
          fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: 'var(--fp-danger)',
          animation: 'fp-live-pulse 1.6s ease-in-out infinite',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--fp-danger)',
            boxShadow: '0 0 8px var(--fp-danger), 0 0 2px var(--fp-danger)',
          }} />
          {t(locale, 'LIVE')}
        </span>
      );
    }
    if (isFinal) {
      return (
        <span style={{
          padding: '3px 8px',
          background: 'color-mix(in srgb, var(--fp-text-muted) 12%, transparent)',
          clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
          fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: 'var(--fp-text-muted)',
        }}>{t(locale, 'FINAL')}</span>
      );
    }
    return (
      <span style={{
        fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
        color: 'var(--fp-accent)',
      }}>· {t(locale, 'UPCOMING')}</span>
    );
  })();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 16px 10px',
      borderBottom: '1px solid var(--fp-stroke)',
    }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 14,
        }}
        aria-label={t(locale, 'Back')}
      >← </button>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 900, letterSpacing: 3,
          color: 'var(--fp-text)',
        }}>{t(locale, 'MATCH')}</span>
        {chip}
      </div>
      <span style={{ width: 24 }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main page

export function LiveMatch() {
  const { fixtureId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Fixture detail can be reached via deep link; no history → home.
  const goBack = useSafeBack('/');
  const { locale } = useLocale();

  // Fallback teams from router state (we navigate from PoolDetail with
  // { fixture, userPick }). If opened cold, we fall back to whatever the
  // live fixture returns.
  const passed = location.state || {};
  const fixture = passed.fixture || null;
  const pick = passed.userPick || null;

  const [live, setLive] = useState(null);
  const [events, setEvents] = useState([]);
  const pollRef = useRef(null);

  const refresh = async () => {
    try {
      const [lives, evs] = await Promise.all([
        api.get(`/football/fixtures?ids=${fixtureId}`),
        api.get(`/football/fixtures/${fixtureId}/events`),
      ]);
      setLive((Array.isArray(lives) ? lives[0] : null) || null);
      setEvents(Array.isArray(evs) ? evs : []);
    } catch {
      /* keep previous state */
    }
  };

  useEffect(() => {
    refresh();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(refresh, 30000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

  const homeName = fixture?.homeTeam || live?.teams?.home?.name || '?';
  const awayName = fixture?.awayTeam || live?.teams?.away?.name || '?';
  const homeLogo = live?.logos?.home || fixture?.homeLogo;
  const awayLogo = live?.logos?.away || fixture?.awayLogo;
  const home = live?.score?.home;
  const away = live?.score?.away;
  const scoreText = (typeof home === 'number' && typeof away === 'number') ? `${home} - ${away}` : '– - –';
  const shortTop = (live?.status?.short || '').toUpperCase();
  const isHTTop = shortTop === 'HT';
  const isLive = live?.status?.isLive === true && !isHTTop;
  const minute = live?.status?.elapsed;

  return (
    <>
      <TitleBar live={live} locale={locale} onBack={goBack} />

      {/* Scoreboard */}
      <div style={{ padding: '14px 16px 0' }}>
        <HudFrame>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
            padding: '18px 14px', gap: 12,
            position: 'relative',
          }}>
            {/* Home plate */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <TeamCrest name={homeName} color="var(--fp-accent)" size={56} logoURL={homeLogo} />
              <span style={{
                fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 900, letterSpacing: 2,
                color: 'var(--fp-text-dim)',
              }}>{threeLetter(homeName)}</span>
            </div>
            {/* Score */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontFamily: 'var(--fp-display)', fontSize: 40, fontWeight: 900, letterSpacing: 2,
                color: 'var(--fp-text)',
              }}>{scoreText}</span>
              {isHTTop && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--fp-mono)', fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                  color: 'var(--fp-gold)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fp-gold)' }} />
                  {t(locale, 'HALF TIME')}
                </span>
              )}
              {isLive && minute != null && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--fp-mono)', fontSize: 12, fontWeight: 700,
                  color: 'var(--fp-danger)',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--fp-danger)',
                    boxShadow: '0 0 8px var(--fp-danger), 0 0 2px var(--fp-danger)',
                    animation: 'fp-live-pulse 1.2s ease-in-out infinite',
                  }} />
                  {minute}'
                </span>
              )}
            </div>
            {/* Away plate */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <TeamCrest name={awayName} color="var(--fp-hot)" size={56} logoURL={awayLogo} />
              <span style={{
                fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 900, letterSpacing: 2,
                color: 'var(--fp-text-dim)',
              }}>{threeLetter(awayName)}</span>
            </div>
          </div>
        </HudFrame>
      </div>

      {/* Your pick */}
      {pick && (
        <div style={{ marginTop: 16 }}>
          <YourPickCard pick={pick} live={live} locale={locale} />
        </div>
      )}

      {/* Match feed */}
      <div style={{ padding: '16px 16px 120px' }}>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 700, letterSpacing: 3,
          color: 'var(--fp-primary)', marginBottom: 10,
        }}>◆ {t(locale, 'MATCH FEED')}</div>

        {events.length === 0 ? (
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)',
          }}>{t(locale, 'No events yet — check back as the match progresses.')}</div>
        ) : (
          events.map((ev, i) => <EventRow key={`${ev.minute}-${ev.type}-${ev.player}-${i}`} ev={ev} locale={locale} />)
        )}
      </div>
    </>
  );
}
