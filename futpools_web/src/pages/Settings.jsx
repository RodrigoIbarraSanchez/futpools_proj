import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import { HudFrame, IconButton, SectionLabel } from '../arena-ui/primitives';

const OPTIONS = [
  { value: '',   labelKey: 'Use your iPhone language' },
  { value: 'en', labelKey: 'English (US)' },
  { value: 'es', labelKey: 'Español (México)' },
];

export function Settings() {
  const { locale, setLocale, rawLocale } = useLocale();

  return (
    <>
      <AppBackground />

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
            {t(locale, 'Settings').toUpperCase()}
          </div>
          <Link to="/account" style={{
            textDecoration: 'none',
            fontFamily: 'var(--fp-display)', fontSize: 11, letterSpacing: 1.5,
            color: 'var(--fp-primary)', fontWeight: 700,
          }}>
            {t(locale, 'Done').toUpperCase()}
          </Link>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 10 }}><SectionLabel>{t(locale, 'App Language').toUpperCase()}</SectionLabel></div>
        <HudFrame>
          <div style={{ padding: 14 }}>
            <select
              value={rawLocale || (locale.startsWith('es') ? 'es' : 'en')}
              onChange={(e) => setLocale(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--fp-bg2)',
                border: '1px solid var(--fp-stroke)',
                color: 'var(--fp-text)',
                fontFamily: 'var(--fp-mono)',
                fontSize: 14,
                outline: 'none',
              }}
            >
              {OPTIONS.map((opt) => (
                <option key={opt.value || 'auto'} value={opt.value} style={{ background: 'var(--fp-bg)' }}>
                  {t(locale, opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </HudFrame>
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-muted)',
          marginTop: 10,
        }}>{t(locale, 'Changes apply instantly')}</div>
      </div>
    </>
  );
}
