import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';

const options = [
  { value: '', labelKey: 'Use your iPhone language' },
  { value: 'en', labelKey: 'English (US)' },
  { value: 'es', labelKey: 'Español (México)' },
];

export function Settings() {
  const { locale, setLocale, rawLocale } = useLocale();

  return (
    <>
      <AppBackground />
      <header
        style={{
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--app-stroke)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link to="/account" style={{ color: 'var(--app-text-secondary)', fontSize: 16 }}>←</Link>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t(locale, 'Settings')}</h1>
        <Link to="/account" style={{ color: 'var(--app-primary)', fontSize: 16 }}>{t(locale, 'Done')}</Link>
      </header>

      <div style={{ padding: 'var(--spacing-md)' }}>
        <p style={{ fontSize: 12, color: 'var(--app-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
          {t(locale, 'App Language')}
        </p>
        <select
          value={rawLocale || (locale.startsWith('es') ? 'es' : 'en')}
          onChange={(e) => setLocale(e.target.value)}
          style={{
            width: '100%',
            padding: 'var(--spacing-md)',
            background: 'var(--app-surface)',
            border: '1px solid var(--app-stroke)',
            borderRadius: 'var(--app-radius-button)',
            color: 'var(--app-text-primary)',
            fontSize: 16,
          }}
        >
          {options.map((opt) => (
            <option key={opt.value || 'auto'} value={opt.value}>
              {t(locale, opt.labelKey)}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 'var(--spacing-sm)' }}>
          {t(locale, 'Changes apply instantly')}
        </p>
      </div>
    </>
  );
}
