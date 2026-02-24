import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { CardView } from '../components/CardView';
import { Pill } from '../components/Pill';
import { PrimaryButton } from '../components/PrimaryButton';
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
  const [tab, setTab] = useState('overview');
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

  useEffect(() => {
    loadPool();
  }, [id]);

  useEffect(() => {
    if (id && token) {
      loadEntries();
    }
    loadLeaderboard();
  }, [id, token]);

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
          borderBottom: '1px solid var(--app-stroke)',
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
            fontSize: 18,
            padding: 'var(--spacing-xs)',
          }}
        >
          ←
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, flex: 1 }}>{t(locale, 'Pool')}</h1>
      </header>

      <div style={{ padding: 'var(--spacing-md)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 'var(--spacing-xs)' }}>{quiniela.name}</h2>
        <p style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-md)' }}>{dateRange}</p>

        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-xs)',
            marginBottom: 'var(--spacing-md)',
            background: 'var(--app-surface-alt)',
            padding: 'var(--spacing-xs)',
            borderRadius: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setTab('overview')}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm)',
              border: 'none',
              borderRadius: 6,
              background: tab === 'overview' ? 'var(--app-surface)' : 'transparent',
              color: 'var(--app-text-primary)',
              fontSize: 14,
            }}
          >
            {t(locale, 'Overview')}
          </button>
          <button
            type="button"
            onClick={() => setTab('fixtures')}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm)',
              border: 'none',
              borderRadius: 6,
              background: tab === 'fixtures' ? 'var(--app-surface)' : 'transparent',
              color: 'var(--app-text-primary)',
              fontSize: 14,
            }}
          >
            {t(locale, 'Fixtures')}
          </button>
        </div>

        {tab === 'overview' && (
          <>
            {quiniela.description && (
              <p style={{ color: 'var(--app-text-secondary)', fontSize: 15, marginBottom: 'var(--spacing-sm)' }}>
                {quiniela.description}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <Pill label={`${t(locale, 'Prize')}: ${quiniela.prize}`} />
              <Pill label={`${t(locale, 'Entry')}: ${quiniela.cost}`} />
              <Pill label={`${t(locale, 'Fixtures')}: ${quiniela.fixtures?.length || 0}`} />
              {entryCount > 0 && <Pill label={`Entry #${entryCount}`} />}
            </div>
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
              {!leaderboard?.entries?.length ? (
                <p style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
                  {t(locale, 'No participants yet. Be the first to join.')}
                </p>
              ) : (
                <div style={{ fontSize: 14 }}>
                  <p style={{ color: 'var(--app-text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                    {t(locale, 'Score: correct predictions per finished match')}
                  </p>
                  {leaderboard.entries.slice(0, 10).map((e, i) => (
                    <div
                      key={e.userId || i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: 'var(--spacing-xs) 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <span style={{ color: 'var(--app-text-primary)' }}>#{e.rank} {e.displayName || e.userId}</span>
                      <span style={{ color: 'var(--app-primary)' }}>{e.score}/{e.totalPossible}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardView>
          </>
        )}

        {tab === 'fixtures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {(quiniela.fixtures || []).map((f) => (
              <CardView key={f.fixtureId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--app-text-primary)' }}>{f.homeTeam} vs {f.awayTeam}</span>
                  {f.kickoff && (
                    <span style={{ fontSize: 13, color: 'var(--app-text-secondary)' }}>
                      {new Date(f.kickoff).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
              </CardView>
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
