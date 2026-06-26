// PoolDetailDesktop — desktop layout for /pool/:id.
//
// Mirrors Claude Design's `screen-pool.jsx`: a 1fr+380 two-column grid
// with a tabbed primary column (Resumen · Partidos · Tabla) and a
// sticky aside carrying the JOIN card. PoolDetail.jsx fetches all the
// data + holds all polling/state and just renders this component when
// `useIsDesktop()` is true; mobile path is untouched.
//
// Adapted for simple_version:
//   • No PrizeLadderCard (single-winner, takes-all 65%) → a single Prize
//     stat lives inside the JOIN card instead.
//   • No "balance" / "saldo" — pool entry is paid per-pool via Stripe.
//   • The JOIN button uses the shared `canJoinPool` rule so a finalised
//     pool whose fixtures have FT statuses is correctly locked here too.
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { t, tFormat } from '../../i18n/translations';
import { resolvePoolStatus, isFreePool, freeToEnter, groupFixturesByStatus, poolLockAtISO } from '../../lib/poolStatus';
import { DesktopShellChrome } from '../../desktop/DesktopShell';
import { ThermometerLadder } from '../../arena-ui/ThermometerLadder';
import { LadderParticipants } from '../../arena-ui/LadderParticipants';

const WINNER_SHARE = 0.65;
const FINISHED = new Set(['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO']);
const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const isLiveStatus = (s) => LIVE.has(String(s || '').toUpperCase());
const isFinishedStatus = (s) => FINISHED.has(String(s || '').toUpperCase());

function fmtMxn(n) { return '$' + Number(n).toLocaleString('es-MX'); }

// ─────────────────────────────────────────────────────────────────────
// PickRow — read-only fixture row showing a participant's pick + status
// (NO PICK / PENDING / LEADING / TRAILING / WON / LOST). Mirrors
// `ParticipantPickRow` in PoolDetail.jsx and the mobile
// `ParticipantPickRowView` so picks read the same on every surface.
// ─────────────────────────────────────────────────────────────────────

const FINISHED_PICK_STATUSES = new Set(['FT', 'AET', 'PEN']);

// Outcome of a single pick vs the (possibly live) result. Shared by the
// per-entry PickRow and the fixture-list "your pick" strip so the prediction
// reads identically on every surface.
// States: missing | pending | leading | trailing | won | lost.
function pickState(pick, live) {
  const home = live?.score?.home;
  const away = live?.score?.away;
  const result = (typeof home === 'number' && typeof away === 'number')
    ? (home > away ? '1' : home < away ? '2' : 'X')
    : null;
  const isFinal = FINISHED_PICK_STATUSES.has((live?.status?.short || '').toUpperCase());
  if (!pick || pick === '-' || pick === '') return 'missing';
  if (!result) return 'pending';
  if (isFinal) return pick === result ? 'won' : 'lost';
  return pick === result ? 'leading' : 'trailing';
}

const PICK_PALETTE = {
  missing:  { badgeBg: 'var(--fp-bg2, #0F1620)', fg: 'var(--fp-text-dim)', accent: 'var(--fp-stroke)' },
  pending:  { badgeBg: 'color-mix(in srgb, var(--fp-accent) 18%, transparent)', fg: 'var(--fp-accent)', accent: 'color-mix(in srgb, var(--fp-accent) 50%, transparent)' },
  leading:  { badgeBg: 'color-mix(in srgb, var(--fp-primary) 22%, transparent)', fg: 'var(--fp-primary)', accent: 'var(--fp-primary)' },
  trailing: { badgeBg: 'color-mix(in srgb, var(--fp-danger) 18%, transparent)',  fg: 'var(--fp-danger)',  accent: 'color-mix(in srgb, var(--fp-danger) 70%, transparent)' },
  won:      { badgeBg: 'color-mix(in srgb, var(--fp-primary) 22%, transparent)', fg: 'var(--fp-primary)', accent: 'var(--fp-primary)' },
  lost:     { badgeBg: 'color-mix(in srgb, var(--fp-danger) 18%, transparent)',  fg: 'var(--fp-danger)',  accent: 'color-mix(in srgb, var(--fp-danger) 70%, transparent)' },
};

function pickStatusText(state, locale) {
  switch (state) {
    case 'missing':  return t(locale, 'NO PICK');
    case 'pending':  return t(locale, 'PENDING').toUpperCase();
    case 'leading':  return `● ${t(locale, 'LEADING')}`;
    case 'trailing': return `● ${t(locale, 'TRAILING')}`;
    case 'won':      return `✓ +1 ${t(locale, 'PT')}`;
    case 'lost':     return `✗ ${t(locale, 'MISSED')}`;
    default: return '';
  }
}

function PickRow({ fixture, pick, live, locale }) {
  const home = live?.score?.home;
  const away = live?.score?.away;
  const isLive = live?.status?.isLive === true;
  const state = pickState(pick, live);
  const palette = PICK_PALETTE[state];
  const statusEl = (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: palette.fg }}>
      {pickStatusText(state, locale)}
    </span>
  );

  const showScore = typeof home === 'number' && typeof away === 'number';

  return (
    <div style={{
      padding: 10,
      background: 'var(--fp-surface-alt)',
      borderRadius: 8,
      borderLeft: `3px solid ${palette.accent}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {fixture.homeLogo && <img src={fixture.homeLogo} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />}
        <span style={{
          flex: 1, fontSize: 13,
          fontWeight: pick === '1' ? 700 : 500,
          color: pick === '1' ? 'var(--fp-text)' : 'var(--fp-text-dim)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{fixture.homeTeam}</span>
        <div style={{ minWidth: 56, textAlign: 'center' }}>
          {showScore ? (
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--fp-text)', fontVariantNumeric: 'tabular-nums' }}>
              {home}–{away}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--fp-text-dim)' }}>vs</span>
          )}
        </div>
        <span style={{
          flex: 1, textAlign: 'right', fontSize: 13,
          fontWeight: pick === '2' ? 700 : 500,
          color: pick === '2' ? 'var(--fp-text)' : 'var(--fp-text-dim)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{fixture.awayTeam}</span>
        {fixture.awayLogo && <img src={fixture.awayLogo} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: palette.badgeBg, borderRadius: 6,
          fontSize: 13, fontWeight: 900, color: palette.fg,
        }}>
          {pick === '1' || pick === 'X' || pick === '2' ? pick : '—'}
        </div>
        <div style={{ flex: 1 }}>
          {isLive && live?.status?.elapsed != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: 'var(--fp-danger)', fontSize: 11, fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fp-danger)' }} />
              LIVE {live.status.elapsed}'
            </span>
          )}
        </div>
        {statusEl}
      </div>
    </div>
  );
}

function statusBadgeKey(status) {
  switch (status) {
    case 'live':      return 'live';
    case 'completed': return 'completed';
    case 'upcoming':  return 'upcoming';
    default:          return 'open';
  }
}

function statusBadgeLabel(status, locale) {
  switch (status) {
    case 'live':      return 'LIVE';
    case 'completed': return t(locale, 'Closed').toUpperCase();
    case 'upcoming':  return t(locale, 'Upcoming').toUpperCase();
    default:          return t(locale, 'Open').toUpperCase();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Header — back button + status pill + meta + title.
// ─────────────────────────────────────────────────────────────────────

function PoolHeader({ quiniela, status, locale, navigate, goBack, justPaid, justEdited }) {
  return (
    <>
      <button
        type="button"
        className="fp-btn ghost sm"
        onClick={goBack}
        style={{ marginBottom: 14 }}
      >← {t(locale, 'Pools')}</button>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 'var(--app-space-6)', marginBottom: 'var(--app-space-6)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span className={`fp-status ${statusBadgeKey(status)}`}>
              {status === 'live' && <span className="pulse" />}
              {statusBadgeLabel(status, locale)}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              {(quiniela.entriesCount ?? 0).toLocaleString('es-MX')} {t(locale, 'players')}
              {' · '}
              {quiniela.fixtures?.length ?? 0} {t(locale, 'fixtures')}
              {quiniela.fixtures?.[0]?.leagueName && (
                <> · {quiniela.fixtures[0].leagueName}</>
              )}
            </span>
          </div>
          <h1 className="fp-desktop-page-title" style={{ marginBottom: 8 }}>
            {quiniela.name}
          </h1>
          {quiniela.description && (
            <p className="muted" style={{ margin: 0, fontSize: 14, maxWidth: 640 }}>
              {quiniela.description}
            </p>
          )}
        </div>
      </div>
      {justPaid && (
        <div style={{
          marginBottom: 'var(--app-space-6)',
          padding: '12px 16px',
          background: 'rgba(33,226,140,0.10)',
          border: '1px solid rgba(33,226,140,0.4)',
          borderRadius: 12,
          color: 'var(--fp-primary)',
          fontWeight: 700,
          fontSize: 14,
        }}>
          ✓ {t(locale, 'Payment confirmed — your entry is in.')}
        </div>
      )}
      {justEdited && (
        <div style={{
          marginBottom: 'var(--app-space-6)',
          padding: '12px 16px',
          background: 'rgba(33,226,140,0.10)',
          border: '1px solid rgba(33,226,140,0.4)',
          borderRadius: 12,
          color: 'var(--fp-primary)',
          fontWeight: 700,
          fontSize: 14,
        }}>
          ✓ {t(locale, 'Your picks were updated.')}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// JOIN card (sticky aside) — Stripe checkout entry point.
// ─────────────────────────────────────────────────────────────────────

function PlayCard({
  quiniela, locale, canJoin, alreadyEntered, entryCount, feeMXN, onJoin, status, isAdmin,
  canEditPicks = false, editDeadlineLabel = '', editBusy = false, editMsg = null, onEditPicks,
}) {
  // International players can pay in USD via PayPal — surface it BEFORE
  // they bounce off the MXN price. Only shown when the backend has the
  // channel configured.
  const [payCfg, setPayCfg] = useState(null);
  useEffect(() => {
    let on = true;
    api.get('/public/payment-config').then((d) => { if (on) setPayCfg(d); }).catch(() => {});
    return () => { on = false; };
  }, []);
  const closed = !canJoin;
  // freeEntry = $0 to join (any pool type) → drives entry/CTA/disclaimer.
  // noPrize = standard pool with no prize ("test"). isLadder shows the
  // ladder's headline prize instead of the (irrelevant) pot.
  const freeEntry = freeToEnter(quiniela);
  const noPrize = isFreePool(quiniela);
  const isLadder = quiniela.poolType === 'prize_ladder';
  const ladderMax = Math.max(0, ...(quiniela.prizeLadder || []).map((tr) => Number(tr.prizeMXN) || 0));
  const prizePot = (quiniela.entriesCount ?? 0) * (quiniela.entryFeeMXN ?? 50) * WINNER_SHARE;
  const prizeStr = isLadder
    ? (ladderMax > 0 ? `${t(locale, 'UP TO')} $${ladderMax.toLocaleString('en-US')}` : '—')
    : noPrize
      ? t(locale, 'NO PRIZE')
      : (prizePot > 0 ? fmtMxn(prizePot) : `$0 MXN`);
  const entryStr = freeEntry ? t(locale, 'FREE') : `$${feeMXN} MXN`;
  // Registration close time (10 min before first kickoff) for the join info.
  const lockIso = poolLockAtISO(quiniela);
  const lockLabel = lockIso
    ? new Date(lockIso).toLocaleString(locale === 'es' ? 'es-MX' : 'en-US',
        { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
  // Admins enter free (backend skips payment); $0 pools join free too.
  const ctaLabel = closed
    ? (status === 'completed' ? t(locale, 'Pool closed') : t(locale, 'POOL LOCKED'))
    : isAdmin
      ? (alreadyEntered ? `+ ${t(locale, 'NEW ENTRY')} · ${t(locale, 'ADMIN FREE')}` : `▶ ${t(locale, 'JOIN')} · ${t(locale, 'ADMIN FREE')}`)
      : freeEntry
        ? `▶ ${alreadyEntered ? t(locale, 'NEW ENTRY') : t(locale, 'PLAY FREE')}`
        : alreadyEntered
          ? `+ ${t(locale, 'NEW ENTRY')} · $${feeMXN} MXN`
          : `▶ ${t(locale, 'JOIN')} · $${feeMXN} MXN`;
  return (
    <div className="fp-card" style={{
      background: 'linear-gradient(180deg, rgba(33,226,140,0.08), transparent 70%), var(--fp-surface)',
      border: '1px solid rgba(33,226,140,0.28)',
    }}>
      <h4 className="fp-section-title">
        {alreadyEntered
          ? t(locale, 'Add another entry')
          : t(locale, 'Play this pool')}
      </h4>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 'var(--app-space-3)', margin: '12px 0 18px',
      }}>
        <div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            {t(locale, 'Entry')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: freeEntry ? 'var(--fp-accent)' : undefined }}>{entryStr}</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            {t(locale, 'Prize')}
          </div>
          <div className="gold num" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {prizeStr}
          </div>
        </div>
      </div>
      {alreadyEntered && !freeEntry && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(33,226,140,0.08)',
          border: '1px solid rgba(33,226,140,0.32)',
          borderRadius: 10, fontSize: 12, color: 'var(--fp-primary)',
          marginBottom: 14, fontWeight: 600,
        }}>
          ✓ {entryCount === 1
              ? t(locale, 'You have 1 entry — pay again to add another')
              : tFormat(locale, 'You have {n} entries — pay again to add another', { n: entryCount })}
        </div>
      )}
      <button
        type="button"
        className="fp-btn primary lg block"
        disabled={closed}
        onClick={onJoin}
      >
        {ctaLabel}
      </button>
      {!closed && lockLabel && (
        <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, margin: '8px 0 0', textAlign: 'center' }}>
          ⏱ {tFormat(locale, 'Registration closes {time} (10 min before the first match).', { time: lockLabel })}
        </p>
      )}

      {/* Edit picks of an existing entry — only while the window is open
          (>10 min before kickoff). Tapping re-checks server-side first. */}
      {canEditPicks && (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, margin: '0 0 6px', textAlign: 'center', color: 'var(--fp-accent)' }}>
            ✎ {editDeadlineLabel
              ? tFormat(locale, 'Edit your picks until {time} (10 min before kickoff).', { time: editDeadlineLabel })
              : t(locale, 'Edit your picks until 10 min before kickoff.')}
          </p>
          <button
            type="button"
            className="fp-btn ghost block"
            disabled={editBusy}
            onClick={onEditPicks}
          >
            {editBusy ? t(locale, 'CHECKING…') : `✎ ${t(locale, 'EDIT PICKS')}`}
          </button>
        </div>
      )}
      {editMsg && (
        <p style={{ fontSize: 11, lineHeight: 1.5, margin: '8px 0 0', textAlign: 'center', color: 'var(--fp-danger)' }}>
          {editMsg}
        </p>
      )}
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, margin: '12px 0 0', textAlign: 'center' }}>
        {isAdmin
          ? t(locale, 'Admin entry — picks register immediately, no payment required.')
          : freeEntry
            ? t(locale, 'Free pool — picks register immediately, no payment required.')
            : t(locale, 'Picks are submitted on the next screen and confirmed via SPEI.')}
      </p>
      {!isAdmin && !freeEntry && payCfg?.paypal?.enabled && (
        <p style={{ fontSize: 11, lineHeight: 1.5, margin: '6px 0 0', textAlign: 'center', color: 'var(--fp-accent)' }}>
          🌎 {tFormat(locale, 'Outside Mexico? You can pay ${usd} USD via PayPal.', { usd: payCfg.paypal.amountUSD })}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab content — Resumen, Partidos, Tabla.
// ─────────────────────────────────────────────────────────────────────

function FixtureRow({ fixture, live, locale, navigate, myPick, pickStat }) {
  const liveStatus = live?.status;
  const liveMatch = isLiveStatus(liveStatus?.short);
  const finalMatch = isFinishedStatus(liveStatus?.short) || isFinishedStatus(fixture.status);
  const hasScore = live && live.score && live.score.home != null;
  const kickoffStr = fixture.kickoff
    ? new Date(fixture.kickoff).toLocaleString(undefined, {
        weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;
  // Actual outcome ('1'|'X'|'2') once a match has a final result — used to
  // emphasise the correct column in the admin inclination panel.
  const resultPick = finalMatch && hasScore
    ? (live.score.home > live.score.away ? '1' : live.score.home < live.score.away ? '2' : 'X')
    : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
    <button
      type="button"
      onClick={() => navigate(`/fixture/${fixture.fixtureId}`)}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%',
        // color: inherit so the .fp-fixture children pick up the white
        // text from the desktop scope. Without this the user-agent
        // 'buttontext' default washes everything out to grey.
        color: 'inherit', font: 'inherit',
      }}
    >
      <div className="fp-fixture">
        <div className="fp-fixture-team">
          {fixture.homeLogo && <img src={fixture.homeLogo} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
          <div className="name">{fixture.homeTeam}</div>
        </div>
        <div className="fp-fixture-score">
          {liveMatch && (
            <span className="fp-status live" style={{ padding: '2px 8px' }}>
              <span className="pulse" />{liveStatus?.elapsed}' {liveStatus?.short}
            </span>
          )}
          {finalMatch && !liveMatch && (
            <span className="meta faint" style={{
              fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
            }}>{t(locale, 'Final')}</span>
          )}
          {hasScore ? (
            <div className="nums">
              <span className="n">{live.score.home}</span>
              <span className="dash">–</span>
              <span className="n">{live.score.away}</span>
            </div>
          ) : (
            <>
              <span className="vs">VS</span>
              {kickoffStr && <span className="meta">{kickoffStr}</span>}
            </>
          )}
        </div>
        <div className="fp-fixture-team away">
          {fixture.awayLogo && <img src={fixture.awayLogo} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
          <div className="name">{fixture.awayTeam}</div>
        </div>

        {/* The user's own prediction for this fixture, with its live/final
            outcome (✓ won, ✗ lost, ● leading/trailing, pending). Full-width
            strip across the card grid so it reads as the row's footer. Hidden
            for viewers with no entry/pick. */}
        {myPick ? (() => {
          const st = pickState(myPick, live);
          const pal = PICK_PALETTE[st];
          const label = myPick === '1' ? fixture.homeTeam
            : myPick === '2' ? fixture.awayTeam
            : t(locale, 'DRAW');
          return (
            <div style={{
              gridColumn: '1 / -1',
              marginTop: 4, paddingTop: 10,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, flexWrap: 'wrap',
              position: 'relative', zIndex: 1,
            }}>
              <span style={{
                fontFamily: 'var(--fp-mono, monospace)', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.14em', color: 'var(--fp-text-muted, #7b8794)',
              }}>{t(locale, 'YOUR PICK')}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 6,
                background: pal.badgeBg, border: `1px solid ${pal.accent}`,
                fontWeight: 900, fontSize: 12, color: pal.fg,
              }}>
                <span>{myPick}</span>
                <span style={{
                  fontFamily: 'var(--fp-mono, monospace)', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{label}</span>
              </span>
              <span style={{
                fontFamily: 'var(--fp-mono, monospace)', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.06em', color: pal.fg,
              }}>{pickStatusText(st, locale)}</span>
            </div>
          );
        })() : null}
      </div>
    </button>
      {pickStat && (
        <AdminPickInclination
          stat={pickStat}
          fixture={fixture}
          resultPick={resultPick}
          locale={locale}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// AdminPickInclination — admin-only panel under each fixture showing how
// the field leaned: L (home '1') / E (draw 'X') / V (away '2') as a
// segmented % bar plus participant avatar circles grouped by pick, so the
// admin can read the inclination per match at a glance. Data comes from
// the admin-gated `pickStats` block of GET /quinielas/:id/participants.
// ─────────────────────────────────────────────────────────────────────

// L = Local (home win), E = Empate (draw), V = Visitante (away win).
const PICK_DIST = {
  1: { letter: 'L', color: '#36E9FF' }, // home — cyan
  X: { letter: 'E', color: '#F5B544' }, // draw — amber
  2: { letter: 'V', color: '#B98CFF' }, // away — violet
};
const PICK_ORDER = ['1', 'X', '2'];
const CIRCLE_CAP = 10; // top-N participants per outcome before "+N"

function pickInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AvatarStack({ voters, color }) {
  const shown = voters.slice(0, CIRCLE_CAP);
  const extra = voters.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 4 }}>
      {shown.map((v, i) => (
        <div
          key={`${v.name}-${v.entryNumber}-${i}`}
          title={v.entryNumber > 1 ? `${v.name} (#${v.entryNumber})` : v.name}
          style={{
            width: 24, height: 24, borderRadius: '50%',
            marginLeft: i === 0 ? 0 : -6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.02em',
            fontFamily: 'var(--fp-mono, monospace)',
            background: 'var(--fp-bg, #0B0F14)',
            color: '#fff',
            border: `2px solid ${color}`,
            boxShadow: `0 0 0 1px var(--fp-bg, #0B0F14)`,
            cursor: 'default',
          }}
        >{pickInitials(v.name)}</div>
      ))}
      {extra > 0 && (
        <div
          title={`+${extra}`}
          style={{
            width: 24, height: 24, borderRadius: '50%', marginLeft: -6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, fontFamily: 'var(--fp-mono, monospace)',
            background: 'var(--fp-surface-alt, #1a2129)', color: 'var(--fp-text-muted, #7b8794)',
            border: '2px solid var(--fp-stroke, #2a333d)',
            boxShadow: '0 0 0 1px var(--fp-bg, #0B0F14)',
          }}
        >+{extra}</div>
      )}
    </div>
  );
}

function AdminPickInclination({ stat, fixture, resultPick, locale }) {
  const total = stat?.total || 0;
  const teamLabel = {
    1: fixture.homeTeam,
    X: t(locale, 'DRAW'),
    2: fixture.awayTeam,
  };
  const votersByPick = { 1: [], X: [], 2: [] };
  for (const v of stat?.voters || []) {
    if (votersByPick[v.pick]) votersByPick[v.pick].push(v);
  }
  // Majority outcome — gets a subtle "leading" emphasis on its column.
  const leader = total > 0
    ? PICK_ORDER.reduce((a, b) => (stat.counts[b] > stat.counts[a] ? b : a))
    : null;

  return (
    <div style={{
      marginTop: 6,
      border: '1px solid var(--fp-stroke, #2a333d)',
      borderRadius: 10,
      background: 'rgba(54,233,255,0.03)',
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: 'var(--fp-mono, monospace)', fontSize: 9, fontWeight: 800,
          letterSpacing: '0.12em', color: '#36E9FF',
          border: '1px solid rgba(54,233,255,0.4)', borderRadius: 4, padding: '2px 6px',
        }}>{t(locale, 'ADMIN')}</span>
        <span style={{
          fontFamily: 'var(--fp-mono, monospace)', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fp-text-muted, #7b8794)',
        }}>{t(locale, 'Pick inclination')}</span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontFamily: 'var(--fp-mono, monospace)', fontSize: 11, fontWeight: 700,
          color: 'var(--fp-text, #fff)',
        }}>
          {total} {total === 1 ? t(locale, 'pick') : t(locale, 'picks')}
        </span>
      </div>

      {total === 0 ? (
        <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
          {t(locale, 'No picks yet')}
        </div>
      ) : (
        <>
          {/* Segmented L/E/V bar */}
          <div style={{
            display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden',
            background: 'var(--fp-surface-alt, #1a2129)', marginBottom: 12,
          }}>
            {PICK_ORDER.map((k) => {
              const pct = (stat.counts[k] / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={k}
                  title={`${PICK_DIST[k].letter} · ${stat.counts[k]} (${Math.round(pct)}%)`}
                  style={{
                    width: `${pct}%`, height: '100%',
                    background: PICK_DIST[k].color,
                    opacity: leader === k ? 1 : 0.78,
                  }}
                />
              );
            })}
          </div>

          {/* Three columns: L / E / V with %, team and avatar circles. For a
              settled match the column matching the real result is emphasised
              with a ✓; otherwise the current majority is highlighted. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {PICK_ORDER.map((k) => {
              const meta = PICK_DIST[k];
              const count = stat.counts[k];
              const pct = Math.round((count / total) * 100);
              const isResult = resultPick === k;
              const isEmph = isResult || (!resultPick && leader === k && count > 0);
              return (
                <div key={k} style={{
                  border: `1px solid ${isEmph ? meta.color : 'var(--fp-stroke, #2a333d)'}`,
                  borderRadius: 8,
                  background: isEmph ? `${meta.color}12` : 'transparent',
                  padding: '8px 9px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 900, color: '#0B0F14',
                      background: meta.color,
                    }}>{meta.letter}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--fp-text-muted, #7b8794)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{teamLabel[k]}</span>
                    {isResult && (
                      <span title={t(locale, 'Final result')} style={{
                        marginLeft: 'auto', color: meta.color, fontSize: 12, fontWeight: 900,
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{
                      fontFamily: 'var(--fp-mono, monospace)', fontSize: 20, fontWeight: 800,
                      color: count > 0 ? meta.color : 'var(--fp-text-muted, #7b8794)', lineHeight: 1,
                    }}>{pct}%</span>
                    <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>
                      ({count})
                    </span>
                  </div>
                  {count > 0
                    ? <AvatarStack voters={votersByPick[k]} color={meta.color} />
                    : <div style={{ height: 24 }} />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const FIXTURE_GROUP_META = {
  live: { icon: '🔴', label: 'Live now' },
  upcoming: { icon: '⏳', label: 'Upcoming' },
  finished: { icon: '🏁', label: 'Finished' },
};

function FixturesTab({ quiniela, liveByFixture, locale, navigate, myPicks, pickStatsByFixture }) {
  // Order by status: live on top, then upcoming (soonest first), then
  // finished at the bottom — so an in-progress pool surfaces what matters.
  const groups = groupFixturesByStatus(quiniela.fixtures, liveByFixture);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-6)' }}>
      {groups.map(({ key, fixtures }) => {
        const meta = FIXTURE_GROUP_META[key];
        return (
          <div key={key}>
            <h4 className="fp-section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {meta.icon} {t(locale, meta.label)}
              <span className="accent">
                {fixtures.length} {fixtures.length === 1 ? t(locale, 'fixture') : t(locale, 'fixtures')}
              </span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fixtures.map((f) => (
                <FixtureRow
                  key={f.fixtureId}
                  fixture={f}
                  live={liveByFixture[f.fixtureId]}
                  locale={locale}
                  navigate={navigate}
                  myPick={myPicks?.[f.fixtureId]}
                  pickStat={pickStatsByFixture?.[f.fixtureId]}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Leaderboard payload: backend returns { entries: [...] } (or
// { leaderboard: [...] } in older shapes). Normalise to a plain array.
function leaderboardRows(leaderboard) {
  if (!leaderboard) return [];
  if (Array.isArray(leaderboard)) return leaderboard;
  return leaderboard.entries || leaderboard.leaderboard || [];
}

function LeaderboardTab({ leaderboard, currentUserId, locale }) {
  const rows = leaderboardRows(leaderboard);
  if (rows.length === 0) {
    return (
      <div className="fp-empty">
        <h4>{t(locale, 'No participants yet')}</h4>
        {t(locale, 'Be the first to enter this pool.')}
      </div>
    );
  }
  return (
    <div className="fp-card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="fp-table">
        <thead>
          <tr>
            <th className="rank">#</th>
            <th>{t(locale, 'Player')}</th>
            <th className="num">{t(locale, 'Score')}</th>
            <th className="num">{t(locale, 'Progress')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const rank = idx + 1;
            const isYou = String(row.userId) === String(currentUserId);
            const total = row.totalPossible || 0;
            const score = row.score || 0;
            const pct = total > 0 ? (score / total) * 100 : 0;
            const displayName = row.displayName || row.username || `Player ${rank}`;
            const suffix = (row.entryNumber || 1) > 1 ? ` ${row.entryNumber}` : '';
            return (
              <tr key={`${row.userId || idx}-${row.entryNumber || 1}`} className={isYou ? 'you' : ''}>
                <td className={`rank ${rank <= 3 ? 'top' : ''}`}>
                  {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="fp-crest-d sm" style={{
                      background: isYou
                        ? 'linear-gradient(135deg, #36E9FF, #21E28C)'
                        : `linear-gradient(135deg, hsl(${(rank * 40) % 360} 40% 28%), hsl(${(rank * 40) % 360} 40% 18%))`,
                      color: isYou ? '#0B0F14' : '#fff',
                    }}>
                      {(displayName[0] || '?').toUpperCase()}
                    </div>
                    <span style={{ fontWeight: isYou ? 700 : 500 }}>
                      {displayName}{suffix}
                      {isYou && <span className="green" style={{ marginLeft: 6, fontSize: 11 }}>({t(locale, 'you')})</span>}
                    </span>
                  </div>
                </td>
                <td className="num" style={{ fontWeight: 700 }}>{score}/{total}</td>
                <td className="num" style={{ width: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      flex: 1, height: 6, borderRadius: 999,
                      background: 'var(--fp-surface-alt)', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: isYou ? 'var(--fp-primary)' : 'rgba(255,255,255,0.4)',
                      }} />
                    </div>
                    <span className="muted" style={{ fontSize: 11 }}>{Math.round(pct)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Unified Partidos tab. Replaces the original Overview+Fixtures split —
// having two tabs that both showed fixtures was redundant. This one
// stacks the user's entries summary (when participating) on top of the
// full grouped-by-day fixture list, so a single tap surfaces everything
// you'd expect on a pool's main view.
function PartidosTab({ quiniela, liveByFixture, leaderboard, currentUserId, entryCount, myEntries, locale, navigate, pickStatsByFixture }) {
  // Click an entry row to expand and reveal that entry's per-fixture picks
  // inline. Default collapsed so multi-entry users don't get a wall of
  // picks at first paint. Mirrors mobile's "View predictions" sheet for
  // self-inspection — but kept on the same page (no modal hop) since the
  // user is already looking at their own data.
  const [openEntryNum, setOpenEntryNum] = useState(null);
  const orderedEntries = (myEntries || [])
    .slice()
    .sort((a, b) => (a.entryNumber ?? 1) - (b.entryNumber ?? 1));
  // The current user's picks (fixtureId → '1'|'X'|'2'), surfaced on each
  // fixture row below. Latest entry wins for multi-entry users.
  const latestEntry = orderedEntries[orderedEntries.length - 1];
  const myPicks = {};
  for (const p of latestEntry?.picks || []) myPicks[p.fixtureId] = p.pick;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-6)' }}>
      {entryCount > 0 && orderedEntries.length > 0 && (
        <div className="fp-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--fp-stroke)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h4 className="fp-section-title" style={{ margin: 0 }}>
              {t(locale, 'Your entries in this pool')}
            </h4>
            <span className="muted" style={{ fontSize: 12 }}>
              {orderedEntries.length} {orderedEntries.length === 1 ? t(locale, 'entry') : t(locale, 'entries')}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {orderedEntries.map((e) => {
              const entryNum = e.entryNumber || 1;
              const total = e.totalPossible || quiniela.fixtures?.length || 0;
              const score = e.score || 0;
              const pct = total > 0 ? (score / total) * 100 : 0;
              const isOpen = openEntryNum === entryNum;
              return (
                <div key={entryNum} style={{ borderTop: '1px solid var(--fp-stroke)' }}>
                  <button
                    type="button"
                    onClick={() => setOpenEntryNum(isOpen ? null : entryNum)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '14px 18px',
                      background: isOpen ? 'rgba(33,226,140,0.06)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      display: 'grid', gridTemplateColumns: '60px 1fr 260px 24px',
                      gap: 14, alignItems: 'center',
                      color: 'var(--fp-text)',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>#{entryNum}</span>
                    <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>
                      {score}/{total} <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>{t(locale, 'PTS')}</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        flex: 1, height: 6, borderRadius: 999,
                        background: 'var(--fp-surface-alt)', overflow: 'hidden',
                      }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--fp-primary)' }} />
                      </div>
                      <span className="muted num" style={{ fontSize: 11 }}>{Math.round(pct)}%</span>
                    </div>
                    <span style={{ color: 'var(--fp-text-muted)', textAlign: 'right' }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{
                      padding: '4px 18px 16px',
                      display: 'flex', flexDirection: 'column', gap: 6,
                      background: 'rgba(33,226,140,0.03)',
                    }}>
                      {(quiniela.fixtures || []).length === 0 ? (
                        <div className="muted" style={{ fontSize: 12, padding: '10px 0' }}>
                          {t(locale, 'NO PICKS YET')}
                        </div>
                      ) : (
                        (quiniela.fixtures || []).map((fx) => {
                          const pick = (e.picks || []).find((p) => p.fixtureId === fx.fixtureId)?.pick;
                          return (
                            <PickRow
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
      )}

      {/* Full fixture list — grouped by day so a 12-fixture pool reads
          as 'Wed / Thu / Sat' rather than a flat list. */}
      <FixturesTab
        quiniela={quiniela}
        liveByFixture={liveByFixture}
        locale={locale}
        navigate={navigate}
        myPicks={myPicks}
        pickStatsByFixture={pickStatsByFixture}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

export function PoolDetailDesktop({
  quiniela, liveByFixture, leaderboard, currentUserId,
  entryCount, alreadyEntered, canJoin, feeMXN,
  handleJoin, navigate, goBack, justPaid, justEdited,
  isAdmin = false, isOwner = false, token, myEntries = [], onMutated,
  canEditPicks = false, editDeadlineLabel = '', editBusy = false, editMsg = null, onEditPicks,
}) {
  const { locale } = useLocale();
  const status = resolvePoolStatus(quiniela, liveByFixture);
  // Two tabs: PARTIDOS (entries summary + grouped fixtures) and TABLA
  // (leaderboard). The earlier OVERVIEW was redundant — it duplicated
  // the fixtures list with an arbitrary 'first 6' truncation.
  const [tab, setTab] = useState('partidos');

  // prize_ladder pools swap the classic leaderboard for the thermometer
  // hero + participants list. User's live position comes from userEntry.
  const isLadder = quiniela.poolType === 'prize_ladder';
  const ladderData = quiniela.prizeLadder || leaderboard?.prizeLadder || [];
  const ladderUserLive = leaderboard?.userEntry?.liveScore ?? 0;
  const ladderUserSettled = leaderboard?.userEntry?.score ?? 0;
  const ladderHasLive = !!leaderboard?.hasLiveFixtures;
  const [showEdit, setShowEdit] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const canAdmin = isAdmin || isOwner;

  // Admin-only: how participants leaned per fixture (L/E/V), rendered inline
  // under each match in the Fixtures tab. The backend attaches `pickStats`
  // to the participants payload only for platform admins (even pre-kickoff)
  // — null for everyone else, so the panels simply don't render. Flattened
  // to a fixtureId → stat map for O(1) lookup per row.
  const [pickStatsByFixture, setPickStatsByFixture] = useState(null);
  const qid = quiniela._id || quiniela.id;
  useEffect(() => {
    if (!isAdmin || !token || !qid) return undefined;
    let on = true;
    api.get(`/quinielas/${qid}/participants`, token)
      .then((d) => {
        if (!on) return;
        const map = {};
        for (const s of d?.pickStats || []) map[s.fixtureId] = s;
        setPickStatsByFixture(map);
      })
      .catch(() => { if (on) setPickStatsByFixture(null); });
    return () => { on = false; };
  }, [isAdmin, token, qid]);

  // Wrap the page in the same sidebar+topbar shell that routed pages
  // (Home, Scores, Account) get. PoolDetail is a top-level route to
  // preserve anon share-link access; the chrome is identical either way.
  // Breadcrumbs override 'Pools / Live' with the actual pool name.
  return (
    <DesktopShellChrome
      crumbsOverride={[t(locale, 'Pools'), quiniela?.name || '—']}
    >
      <div className="fp-desktop-wide">
        <PoolHeader
          quiniela={quiniela} status={status} locale={locale}
          navigate={navigate} goBack={goBack} justPaid={justPaid} justEdited={justEdited}
        />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 380px',
        gap: 'var(--app-space-6)', alignItems: 'flex-start',
      }}>
        <div>
          {/* prize_ladder hero — the thermometer sits above the tabs so
              the player's live prize is always in view. */}
          {isLadder && (
            <div style={{ marginBottom: 'var(--app-space-5)' }}>
              <ThermometerLadder
                ladder={ladderData}
                liveScore={ladderUserLive}
                settledScore={ladderUserSettled}
                fixtureCount={(quiniela.fixtures || []).length}
                hasLiveFixtures={ladderHasLive}
                locale={locale}
              />
            </div>
          )}
          <div className="fp-tabs">
            <button
              type="button"
              className={tab === 'partidos' ? 'active' : ''}
              onClick={() => setTab('partidos')}
            >{t(locale, 'Fixtures')} · {quiniela.fixtures?.length ?? 0}</button>
            <button
              type="button"
              className={tab === 'leaderboard' ? 'active' : ''}
              onClick={() => setTab('leaderboard')}
            >{isLadder ? t(locale, 'Participants') : t(locale, 'Leaderboard')}</button>
          </div>
          <div style={{ marginTop: 'var(--app-space-5)' }}>
            {tab === 'partidos' && (
              <PartidosTab
                quiniela={quiniela}
                liveByFixture={liveByFixture}
                leaderboard={leaderboard}
                currentUserId={currentUserId}
                entryCount={entryCount}
                myEntries={myEntries}
                locale={locale}
                navigate={navigate}
                pickStatsByFixture={pickStatsByFixture}
              />
            )}
            {tab === 'leaderboard' && (
              isLadder
                ? <LadderParticipants
                    quinielaId={quiniela._id || quiniela.id}
                    locale={locale}
                    hasLiveFixtures={ladderHasLive}
                    ladder={ladderData}
                    currentUserId={currentUserId}
                  />
                : <LeaderboardTab
                    leaderboard={leaderboard}
                    currentUserId={currentUserId}
                    locale={locale}
                  />
            )}
          </div>
        </div>

        <aside style={{
          display: 'flex', flexDirection: 'column', gap: 'var(--app-space-5)',
          // Whole column sticks together so the invite-code + admin boxes
          // follow on scroll, not just the play card.
          position: 'sticky', top: 'var(--app-space-6)', alignSelf: 'flex-start',
        }}>
          <PlayCard
            quiniela={quiniela}
            locale={locale}
            canJoin={canJoin}
            alreadyEntered={alreadyEntered}
            entryCount={entryCount}
            feeMXN={feeMXN}
            onJoin={handleJoin}
            status={status}
            isAdmin={isAdmin}
            canEditPicks={canEditPicks}
            editDeadlineLabel={editDeadlineLabel}
            editBusy={editBusy}
            editMsg={editMsg}
            onEditPicks={onEditPicks}
          />
          {/* Invite code box — visible on private pools so the creator
              can copy/share without leaving the screen. */}
          {quiniela.inviteCode && (
            <div className="fp-card">
              <h4 className="fp-section-title">{t(locale, 'INVITE CODE')}</h4>
              <div style={{
                marginTop: 12,
                fontFamily: 'var(--app-font-mono)', fontSize: 22, fontWeight: 800,
                letterSpacing: 4, textAlign: 'center',
                color: 'var(--fp-primary)',
              }}>{quiniela.inviteCode}</div>
              <p className="muted" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                {t(locale, 'Share this code so friends can join.')}
              </p>
            </div>
          )}

          {/* Admin actions — only rendered for the pool owner OR an
              ADMIN_EMAILS user. Three tools: edit name+description,
              view all participants' picks, cancel pool + refund all. */}
          {canAdmin && (
            <AdminCard
              quiniela={quiniela}
              locale={locale}
              onEdit={() => setShowEdit(true)}
              onParticipants={() => setShowParticipants(true)}
              onCancel={() => setShowCancel(true)}
            />
          )}
        </aside>
      </div>
      </div>

      {showEdit && (
        <EditPoolModal
          quiniela={quiniela}
          token={token}
          locale={locale}
          isAdmin={isAdmin}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onMutated?.(); }}
        />
      )}
      {showParticipants && (
        <ParticipantsModal
          quinielaId={quiniela._id}
          token={token}
          locale={locale}
          fixtures={quiniela.fixtures || []}
          liveByFixture={liveByFixture}
          onClose={() => setShowParticipants(false)}
          onMutated={onMutated}
        />
      )}
      {showCancel && (
        <CancelPoolModal
          quiniela={quiniela}
          token={token}
          locale={locale}
          onClose={() => setShowCancel(false)}
          onCancelled={() => { setShowCancel(false); onMutated?.(); }}
        />
      )}
    </DesktopShellChrome>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Admin actions card + modals
// ─────────────────────────────────────────────────────────────────────

function AdminCard({ quiniela, locale, onEdit, onParticipants, onCancel }) {
  const isCancelled = quiniela.settlementStatus === 'cancelled';
  return (
    <div className="fp-card" style={{
      border: '1px solid color-mix(in srgb, var(--fp-accent) 40%, transparent)',
      background: 'linear-gradient(180deg, color-mix(in srgb, var(--fp-accent) 6%, transparent), transparent 70%), var(--fp-surface)',
    }}>
      <h4 className="fp-section-title" style={{ color: 'var(--fp-accent)' }}>
        ⚙ {t(locale, 'ADMIN ACTIONS')}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <button type="button" className="fp-btn ghost block" onClick={onEdit}>
          ✎ {t(locale, 'Edit name & description')}
        </button>
        <button type="button" className="fp-btn ghost block" onClick={onParticipants}>
          👁 {t(locale, 'View all participants')}
        </button>
        <button
          type="button"
          className="fp-btn danger block"
          onClick={onCancel}
          disabled={isCancelled}
        >
          ⚠ {isCancelled ? t(locale, 'Already cancelled') : t(locale, 'Cancel pool & refund all')}
        </button>
      </div>
      {isCancelled && (
        <p className="muted" style={{ fontSize: 11, marginTop: 10, textAlign: 'center' }}>
          {t(locale, 'This pool was cancelled and all entries were refunded.')}
        </p>
      )}
    </div>
  );
}

function EditPoolModal({ quiniela, token, locale, isAdmin, onClose, onSaved }) {
  const [name, setName] = useState(quiniela.name || '');
  const [description, setDescription] = useState(quiniela.description || '');
  // Backend gates `featured` to admins regardless of ownership (see
  // updateQuiniela), so the toggle only renders when isAdmin === true.
  // Pool owners who aren't admins won't see this row.
  const [featured, setFeatured] = useState(!!quiniela.featured);
  // Entry fee (MXN). $0 = free / no-prize ("test") pool.
  const [entryFeeMXN, setEntryFeeMXN] = useState(String(quiniela.entryFeeMXN ?? 50));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isLadder = quiniela.poolType === 'prize_ladder';
  const feeNum = Math.max(0, Math.round(Number(entryFeeMXN) || 0));
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        entryFeeMXN: feeNum,
      };
      if (isAdmin) body.featured = featured;
      await api.put(`/quinielas/${quiniela._id}`, body, token);
      onSaved?.();
    } catch (e) {
      setError(e.message); setSaving(false);
    }
  };
  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>
          {t(locale, 'Edit pool')}
        </h3>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            {t(locale, 'Name')}
          </div>
          <input
            type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 15,
              background: 'var(--fp-surface-alt)', border: '1px solid var(--fp-stroke)',
              borderRadius: 10, color: 'var(--fp-text)', font: 'inherit', outline: 'none',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            {t(locale, 'Description')}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 14,
              background: 'var(--fp-surface-alt)', border: '1px solid var(--fp-stroke)',
              borderRadius: 10, color: 'var(--fp-text)', font: 'inherit',
              resize: 'vertical', outline: 'none',
            }}
          />
        </label>

        {/* Entry fee — editable for every pool type. $0 makes a STANDARD
            pool free / no-prize ("test"). On a prize_ladder pool $0 just
            means free entry; the prizes still come from the ladder. */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            {t(locale, 'Entry fee (MXN)')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--fp-primary)' }}>$</span>
            <input
              type="number" min="0" step="1" value={entryFeeMXN}
              onChange={(e) => setEntryFeeMXN(e.target.value.replace(/[^\d]/g, ''))}
              style={{
                width: 120, padding: '10px 12px', fontSize: 16, fontWeight: 700, textAlign: 'center',
                background: 'var(--fp-surface-alt)', border: '1px solid var(--fp-stroke)',
                borderRadius: 10, color: 'var(--fp-text)', font: 'inherit', outline: 'none',
              }}
            />
            <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>MXN</span>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
            {feeNum === 0
              ? (isLadder
                  ? `🎟️ ${t(locale, 'Free entry — prizes still come from the ladder.')}`
                  : `🎟️ ${t(locale, 'Free pool — no prize (test / practice).')}`)
              : t(locale, 'Each participant pays this via SPEI to join.')}
          </div>
        </label>

        {/* ⚡ Featured toggle — admin only. When true, the pool is pinned
            as the Home hero ('QUINIELA DESTACADA'). The backend gates
            `featured` to admins, so non-admin owners never see this. */}
        {isAdmin && (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, marginBottom: 14,
            padding: '12px 14px',
            background: featured
              ? 'color-mix(in srgb, var(--fp-primary) 10%, var(--fp-surface-alt))'
              : 'var(--fp-surface-alt)',
            border: `1px solid ${featured ? 'rgba(33,226,140,0.5)' : 'var(--fp-stroke)'}`,
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                ⚡ {t(locale, 'Featured pool')}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>
                {t(locale, 'Pin this pool as the Home hero for everyone.')}
              </div>
            </div>
            {/* Custom switch — checkbox is hidden but accessible. */}
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <span
              role="switch"
              aria-checked={featured}
              style={{
                width: 42, height: 24, borderRadius: 999,
                background: featured ? 'var(--fp-primary)' : 'var(--fp-stroke)',
                position: 'relative',
                transition: 'background 120ms ease',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: featured ? 21 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff',
                transition: 'left 140ms ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            </span>
          </label>
        )}
        {error && (
          <p style={{ color: 'var(--fp-danger)', fontSize: 12, margin: '0 0 12px' }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="fp-btn ghost block" onClick={onClose}>
            {t(locale, 'Cancel')}
          </button>
          <button
            type="button" className="fp-btn primary block"
            disabled={saving || !name.trim()}
            onClick={save}
          >{saving ? t(locale, 'Saving…') : t(locale, 'Save')}</button>
        </div>
      </div>
    </div>
  );
}

// Rich admin/owner view of every participant's entries. Two modes off
// the same /quinielas/:id/participants fetch:
//   • picksHidden=true  → MANAGE: per-entry delete + remove-player (pre-
//                         kickoff only; backend strips picks so the
//                         creator can't moderate based on guesses).
//   • picksHidden=false → VIEW PREDICTIONS: read-only per-fixture pick
//                         rows with won/lost/leading/trailing badges.
// Mirrors the iOS `ParticipantManageSheet` and the web mobile-style
// `ParticipantManageModal` (PoolDetail.jsx) so the experience matches
// across all three surfaces.
function ParticipantsModal({ quinielaId, token, locale, fixtures, liveByFixture, onClose, onMutated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openEntryId, setOpenEntryId] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.get(`/quinielas/${quinielaId}/participants`, token);
      setData(d);
    } catch (e) {
      setError(e.message || 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [quinielaId, token]);

  useEffect(() => { load(); }, [load]);

  const participants = data?.participants || [];
  const picksHidden = data?.picksHidden;
  // Backend authority — picks are exposed exactly when picksHidden is
  // explicitly false. nil/true keeps us in moderation mode so we never
  // render a "view picks" UI without picks attached.
  const showPicks = picksHidden === false;
  const status = data?.status;
  const isScheduled = status === 'scheduled';
  const title = showPicks
    ? t(locale, 'PARTICIPANT PREDICTIONS')
    : t(locale, 'MANAGE PARTICIPANTS');

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm(t(locale, 'Delete this entry? Coins will be refunded if paid.'))) return;
    setPendingId(entryId);
    try {
      await api.delete(`/quinielas/${quinielaId}/entries/${entryId}`, token);
      await load();
      onMutated?.();
    } catch (e) {
      setError(e.message || 'Delete failed');
    } finally {
      setPendingId(null);
    }
  };

  const handleRemoveParticipant = async (p) => {
    const entries = p.entries || [];
    if (entries.length === 0) return;
    const who = p.user?.displayName || p.user?.username || 'this player';
    const ok = window.confirm(
      tFormat(locale, 'Remove {who}? All {n} of their entries will be deleted (coins refunded).', {
        who, n: entries.length,
      })
    );
    if (!ok) return;
    setPendingId(p.user?.id);
    try {
      // Fire deletes in parallel — backend refund idempotency makes
      // retries safe if any single request blips.
      await Promise.all(
        entries.map((e) => api.delete(`/quinielas/${quinielaId}/entries/${e._id}`, token))
      );
      await load();
      onMutated?.();
    } catch (e) {
      setError(e.message || 'Remove failed');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div
        className="fp-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 820, width: '94vw', maxHeight: '88vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>
            {title}
            <span className="muted" style={{ fontSize: 13, fontWeight: 500, marginLeft: 8 }}>
              · {participants.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(locale, 'Close')}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--fp-text-muted)', fontSize: 22,
              cursor: 'pointer', padding: 4, lineHeight: 1,
            }}
          >✕</button>
        </div>

        {picksHidden && (
          <p className="muted" style={{ fontSize: 12, margin: '0 0 14px' }}>
            {t(locale, 'Picks are hidden until the first kickoff so the creator can\'t moderate based on guesses.')}
          </p>
        )}
        {showPicks && (
          <p className="muted" style={{ fontSize: 12, margin: '0 0 14px' }}>
            {t(locale, 'Tap an entry to reveal picks.')}
          </p>
        )}

        {loading && <p className="muted" style={{ fontSize: 13 }}>{t(locale, 'Loading…')}</p>}
        {error && <p style={{ color: 'var(--fp-danger)', fontSize: 13 }}>{error}</p>}
        {!loading && participants.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>{t(locale, 'No participants yet')}</p>
        )}

        {!loading && participants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {participants.map((p) => {
              const name = p.user?.displayName || p.user?.username || 'Player';
              const handle = p.user?.username ? `@${p.user.username}` : '';
              const isPending = pendingId === p.user?.id;
              return (
                <div key={p.user?.id || name} style={{
                  padding: 12,
                  background: 'var(--fp-surface-alt)',
                  border: '1px solid var(--fp-stroke)',
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        {handle && <>{handle} · </>}
                        {p.entryCount} {p.entryCount === 1 ? t(locale, 'entry') : t(locale, 'entries')}
                      </div>
                    </div>
                    {isScheduled && (
                      <button
                        type="button"
                        className="fp-btn ghost sm"
                        disabled={isPending}
                        onClick={() => handleRemoveParticipant(p)}
                        style={{ color: 'var(--fp-danger)', borderColor: 'rgba(255,93,93,0.4)' }}
                      >
                        {isPending ? '…' : t(locale, 'REMOVE')}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {p.entries.map((e) => {
                      const entryPending = pendingId === e._id;
                      const isOpen = openEntryId === e._id;
                      const hasScore = typeof e.score === 'number'
                        && typeof e.totalPossible === 'number'
                        && e.totalPossible > 0;
                      const dateStr = e.createdAt
                        ? new Date(e.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                        : '';
                      return (
                        <div key={e._id} style={{
                          background: 'var(--fp-surface)',
                          borderRadius: 8,
                          overflow: 'hidden',
                        }}>
                          <div
                            onClick={showPicks ? () => setOpenEntryId(isOpen ? null : e._id) : undefined}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px',
                              cursor: showPicks ? 'pointer' : 'default',
                            }}
                          >
                            <span style={{
                              fontWeight: 700, color: 'var(--fp-primary)',
                              minWidth: 36, fontSize: 13,
                            }}>#{e.entryNumber}</span>
                            <span className="muted" style={{ flex: 1, fontSize: 11 }}>
                              {dateStr}
                            </span>
                            {showPicks && hasScore && (
                              <span className="gold" style={{ fontSize: 12, fontWeight: 700 }}>
                                {e.score}/{e.totalPossible} {t(locale, 'PTS')}
                              </span>
                            )}
                            {isScheduled ? (
                              <button
                                type="button"
                                disabled={entryPending}
                                onClick={() => handleDeleteEntry(e._id)}
                                style={{
                                  background: 'transparent', border: 'none',
                                  color: 'var(--fp-danger)',
                                  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                                  cursor: entryPending ? 'default' : 'pointer',
                                  opacity: entryPending ? 0.5 : 1,
                                }}
                              >{entryPending ? '…' : t(locale, 'DELETE')}</button>
                            ) : showPicks ? (
                              <span style={{ color: 'var(--fp-text-muted)', fontSize: 12 }}>
                                {isOpen ? '▲' : '▼'}
                              </span>
                            ) : null}
                          </div>

                          {showPicks && isOpen && (
                            <div style={{
                              padding: '4px 12px 12px',
                              display: 'flex', flexDirection: 'column', gap: 6,
                              borderTop: '1px solid var(--fp-stroke)',
                            }}>
                              {(fixtures || []).length === 0 ? (
                                <div className="muted" style={{ fontSize: 12, padding: '8px 0' }}>
                                  {t(locale, 'NO PICKS YET')}
                                </div>
                              ) : (
                                (fixtures || []).map((fx) => {
                                  const pick = (e.picks || []).find((pk) => pk.fixtureId === fx.fixtureId)?.pick;
                                  return (
                                    <PickRow
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

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="fp-btn ghost" onClick={onClose}>{t(locale, 'Close')}</button>
        </div>
      </div>
    </div>
  );
}

function CancelPoolModal({ quiniela, token, locale, onClose, onCancelled }) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const armed = confirmText.trim().toUpperCase() === 'CANCELAR';

  const run = async () => {
    setRunning(true); setError(null);
    try {
      const res = await api.post(`/admin/pools/${quiniela._id}/cancel`, { reason: reason.trim() }, token);
      setResult(res);
    } catch (e) {
      setError(e.message); setRunning(false);
    }
  };

  if (result) {
    const failed = (result.results || []).filter((r) => !r.ok).length;
    return (
      <div className="fp-modal-backdrop" onClick={onClose}>
        <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
          <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>
            {t(locale, 'Pool cancelled')}
          </h3>
          <p style={{ fontSize: 14, margin: '0 0 12px' }}>
            {tFormat(locale, '{n} entries processed', { n: result.entriesProcessed })}
            {failed > 0 && (
              <> · <span className="red">{tFormat(locale, '{n} refund failures', { n: failed })}</span></>
            )}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="fp-btn primary" onClick={onCancelled}>
              {t(locale, 'Done')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: 'var(--fp-danger)' }}>
          ⚠ {t(locale, 'Cancel pool & refund all')}
        </h3>
        <p style={{ fontSize: 13, margin: '0 0 14px', color: 'var(--fp-text-dim)' }}>
          {t(locale, 'This will refund every entry via Stripe and mark the pool cancelled. Cannot be undone.')}
        </p>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            {t(locale, 'Reason (visible in admin log)')}
          </div>
          <input
            type="text" value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(locale, 'e.g. fixture cancelled by league')}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 14,
              background: 'var(--fp-surface-alt)', border: '1px solid var(--fp-stroke)',
              borderRadius: 10, color: 'var(--fp-text)', font: 'inherit', outline: 'none',
            }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            {t(locale, 'Type CANCELAR to confirm')}
          </div>
          <input
            type="text" value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 14,
              background: 'var(--fp-surface-alt)',
              border: `1px solid ${armed ? 'var(--fp-danger)' : 'var(--fp-stroke)'}`,
              borderRadius: 10, color: 'var(--fp-text)', font: 'inherit', outline: 'none',
              letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase',
            }}
          />
        </label>
        {error && (
          <p style={{ color: 'var(--fp-danger)', fontSize: 12, margin: '0 0 12px' }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="fp-btn ghost block" onClick={onClose}>
            {t(locale, 'Keep pool')}
          </button>
          <button
            type="button" className="fp-btn danger block"
            disabled={!armed || running}
            onClick={run}
          >{running ? t(locale, 'Refunding…') : t(locale, 'Confirm cancel')}</button>
        </div>
      </div>
    </div>
  );
}
