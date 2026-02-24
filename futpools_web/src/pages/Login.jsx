import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { PrimaryButton } from '../components/PrimaryButton';
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
      <div style={{ minHeight: '100%', padding: 'var(--spacing-xl)', paddingTop: 'var(--spacing-xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: 'var(--app-text-primary)', marginBottom: 'var(--spacing-sm)' }}>
            Quinielas
          </h1>
          <p style={{ color: 'var(--app-text-secondary)', fontSize: 15 }}>{t(locale, 'Sign in to play')}</p>
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
            type="password"
            placeholder={t(locale, 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {error && (
            <p style={{ color: 'var(--app-live-red)', fontSize: 13, textAlign: 'center' }}>{error}</p>
          )}
          <PrimaryButton type="submit" disabled={loading || !email || !password}>
            {t(locale, 'Sign in')}
          </PrimaryButton>
        </form>

        <button
          type="button"
          onClick={() => setShowComingSoon(true)}
          style={{
            marginTop: 'var(--spacing-sm)',
            background: 'none',
            border: 'none',
            color: 'var(--app-text-secondary)',
            fontSize: 15,
            padding: 'var(--spacing-xs)',
          }}
        >
          {t(locale, 'Forgot password?')}
        </button>

        <p style={{ textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
          <Link to="/register">{t(locale, "Don't have an account? Sign up")}</Link>
        </p>
      </div>

      {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(false)} />}
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
