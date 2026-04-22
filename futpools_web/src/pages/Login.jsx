import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import {
  HudFrame, ArcadeButton, ArenaLabel, arenaInputStyle,
} from '../arena-ui/primitives';
import { ComingSoonModal } from '../components/ComingSoonModal';

export function Login() {
  const { login, error, setError } = useAuth();
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    await login(email, password);
    setLoading(false);
  };

  return (
    <>
      <AppBackground />

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

      <div style={{ position: 'relative', zIndex: 1, padding: '80px 28px 40px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Logo lockup */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          {/* BRAND wordmark — never translated (FutPools is a proper noun).
              Hardcoded JSX so it stays "FUTPOOLS" across all locales. */}
          <div style={{
            fontFamily: 'var(--fp-display)',
            fontWeight: 900, fontSize: 44,
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
        </div>

        {/* Form card */}
        <HudFrame glow="var(--fp-primary)" brackets style={{ padding: 22 }}>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 13, letterSpacing: 3,
            color: 'var(--fp-primary)', marginBottom: 16, textTransform: 'uppercase',
            fontWeight: 800,
          }}>
            ▶ INSERT COIN TO CONTINUE
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
              {loading ? 'LOADING…' : '▶ START MATCH'}
            </ArcadeButton>
          </form>
        </HudFrame>

        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-muted)', letterSpacing: 1 }}>
              NEW PLAYER?
            </span>
            <Link to="/register" style={{
              fontFamily: 'var(--fp-display)', fontSize: 12, color: 'var(--fp-primary)',
              letterSpacing: 2, fontWeight: 700, textDecoration: 'none',
            }}>
              CREATE ACCOUNT →
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setShowComingSoon(true)}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: 'var(--fp-mono)',
              fontSize: 10, letterSpacing: 1,
              color: 'var(--fp-text-dim)',
            }}
          >
            FORGOT PASSWORD?
          </button>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{
          textAlign: 'center',
          fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 3,
          color: 'var(--fp-text-faint)',
        }}>
          © 2026 FUTPOOLS · PRESS START
        </div>
      </div>

      {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(false)} />}
    </>
  );
}
