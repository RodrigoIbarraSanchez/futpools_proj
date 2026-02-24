import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { CardView } from '../components/CardView';

export function MyEntries() {
  const { token } = useAuth();
  const { locale } = useLocale();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!token) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await api.get('/quinielas/entries/me', token);
      setEntries(list);
    } catch (e) {
      setError(e.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const grouped = entries.reduce((acc, entry) => {
    const qid = entry.quiniela?._id || entry.quiniela;
    if (!acc[qid]) acc[qid] = { quiniela: entry.quiniela, entries: [] };
    acc[qid].entries.push(entry);
    return acc;
  }, {});
  const groups = Object.values(grouped).sort((a, b) => {
    const da = a.quiniela?.startDate ? new Date(a.quiniela.startDate) : 0;
    const db = b.quiniela?.startDate ? new Date(b.quiniela.startDate) : 0;
    return db - da;
  });

  return (
    <>
      <AppBackground />
      <header
        style={{
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--app-stroke)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t(locale, 'My Entries')}</h1>
      </header>

      <div style={{ padding: 'var(--spacing-md)' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p style={{ color: 'var(--app-text-secondary)' }}>{t(locale, 'Loading entries…')}</p>
          </div>
        )}
        {error && (
          <p style={{ color: 'var(--app-text-secondary)', textAlign: 'center', padding: 'var(--spacing-md)' }}>{error}</p>
        )}
        {!loading && entries.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p style={{ color: 'var(--app-text-secondary)' }}>
              {t(locale, "You don't have any entries yet. Join a pool to create one.")}
            </p>
            <Link to="/" style={{ display: 'inline-block', marginTop: 'var(--spacing-md)', color: 'var(--app-primary)' }}>
              {t(locale, 'Pools')}
            </Link>
          </div>
        )}
        {!loading && groups.length > 0 && groups.map((group) => (
          <CardView key={group.quiniela?._id} style={{ marginBottom: 'var(--spacing-md)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
              {group.quiniela?.name}
            </h3>
            {group.entries.map((entry) => (
              <Link
                key={entry._id}
                to={`/pool/${group.quiniela?._id}`}
                style={{
                  display: 'block',
                  padding: 'var(--spacing-sm) 0',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  color: 'var(--app-text-primary)',
                  textDecoration: 'none',
                }}
              >
                Entry #{entry.entryNumber ?? '—'} · Score: {entry.score ?? 0}/{entry.totalPossible ?? '—'}
              </Link>
            ))}
          </CardView>
        ))}
      </div>
    </>
  );
}
