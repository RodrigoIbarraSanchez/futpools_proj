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
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { t, tFormat } from '../../i18n/translations';
import { resolvePoolStatus } from '../../lib/poolStatus';
import { DesktopShellChrome } from '../../desktop/DesktopShell';

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

// Unified Partidos tab. Replaces the original Overview+Fixtures split —
// having two tabs that both showed fixtures was redundant. This one
// stacks the user's entries summary (when participating) on top of the
// full grouped-by-day fixture list, so a single tap surfaces everything
// you'd expect on a pool's main view.
function PartidosTab({ quiniela, liveByFixture, leaderboard, currentUserId, entryCount, locale, navigate }) {
  const yourEntries = leaderboardRows(leaderboard).filter(
    (r) => String(r.userId) === String(currentUserId)
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-6)' }}>
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

      {/* Full fixture list — grouped by day so a 12-fixture pool reads
          as 'Wed / Thu / Sat' rather than a flat list. */}
      <FixturesTab
        quiniela={quiniela}
        liveByFixture={liveByFixture}
        locale={locale}
        navigate={navigate}
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
  handleJoin, navigate, goBack, justPaid,
  isAdmin = false, isOwner = false, token, onMutated,
}) {
  const { locale } = useLocale();
  const status = resolvePoolStatus(quiniela, liveByFixture);
  // Two tabs: PARTIDOS (entries summary + grouped fixtures) and TABLA
  // (leaderboard). The earlier OVERVIEW was redundant — it duplicated
  // the fixtures list with an arbitrary 'first 6' truncation.
  const [tab, setTab] = useState('partidos');
  const [showEdit, setShowEdit] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const canAdmin = isAdmin || isOwner;

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
              className={tab === 'partidos' ? 'active' : ''}
              onClick={() => setTab('partidos')}
            >{t(locale, 'Fixtures')} · {quiniela.fixtures?.length ?? 0}</button>
            <button
              type="button"
              className={tab === 'leaderboard' ? 'active' : ''}
              onClick={() => setTab('leaderboard')}
            >{t(locale, 'Leaderboard')}</button>
          </div>
          <div style={{ marginTop: 'var(--app-space-5)' }}>
            {tab === 'partidos' && (
              <PartidosTab
                quiniela={quiniela}
                liveByFixture={liveByFixture}
                leaderboard={leaderboard}
                currentUserId={currentUserId}
                entryCount={entryCount}
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
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onMutated?.(); }}
        />
      )}
      {showParticipants && (
        <ParticipantsModal
          quinielaId={quiniela._id}
          token={token}
          locale={locale}
          onClose={() => setShowParticipants(false)}
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

function EditPoolModal({ quiniela, token, locale, onClose, onSaved }) {
  const [name, setName] = useState(quiniela.name || '');
  const [description, setDescription] = useState(quiniela.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setSaving(true); setError(null);
    try {
      await api.put(`/quinielas/${quiniela._id}`, {
        name: name.trim(),
        description: description.trim(),
      }, token);
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

function ParticipantsModal({ quinielaId, token, locale, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.get(`/quinielas/${quinielaId}/participants`, token)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [quinielaId, token]);
  const participants = data?.participants || [];
  const picksHidden = data?.picksHidden;
  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
          {t(locale, 'Participants')} <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>· {participants.length}</span>
        </h3>
        {picksHidden && (
          <p className="muted" style={{ fontSize: 12, margin: '0 0 14px' }}>
            {t(locale, 'Picks are hidden until the first kickoff so the creator can\'t moderate based on guesses.')}
          </p>
        )}
        {loading && <p className="muted" style={{ fontSize: 13 }}>{t(locale, 'Loading…')}</p>}
        {error && <p style={{ color: 'var(--fp-danger)', fontSize: 13 }}>{error}</p>}
        {!loading && participants.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>{t(locale, 'No participants yet')}</p>
        )}
        {!loading && participants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {participants.map((p) => (
              <div key={p.user.id} style={{
                padding: 12, background: 'var(--fp-surface-alt)',
                border: '1px solid var(--fp-stroke)', borderRadius: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong>{p.user.displayName || p.user.username || 'Player'}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {p.entryCount} {p.entryCount === 1 ? t(locale, 'entry') : t(locale, 'entries')}
                  </span>
                </div>
                {p.entries.map((e) => (
                  <div key={e._id} style={{ marginTop: 8, fontSize: 12 }}>
                    <div className="muted" style={{ marginBottom: 4 }}>
                      #{e.entryNumber} · {e.score ?? 0}/{e.totalPossible ?? '—'}
                    </div>
                    {e.picks && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {e.picks.map((pk) => (
                          <span key={pk.fixtureId} style={{
                            padding: '3px 8px', borderRadius: 6,
                            background: 'rgba(33,226,140,0.16)', color: 'var(--fp-primary)',
                            fontFamily: 'var(--app-font-mono)', fontSize: 11, fontWeight: 700,
                          }}>{pk.pick}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
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
