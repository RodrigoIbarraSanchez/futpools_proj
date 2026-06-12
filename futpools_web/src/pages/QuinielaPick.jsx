import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { trackEvent } from '../lib/analytics';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import {
  HudFrame, HudChip, XpBar, TeamCrest, ArcadeButton, IconButton,
} from '../arena-ui/primitives';
import { useSafeBack } from '../lib/safeBack';
import { freeToEnter } from '../lib/poolStatus';
import { useIsDesktop } from '../desktop/useIsDesktop';
import { QuinielaPickDesktop } from './desktop/QuinielaPickDesktop';

export function QuinielaPick() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Picks are scoped to a pool — when there's no history the natural
  // home for the back arrow is that pool's detail page.
  const goBack = useSafeBack(`/pool/${id}`);
  const { token, user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const { locale } = useLocale();
  const isDesktop = useIsDesktop();

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
  // Once the SPEI intent is created, we switch this screen to the transfer
  // instructions (CLABE + reference). Holds the backend's intent response.
  const [speiInfo, setSpeiInfo] = useState(null);

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
  const feeMXN = (quiniela?.entryFeeMXN ?? 50).toLocaleString('es-MX', { minimumFractionDigits: 0 });

  const setPick = (fixtureId, value, nextIndex) => {
    setPicks(prev => ({ ...prev, [fixtureId]: value }));
    const next = fixtures[nextIndex];
    if (next) setTimeout(() => setFocused(next.fixtureId), 120);
  };

  /**
   * Create a manual-SPEI payment intent (replaces Stripe — account closed).
   * The backend stashes the picks + mints a reference and returns the
   * destination CLABE. We then show the transfer instructions; the entry is
   * created later when an admin confirms the transfer arrived.
   *
   * Admins get { freeEntry: true } and skip straight to the success screen.
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
      const res = await api.post(`/pools/${id}/spei-intent`, payload, token);
      // GA funnel step: participant signed up (picks submitted). The next
      // step is payment ("marcó como pagado" lives server-side via SPEI).
      trackEvent('join_pool', {
        pool_id: id,
        pool_name: res?.poolName || '',
        value: res?.amountMXN ?? 0,
        currency: 'MXN',
        free_entry: !!res?.freeEntry,
      });
      if (res?.freeEntry) {
        navigate(`/pool/${id}?paid=1`);
        return;
      }
      // Switch this screen to the SPEI transfer instructions.
      setSpeiInfo(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Once the SPEI intent exists, this screen becomes the transfer
  // instructions — same view on mobile and desktop.
  if (speiInfo) {
    return <SpeiInstructions info={speiInfo} locale={locale} isDesktop={isDesktop} token={token} onDone={() => navigate(`/pool/${id}`)} />;
  }

  if (loading || !quiniela) {
    return (
      <div className={isDesktop ? 'fp-desktop-scope fp-pool-deep' : 'fp-pool-deep'}>
        {!isDesktop && <AppBackground />}
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
          {t(locale, 'Loading pools…').toUpperCase()}
        </div>
      </div>
    );
  }

  // Desktop renders the design's two-column pick screen. Same data + state
  // owned here, just a different presentation. Mobile path stays untouched.
  if (isDesktop) {
    return (
      <QuinielaPickDesktop
        quiniela={quiniela}
        picks={picks}
        setPicks={setPicks}
        setPick={setPick}
        count={count}
        total={total}
        complete={complete}
        submitting={submitting}
        error={error}
        feeMXN={feeMXN}
        onSubmit={handleSubmit}
        goBack={goBack}
        isAdmin={isAdmin}
      />
    );
  }

  return (
    // On mobile: .fp-pool-deep is a no-op (only matters at ≥1100px).
    <div className="fp-pool-deep">
      <AppBackground />

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--fp-stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <IconButton onClick={goBack}>←</IconButton>
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

      {/* Mobile sticky submit. Desktop has its own CTA inside the aside,
          so this only renders below the desktop breakpoint. */}
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
            {submitting ? t(locale, 'PROCESSING…')
              : !complete ? `${t(locale, 'COMPLETE ALL')} (${total - count} ${t(locale, 'LEFT')})`
              : freeToEnter(quiniela) ? `▶ ${t(locale, 'PLAY FREE')}`
              : `▶ ${t(locale, 'PAY')} $${feeMXN} MXN`}
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}

// Tap-to-copy field for the SPEI account details.
function CopyField({ label, value, locale, big }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard?.writeText(String(value))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
      .catch(() => {});
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5, color: 'var(--fp-text-muted)', marginBottom: 4 }}>{label}</div>
      <div onClick={copy} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '10px 12px', background: 'var(--fp-bg2)', border: '1px solid var(--fp-stroke)',
        clipPath: 'var(--fp-clip-sm)', cursor: value ? 'pointer' : 'default',
      }}>
        <span style={{
          fontFamily: 'var(--fp-mono)', fontSize: big ? 20 : 14, fontWeight: big ? 800 : 600,
          color: 'var(--fp-text)', letterSpacing: big ? 2 : 0.5, userSelect: 'all', wordBreak: 'break-all',
        }}>{value || '—'}</span>
        {value && (
          <span style={{
            fontFamily: 'var(--fp-display)', fontSize: 10, fontWeight: 800, letterSpacing: 1,
            color: copied ? 'var(--fp-primary)' : 'var(--fp-accent)', flexShrink: 0,
          }}>{copied ? t(locale, 'Copied!') : t(locale, 'Copy')}</span>
        )}
      </div>
    </div>
  );
}

// SPEI transfer instructions — shown after a payment intent is created.
// Same view on mobile and desktop.
function SpeiInstructions({ info, locale, isDesktop, token, onDone }) {
  const configured = !!info?.clabe;
  const [note, setNote] = useState('');
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const [markError, setMarkError] = useState(null);

  const markPaid = async () => {
    if (marking || !info?.paymentId) return;
    setMarking(true);
    setMarkError(null);
    try {
      await api.post(`/pools/spei/${info.paymentId}/mark-paid`, { note }, token);
      // GA funnel step: user reports the SPEI transfer as done (payment
      // confirmation itself happens admin-side, so this is the closest
      // client-trackable "purchase" signal).
      trackEvent('mark_paid', {
        pool_name: info?.poolName || '',
        value: info?.amountMXN ?? 0,
        currency: 'MXN',
      });
      setMarked(true);
    } catch (e) {
      setMarkError(e?.message || 'Error');
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className={isDesktop ? 'fp-desktop-scope fp-pool-deep' : 'fp-pool-deep'}>
      {!isDesktop && <AppBackground />}
      <div style={{ padding: '18px 16px 120px', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800, letterSpacing: 3, marginBottom: 6 }}>
          {t(locale, 'PAY BY SPEI')}
        </div>
        {info?.poolName && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-muted)', marginBottom: 16 }}>{info.poolName}</div>
        )}

        <HudFrame glow="var(--fp-primary)" brackets>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--fp-text-muted)' }}>{t(locale, 'Transfer exactly this amount to:')}</div>
            <div style={{ fontFamily: 'var(--fp-display)', fontSize: 38, fontWeight: 900, color: 'var(--fp-primary)', marginTop: 4 }}>${Number(info?.amountMXN || 0).toLocaleString('en-US')} MXN</div>
          </div>
        </HudFrame>

        <div style={{ height: 16 }} />

        {configured ? (
          <>
            <CopyField label={t(locale, 'BENEFICIARY')} value={info.beneficiary} locale={locale} />
            <CopyField label={t(locale, 'BANK')} value={info.bank} locale={locale} />
            <CopyField label="CLABE" value={info.clabe} locale={locale} />
            <CopyField label={t(locale, 'REFERENCE / CONCEPT')} value={info.reference} locale={locale} big />
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-dim)', lineHeight: 1.5, margin: '4px 0 14px' }}>
              ◆ {t(locale, 'Put this reference in the transfer concept so we can match your payment.')}
            </div>
            <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--fp-accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--fp-accent) 35%, transparent)', clipPath: 'var(--fp-clip-sm)', fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-accent)', marginBottom: 16 }}>
              {t(locale, "You'll join the pool once we confirm your transfer.")}
            </div>
          </>
        ) : (
          <div style={{ padding: 14, background: 'color-mix(in srgb, var(--fp-danger) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--fp-danger) 40%, transparent)', clipPath: 'var(--fp-clip-sm)', fontFamily: 'var(--fp-mono)', fontSize: 12, color: 'var(--fp-danger)', marginBottom: 16 }}>
            {t(locale, 'SPEI payments are not set up yet. Contact the admin.')}
            <div style={{ marginTop: 8, color: 'var(--fp-text-dim)' }}>{t(locale, 'REFERENCE / CONCEPT')}: <b style={{ color: 'var(--fp-text)' }}>{info?.reference}</b></div>
          </div>
        )}

        {/* Let the payer signal they completed the transfer so the
            organizer knows to verify it. */}
        {marked ? (
          <div style={{
            padding: '12px 14px', marginBottom: 14,
            background: 'color-mix(in srgb, var(--fp-primary) 14%, transparent)',
            border: '1px solid var(--fp-primary)', clipPath: 'var(--fp-clip-sm)',
            fontFamily: 'var(--fp-mono)', fontSize: 12, color: 'var(--fp-primary)',
          }}>
            ✓ {t(locale, "Got it — we'll verify your payment shortly.")}
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5, color: 'var(--fp-text-muted)', marginBottom: 4 }}>
              {t(locale, 'SPEI tracking key (optional)')}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(locale, "e.g. your bank's tracking key (clave de rastreo)")}
              maxLength={200}
              style={{
                width: '100%', padding: '10px 12px', background: 'var(--fp-bg2)',
                border: '1px solid var(--fp-stroke)', color: 'var(--fp-text)',
                fontFamily: 'var(--fp-mono)', fontSize: 13, outline: 'none',
                boxSizing: 'border-box', clipPath: 'var(--fp-clip-sm)', marginBottom: 8,
              }}
            />
            {markError && (
              <div style={{ color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 11, marginBottom: 8 }}>{markError}</div>
            )}
            <ArcadeButton size="md" fullWidth onClick={markPaid} disabled={marking}>
              {marking ? t(locale, 'SENDING…') : `✓ ${t(locale, "I'VE TRANSFERRED")}`}
            </ArcadeButton>
          </div>
        )}

        <ArcadeButton size="lg" fullWidth variant="ghost" onClick={onDone}>{t(locale, 'BACK TO POOL')}</ArcadeButton>
      </div>
    </div>
  );
}
