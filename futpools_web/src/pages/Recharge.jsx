import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { HudFrame, IconButton } from '../arena-ui/primitives';

export function Recharge() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const balance = user?.balance ?? 0;

  return (
    <>
      {/* Header */}
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
            COIN SHOP
          </div>
          <div style={{ width: 32 }} />
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Current balance */}
        <HudFrame
          glow="var(--fp-gold)"
          bg="linear-gradient(135deg, color-mix(in srgb, var(--fp-gold) 18%, transparent), var(--fp-surface) 60%)"
        >
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 2,
              color: 'var(--fp-text-muted)', marginBottom: 4,
            }}>{t(locale, 'CURRENT BALANCE')}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, var(--fp-gold), #B88A1F)',
                boxShadow: '0 0 10px rgba(255,209,102,0.5)',
              }} />
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 32, fontWeight: 800,
                color: 'var(--fp-gold)', letterSpacing: 1,
              }}>
                {Number(balance).toLocaleString()}
              </div>
            </div>
          </div>
        </HudFrame>

        {/* Informational block — web doesn't process real purchases */}
        <HudFrame style={{ marginTop: 18 }}>
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📱</div>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 14, letterSpacing: 2,
              fontWeight: 800, color: 'var(--fp-accent)', marginBottom: 8,
            }}>
              {t(locale, 'Coming soon').toUpperCase()}
            </div>
            <div style={{
              fontFamily: 'var(--fp-body)', fontSize: 13,
              color: 'var(--fp-text-dim)', lineHeight: 1.5,
            }}>
              Recharge is available on the iOS app via In-App Purchase. Web top-ups are coming in a future update.
            </div>
          </div>
        </HudFrame>
      </div>
    </>
  );
}
