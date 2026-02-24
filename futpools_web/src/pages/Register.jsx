import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { PrimaryButton } from '../components/PrimaryButton';

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
      <div style={{ minHeight: '100%', padding: 'var(--spacing-xl)', paddingTop: 'var(--spacing-xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--app-text-primary)' }}>
            {t(locale, 'Create account')}
          </h1>
          <p style={{ color: 'var(--app-text-secondary)', fontSize: 15 }}>{t(locale, 'Sign up to start playing')}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <input
            type="email"
            placeholder={t(locale, 'Email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="text"
            placeholder={t(locale, 'Username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="text"
            placeholder={t(locale, 'Name')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder={t(locale, 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
          />
          {error && (
            <p style={{ color: 'var(--app-live-red)', fontSize: 13, textAlign: 'center' }}>{error}</p>
          )}
          <PrimaryButton type="submit" disabled={loading}>
            {t(locale, 'Sign up')}
          </PrimaryButton>
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
          <Link to="/login">{t(locale, 'Sign in')}</Link>
        </p>
      </div>
    </>
  );
}

const inputStyle = {
  padding: 'var(--spacing-md)',
  background: 'var(--app-surface)',
  border: '1px solid var(--app-stroke)',
  borderRadius: 'var(--app-radius-button)',
  color: 'var(--app-text-primary)',
  fontSize: 16,
};
