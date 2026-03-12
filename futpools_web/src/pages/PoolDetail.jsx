import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { CardView } from '../components/CardView';
import { FixtureCard } from '../components/FixtureCard';
import { Pill } from '../components/Pill';
import { PrimaryButton } from '../components/PrimaryButton';
import { SegmentTabs } from '../components/SegmentTabs';
import { InsufficientBalanceModal } from '../components/InsufficientBalanceModal';

function formatDateRange(start, end) {
  if (!start) return '—';
  const d1 = new Date(start);
  const d2 = end ? new Date(end) : null;
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  if (d2) return `${d1.toLocaleString(undefined, opts)} - ${d2.toLocaleString(undefined, opts)}`;
  return d1.toLocaleString(undefined, opts);
}

function parseEntryCost(cost) {
  if (typeof cost === 'number') return cost;
  const s = String(cost || '').replace(/[^0-9.-]/g, '');
  return parseFloat(s) || 0;
}

export function PoolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { locale } = useLocale();
  const [quiniela, setQuiniela] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const tab = tabIndex === 0 ? 'overview' : 'fixtures';
  const [entryCount, setEntryCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState(null);
  const [liveFixtures, setLiveFixtures] = useState({});
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

  const loadPool = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const q = await api.get(`/quinielas/${id}`);
      setQuiniela(q);
    } catch {
      setQuiniela(null);
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    if (!id || !token) return;
    try {
      const entries = await api.get(`/quinielas/${id}/entries/me`, token);
      setEntryCount(entries?.length ?? 0);
    } catch {
      setEntryCount(0);
    }
  };

  const loadLeaderboard = async () => {
    if (!id) return;
    try {
      const lb = await api.get(`/quinielas/${id}/leaderboard`);
      setLeaderboard(lb);
    } catch {
      setLeaderboard(null);
    }
  };

  const loadLiveFixtures = async () => {
    const fixtureIds = (quiniela?.fixtures || []).map((f) => f.fixtureId).filter(Boolean);
    if (fixtureIds.length === 0) return;
    try {
      const ids = fixtureIds.join(',');
      const list = await api.get(`/football/fixtures?ids=${ids}`);
      const map = {};
      (list || []).forEach((f) => {
        if (f.fixtureId != null) map[f.fixtureId] = f;
      });
      setLiveFixtures(map);
    } catch {
      setLiveFixtures({});
    }
  };

  useEffect(() => {
    loadPool();
  }, [id]);

  useEffect(() => {
    if (id && token) {
      loadEntries();
    }
    loadLeaderboard();
  }, [id, token]);

  useEffect(() => {
    if (!quiniela?.fixtures?.length) return;
    loadLiveFixtures();
    const interval = setInterval(loadLiveFixtures, 30000);
    return () => clearInterval(interval);
  }, [quiniela?._id, quiniela?.fixtures?.length]);

  const handleJoinClick = () => {
    if (!canJoin()) return;
    if (entryCost > 0 && !hasEnoughBalance) {
      setShowInsufficient(true);
      return;
    }
    navigate(`/pool/${id}/pick`);
  };

  const handleRecharge = () => {
    setShowInsufficient(false);
    navigate('/account');
  };

  if (loading || !quiniela) {
    return (
      <>
        <AppBackground />
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
          <p style={{ color: 'var(--app-text-secondary)' }}>{loading ? t(locale, 'Loading pools…') : 'Pool not found'}</p>
        </div>
      </>
    );
  }

  const dateRange = formatDateRange(quiniela.startDate, quiniela.endDate);
  const joinLabel = entryCount > 0 ? t(locale, 'Create Another Entry') : t(locale, 'Join & Pick');

  return (
    <>
      <AppBackground />
      <header
        style={{
          padding: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--app-primary)',
            fontSize: 20,
            padding: 'var(--spacing-xs)',
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <h1 className="app-font-headline" style={{ margin: 0, flex: 1 }}>{t(locale, 'Pool')}</h1>
      </header>

      <div style={{ padding: '0 var(--spacing-md) var(--spacing-lg)' }}>
        <h2 className="app-font-title" style={{ marginBottom: 'var(--spacing-xs)', color: 'var(--app-text-primary)' }}>{quiniela.name}</h2>
        <p className="app-font-caption" style={{ color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-md)' }}>{dateRange}</p>

        <SegmentTabs
          tabs={[t(locale, 'Overview'), t(locale, 'Fixtures')]}
          selectedIndex={tabIndex}
          onChange={setTabIndex}
        />
        <div style={{ marginTop: 'var(--spacing-md)' }} />

        {tab === 'overview' && (
          <>
            {quiniela.description && (
              <p style={{ color: 'var(--app-text-secondary)', fontSize: 15, marginBottom: 'var(--spacing-sm)' }}>
                {quiniela.description}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <Pill label={`${t(locale, 'Entry')}: ${quiniela.cost}`} />
              <Pill label={`${t(locale, 'Fixtures')}: ${quiniela.fixtures?.length || 0}`} />
              {entryCount > 0 && <Pill label={`Entry #${entryCount}`} />}
            </div>

            {leaderboard?.prizeLadder?.length > 0 && (
              <>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                  {t(locale, 'Prize ladder')}
                </h3>
                <CardView style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                    {[...leaderboard.prizeLadder]
                      .filter((r) => r.hits > 0)
                      .sort((a, b) => b.hits - a.hits)
                      .map((r) => (
                        <div
                          key={r.hits}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 14,
                          }}
                        >
                          <span style={{ color: 'var(--app-text-secondary)' }}>
                            {r.hits === 1 ? '1 acierto' : `${r.hits} aciertos`}
                          </span>
                          <span style={{ color: r.amount > 0 ? 'var(--app-gold)' : 'var(--app-text-muted)', fontWeight: 600 }}>
                            ${r.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 14,
                        paddingTop: 'var(--spacing-xs)',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <span style={{ color: 'var(--app-text-muted)' }}>{t(locale, '1 to 7 hits')}</span>
                      <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>$0</span>
                    </div>
                    {leaderboard.prizeLadder.find((r) => r.hits === 0) && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 14,
                        }}
                      >
                        <span style={{ color: 'var(--app-text-secondary)' }}>0 aciertos</span>
                        <span style={{ color: 'var(--app-gold)', fontWeight: 600 }}>$100</span>
                      </div>
                    )}
                  </div>
                </CardView>
              </>
            )}
            <PrimaryButton style="green" onClick={handleJoinClick} disabled={!canJoin()}>
              {joinLabel}
            </PrimaryButton>
            {!canJoin() && (
              <p style={{ fontSize: 13, color: 'var(--app-live-red)', marginTop: 'var(--spacing-sm)' }}>
                {t(locale, 'This pool has already started. New entries are locked.')}
              </p>
            )}
            {entryCount > 0 && (
              <p style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
                {entryCount === 1
                  ? t(locale, 'You already have one entry in this pool.')
                  : tFormat(locale, 'You already have {n} entr(y|ies) in this pool.', { n: entryCount })}
              </p>
            )}

            <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>
              {t(locale, 'Leaderboard')}
            </h3>
            <CardView>
              {!(leaderboard?.leaderboard?.length || leaderboard?.entries?.length) ? (
                <p style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
                  {t(locale, 'No participants yet. Be the first to join.')}
                </p>
              ) : (
                <div style={{ fontSize: 14 }}>
                  <p style={{ color: 'var(--app-text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                    {t(locale, 'Score: correct predictions per finished match')}
                  </p>
                  {(leaderboard.leaderboard || leaderboard.entries || []).slice(0, 10).map((e, i) => (
                    <div
                      key={e.userId || e.entryId || i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-xs) 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        gap: 'var(--spacing-sm)',
                      }}
                    >
                      <span style={{ color: 'var(--app-text-primary)' }}>
                        #{e.rank} {e.displayName || e.userId}
                      </span>
                      <span style={{ color: 'var(--app-primary)' }}>{e.score}/{e.totalPossible}</span>
                      {e.prizeAmount !== undefined && (
                        <span style={{ color: 'var(--app-gold)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          ${e.prizeAmount > 0 ? e.prizeAmount.toLocaleString() : '0'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardView>
          </>
        )}

        {tab === 'fixtures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {(quiniela.fixtures || []).map((f) => (
              <FixtureCard key={f.fixtureId} fixture={f} live={liveFixtures[f.fixtureId]} />
            ))}
          </div>
        )}
      </div>

      {showInsufficient && (
        <InsufficientBalanceModal
          entryCost={entryCost}
          currentBalance={userBalance}
          onRecharge={handleRecharge}
          onClose={() => setShowInsufficient(false)}
        />
      )}
    </>
  );
}
