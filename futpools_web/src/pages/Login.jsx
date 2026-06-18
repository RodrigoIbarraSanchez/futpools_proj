import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import {
  HudFrame, ArcadeButton, ArenaLabel, arenaInputStyle,
} from '../arena-ui/primitives';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { useIsDesktop } from '../desktop/useIsDesktop';

export function Login() {
  const { login, error, setError } = useAuth();
  const { locale, setLocale } = useLocale();
  const c = (es, en) => (locale === 'es' ? es : en);
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    await login(email, password);
    setLoading(false);
  };

  const langToggle = (
    <div style={{
      position: 'absolute', top: 18, right: 20, zIndex: 2,
      display: 'flex', gap: 2,
      fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 1,
    }}>
      {['es', 'en'].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          style={{
            background: locale === l ? 'rgba(33,226,140,0.14)' : 'none',
            border: '1px solid', borderColor: locale === l ? 'var(--fp-primary)' : 'var(--fp-stroke)',
            color: locale === l ? 'var(--fp-primary)' : 'var(--fp-text-muted)',
            padding: '4px 9px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit',
          }}
        >{l.toUpperCase()}</button>
      ))}
    </div>
  );

  const formCard = (
    <>
      <HudFrame glow="var(--fp-primary)" brackets style={{ padding: 22 }}>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 13, letterSpacing: 3,
          color: 'var(--fp-primary)', marginBottom: 16, textTransform: 'uppercase',
          fontWeight: 800,
        }}>
          ▶ {c('INICIA SESIÓN', 'INSERT COIN TO CONTINUE')}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <ArenaLabel>{t(locale, 'Email').toUpperCase()}</ArenaLabel>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={arenaInputStyle}
            />
          </div>
          <div>
            <ArenaLabel>{t(locale, 'Password').toUpperCase()}</ArenaLabel>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={arenaInputStyle}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--fp-danger)', fontSize: 12, fontFamily: 'var(--fp-mono)' }}>{error}</div>
          )}

          <ArcadeButton
            type="submit"
            size="lg"
            fullWidth
            disabled={loading || !email || !password}
          >
            {loading ? c('CARGANDO…', 'LOADING…') : `▶ ${c('ENTRAR', 'START MATCH')}`}
          </ArcadeButton>
        </form>

        <button
          type="button"
          onClick={() => setShowForgot(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1,
            color: 'var(--fp-text-dim)', marginTop: 12, width: '100%', textAlign: 'center',
          }}
        >
          {c('¿OLVIDASTE TU CONTRASEÑA?', 'FORGOT PASSWORD?')}
        </button>
      </HudFrame>

      {/* Registration block — deliberately PROMINENT: most visitors arriving
          from a pool's "Inscribirme" CTA don't have an account yet, so the
          path to create one must be impossible to miss (not a footnote link).
          location.state is forwarded so PublicRoute returns the new user to
          the pool they came from after registering. */}
      <HudFrame stroke="var(--fp-accent)" style={{ padding: 18, marginTop: 16 }}>
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 2,
          color: 'var(--fp-text-dim)', marginBottom: 10, textAlign: 'center',
        }}>
          {c('¿NO TIENES CUENTA? CRÉALA EN 1 MINUTO', 'NEW PLAYER? IT TAKES 1 MINUTE')}
        </div>
        <Link to="/register" state={location.state} style={{ textDecoration: 'none', display: 'block' }}>
          <ArcadeButton variant="accent" size="lg" fullWidth>
            {c('CREAR CUENTA GRATIS', 'CREATE FREE ACCOUNT')} →
          </ArcadeButton>
        </Link>
      </HudFrame>
    </>
  );

  const brand = (compact) => (
    <div style={{ textAlign: compact ? 'center' : 'left', marginBottom: compact ? 48 : 0 }}>
      {/* BRAND wordmark — never translated (FutPools is a proper noun). */}
      <div style={{
        fontFamily: 'var(--fp-display)',
        fontWeight: 900, fontSize: compact ? 44 : 56,
        color: 'var(--fp-text)',
        letterSpacing: 6,
        lineHeight: 1,
      }}>
        FUT<span style={{ color: 'var(--fp-primary)', textShadow: '0 0 20px var(--fp-primary)' }}>POOLS</span>
      </div>
      <div style={{
        fontFamily: 'var(--fp-mono)',
        fontSize: 11, letterSpacing: 4,
        color: 'var(--fp-text-dim)', marginTop: 6,
      }}>· ARENA v2.0 ·</div>
      {!compact && (
        <>
          <div style={{
            fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 22,
            color: 'var(--fp-text)', marginTop: 28, lineHeight: 1.3,
          }}>
            {c('Quinielas de fútbol con premios reales.', 'Football pools with real prizes.')}
          </div>
          <ul style={{
            listStyle: 'none', padding: 0, margin: '18px 0 0',
            display: 'flex', flexDirection: 'column', gap: 10,
            fontFamily: 'var(--fp-mono)', fontSize: 13, color: 'var(--fp-text-dim)', letterSpacing: 0.5,
          }}>
            <li>◆ {c('Pronostica L · E · V en cada partido', 'Pick H · D · A on every match')}</li>
            <li>◆ {c('Sigue tus aciertos en vivo', 'Track your hits live')}</li>
            <li>◆ {c('Premios depositados a tu cuenta', 'Prizes paid straight to your account')}</li>
          </ul>
        </>
      )}
    </div>
  );

  return (
    <>
      <AppBackground />
      {langToggle}

      {/* Grid floor perspective */}
      <div style={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        height: '40%',
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent 0 24px, rgba(33,226,140,0.16) 24px 25px),' +
          'repeating-linear-gradient(90deg, transparent 0 24px, rgba(33,226,140,0.16) 24px 25px)',
        transform: 'perspective(400px) rotateX(60deg)',
        transformOrigin: 'bottom',
        maskImage: 'linear-gradient(0deg, black 0%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(0deg, black 0%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {isDesktop ? (
        /* ── Desktop: brand/value pitch left · form right.
           `fp-auth-full` opts out of the global 430px phone-frame clamp
           (see index.css) — without it this grid renders inside a phone
           column and collapses. ── */
        <div className="fp-auth-full" style={{
          position: 'relative', zIndex: 1, minHeight: '100vh',
          display: 'grid', gridTemplateColumns: '1.05fr 0.95fr',
          alignItems: 'center', gap: 72,
          maxWidth: 1040, margin: '0 auto', padding: '60px 40px',
        }}>
          <div>{brand(false)}</div>
          <div style={{ maxWidth: 420, width: '100%', justifySelf: 'start' }}>
            {formCard}
          </div>
        </div>
      ) : (
        /* ── Mobile: stacked, as before ── */
        <div style={{ position: 'relative', zIndex: 1, padding: '80px 28px 40px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          {brand(true)}
          {formCard}
          <div style={{ flex: 1 }} />
          <div style={{
            textAlign: 'center', marginTop: 32,
            fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 3,
            color: 'var(--fp-text-faint)',
          }}>
            © 2026 FUTPOOLS · PRESS START
          </div>
        </div>
      )}

      {showForgot && (
        <ForgotPasswordModal initialEmail={email} onClose={() => setShowForgot(false)} />
      )}
    </>
  );
}
