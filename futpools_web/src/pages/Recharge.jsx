import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { PrimaryButton } from '../components/PrimaryButton';

export function Recharge() {
  const { locale } = useLocale();

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
        <Link to="/account" style={{ color: 'var(--app-primary)', fontSize: 18 }}>←</Link>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t(locale, 'Recharge')}</h1>
      </header>

      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
        <p style={{ color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
          {t(locale, 'Coming soon')}
        </p>
        <p style={{ color: 'var(--app-text-muted)', fontSize: 14, marginBottom: 'var(--spacing-lg)' }}>
          Recharge will be available in the iOS app via In-App Purchase. On web it will be available in a future update.
        </p>
        <PrimaryButton onClick={() => window.history.back()}>{t(locale, 'Close')}</PrimaryButton>
      </div>
    </>
  );
}
