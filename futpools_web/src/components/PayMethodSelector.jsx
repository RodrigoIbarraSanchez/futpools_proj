import { t } from '../i18n/translations';

/**
 * SPEI (MXN, Mexico) vs PayPal (USD, international) selector. Renders
 * nothing unless the backend reports PayPal configured (GET
 * /public/payment-config) — Mexico-only setups never see it. Shared by
 * the mobile pick screen (QuinielaPick) and the desktop SummaryCard
 * (QuinielaPickDesktop).
 */
export function PayMethodSelector({ payCfg, payMethod, setPayMethod, feeMXN, locale }) {
  if (!payCfg?.paypal?.enabled) return null;
  const opts = [
    { id: 'spei', icon: '🇲🇽', title: 'SPEI', sub: `$${feeMXN} MXN` },
    { id: 'paypal', icon: '🌎', title: 'PayPal', sub: `$${payCfg.paypal.amountUSD} USD` },
  ];
  return (
    <div style={{ margin: '14px 0 4px' }}>
      <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5, color: 'var(--fp-text-muted)', marginBottom: 6 }}>
        ◆ {t(locale, 'PAYMENT METHOD')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {opts.map((o) => {
          const active = payMethod === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setPayMethod(o.id)}
              style={{
                padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
                background: active ? 'color-mix(in srgb, var(--fp-primary) 10%, transparent)' : 'var(--fp-surface)',
                border: `1px solid ${active ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
                clipPath: 'var(--fp-clip-sm)',
                boxShadow: active ? '0 0 10px rgba(33,226,140,0.25)' : 'none',
              }}
            >
              <div style={{ fontSize: 16, lineHeight: 1.2 }}>{o.icon}</div>
              <div style={{ fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 12, letterSpacing: 1, color: 'var(--fp-text)' }}>{o.title}</div>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: active ? 'var(--fp-primary)' : 'var(--fp-text-muted)' }}>{o.sub}</div>
            </button>
          );
        })}
      </div>
      {payMethod === 'paypal' && (
        <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)', lineHeight: 1.5, marginTop: 8 }}>
          ◆ {t(locale, 'For players outside Mexico.')} {t(locale, 'If you win, your prize is sent via PayPal.')}
        </div>
      )}
    </div>
  );
}
