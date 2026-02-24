import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { PrimaryButton } from './PrimaryButton';

export function ComingSoonModal({ onClose }) {
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
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 'var(--spacing-sm)', color: 'var(--app-text-primary)' }}>
        {t(locale, 'Coming soon')}
      </h2>
      <p style={{ color: 'var(--app-text-secondary)', textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
        {t(locale, "Password recovery will be available soon. We'll notify you when it's ready.")}
      </p>
      <div style={{ width: '100%', maxWidth: 280 }}>
        <PrimaryButton onClick={onClose}>{t(locale, 'Done')}</PrimaryButton>
      </div>
    </div>
  );
}
