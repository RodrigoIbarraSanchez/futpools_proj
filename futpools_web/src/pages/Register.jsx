import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import { HudFrame, ArcadeButton, ArenaLabel, arenaInputStyle } from '../arena-ui/primitives';

export function Register() {
  const { register, error, setError } = useAuth();
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    await register(email, password, username, displayName);
    setLoading(false);
  };

  return (
    <>
      <AppBackground />
      <div style={{ minHeight: '100%', padding: '60px 24px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            fontFamily: 'var(--fp-display)', fontSize: 30, fontWeight: 800,
            letterSpacing: 3, textTransform: 'uppercase',
            margin: 0, color: 'var(--fp-text)',
          }}>
            {t(locale, 'Create account')}
          </h1>
          <p style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 2,
            color: 'var(--fp-text-dim)', marginTop: 6,
          }}>
            {t(locale, 'Sign up to start playing').toUpperCase()}
          </p>
        </div>

        <HudFrame style={{ padding: 20 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <ArenaLabel>{t(locale, 'Email').toUpperCase()}</ArenaLabel>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={arenaInputStyle} />
            </div>
            <div>
              <ArenaLabel>{t(locale, 'Username').toUpperCase()}</ArenaLabel>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required style={arenaInputStyle} />
            </div>
            <div>
              <ArenaLabel>{t(locale, 'Name').toUpperCase()}</ArenaLabel>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={arenaInputStyle} />
            </div>
            <div>
              <ArenaLabel>{t(locale, 'Password').toUpperCase()}</ArenaLabel>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={arenaInputStyle} />
            </div>

            {error && (
              <div style={{ color: 'var(--fp-danger)', fontSize: 12, fontFamily: 'var(--fp-mono)' }}>{error}</div>
            )}

            <ArcadeButton type="submit" size="lg" fullWidth disabled={loading}>
              {loading ? 'LOADING…' : `▶ ${t(locale, 'Sign up').toUpperCase()}`}
            </ArcadeButton>
          </form>
        </HudFrame>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link to="/login" style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 1.5,
            color: 'var(--fp-primary)', textDecoration: 'none',
          }}>
            ← {t(locale, 'Sign in').toUpperCase()}
          </Link>
        </div>
      </div>
    </>
  );
}
