import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { HudFrame, ArcadeButton, IconButton } from '../arena-ui/primitives';

/** Format cents as display price. Handles USD for now; add locale-aware
 *  currency support here if we ever ship multi-currency pricing. */
function formatPrice(cents, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format((cents || 0) / 100);
  } catch {
    return `$${((cents || 0) / 100).toFixed(2)}`;
  }
}

export function Recharge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, fetchUser } = useAuth();
  const { locale } = useLocale();
  const [packs, setPacks] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [purchasingPackId, setPurchasingPackId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const balance = user?.balance ?? 0;

  // Return-from-Stripe handling. The hosted Checkout page redirects here with
  // ?success=1&session_id=... on success or ?cancel=1 on abort. We show a
  // confirmation and poll /users/me until the webhook has credited coins.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === '1') {
      setShowSuccess(true);
      // Poll balance for up to 10 seconds — webhooks usually arrive within 2s
      // but Stripe CLI forwarding can lag on dev.
      let tries = 0;
      const pollStart = balance;
      const timer = setInterval(async () => {
        tries += 1;
        await fetchUser();
        if ((user?.balance ?? 0) > pollStart || tries >= 10) clearInterval(timer);
      }, 1000);
      // Clean up the query string so refresh doesn't re-trigger.
      navigate('/shop', { replace: true });
      return () => clearInterval(timer);
    }
    if (params.get('cancel') === '1') {
      setShowCancel(true);
      navigate('/shop', { replace: true });
      setTimeout(() => setShowCancel(false), 3200);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Catalog load on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/payments/catalog');
        if (cancelled) return;
        setPacks(res?.packs || []);
        setConfigured(res?.configured !== false);
      } catch (err) {
        if (cancelled) return;
        // 503 → payments not configured yet. Don't show an error screen,
        // fall back to the "coming soon" card with a friendlier message.
        if (err?.message?.includes('503') || /not.*configured/i.test(err?.message || '')) {
          setConfigured(false);
        } else {
          setErrorMsg(err?.message || 'Failed to load shop');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const buyPack = async (packId) => {
    setPurchasingPackId(packId);
    setErrorMsg(null);
    try {
      const res = await api.post('/payments/checkout-session', { packId });
      if (res?.url) {
        // Hand off to Stripe-hosted page. Browser navigates away; on return
        // the useEffect above catches ?success=1.
        window.location.href = res.url;
        return;
      }
      throw new Error('Missing checkout URL');
    } catch (err) {
      setErrorMsg(err?.message || 'Could not start checkout');
      setPurchasingPackId(null);
    }
  };

  return (
    <>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--fp-stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/account" style={{ textDecoration: 'none' }}>
            <IconButton>←</IconButton>
          </Link>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontSize: 12, letterSpacing: 3,
            fontWeight: 700,
          }}>
            {t(locale, 'COIN SHOP')}
          </div>
          <div style={{ width: 32 }} />
        </div>
      </div>

      <div style={{ padding: 16, paddingBottom: 120 }}>
        {/* Current balance */}
        <HudFrame
          glow="var(--fp-gold)"
          bg="linear-gradient(135deg, color-mix(in srgb, var(--fp-gold) 18%, transparent), var(--fp-surface) 60%)"
        >
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 2,
              color: 'var(--fp-text-muted)', marginBottom: 4,
            }}>{t(locale, 'CURRENT BALANCE')}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, var(--fp-gold), #B88A1F)',
                boxShadow: '0 0 10px rgba(255,209,102,0.5)',
              }} />
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 32, fontWeight: 800,
                color: 'var(--fp-gold)', letterSpacing: 1,
              }}>
                {Number(balance).toLocaleString()}
              </div>
            </div>
          </div>
        </HudFrame>

        <div style={{ height: 18 }} />

        {/* Section header */}
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 10, letterSpacing: 3, fontWeight: 700,
          color: 'var(--fp-text-muted)', marginBottom: 10,
        }}>◆ {t(locale, 'SELECT A PACK')}</div>

        {loading ? (
          <div style={{
            padding: 40, textAlign: 'center',
            color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 11,
          }}>{t(locale, 'Loading…')}</div>
        ) : !configured ? (
          <HudFrame>
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🛒</div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 14, letterSpacing: 2,
                fontWeight: 800, color: 'var(--fp-accent)', marginBottom: 8,
              }}>
                {t(locale, 'Coming soon').toUpperCase()}
              </div>
              <div style={{
                fontFamily: 'var(--fp-body)', fontSize: 13,
                color: 'var(--fp-text-dim)', lineHeight: 1.5,
              }}>
                {t(locale, "Web top-ups are almost ready — we're finishing payment setup. Meanwhile the iOS app accepts purchases via In-App Purchase.")}
              </div>
            </div>
          </HudFrame>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          }}>
            {packs.map((p) => (
              <CoinPackCard
                key={p.packId}
                pack={p}
                locale={locale}
                purchasing={purchasingPackId === p.packId}
                disabled={purchasingPackId != null}
                onBuy={() => buyPack(p.packId)}
              />
            ))}
          </div>
        )}

        {errorMsg && (
          <div style={{
            marginTop: 14, padding: 10,
            background: 'color-mix(in srgb, var(--fp-danger) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--fp-danger) 45%, transparent)',
            clipPath: 'var(--fp-clip-sm)',
            fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-danger)',
          }}>{errorMsg}</div>
        )}

        {/* Small legal / support footnote — Stripe requires visible refund
            policy language even for virtual goods. */}
        {configured && (
          <div style={{
            marginTop: 20,
            fontFamily: 'var(--fp-mono)', fontSize: 9,
            color: 'var(--fp-text-faint)', lineHeight: 1.5, textAlign: 'center',
          }}>
            {t(locale, 'Secure checkout by Stripe. Coins are non-refundable and cannot be cashed out.')}
          </div>
        )}
      </div>

      {showSuccess && (
        <PurchaseConfirmationOverlay locale={locale} onClose={() => setShowSuccess(false)} />
      )}

      {showCancel && (
        <div style={{
          position: 'fixed', bottom: 110, left: 16, right: 16, zIndex: 200,
          padding: '10px 14px',
          background: 'color-mix(in srgb, var(--fp-text-muted) 18%, var(--fp-bg) 82%)',
          border: '1px solid var(--fp-stroke)',
          clipPath: 'var(--fp-clip-sm)',
          fontFamily: 'var(--fp-mono)', fontSize: 11,
          color: 'var(--fp-text-dim)', textAlign: 'center',
        }}>{t(locale, 'Payment cancelled. No charges.')}</div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────

function CoinPackCard({ pack, locale, purchasing, disabled, onBuy }) {
  const { coinAmount, bonusCoins, priceCents, currency, badge } = pack;
  const accent = badge === 'BEST VALUE' ? 'var(--fp-hot)'
              : badge === '+10% BONUS'  ? 'var(--fp-primary)'
              : badge === 'POPULAR'     ? 'var(--fp-accent)'
              : 'var(--fp-gold)';
  return (
    <HudFrame>
      <div style={{
        padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 8, minHeight: 180,
      }}>
        {badge && (
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 8, fontWeight: 800, letterSpacing: 1.5,
            color: accent,
            padding: '2px 8px',
            border: `1px solid ${accent}`,
            clipPath: 'var(--fp-clip-sm)',
          }}>{t(locale, badge)}</div>
        )}

        {/* Coin stack — one medallion per ~100 coins, capped at 3 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44 }}>
          {Array.from({ length: Math.min(3, Math.max(1, Math.round(coinAmount / 100) + 1)) }).map((_, i) => (
            <div key={i} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, var(--fp-gold), #B88A1F)',
              boxShadow: '0 0 10px rgba(255,209,102,0.55)',
              marginLeft: i === 0 ? 0 : -10,
            }} />
          ))}
        </div>

        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 28, fontWeight: 900,
          color: 'var(--fp-gold)', lineHeight: 1,
        }}>{coinAmount.toLocaleString()}</div>

        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
          color: 'var(--fp-text-muted)',
        }}>{t(locale, 'COINS')}</div>

        {bonusCoins > 0 && (
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700,
            color: 'var(--fp-accent)',
          }}>
            {tFormat(locale, '+{n} BONUS', { n: bonusCoins })}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <ArcadeButton
          size="sm"
          fullWidth
          disabled={disabled}
          onClick={onBuy}
        >
          {purchasing
            ? t(locale, 'Loading…')
            : `▶ ${formatPrice(priceCents, currency)}`}
        </ArcadeButton>
      </div>
    </HudFrame>
  );
}

// ────────────────────────────────────────────────────────────────────

function PurchaseConfirmationOverlay({ locale, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'color-mix(in srgb, var(--fp-bg) 92%, transparent)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380 }}>
        <HudFrame glow="var(--fp-primary)" brackets>
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>💰</div>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 18, fontWeight: 900,
              letterSpacing: 3, color: 'var(--fp-primary)', marginBottom: 10,
            }}>
              {t(locale, 'COINS RECEIVED')}
            </div>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 12,
              color: 'var(--fp-text-dim)', marginBottom: 18,
            }}>
              {t(locale, 'Your balance has been updated. Ready to play?')}
            </div>
            <ArcadeButton fullWidth onClick={onClose}>
              {t(locale, "LET'S GO")}
            </ArcadeButton>
          </div>
        </HudFrame>
      </div>
    </div>
  );
}
