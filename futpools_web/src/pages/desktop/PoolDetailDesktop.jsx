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
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../context/LocaleContext';
import { t, tFormat } from '../../i18n/translations';
import { resolvePoolStatus } from '../../lib/poolStatus';

const WINNER_SHARE = 0.65;
const FINISHED = new Set(['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO']);
const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const isLiveStatus = (s) => LIVE.has(String(s || '').toUpperCase());
const isFinishedStatus = (s) => FINISHED.has(String(s || '').toUpperCase());

function fmtMxn(n) { return '$' + Number(n).toLocaleString('es-MX'); }

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

function PoolHeader({ quiniela, status, locale, navigate, goBack, justPaid }) {
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
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// JOIN card (sticky aside) — Stripe checkout entry point.
// ─────────────────────────────────────────────────────────────────────

function PlayCard({ quiniela, locale, canJoin, alreadyEntered, entryCount, feeMXN, onJoin, status }) {
  const closed = !canJoin;
  const prizePot = (quiniela.entriesCount ?? 0) * (quiniela.entryFeeMXN ?? 50) * WINNER_SHARE;
  const ctaLabel = closed
    ? (status === 'completed' ? t(locale, 'Pool closed') : t(locale, 'POOL LOCKED'))
    : alreadyEntered
      ? `+ ${t(locale, 'NEW ENTRY')} · $${feeMXN} MXN`
      : `▶ ${t(locale, 'JOIN')} · $${feeMXN} MXN`;
  return (
    <div className="fp-card" style={{
      background: 'linear-gradient(180deg, rgba(33,226,140,0.08), transparent 70%), var(--fp-surface)',
      border: '1px solid rgba(33,226,140,0.28)',
      position: 'sticky', top: 'var(--app-space-8)',
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
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>${feeMXN} MXN</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            {t(locale, 'Prize')}
          </div>
          <div className="gold num" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {prizePot > 0 ? fmtMxn(prizePot) : '—'}
          </div>
        </div>
      </div>
      {alreadyEntered && (
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
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, margin: '12px 0 0', textAlign: 'center' }}>
        {t(locale, 'Picks are submitted on the next screen and confirmed via Stripe.')}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab content — Resumen, Partidos, Tabla.
// ─────────────────────────────────────────────────────────────────────

function FixtureRow({ fixture, live, locale, navigate }) {
  const liveStatus = live?.status;
  const liveMatch = isLiveStatus(liveStatus?.short);
  const finalMatch = isFinishedStatus(liveStatus?.short) || isFinishedStatus(fixture.status);
  const hasScore = live && live.score && live.score.home != null;
  const kickoffStr = fixture.kickoff
    ? new Date(fixture.kickoff).toLocaleString(undefined, {
        weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;
  return (
    <button
      type="button"
      onClick={() => navigate(`/fixture/${fixture.fixtureId}`)}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%' }}
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
      </div>
    </button>
  );
}

function FixturesTab({ quiniela, liveByFixture, locale, navigate }) {
  // Group by day so a 9-fixture pool reads as 'Sat / Sun / Mon' rather
  // than a flat list.
  const byDay = (() => {
    const groups = {};
    for (const f of (quiniela.fixtures || [])) {
      const day = f.kickoff
        ? new Date(f.kickoff).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short' })
        : t(locale, 'Date TBD');
      (groups[day] ||= []).push(f);
    }
    return groups;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-6)' }}>
      {Object.entries(byDay).map(([day, list]) => (
        <div key={day}>
          <h4 className="fp-section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            🕐 {day}
            <span className="accent">
              {list.length} {list.length === 1 ? t(locale, 'fixture') : t(locale, 'fixtures')}
            </span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((f) => (
              <FixtureRow
                key={f.fixtureId}
                fixture={f}
                live={liveByFixture[f.fixtureId]}
                locale={locale}
                navigate={navigate}
              />
            ))}
          </div>
        </div>
      ))}
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

function OverviewTab({ quiniela, liveByFixture, leaderboard, currentUserId, entryCount, locale, navigate }) {
  const yourEntries = leaderboardRows(leaderboard).filter(
    (r) => String(r.userId) === String(currentUserId)
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-6)' }}>
      {/* Your entries summary (only if user is participating) */}
      {entryCount > 0 && yourEntries.length > 0 && (
        <div className="fp-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--fp-stroke)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h4 className="fp-section-title" style={{ margin: 0 }}>
              {t(locale, 'Your entries in this pool')}
            </h4>
            <span className="muted" style={{ fontSize: 12 }}>
              {yourEntries.length} {yourEntries.length === 1 ? t(locale, 'entry') : t(locale, 'entries')}
            </span>
          </div>
          <table className="fp-table">
            <thead>
              <tr>
                <th>{t(locale, 'Entry')}</th>
                <th className="num">{t(locale, 'Score')}</th>
                <th>{t(locale, 'Progress')}</th>
              </tr>
            </thead>
            <tbody>
              {yourEntries.map((e) => {
                const total = e.totalPossible || quiniela.fixtures?.length || 0;
                const pct = total > 0 ? (e.score / total) * 100 : 0;
                return (
                  <tr key={`${e.userId}-${e.entryNumber || 1}`}>
                    <td><span style={{ fontWeight: 600 }}>#{e.entryNumber || 1}</span></td>
                    <td className="num" style={{ fontWeight: 700 }}>{e.score || 0}/{total}</td>
                    <td style={{ width: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          flex: 1, height: 6, borderRadius: 999,
                          background: 'var(--fp-surface-alt)', overflow: 'hidden',
                        }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--fp-primary)' }} />
                        </div>
                        <span className="muted num" style={{ fontSize: 11 }}>{Math.round(pct)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Fixtures preview — first 6 in a 2-col grid */}
      <div>
        <h4 className="fp-section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚽ {t(locale, 'Fixtures')}
          <span className="accent">{quiniela.fixtures?.length ?? 0} {t(locale, 'predictions')}</span>
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {(quiniela.fixtures || []).slice(0, 6).map((f) => (
            <FixtureRow
              key={f.fixtureId}
              fixture={f}
              live={liveByFixture[f.fixtureId]}
              locale={locale}
              navigate={navigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

export function PoolDetailDesktop({
  quiniela, liveByFixture, leaderboard, currentUserId,
  entryCount, alreadyEntered, canJoin, feeMXN,
  handleJoin, navigate, goBack, justPaid,
}) {
  const { locale } = useLocale();
  const status = resolvePoolStatus(quiniela, liveByFixture);
  const [tab, setTab] = useState('overview');

  return (
    // .fp-desktop-scope opts this top-level route into the same scoped
    // styles the desktop shell uses (.fp-card, .fp-tabs, .fp-status,
    // .fp-fixture, etc). Without this wrapper PoolDetail renders bare
    // HTML because the desktop CSS rules require an ancestor with either
    // .fp-desktop-shell or .fp-desktop-scope.
    <div
      className="fp-desktop-scope fp-desktop-wide"
      style={{ padding: 'var(--app-space-8)' }}
    >
      <PoolHeader
        quiniela={quiniela} status={status} locale={locale}
        navigate={navigate} goBack={goBack} justPaid={justPaid}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 380px',
        gap: 'var(--app-space-6)', alignItems: 'flex-start',
      }}>
        <div>
          <div className="fp-tabs">
            <button
              type="button"
              className={tab === 'overview' ? 'active' : ''}
              onClick={() => setTab('overview')}
            >{t(locale, 'Overview')}</button>
            <button
              type="button"
              className={tab === 'fixtures' ? 'active' : ''}
              onClick={() => setTab('fixtures')}
            >{t(locale, 'Fixtures')} · {quiniela.fixtures?.length ?? 0}</button>
            <button
              type="button"
              className={tab === 'leaderboard' ? 'active' : ''}
              onClick={() => setTab('leaderboard')}
            >{t(locale, 'Leaderboard')}</button>
          </div>
          <div style={{ marginTop: 'var(--app-space-5)' }}>
            {tab === 'overview' && (
              <OverviewTab
                quiniela={quiniela}
                liveByFixture={liveByFixture}
                leaderboard={leaderboard}
                currentUserId={currentUserId}
                entryCount={entryCount}
                locale={locale}
                navigate={navigate}
              />
            )}
            {tab === 'fixtures' && (
              <FixturesTab
                quiniela={quiniela}
                liveByFixture={liveByFixture}
                locale={locale}
                navigate={navigate}
              />
            )}
            {tab === 'leaderboard' && (
              <LeaderboardTab
                leaderboard={leaderboard}
                currentUserId={currentUserId}
                locale={locale}
              />
            )}
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-5)' }}>
          <PlayCard
            quiniela={quiniela}
            locale={locale}
            canJoin={canJoin}
            alreadyEntered={alreadyEntered}
            entryCount={entryCount}
            feeMXN={feeMXN}
            onJoin={handleJoin}
            status={status}
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
        </aside>
      </div>
    </div>
  );
}
