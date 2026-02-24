import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { CardView } from '../components/CardView';
import { Pill } from '../components/Pill';

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

function QuinielaCard({ quiniela }) {
  const locale = useLocale().locale;
  const dateRange = formatDateRange(quiniela.startDate, quiniela.endDate);
  const status = statusLabel(quiniela, locale);
  const previewFixtures = (quiniela.fixtures || []).slice(0, 2);
  const more = (quiniela.fixtures?.length || 0) - previewFixtures.length;

  return (
    <Link to={`/pool/${quiniela._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <CardView style={{ marginBottom: 'var(--spacing-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xs)' }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>
            {quiniela.name}
          </h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 999,
              background: status === 'LIVE' ? 'var(--app-live-red)' : status === 'Closed' || status === 'Completed' ? 'var(--app-surface-alt)' : 'var(--app-primary)',
              color: status === 'Closed' || status === 'Completed' ? 'var(--app-text-secondary)' : '#000',
            }}
          >
            {status}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>{dateRange}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
          <Pill label={`${t(locale, 'Prize')}: ${quiniela.prize}`} />
          <Pill label={`${t(locale, 'Entry')}: ${quiniela.cost}`} />
          <Pill label={`${t(locale, 'Fixtures')}: ${quiniela.fixtures?.length || 0}`} />
          <Pill label={`${t(locale, 'Entries')}: ${quiniela.entriesCount ?? 0}`} />
        </div>
        {previewFixtures.length > 0 && (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 'var(--spacing-sm)' }}>
              {previewFixtures.map((f) => (
                <div key={f.fixtureId} style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginBottom: 4 }}>
                  {f.homeTeam} vs {f.awayTeam}
                </div>
              ))}
              {more > 0 && (
                <div style={{ fontSize: 13, color: 'var(--app-text-secondary)' }}>+ {more} more fixtures</div>
              )}
            </div>
          </>
        )}
      </CardView>
    </Link>
  );
}

export function Home() {
  const { token } = useAuth();
  const { locale } = useLocale();
  const [quinielas, setQuinielas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <header
        style={{
          padding: 'var(--spacing-md)',
          textAlign: 'center',
          borderBottom: '1px solid var(--app-stroke)',
        }}
      >
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t(locale, 'Pools')}</h1>
        <p style={{ fontSize: 11, color: 'var(--app-text-muted)', margin: 0 }}>{t(locale, 'Play')}</p>
      </header>
      <div style={{ padding: 'var(--spacing-md)' }}>
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
        {!loading && quinielas.length > 0 && quinielas.map((q) => <QuinielaCard key={q._id} quiniela={q} />)}
      </div>
    </>
  );
}
