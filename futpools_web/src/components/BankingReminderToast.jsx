import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';

/// Whether the user has enough payout info on file to be paid. Mirrors the
/// backend's per-country rule (lib/payout.hasPayoutInfo): a CLABE is enough
/// in Mexico, a PayPal email is enough anywhere else.
function hasPayoutInfo(payout) {
  if (!payout) return false;
  const country = (payout.country || 'MX').toUpperCase();
  if (country === 'MX') return !!(payout.clabe && String(payout.clabe).trim());
  return !!(payout.paypalEmail && String(payout.paypalEmail).trim());
}

/// Persistent, non-dismissable reminder shown to authenticated players who
/// haven't added their banking details yet — without them we can't pay a
/// prize. It has no close button by design; the only way out is to add the
/// details (the CTA routes to Edit profile), after which `user.payout`
/// satisfies hasPayoutInfo and the toast stops rendering on its own.
///
/// Mounted once at the app root (sibling to <Routes>), so it rides along on
/// every screen. Hidden for: unauthenticated visitors, admins (the operator
/// doesn't need nagging), and the Edit-profile screen itself (so it never
/// covers the form the user is filling in).
export function BankingReminderToast() {
  const { ready, isAuthenticated, user } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();

  if (!ready || !isAuthenticated || !user) return null;
  if (user.isAdmin) return null;
  if (hasPayoutInfo(user.payout)) return null;
  // Don't cover the form they'd use to resolve this.
  if (location.pathname.startsWith('/account/edit')) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        // Clear the bottom tab bar (fixed at bottom:12, ~64px tall) on mobile.
        bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
        left: 12,
        right: 12,
        maxWidth: 430 - 24,
        margin: '0 auto',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: 'color-mix(in srgb, var(--fp-gold, #F5B300) 16%, var(--fp-surface, #11161E))',
        border: '1px solid color-mix(in srgb, var(--fp-gold, #F5B300) 55%, transparent)',
        clipPath: 'var(--fp-clip-sm)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>🏦</span>
      <div style={{
        flex: 1, minWidth: 0,
        fontFamily: 'var(--fp-mono)', fontSize: 12, lineHeight: 1.4,
        color: 'var(--fp-text, #F3F6FB)',
      }}>
        {t(locale, 'Add your bank details so we can pay out your prizes.')}
      </div>
      <button
        type="button"
        onClick={() => navigate('/account/edit')}
        style={{
          flexShrink: 0,
          padding: '8px 12px',
          background: 'var(--fp-gold, #F5B300)',
          color: '#1A1300',
          border: 0,
          clipPath: 'var(--fp-clip-sm)',
          fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 11,
          letterSpacing: 1, textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {t(locale, 'Add details')}
      </button>
    </div>
  );
}
