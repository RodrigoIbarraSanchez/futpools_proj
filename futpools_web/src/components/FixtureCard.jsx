/**
 * Pitch-style fixture card: team crests, score, live status (minute + period).
 * Localized (EN/ES). UI inspired by SofaScore/ESPN: clear live strip + score.
 */
import { useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const a = parts[0]?.slice(0, 1) ?? '';
  const b = parts[1]?.slice(0, 1) ?? '';
  return (a + b).toUpperCase() || '?';
}

function TeamCrest({ name, logoUrl, size }) {
  const [imgError, setImgError] = useState(false);
  const showImg = logoUrl && !imgError;

  return (
    <div
      style={{
        width: size,
        height: size,
        margin: '0 auto var(--spacing-xs)',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--app-surface-alt), var(--app-surface))',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {showImg ? (
        <img
          src={logoUrl}
          alt=""
          role="presentation"
          style={{ width: size * 0.65, height: size * 0.65, objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          style={{
            fontSize: size * 0.35,
            fontWeight: 700,
            color: 'var(--app-text-primary)',
          }}
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'SUSP', 'LIVE']);

/** Translation key for long period label (fallback). */
function periodKey(short) {
  const s = (short || '').toUpperCase();
  const map = {
    '1H': 'First half',
    '2H': 'Second half',
    HT: 'Half time',
    ET: 'Extra time',
    P: 'Penalties',
    PEN: 'Penalties',
    BT: 'Break',
    INT: 'Interrupted',
    SUSP: 'Suspended',
    LIVE: 'Live',
  };
  return map[s] || null;
}

/** Short period key for display: 1H, 2H, TE/ET, P, etc. (used in translations). */
function periodShortKey(short) {
  const s = (short || '').toUpperCase();
  if (['1H', '2H', 'HT', 'ET', 'P', 'PEN', 'BT', 'INT', 'SUSP'].includes(s)) {
    return s === 'PEN' ? 'period_P' : `period_${s}`;
  }
  return null;
}

function isLive(status) {
  const short = (status?.short || '').toUpperCase();
  return LIVE_STATUSES.has(short) || short === 'LIVE';
}

function isFinished(status) {
  const short = (status?.short || '').toUpperCase();
  return FINISHED_STATUSES.has(short);
}

export function FixtureCard({ fixture, compact = false, live = null }) {
  const { locale } = useLocale();
  const homeTeam = fixture?.homeTeam ?? '—';
  const awayTeam = fixture?.awayTeam ?? '—';
  const homeLogo = fixture?.homeLogo ?? (live?.logos?.home || null);
  const awayLogo = fixture?.awayLogo ?? (live?.logos?.away || null);
  const leagueName = fixture?.leagueName || null;
  const kickoff = fixture?.kickoff
    ? new Date(fixture.kickoff).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    : null;
  const crestSize = compact ? 32 : 48;

  const hasScore = live && (live.score?.home != null || live.score?.away != null);
  const homeScore = live?.score?.home ?? null;
  const awayScore = live?.score?.away ?? null;
  const isLiveMatch = live && isLive(live.status);
  const isFinal = live && isFinished(live.status);
  const hasPenaltyScore = live?.penalty && (live.penalty.home != null || live.penalty.away != null);
  const penaltyHome = live?.penalty?.home ?? null;
  const penaltyAway = live?.penalty?.away ?? null;
  const statusShort = live?.status?.short || null;
  const elapsed = live?.status?.elapsed;
  const periodShortTKey = periodShortKey(statusShort);
  const periodShortLabel = periodShortTKey ? t(locale, periodShortTKey) : null;
  const liveMinuteText = elapsed != null ? `${elapsed}'` : null;
  const metaText = isLiveMatch
    ? null
    : isFinal
      ? t(locale, 'Final')
      : hasScore
        ? null
        : kickoff;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: compact ? 'var(--spacing-sm) var(--spacing-md)' : 'var(--spacing-md)',
        borderRadius: compact ? 10 : 'var(--app-radius-card)',
        background: 'linear-gradient(135deg, var(--app-pitch-deep) 0%, var(--app-pitch) 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: [
          '0 0 12px rgba(54, 233, 255, 0.1)',
          compact ? '0 4px 8px rgba(0,0,0,0.3)' : '0 10px 16px rgba(0,0,0,0.45)',
        ].join(', '),
        display: 'flex',
        flexDirection: 'column',
        minHeight: compact ? undefined : 140,
      }}
    >
      {/* Top: liga + (si live) minuto y periodo */}
      <div style={{ flexShrink: 0, textAlign: 'center' }}>
        {!compact && leagueName && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--app-text-secondary)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            {leagueName}
          </div>
        )}
        {!compact && isLiveMatch && (liveMinuteText || periodShortLabel) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 'var(--spacing-sm)',
            }}
          >
            {liveMinuteText && (
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.08)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--app-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {liveMinuteText}
              </span>
            )}
            {periodShortLabel && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--app-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {periodShortLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Centro: línea y círculo de fondo; marcador y equipos centrados verticalmente en el círculo */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: compact ? 56 : 80,
        }}
      >
        {/* Center line (vertical) */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(255,255,255,0.08)',
            transform: 'translateX(-50%)',
          }}
        />
        {/* Center circle */}
        {!compact && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 52,
              height: 52,
              marginLeft: -26,
              marginTop: -26,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--spacing-sm)',
            position: 'relative',
            zIndex: 1,
            width: '100%',
          }}
        >
          <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
            <TeamCrest name={homeTeam} logoUrl={homeLogo} size={crestSize} />
            <div
              style={{
                fontSize: compact ? 11 : 13,
                fontWeight: 600,
                color: 'var(--app-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {homeTeam}
            </div>
          </div>

          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: compact ? 4 : 6,
              minWidth: compact ? 80 : 100,
            }}
          >
            {/* FT pill for finished matches */}
            {isFinal && !isLiveMatch && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--app-text-muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {t(locale, 'Final')}
              </span>
            )}

            {/* Score or vs + kickoff */}
            {hasScore ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: compact ? 18 : 26, fontWeight: 800, color: 'var(--app-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {homeScore ?? '—'}
                  </span>
                  <span style={{ fontSize: compact ? 14 : 20, color: 'var(--app-text-muted)' }}>–</span>
                  <span style={{ fontSize: compact ? 18 : 26, fontWeight: 800, color: 'var(--app-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {awayScore ?? '—'}
                  </span>
                </div>
                {hasPenaltyScore && (
                  <span style={{ fontSize: 10, color: 'var(--app-text-secondary)' }}>
                    {t(locale, 'Penalty score')} {penaltyHome ?? '—'}–{penaltyAway ?? '—'}
                  </span>
                )}
              </>
            ) : (
              <>
                <span style={{ fontSize: compact ? 12 : 14, fontWeight: 600, color: 'var(--app-text-muted)' }}>
                  {t(locale, 'vs')}
                </span>
                {metaText && (
                  <span style={{ fontSize: 10, color: 'var(--app-text-secondary)' }}>{metaText}</span>
                )}
              </>
            )}
          </div>

          <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
            <TeamCrest name={awayTeam} logoUrl={awayLogo} size={crestSize} />
            <div
              style={{
                fontSize: compact ? 11 : 13,
                fontWeight: 600,
                color: 'var(--app-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {awayTeam}
            </div>
          </div>
        </div>
      </div>

      {/* Abajo: solo el pill "Live", centrado */}
      {isLiveMatch && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 'var(--spacing-sm)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(255, 93, 93, 0.2)',
              border: '1px solid var(--app-live-red)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--app-live-red)',
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--app-live-red)', flexShrink: 0 }} />
            {t(locale, 'Live')}
          </span>
        </div>
      )}
    </div>
  );
}
