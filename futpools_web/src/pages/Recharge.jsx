import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n/translations';
import { api } from '../api/client';
import { AppBackground } from '../components/AppBackground';
import { CardView } from '../components/CardView';
import { PrimaryButton } from '../components/PrimaryButton';

const DEFAULT_OPTIONS = [
  { amountCredits: 50, priceMxn: 50, label: '50' },
  { amountCredits: 100, priceMxn: 100, label: '100' },
  { amountCredits: 200, priceMxn: 200, label: '200' },
  { amountCredits: 500, priceMxn: 500, label: '500' },
];

export function Recharge() {
  const { locale } = useLocale();
  const { token, fetchUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const success = searchParams.get('success') === '1';
  const canceled = searchParams.get('canceled') === '1';

  useEffect(() => {
    api.get('/stripe/recharge-options').then((r) => {
      if (r?.options?.length) setOptions(r.options);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (success && token) {
      fetchUser();
    }
  }, [success, token, fetchUser]);

  const handlePay = async () => {
    if (!token || !selectedAmount) return;
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.post('/stripe/create-checkout-session', { amountCredits: selectedAmount }, token);
      if (url) window.location.href = url;
      else setError(t(locale, 'Could not start payment'));
    } catch (e) {
      const msg = e.message || t(locale, 'Could not start payment');
      setError(msg === 'Stripe is not configured' ? t(locale, 'Stripe is not configured') : msg);
    } finally {
      setLoading(false);
    }
  };

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
        <Link to="/account" style={{ color: 'var(--app-primary)', fontSize: 18, textDecoration: 'none' }}>←</Link>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t(locale, 'Recharge')}</h1>
      </header>

      <div style={{ padding: 'var(--spacing-md)' }}>
        {success && (
          <CardView style={{ marginBottom: 'var(--spacing-md)', borderColor: 'var(--app-primary)' }}>
            <p style={{ color: 'var(--app-primary)', fontWeight: 600, margin: 0 }}>
              {t(locale, 'Payment successful')}. {t(locale, 'Your balance has been updated')}.
            </p>
          </CardView>
        )}
        {canceled && (
          <CardView style={{ marginBottom: 'var(--spacing-md)' }}>
            <p style={{ color: 'var(--app-text-secondary)', margin: 0 }}>{t(locale, 'Payment was canceled')}.</p>
          </CardView>
        )}

        <p style={{ color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
          {t(locale, 'Choose an amount to add to your balance')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
          {options.map((opt) => {
            const isSelected = selectedAmount === opt.amountCredits;
            return (
              <button
                key={opt.amountCredits}
                type="button"
                onClick={() => { setSelectedAmount(opt.amountCredits); setError(null); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 'var(--spacing-md)',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(33, 226, 140, 0.15), rgba(54, 233, 255, 0.08))'
                    : 'linear-gradient(135deg, var(--app-surface), var(--app-surface-alt))',
                  border: `1px solid ${isSelected ? 'var(--app-primary)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 'var(--app-radius-card)',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 16px rgba(33, 226, 140, 0.2)' : '0 4px 16px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--app-text-primary)', fontSize: 17 }}>
                    {opt.label} créditos
                  </span>
                  <span style={{ color: 'var(--app-text-secondary)', fontSize: 15 }}>
                    ${opt.priceMxn ?? opt.amountCredits} MXN
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <PrimaryButton
          style="green"
          onClick={handlePay}
          disabled={!selectedAmount || loading}
        >
          {loading ? t(locale, 'Loading…') : t(locale, 'Pay with Stripe')}
        </PrimaryButton>

        {error && (
          <p style={{ color: 'var(--app-live-red)', fontSize: 14, marginTop: 'var(--spacing-md)' }}>{error}</p>
        )}

        <p style={{ color: 'var(--app-text-muted)', fontSize: 12, marginTop: 'var(--spacing-md)' }}>
          {t(locale, 'Secure payment powered by Stripe')}.
        </p>
      </div>
    </>
  );
}
