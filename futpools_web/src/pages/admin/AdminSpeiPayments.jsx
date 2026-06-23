import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { t, tFormat } from '../../i18n/translations';
import { useSafeBack } from '../../lib/safeBack';
import { AppBackground } from '../../arena-ui/AppBackground';
import {
  HudFrame, ArcadeButton, IconButton, SectionLabel,
} from '../../arena-ui/primitives';
import { useIsDesktop } from '../../desktop/useIsDesktop';
import { DesktopShellChrome } from '../../desktop/DesktopShell';

/// Admin-only dashboard for manual-SPEI cobros. Lists pending transfers
/// (user submitted picks + got a reference). The admin checks their bank
/// and Confirms (creates the entry) or Rejects. Renders a native desktop
/// layout inside the desktop shell, and the arcade-HUD layout on mobile.
export function AdminSpeiPayments() {
  const isDesktop = useIsDesktop();
  const goBack = useSafeBack('/account');
  const { token } = useAuth();
  const { locale } = useLocale();
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = await api.get('/admin/spei-payments?status=pending', token);
      setPayments(list || []);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Could not load SPEI payments');
      setPayments([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const confirm = async (p) => {
    if (busyId) return;
    setBusyId(p.id);
    setError(null);
    try {
      await api.post(`/admin/spei-payments/${p.id}/confirm`, {}, token);
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to confirm');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (p) => {
    if (busyId) return;
    // eslint-disable-next-line no-alert
    const reason = window.prompt(t(locale, 'Reason for rejecting (optional):')) ?? null;
    if (reason === null) return; // cancelled the prompt
    setBusyId(p.id);
    setError(null);
    try {
      await api.post(`/admin/spei-payments/${p.id}/reject`, { reason }, token);
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  };

  const shared = {
    locale, payments, error, busyId, confirm, reject,
  };

  if (isDesktop) return <SpeiDesktop {...shared} />;
  return <SpeiMobile {...shared} goBack={goBack} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Desktop
// ─────────────────────────────────────────────────────────────────────────
function SpeiDesktop({ locale, payments, error, busyId, confirm, reject }) {
  return (
    <DesktopShellChrome crumbsOverride={[t(locale, 'Admin'), t(locale, 'SPEI payments')]}>
      <div className="fp-desktop-wide">
        <div className="fp-desktop-page-head">
          <div>
            <div className="muted" style={{
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{t(locale, 'Admin')}</div>
            <h1 className="fp-desktop-page-title" style={{ marginTop: 4 }}>{t(locale, 'SPEI payments')}</h1>
            <p className="fp-desktop-page-sub">
              {payments == null
                ? t(locale, 'LOADING…')
                : tFormat(locale, '{n} PAYMENTS PENDING CONFIRMATION', { n: payments.length })}
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 12px', borderRadius: 10,
            background: 'color-mix(in srgb, var(--fp-danger) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--fp-danger) 35%, transparent)',
            color: 'var(--fp-danger)', fontSize: 13,
          }}>{error}</div>
        )}

        {payments && payments.length === 0 && !error && (
          <div className="fp-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✓</div>
            <p className="muted" style={{ fontSize: 14 }}>
              {t(locale, 'No SPEI transfers waiting for confirmation.')}
            </p>
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
          gap: 'var(--app-space-5)', alignItems: 'flex-start',
        }}>
          {(payments || []).map((p) => {
            const isPaypal = p.method === 'paypal';
            return (
              <div key={p.id} className="fp-card">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <h3 style={{
                    margin: 0, flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--fp-text)',
                  }}>{p.pool?.name || '—'}</h3>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: '3px 8px', borderRadius: 6,
                    background: isPaypal ? 'rgba(54,233,255,0.16)' : 'rgba(33,226,140,0.16)',
                    color: isPaypal ? 'var(--fp-accent)' : 'var(--fp-primary)',
                  }}>{isPaypal ? 'PAYPAL' : 'SPEI'}</span>
                  <span className="gold num" style={{ fontSize: 20, fontWeight: 900 }}>
                    {isPaypal
                      ? `$${Number(p.amountUSD || 0).toLocaleString('en-US')} USD`
                      : `$${Number(p.amountMXN || 0).toLocaleString('en-US')}`}
                  </span>
                </div>

                {/* Reference — the key the admin matches against the bank */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'var(--fp-surface-alt)',
                }}>
                  <span className="muted" style={{ fontSize: 11, letterSpacing: 1 }}>
                    {t(locale, 'REFERENCE / CONCEPT')}
                  </span>
                  <span className="num" style={{
                    fontSize: 20, fontWeight: 800, letterSpacing: 2, color: 'var(--fp-primary)', userSelect: 'all',
                  }}>{p.reference}</span>
                </div>

                {p.userMarkedPaidAt && (
                  <div style={{
                    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                    marginTop: 12, padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(33,226,140,0.12)', border: '1px solid rgba(33,226,140,0.35)',
                  }}>
                    <span className="green" style={{ fontSize: 12, fontWeight: 800 }}>
                      ✓ {t(locale, 'PAYER MARKED AS PAID')}
                    </span>
                    <span className="muted" style={{ fontSize: 11 }}>{formatDate(p.userMarkedPaidAt)}</span>
                  </div>
                )}
                {p.userNote && (
                  <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    {t(locale, 'Tracking key')}:{' '}
                    <span style={{ color: 'var(--fp-text)', userSelect: 'all' }}>{p.userNote}</span>
                  </div>
                )}

                <div className="muted" style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6 }}>
                  <div>{p.user?.displayName} · <span style={{ color: 'var(--fp-accent)', userSelect: 'all' }}>{p.user?.email}</span></div>
                  <div>{tFormat(locale, '{n} picks', { n: p.picksCount })} · {formatDate(p.createdAt)}</div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    className="fp-btn primary block"
                    style={{ flex: 1 }}
                    onClick={() => confirm(p)}
                    disabled={busyId === p.id}
                  >{busyId === p.id ? t(locale, 'Confirming…') : `✓ ${t(locale, 'Confirm payment')}`}</button>
                  <button
                    type="button"
                    className="fp-btn ghost"
                    onClick={() => reject(p)}
                    disabled={busyId === p.id}
                    style={{ color: 'var(--fp-danger)', borderColor: 'color-mix(in srgb, var(--fp-danger) 45%, transparent)' }}
                  >{t(locale, 'Reject')}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DesktopShellChrome>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mobile (arcade HUD)
// ─────────────────────────────────────────────────────────────────────────
function SpeiMobile({ locale, payments, error, busyId, confirm, reject, goBack }) {
  return (
    <>
      <AppBackground />
      <div style={{ padding: '14px 16px 120px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <IconButton onClick={goBack}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 14,
          }}>{t(locale, 'SPEI PAYMENTS')}</div>
          <div style={{ width: 32 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <SectionLabel color="var(--fp-primary)">
            {payments == null
              ? t(locale, 'LOADING…')
              : tFormat(locale, '{n} PAYMENTS PENDING CONFIRMATION', { n: payments.length })}
          </SectionLabel>
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: 10,
            background: 'color-mix(in srgb, var(--fp-danger) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--fp-danger) 40%, transparent)',
            clipPath: 'var(--fp-clip-sm)',
            color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 12,
          }}>{error}</div>
        )}

        {payments && payments.length === 0 && !error && (
          <HudFrame>
            <div style={{
              padding: 32, textAlign: 'center', color: 'var(--fp-text-muted)',
              fontFamily: 'var(--fp-mono)', fontSize: 12,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <div>{t(locale, 'No SPEI transfers waiting for confirmation.')}</div>
            </div>
          </HudFrame>
        )}

        {payments && payments.map((p) => (
          <div key={p.id} style={{ marginBottom: 12 }}>
            <HudFrame>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    fontFamily: 'var(--fp-display)', fontSize: 15, fontWeight: 800,
                    letterSpacing: 0.5, color: 'var(--fp-text)', flex: 1,
                  }}>{p.pool?.name || '—'}</div>
                  {/* Channel badge — PayPal payments are verified in PayPal, not the bank. */}
                  <div style={{
                    fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
                    padding: '3px 8px', clipPath: 'var(--fp-clip-sm)',
                    background: p.method === 'paypal' ? 'color-mix(in srgb, var(--fp-accent) 16%, transparent)' : 'color-mix(in srgb, var(--fp-primary) 14%, transparent)',
                    color: p.method === 'paypal' ? 'var(--fp-accent)' : 'var(--fp-primary)',
                  }}>{p.method === 'paypal' ? 'PAYPAL' : 'SPEI'}</div>
                  <div style={{
                    fontFamily: 'var(--fp-display)', fontSize: 20, fontWeight: 900,
                    color: 'var(--fp-gold)',
                  }}>
                    {p.method === 'paypal'
                      ? `$${Number(p.amountUSD || 0).toLocaleString('en-US')} USD`
                      : `$${Number(p.amountMXN || 0).toLocaleString('en-US')}`}
                  </div>
                </div>

                {/* Reference — the key thing the admin matches against the bank */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', marginBottom: 10,
                  background: 'var(--fp-bg2)', clipPath: 'var(--fp-clip-sm)',
                }}>
                  <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5, color: 'var(--fp-text-muted)' }}>
                    {t(locale, 'REFERENCE / CONCEPT')}
                  </div>
                  <div style={{
                    fontFamily: 'var(--fp-mono)', fontSize: 20, fontWeight: 800,
                    letterSpacing: 2, color: 'var(--fp-primary)', userSelect: 'all',
                  }}>{p.reference}</div>
                </div>

                {/* The payer tapped "I've transferred" — verify these first. */}
                {p.userMarkedPaidAt && (
                  <div style={{
                    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10,
                    padding: '7px 10px',
                    background: 'color-mix(in srgb, var(--fp-primary) 14%, transparent)',
                    border: '1px solid var(--fp-primary)', clipPath: 'var(--fp-clip-sm)',
                  }}>
                    <span style={{ fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--fp-primary)' }}>
                      ✓ {t(locale, 'PAYER MARKED AS PAID')}
                    </span>
                    <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)' }}>{formatDate(p.userMarkedPaidAt)}</span>
                  </div>
                )}
                {p.userNote && (
                  <div style={{ marginBottom: 10, fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-dim)' }}>
                    {t(locale, 'Tracking key')}: <span style={{ color: 'var(--fp-text)', userSelect: 'all' }}>{p.userNote}</span>
                  </div>
                )}

                <div style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-dim)',
                  marginBottom: 14, lineHeight: 1.6,
                }}>
                  <div>{p.user?.displayName} · <span style={{ color: 'var(--fp-accent)', userSelect: 'all' }}>{p.user?.email}</span></div>
                  <div>{tFormat(locale, '{n} picks', { n: p.picksCount })} · {formatDate(p.createdAt)}</div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <ArcadeButton size="md" fullWidth onClick={() => confirm(p)} disabled={busyId === p.id}>
                    {busyId === p.id ? t(locale, 'CONFIRMING…') : `✓ ${t(locale, 'CONFIRM PAYMENT')}`}
                  </ArcadeButton>
                  <button
                    type="button"
                    onClick={() => reject(p)}
                    disabled={busyId === p.id}
                    style={{
                      padding: '0 16px', background: 'transparent',
                      border: '1px solid color-mix(in srgb, var(--fp-danger) 50%, transparent)',
                      color: 'var(--fp-danger)', clipPath: 'var(--fp-clip-sm)',
                      fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800,
                      letterSpacing: 1, cursor: busyId === p.id ? 'default' : 'pointer',
                    }}
                  >{t(locale, 'REJECT')}</button>
                </div>
              </div>
            </HudFrame>
          </div>
        ))}
      </div>
    </>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
