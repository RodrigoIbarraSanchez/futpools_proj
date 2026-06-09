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

/// Admin-only dashboard for manual-SPEI cobros. Lists pending transfers
/// (user submitted picks + got a reference). The admin checks their bank
/// and Confirms (creates the entry) or Rejects.
export function AdminSpeiPayments() {
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
                  <div style={{
                    fontFamily: 'var(--fp-display)', fontSize: 20, fontWeight: 900,
                    color: 'var(--fp-gold)',
                  }}>${Number(p.amountMXN || 0).toLocaleString('en-US')}</div>
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
