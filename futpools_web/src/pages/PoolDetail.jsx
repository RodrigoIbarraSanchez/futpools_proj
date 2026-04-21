import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import {
  HudFrame, HudChip, LiveDot, TeamCrest, ArcadeButton, SectionLabel, IconButton,
} from '../arena-ui/primitives';
import { InsufficientBalanceModal } from '../components/InsufficientBalanceModal';

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
function statusMeta(q) {
  const now = new Date();
  const fixtures = q?.fixtures || [];
  const endedByStatus = q?.status === 'completed';
  const endedByDate = q?.endDate && new Date(q.endDate) < now;
  if (endedByStatus || endedByDate) {
    return { label: 'POOL FINISHED', color: 'var(--fp-text-muted)', showDot: false };
  }
  const anyStarted = fixtures.some(f => f.kickoff && new Date(f.kickoff) <= now);
  if (q?.status === 'live' && anyStarted) {
    return { label: 'LIVE NOW', color: 'var(--fp-danger)', showDot: true };
  }
  const upcoming = fixtures
    .map(f => f.kickoff && new Date(f.kickoff))
    .filter(d => d && d > now)
    .sort((a, b) => a - b);
  if (upcoming.length) {
    const label = `OPENS · ${upcoming[0].toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }).toUpperCase()}`;
    return { label, color: 'var(--fp-accent)', showDot: false };
  }
  return { label: 'POOL FINISHED', color: 'var(--fp-text-muted)', showDot: false };
}

export function PoolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { locale } = useLocale();
  const [quiniela, setQuiniela] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('fixtures');
  const [entryCount, setEntryCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState(null);
  const [showInsufficient, setShowInsufficient] = useState(false);

  const userBalance = user?.balance ?? 0;
  const entryCost = quiniela ? parseEntryCost(quiniela.cost) : 0;
  const hasEnoughBalance = userBalance >= entryCost;

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

  useEffect(() => {
    if (id && token) {
      api.get(`/quinielas/${id}/entries/me`, token).then(e => setEntryCount(e?.length ?? 0)).catch(() => setEntryCount(0));
    }
    if (id) {
      api.get(`/quinielas/${id}/leaderboard`).then(setLeaderboard).catch(() => setLeaderboard(null));
    }
  }, [id, token]);

  const handleJoin = () => {
    if (!canJoin()) return;
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

  const status = statusMeta(quiniela);

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
          {/* spacer to keep title centered (share button removed — no handler) */}
          <div style={{ width: 32 }} />
        </div>

        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 24, fontWeight: 800,
          letterSpacing: 1, lineHeight: 1.1, marginBottom: 8,
          textTransform: 'uppercase',
        }}>{quiniela.name}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {status.showDot && <LiveDot color={status.color} />}
          <span style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 1, fontWeight: 700,
            color: status.color,
          }}>{status.label}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
            {(quiniela.entriesCount ?? 0)} JUGADORES
          </span>
        </div>

        {/* Prize hero */}
        <HudFrame
          glow="var(--fp-gold)"
          bg="linear-gradient(135deg, color-mix(in srgb, var(--fp-gold) 20%, transparent), var(--fp-bg2))"
        >
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 32, filter: 'drop-shadow(0 0 8px var(--fp-gold))' }}>🏆</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--fp-text-muted)' }}>
                PRIZE POOL
              </div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 26, fontWeight: 800,
                color: 'var(--fp-gold)', letterSpacing: 1, lineHeight: 1,
              }}>{quiniela.prize}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--fp-text-muted)' }}>
                ENTRY
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
          ['fixtures', 'FIXTURES'],
          ['ranking',  'RANKING'],
          ['overview', 'INFO'],
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
        {tab === 'fixtures' && (quiniela.fixtures || []).map((f) => (
          <HudFrame key={f.fixtureId} style={{ marginBottom: 8 }}>
            <div style={{ padding: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', marginBottom: 10,
                fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
                color: 'var(--fp-text-muted)',
              }}>
                {f.kickoff ? new Date(f.kickoff).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase() : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <TeamCrest name={f.homeTeam} logoURL={f.homeLogo} size={32} />
                  <div style={{
                    fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 700,
                    letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>{String(f.homeTeam).slice(0,3)}</div>
                </div>
                <div style={{
                  fontFamily: 'var(--fp-display)', fontSize: 10, letterSpacing: 2,
                  color: 'var(--fp-text-muted)',
                }}>VS</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                  <div style={{
                    fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 700,
                    letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>{String(f.awayTeam).slice(0,3)}</div>
                  <TeamCrest name={f.awayTeam} logoURL={f.awayLogo} size={32} />
                </div>
              </div>
            </div>
          </HudFrame>
        ))}

        {tab === 'ranking' && (
          <HudFrame>
            <div style={{ padding: 14 }}>
              <SectionLabel color="var(--fp-primary)">LEADERBOARD</SectionLabel>
              <div style={{ height: 12 }} />
              {!leaderboard?.entries?.length && !leaderboard?.leaderboard?.length ? (
                <div style={{ color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-body)', fontSize: 13 }}>
                  {t(locale, 'No participants yet. Be the first to join.')}
                </div>
              ) : (
                <div>
                  {(leaderboard.entries || leaderboard.leaderboard || []).slice(0, 12).map((e) => (
                    <div key={e.entryId || e.userId || e.rank} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 4px',
                      background: e.isSelf ? 'color-mix(in srgb, var(--fp-primary) 15%, transparent)' : 'transparent',
                      clipPath: e.isSelf ? 'var(--fp-clip-sm)' : 'none',
                    }}>
                      <div style={{
                        width: 24, textAlign: 'center',
                        fontFamily: 'var(--fp-mono)', fontSize: 12, fontWeight: 700,
                        color: 'var(--fp-text-dim)',
                      }}>{e.rank}</div>
                      <div style={{
                        flex: 1,
                        fontFamily: 'var(--fp-mono)', fontSize: 12,
                        color: 'var(--fp-text)',
                      }}>{e.displayName || e.userId || 'player'}</div>
                      <div style={{
                        fontFamily: 'var(--fp-mono)', fontSize: 13, fontWeight: 700,
                        color: 'var(--fp-primary)',
                      }}>{e.score}/{e.totalPossible}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </HudFrame>
        )}

        {tab === 'overview' && (
          <HudFrame>
            <div style={{ padding: 14 }}>
              <SectionLabel color="var(--fp-primary)">POOL INFO</SectionLabel>
              <div style={{ height: 8 }} />
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-dim)', marginBottom: 12 }}>
                {formatDateRange(quiniela.startDate, quiniela.endDate)}
              </div>
              {quiniela.description && (
                <div style={{ fontFamily: 'var(--fp-body)', fontSize: 13, color: 'var(--fp-text-dim)', marginBottom: 12 }}>
                  {quiniela.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <HudChip color="var(--fp-gold)">PRIZE {quiniela.prize}</HudChip>
                <HudChip color="var(--fp-accent)">ENTRY {quiniela.cost}</HudChip>
                <HudChip>FIXTURES {quiniela.fixtures?.length || 0}</HudChip>
                {entryCount > 0 && <HudChip color="var(--fp-hot)">ENTRY #{entryCount}</HudChip>}
              </div>
              {entryCount > 0 && (
                <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-dim)', marginTop: 10 }}>
                  {entryCount === 1
                    ? t(locale, 'You already have one entry in this pool.')
                    : tFormat(locale, 'You already have {n} entr(y|ies) in this pool.', { n: entryCount })}
                </div>
              )}
            </div>
          </HudFrame>
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
            {canJoin() ? `▶ ${entryCount > 0 ? 'NEW ENTRY' : 'MAKE PICKS'} · ${quiniela.cost}` : 'POOL LOCKED'}
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
    </>
  );
}
