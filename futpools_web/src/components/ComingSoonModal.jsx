import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { HudFrame, ArcadeButton } from '../arena-ui/primitives';

export function ComingSoonModal({ onClose }) {
  const { locale } = useLocale();
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <HudFrame glow="var(--fp-primary)" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 800,
            letterSpacing: 3, textTransform: 'uppercase', color: 'var(--fp-text)',
            marginBottom: 10,
          }}>
            {t(locale, 'Coming soon')}
          </div>
          <div style={{
            fontFamily: 'var(--fp-body)', fontSize: 13,
            color: 'var(--fp-text-dim)', marginBottom: 20,
          }}>
            {t(locale, "Password recovery will be available soon. We'll notify you when it's ready.")}
          </div>
          <ArcadeButton fullWidth onClick={onClose}>
            {t(locale, 'Done').toUpperCase()}
          </ArcadeButton>
        </div>
      </HudFrame>
    </div>
  );
}
