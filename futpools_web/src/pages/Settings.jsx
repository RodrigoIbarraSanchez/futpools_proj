import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import { HudFrame, IconButton, SectionLabel } from '../arena-ui/primitives';
import { useIsDesktop } from '../desktop/useIsDesktop';

const OPTIONS = [
  { value: '',   labelKey: 'Use your iPhone language' },
  { value: 'en', labelKey: 'English (US)' },
  { value: 'es', labelKey: 'Español (México)' },
];

export function Settings() {
  const { locale, setLocale, rawLocale } = useLocale();
  const isDesktop = useIsDesktop();

  // Desktop variant — radio cards inside a max-720 container, mirroring
  // the design's `screen-settings.jsx`. Mobile keeps its native select
  // (better UX on touch).
  if (isDesktop) {
    const current = rawLocale || (locale.startsWith('es') ? 'es' : 'en');
    return (
      <div className="fp-desktop-narrow">
        <div className="fp-desktop-page-head">
          <div>
            <h1 className="fp-desktop-page-title">{t(locale, 'Settings')}</h1>
            <p className="fp-desktop-page-sub">{t(locale, 'App preferences.')}</p>
          </div>
        </div>
        <div className="fp-card">
          <h4 className="fp-section-title">{t(locale, 'App Language').toUpperCase()}</h4>
          <p className="muted" style={{ fontSize: 13, margin: '8px 0 18px' }}>
            {t(locale, 'Changes apply instantly')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {OPTIONS.map((opt) => {
              const active = current === opt.value;
              return (
                <label
                  key={opt.value || 'auto'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: active
                      ? '1.5px solid var(--fp-primary)'
                      : '1px solid var(--fp-stroke)',
                    background: active
                      ? 'rgba(33,226,140,0.06)'
                      : 'var(--fp-surface-alt)',
                    transition: 'all 120ms ease',
                  }}
                >
                  <input
                    type="radio" name="lang"
                    checked={active}
                    onChange={() => setLocale(opt.value)}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: active ? '6px solid var(--fp-primary)' : '2px solid var(--fp-stroke)',
                    background: active ? 'var(--fp-surface)' : 'transparent',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {t(locale, opt.labelKey)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

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
