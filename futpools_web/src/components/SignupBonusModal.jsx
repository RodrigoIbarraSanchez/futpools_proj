// One-shot welcome modal shown after a successful register when the server
// granted a signup bonus. Mirrors the iOS SignupBonusCelebrationSheet so the
// onboarding moment feels identical across platforms.
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { ArcadeButton } from '../arena-ui/primitives';

export function SignupBonusModal() {
  const { pendingSignupBonus, acknowledgeSignupBonus } = useAuth();
  const { locale } = useLocale();

  // Lock body scroll while the celebration is on screen. The modal is an
  // explicit-acknowledgement UI, we don't want the user to scroll past it.
  useEffect(() => {
    if (pendingSignupBonus == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [pendingSignupBonus]);

  if (pendingSignupBonus == null) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'color-mix(in srgb, var(--fp-bg) 94%, transparent)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        padding: 32, maxWidth: 380, width: '100%',
        animation: 'fpPopIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <div style={{ fontSize: 72, lineHeight: 1 }}>🎁</div>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 18, fontWeight: 900,
          letterSpacing: 3, color: 'var(--fp-primary)',
        }}>
          {t(locale, 'WELCOME BONUS')}
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
        }}>
          <span style={{
            fontFamily: 'var(--fp-display)', fontSize: 56, fontWeight: 900,
            color: 'var(--fp-gold)',
          }}>+{pendingSignupBonus}</span>
          <span style={{
            fontFamily: 'var(--fp-display)', fontSize: 18, fontWeight: 800,
            letterSpacing: 2, color: 'var(--fp-gold)',
          }}>{t(locale, 'COINS')}</span>
        </div>
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 12,
          color: 'var(--fp-text-dim)', textAlign: 'center',
          marginBottom: 8,
        }}>
          {t(locale, 'On the house — enough to sponsor your first pool.')}
        </div>
        <div style={{ width: '100%' }}>
          <ArcadeButton size="lg" fullWidth onClick={acknowledgeSignupBonus}>
            {t(locale, "LET'S GO")}
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}
