import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { CardView } from '../components/CardView';
import { PrimaryButton } from '../components/PrimaryButton';

export function QuinielaPick() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { locale } = useLocale();
  const [quiniela, setQuiniela] = useState(null);
  const [picks, setPicks] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/quinielas/${id}`).then(setQuiniela).catch(() => setQuiniela(null)).finally(() => setLoading(false));
  }, [id]);

  const setPick = (fixtureId, value) => {
    setPicks((prev) => ({ ...prev, [fixtureId]: value }));
  };

  const fixtures = quiniela?.fixtures || [];
  const isComplete = fixtures.length > 0 && fixtures.every((f) => ['1', 'X', '2'].includes(picks[f.fixtureId]));

  const handleSubmit = async () => {
    if (!token) {
      setError(t(locale, 'Please sign in to submit picks.'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        picks: fixtures
          .filter((f) => ['1', 'X', '2'].includes(picks[f.fixtureId]))
          .map((f) => ({ fixtureId: f.fixtureId, pick: picks[f.fixtureId] })),
      };
      await api.post(`/quinielas/${id}/entries`, payload, token);
      setSuccess(true);
      setTimeout(() => navigate(-1), 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !quiniela) {
    return (
      <>
        <AppBackground />
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
          <p style={{ color: 'var(--app-text-secondary)' }}>{t(locale, 'Loading pools…')}</p>
        </div>
      </>
    );
  }

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
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t(locale, 'Make Picks')}</h1>
      </header>

      <div style={{ padding: 'var(--spacing-md)' }}>
        <p style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
          {t(locale, 'Pick 1 (home), X (draw) or 2 (away) for each match')}
        </p>

        {fixtures.map((f) => (
          <CardView key={f.fixtureId} style={{ marginBottom: 'var(--spacing-sm)' }}>
            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              {f.homeTeam} vs {f.awayTeam}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              {['1', 'X', '2'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPick(f.fixtureId, opt)}
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-sm)',
                    border: `2px solid ${picks[f.fixtureId] === opt ? 'var(--app-primary)' : 'var(--app-stroke)'}`,
                    borderRadius: 'var(--app-radius-button)',
                    background: picks[f.fixtureId] === opt ? 'rgba(33, 226, 140, 0.2)' : 'var(--app-surface)',
                    color: 'var(--app-text-primary)',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </CardView>
        ))}

        {error && <p style={{ color: 'var(--app-live-red)', fontSize: 13, marginBottom: 'var(--spacing-sm)' }}>{error}</p>}

        {success ? (
          <p style={{ color: 'var(--app-primary)', fontSize: 15, textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
            {t(locale, 'Picks saved')}
          </p>
        ) : (
          <PrimaryButton
            style="green"
            onClick={handleSubmit}
            disabled={!isComplete || submitting}
          >
            {submitting ? t(locale, 'Submitting...') : t(locale, 'Submit Picks')}
          </PrimaryButton>
        )}
      </div>
    </>
  );
}
