import { useState } from 'react';
import { t } from '../i18n/translations';

/**
 * SPEI (MXN, Mexico) vs PayPal (USD, international) selector. Renders
 * nothing unless the backend reports PayPal configured (GET
 * /public/payment-config) — Mexico-only setups never see it. Shared by
 * the mobile pick screen (QuinielaPick) and the desktop SummaryCard
 * (QuinielaPickDesktop).
 *
 * Steering: SPEI is the house-preferred channel (PayPal fees eat ~10% of
 * a $3 entry). For visitors whose browser timezone is Mexican, PayPal is
 * COLLAPSED behind an "outside Mexico?" link; for foreign timezones both
 * cards show and the parent preselects PayPal (see isLikelyMexico).
 */

const MX_TIMEZONES = new Set([
  'America/Mexico_City', 'America/Monterrey', 'America/Tijuana',
  'America/Cancun', 'America/Hermosillo', 'America/Chihuahua',
  'America/Mazatlan', 'America/Merida', 'America/Matamoros',
  'America/Ojinaga', 'America/Bahia_Banderas', 'America/Ciudad_Juarez',
]);

/** Timezone heuristic — no permissions, no geo APIs. Defaults to Mexico
 *  (the home market) when the timezone can't be read. */
export function isLikelyMexico() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return MX_TIMEZONES.has(tz);
  } catch {
    return true;
  }
}

export function PayMethodSelector({ payCfg, payMethod, setPayMethod, feeMXN, locale }) {
  // When the visitor looks Mexican, PayPal starts hidden behind a link.
  const [showPaypal, setShowPaypal] = useState(() => !isLikelyMexico());
  if (!payCfg?.paypal?.enabled) return null;

  const paypalVisible = showPaypal || payMethod === 'paypal';
  const opts = [
    { id: 'spei', icon: '🇲🇽', title: 'SPEI', sub: `$${feeMXN} MXN`, hint: t(locale, 'No fees'), badge: t(locale, 'RECOMMENDED') },
    ...(paypalVisible
      ? [{ id: 'paypal', icon: '🌎', title: 'PayPal', sub: `$${payCfg.paypal.amountUSD} USD`, hint: t(locale, 'Outside Mexico') }]
      : []),
  ];

  return (
    <div style={{ margin: '14px 0 4px' }}>
      <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5, color: 'var(--fp-text-muted)', marginBottom: 6 }}>
        ◆ {t(locale, 'PAYMENT METHOD')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: paypalVisible ? '1fr 1fr' : '1fr', gap: 8 }}>
        {opts.map((o) => {
          const active = payMethod === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setPayMethod(o.id)}
              style={{
                position: 'relative',
                padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
                background: active ? 'color-mix(in srgb, var(--fp-primary) 10%, transparent)' : 'var(--fp-surface)',
                border: `1px solid ${active ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
                clipPath: 'var(--fp-clip-sm)',
                boxShadow: active ? '0 0 10px rgba(33,226,140,0.25)' : 'none',
              }}
            >
              {o.badge && (
                <div style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 8, letterSpacing: 1, fontWeight: 700,
                  color: 'var(--fp-on-primary)', background: 'var(--fp-primary)',
                  display: 'inline-block', padding: '2px 6px', marginBottom: 4,
                  clipPath: 'polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)',
                }}>{o.badge}</div>
              )}
              <div style={{ fontSize: 16, lineHeight: 1.2 }}>{o.icon}</div>
              <div style={{ fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 12, letterSpacing: 1, color: 'var(--fp-text)' }}>{o.title}</div>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: active ? 'var(--fp-primary)' : 'var(--fp-text-muted)' }}>{o.sub}</div>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 8.5, letterSpacing: 0.5, color: 'var(--fp-text-dim)', marginTop: 2 }}>{o.hint}</div>
            </button>
          );
        })}
      </div>

      {!paypalVisible && (
        <button
          type="button"
          onClick={() => setShowPaypal(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0 0',
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 0.5,
            color: 'var(--fp-text-dim)', textDecoration: 'underline',
          }}
        >
          {t(locale, 'Outside Mexico? Pay with PayPal')} →
        </button>
      )}

      {payMethod === 'paypal' && (
        <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)', lineHeight: 1.5, marginTop: 8 }}>
          ◆ {t(locale, 'If you win, your prize is sent via PayPal.')} {t(locale, 'In Mexico? SPEI has no fees and confirms faster.')}
        </div>
      )}
    </div>
  );
}
