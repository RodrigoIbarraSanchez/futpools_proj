import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { CardView } from '../components/CardView';
import { FixtureCard } from '../components/FixtureCard';
import { PoolStatTile } from '../components/PoolStatTile';

function formatDateRange(start, end) {
  if (!start) return '—';
  const d1 = new Date(start);
  const d2 = end ? new Date(end) : null;
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  if (d2) return `${d1.toLocaleString(undefined, opts)} - ${d2.toLocaleString(undefined, opts)}`;
  return d1.toLocaleString(undefined, opts);
}

function statusLabel(q, locale) {
  if (q.status === 'live') return 'LIVE';
  if (q.status === 'completed') return t(locale, 'Completed');
  const now = new Date();
  const end = q.endDate ? new Date(q.endDate) : null;
  const start = q.startDate ? new Date(q.startDate) : null;
  if (end && end < now) return t(locale, 'Closed');
  if (start && start > now) return t(locale, 'Upcoming');
  return t(locale, 'Open');
}

function QuinielaCard({ quiniela, liveFixtures = {} }) {
  const locale = useLocale().locale;
  const dateRange = formatDateRange(quiniela.startDate, quiniela.endDate);
  const status = statusLabel(quiniela, locale);
  const previewFixtures = (quiniela.fixtures || []).slice(0, 2);
  const more = (quiniela.fixtures?.length || 0) - previewFixtures.length;
  const isClosed = status === 'Closed' || status === 'Completed';

  return (
    <Link to={`/pool/${quiniela._id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: 'var(--spacing-sm)' }}>
      <CardView style={{ position: 'relative', paddingRight: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xs)' }}>
          <h3 className="app-font-headline" style={{ color: 'var(--app-text-primary)', margin: 0, flex: 1 }}>
            {quiniela.name}
          </h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--app-radius-pill)',
              background: status === 'LIVE' ? 'var(--app-live-red)' : isClosed ? 'var(--app-surface-alt)' : 'var(--app-primary)',
              color: isClosed ? 'var(--app-text-secondary)' : '#0B0F14',
            }}
          >
            {status}
          </span>
        </div>
        <p className="app-font-caption" style={{ color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-md)' }}>{dateRange}</p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--spacing-sm) var(--spacing-md)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          <PoolStatTile label={t(locale, 'Prize')} value={quiniela.prize} iconKey="prize" accent="gold" />
          <PoolStatTile label={t(locale, 'Entry')} value={quiniela.cost} iconKey="entry" />
          <PoolStatTile label={t(locale, 'Fixtures')} value={String(quiniela.fixtures?.length || 0)} iconKey="fixtures" />
          <PoolStatTile label={t(locale, 'Entries')} value={String(quiniela.entriesCount ?? 0)} iconKey="entries" />
        </div>

        {previewFixtures.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {previewFixtures.map((f) => (
                <FixtureCard key={f.fixtureId} fixture={f} live={liveFixtures[f.fixtureId]} compact />
              ))}
              {more > 0 && (
                <p className="app-font-caption" style={{ color: 'var(--app-text-secondary)', margin: 0 }}>
                  + {more} more fixtures
                </p>
              )}
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', right: 'var(--spacing-md)', top: '50%', transform: 'translateY(-50%)', color: 'var(--app-text-muted)', fontSize: 14 }}>
          ›
        </div>
      </CardView>
    </Link>
  );
}

export function Home() {
  const { locale } = useLocale();
  const [quinielas, setQuinielas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveFixtures, setLiveFixtures] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.get('/quinielas');
      setQuinielas(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fixtureIdsString = useMemo(() => {
    const ids = [...new Set(quinielas.flatMap((q) => (q.fixtures || []).map((f) => f.fixtureId).filter(Boolean)))];
    return ids.sort((a, b) => a - b).join(',');
  }, [quinielas]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!fixtureIdsString) return;
    const fetchLive = async () => {
      try {
        const list = await api.get(`/football/fixtures?ids=${fixtureIdsString}`);
        const map = {};
        (list || []).forEach((f) => {
          if (f.fixtureId != null) map[f.fixtureId] = f;
        });
        setLiveFixtures(map);
      } catch {
        setLiveFixtures({});
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 30000);
    return () => clearInterval(interval);
  }, [fixtureIdsString]);

  return (
    <>
      <header
        style={{
          padding: 'var(--spacing-lg) var(--spacing-md)',
          textAlign: 'center',
        }}
      >
        <h1 className="app-font-headline" style={{ margin: 0, color: 'var(--app-text-primary)' }}>{t(locale, 'Pools')}</h1>
        <p className="app-font-overline" style={{ margin: '2px 0 0', color: 'var(--app-text-muted)' }}>{t(locale, 'Play')}</p>
      </header>
      <div style={{ padding: '0 var(--spacing-md) var(--spacing-md)' }}>
        {loading && quinielas.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p style={{ color: 'var(--app-text-secondary)' }}>{t(locale, 'Loading pools…')}</p>
          </div>
        )}
        {error && (
          <p style={{ color: 'var(--app-text-secondary)', textAlign: 'center', padding: 'var(--spacing-md)' }}>{error}</p>
        )}
        {!loading && quinielas.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p style={{ fontSize: 48, marginBottom: 'var(--spacing-md)' }}>🏆</p>
            <p style={{ color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
              {t(locale, 'No pools right now')}
            </p>
            <p style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>
              {t(locale, "Check back soon or we'll notify you when new pools are available to play.")}
            </p>
            <button
              type="button"
              onClick={load}
              style={{
                marginTop: 'var(--spacing-md)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--app-surface-alt)',
                border: '1px solid var(--app-stroke)',
                borderRadius: 'var(--app-radius-button)',
                color: 'var(--app-primary)',
                fontSize: 14,
              }}
            >
              {t(locale, 'Refresh')}
            </button>
          </div>
        )}
        {!loading && quinielas.length > 0 && quinielas.map((q) => (
          <QuinielaCard key={q._id} quiniela={q} liveFixtures={liveFixtures} />
        ))}
      </div>
    </>
  );
}
