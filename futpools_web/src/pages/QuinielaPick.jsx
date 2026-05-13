import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import {
  HudFrame, HudChip, XpBar, TeamCrest, ArcadeButton, IconButton,
} from '../arena-ui/primitives';

export function QuinielaPick() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { locale } = useLocale();

  // simple_version: picks happen exactly once, at checkout. The legacy
  // edit-an-existing-entry path is gone (PUT /quinielas/:id/entries/:entryId
  // is unmounted in simple mode), so this screen only handles the
  // "fresh entry, then pay" flow.
  const [quiniela, setQuiniela] = useState(null);
  const [picks, setPicks] = useState({});
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const pool = await api.get(`/quinielas/${id}`);
        if (cancelled) return;
        setQuiniela(pool);
      } catch {
        if (!cancelled) setQuiniela(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const fixtures = quiniela?.fixtures || [];
  const count = fixtures.filter(f => ['1','X','2'].includes(picks[f.fixtureId])).length;
  const total = fixtures.length;
  const complete = count === total && total > 0;
  const feeMXN = ((quiniela?.entryFeeMXN ?? 5000) / 100).toLocaleString('es-MX', { minimumFractionDigits: 0 });

  const setPick = (fixtureId, value, nextIndex) => {
    setPicks(prev => ({ ...prev, [fixtureId]: value }));
    const next = fixtures[nextIndex];
    if (next) setTimeout(() => setFocused(next.fixtureId), 120);
  };

  /**
   * Hand off to Stripe Checkout. The backend creates the session with picks
   * embedded in metadata; on payment success the webhook reconstructs and
   * persists the QuinielaEntry, then redirects the browser back to
   * /pool/:id?paid=1 where PoolDetail shows the success state.
   *
   * Note: we don't need to retain picks in localStorage. If the user
   * abandons checkout, returning to this page is a fresh entry — Stripe
   * sessions expire in 24h and we never created a server-side entry.
   */
  const handleSubmit = async () => {
    if (!token) { setError(t(locale, 'Please sign in to submit picks.')); return; }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        picks: fixtures
          .filter(f => ['1','X','2'].includes(picks[f.fixtureId]))
          .map(f => ({ fixtureId: f.fixtureId, pick: picks[f.fixtureId] })),
      };
      const { url } = await api.post(`/pools/${id}/checkout-session`, payload, token);
      if (!url) throw new Error('Stripe URL missing');
      // Full-page redirect — Stripe Checkout is hosted on their domain.
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  if (loading || !quiniela) {
    return (
      <>
        <AppBackground />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
          {t(locale, 'Loading pools…').toUpperCase()}
        </div>
      </>
    );
  }

  return (
    <>
      <AppBackground />

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--fp-stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <IconButton onClick={() => navigate(-1)}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontSize: 12, letterSpacing: 3,
            fontWeight: 700,
          }}>
            {t(locale, 'MAKE YOUR PICKS')}
          </div>
          <div style={{ width: 32 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
              color: 'var(--fp-text-muted)', marginBottom: 3,
            }}>
              ◆ PROGRESS · {count}/{total}
            </div>
            <XpBar
              value={count}
              max={Math.max(total, 1)}
              color={complete ? 'var(--fp-primary)' : 'var(--fp-accent)'}
              segments={Math.max(total, 1)}
              height={6}
            />
          </div>
          <HudChip color={complete ? 'var(--fp-primary)' : 'var(--fp-text-muted)'}>
            {complete ? 'READY' : `${total - count} LEFT`}
          </HudChip>
        </div>
      </div>

      {/* Pick rows */}
      <div style={{ padding: '14px 16px 140px' }}>
        {fixtures.map((f, i) => {
          const isFocused = focused === f.fixtureId;
          return (
            <div
              key={f.fixtureId}
              className="fp-slide-up"
              onClick={() => setFocused(f.fixtureId)}
              style={{
                padding: 12,
                marginBottom: 8,
                background: isFocused ? 'color-mix(in srgb, var(--fp-primary) 5%, transparent)' : 'var(--fp-surface)',
                border: `1px solid ${isFocused ? 'color-mix(in srgb, var(--fp-primary) 40%, transparent)' : 'var(--fp-stroke)'}`,
                clipPath: 'var(--fp-clip-sm)',
                animationDelay: `${i * 40}ms`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                <span style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700,
                  letterSpacing: 1.5, color: 'var(--fp-primary)',
                }}>#{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
                  {f.kickoff ? new Date(f.kickoff).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase() : ''}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <TeamCrest name={f.homeTeam} logoURL={f.homeLogo} size={34} />
                  <div style={{
                    fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 700,
                    letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>{String(f.homeTeam).slice(0,3)}</div>
                </div>
                <div style={{
                  fontFamily: 'var(--fp-display)', fontSize: 10, letterSpacing: 2,
                  color: 'var(--fp-text-muted)',
                }}>VS</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <TeamCrest name={f.awayTeam} logoURL={f.awayLogo} size={34} />
                  <div style={{
                    fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 700,
                    letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>{String(f.awayTeam).slice(0,3)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { p: '1', label: String(f.homeTeam).slice(0,3).toUpperCase() },
                  { p: 'X', label: 'DRAW' },
                  { p: '2', label: String(f.awayTeam).slice(0,3).toUpperCase() },
                ].map((opt) => {
                  const active = picks[f.fixtureId] === opt.p;
                  return (
                    <button
                      key={opt.p}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPick(f.fixtureId, opt.p, i + 1); }}
                      style={{
                        flex: 1, padding: '10px 6px',
                        background: active ? 'var(--fp-primary)' : 'var(--fp-bg2)',
                        color: active ? 'var(--fp-on-primary)' : 'var(--fp-text-dim)',
                        fontFamily: 'var(--fp-display)', fontSize: 15, fontWeight: 800,
                        letterSpacing: 1,
                        clipPath: 'var(--fp-clip-sm)',
                        border: 'none',
                        boxShadow: active ? '0 0 12px rgba(33,226,140,0.5), inset 0 0 0 2px var(--fp-primary)' : 'none',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        transition: 'all 0.1s',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{opt.p}</span>
                      <span style={{
                        fontFamily: 'var(--fp-mono)', fontSize: 8, letterSpacing: 1,
                        opacity: 0.75,
                      }}>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {error && (
          <div style={{
            color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 12,
            marginTop: 10,
          }}>{error}</div>
        )}
      </div>

      {/* Sticky submit */}
      <div style={{
        position: 'fixed', bottom: 104, left: 0, right: 0,
        maxWidth: 430, margin: '0 auto',
        padding: '8px 16px 0',
        background: 'linear-gradient(180deg, transparent, var(--fp-bg) 40%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <ArcadeButton
            size="lg"
            fullWidth
            disabled={!complete || submitting}
            onClick={handleSubmit}
          >
            {submitting ? t(locale, 'REDIRECTING TO PAYMENT…')
              : complete ? `▶ ${t(locale, 'PAY')} $${feeMXN} MXN`
              : `${t(locale, 'COMPLETE ALL')} (${total - count} ${t(locale, 'LEFT')})`}
          </ArcadeButton>
        </div>
      </div>
    </>
  );
}
