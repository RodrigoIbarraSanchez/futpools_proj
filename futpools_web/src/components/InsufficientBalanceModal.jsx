import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { HudFrame, ArcadeButton } from '../arena-ui/primitives';

export function InsufficientBalanceModal({ entryCost, currentBalance, onRecharge, onClose }) {
  const { locale } = useLocale();
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <HudFrame glow="var(--fp-danger)" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 20, fontWeight: 800,
            letterSpacing: 2, textTransform: 'uppercase', color: 'var(--fp-text)',
            marginBottom: 10,
          }}>
            {t(locale, 'Insufficient balance')}
          </div>
          <div style={{
            fontFamily: 'var(--fp-body)', fontSize: 13,
            color: 'var(--fp-text-dim)', marginBottom: 20,
          }}>
            {tFormat(locale, 'You need {cost} to join this pool. Your balance: {balance}.', {
              cost: entryCost, balance: currentBalance,
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ArcadeButton fullWidth size="lg" onClick={onRecharge}>
              ▶ {t(locale, 'Recharge').toUpperCase()}
            </ArcadeButton>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none', border: 'none',
                fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 1.5,
                color: 'var(--fp-text-muted)',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {t(locale, 'Close').toUpperCase()}
            </button>
          </div>
        </div>
      </HudFrame>
    </div>
  );
}
