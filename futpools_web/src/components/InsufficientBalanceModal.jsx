import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { PrimaryButton } from './PrimaryButton';

export function InsufficientBalanceModal({ entryCost, currentBalance, onRecharge, onClose }) {
  const { locale } = useLocale();
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--app-background)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-xl)',
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 'var(--spacing-sm)', color: 'var(--app-text-primary)' }}>
        {t(locale, 'Insufficient balance')}
      </h2>
      <p style={{ color: 'var(--app-text-secondary)', textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
        {tFormat(locale, 'You need {cost} to join this pool. Your balance: {balance}.', {
          cost: entryCost,
          balance: currentBalance,
        })}
      </p>
      <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        <PrimaryButton style="green" onClick={onRecharge}>
          {t(locale, 'Recharge')}
        </PrimaryButton>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--app-text-secondary)',
            fontSize: 15,
            padding: 'var(--spacing-sm)',
          }}
        >
          {t(locale, 'Close')}
        </button>
      </div>
    </div>
  );
}
