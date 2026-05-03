import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import { HudFrame, ArcadeButton, ArenaLabel, arenaInputStyle } from '../arena-ui/primitives';
import { CountryPicker, countryName, flagEmoji } from '../components/CountryPicker';

// Map a backend error `code` to a localized friendly message. Falls
// back to the raw backend `message` (already English-or-Spanish-aware
// on the server side) if the code isn't recognized.
function localizedRegisterError(locale, code, fallbackMessage) {
  const dict = {
    EMAIL_EXISTS:     { en: 'An account with this email already exists. Try signing in instead.',
                        es: 'Ya existe una cuenta con ese correo. Inicia sesión.' },
    USERNAME_TAKEN:   { en: 'That username is already taken. Pick another one.',
                        es: 'Ese nombre de usuario ya está ocupado. Elige otro.' },
    INVALID_EMAIL:    { en: 'That doesn’t look like a valid email address.',
                        es: 'Ese correo no parece válido.' },
    WEAK_PASSWORD:    { en: 'Password must be at least 6 characters.',
                        es: 'La contraseña debe tener al menos 6 caracteres.' },
    INVALID_USERNAME: { en: 'Username must be 3–20 chars: letters, numbers, dot or underscore.',
                        es: 'El usuario debe tener 3–20 caracteres: letras, números, punto o guión bajo.' },
    NAME_TOO_SHORT:   { en: 'Name must be at least 2 characters.',
                        es: 'El nombre debe tener al menos 2 caracteres.' },
    INVALID_DOB:      { en: 'Please pick a valid date of birth.',
                        es: 'Elige una fecha de nacimiento válida.' },
    UNDERAGE:         { en: 'You must be 18 or older to sign up.',
                        es: 'Debes tener 18 años o más para registrarte.' },
    SERVER_ERROR:     { en: 'Couldn’t create your account. Please try again in a moment.',
                        es: 'No pudimos crear tu cuenta. Intenta de nuevo en un momento.' },
  };
  const entry = code && dict[code];
  if (entry) return entry[locale] || entry.en;
  return fallbackMessage || (locale === 'es' ? 'No pudimos crear tu cuenta.' : 'Could not create your account.');
}

export function Register() {
  const { register, error, errorCode, errorField, setError } = useAuth();
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob] = useState('');             // YYYY-MM-DD from <input type="date">
  const [country, setCountry] = useState('MX');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Block submit when computed age < 18. Backend also enforces but
  // catching it client-side avoids a wasted round-trip.
  const ageYears = (() => {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  })();
  const dobError = (ageYears != null && ageYears < 18)
    ? t(locale, 'Must be 18 or older')
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (dobError) return;
    setLoading(true);
    await register(email, password, username, displayName, dob, country);
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
            <div>
              <ArenaLabel>{t(locale, 'DATE OF BIRTH')}</ArenaLabel>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required style={arenaInputStyle} />
              {dobError && (
                <div style={{ color: 'var(--fp-danger)', fontSize: 11, fontFamily: 'var(--fp-mono)', marginTop: 4 }}>
                  {dobError}
                </div>
              )}
            </div>
            <div>
              <ArenaLabel>{t(locale, 'COUNTRY')}</ArenaLabel>
              <button
                type="button"
                onClick={() => setShowCountryPicker(true)}
                style={{
                  ...arenaInputStyle,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 22 }}>{flagEmoji(country)}</span>
                <span style={{ flex: 1 }}>{countryName(country, locale)}</span>
                <span style={{ color: 'var(--fp-text-dim)', fontSize: 12 }}>▾</span>
              </button>
            </div>

            {error && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px',
                background: 'rgba(255,59,92,0.08)',
                border: '1px solid rgba(255,59,92,0.45)',
                borderRadius: 6,
                color: 'var(--fp-text)',
                fontFamily: 'var(--fp-body)', fontSize: 13, lineHeight: 1.4,
              }}>
                <span style={{ color: 'var(--fp-danger)', fontSize: 16, lineHeight: 1, fontWeight: 800 }}>!</span>
                <span style={{ flex: 1 }}>
                  {localizedRegisterError(locale, errorCode, error)}
                </span>
              </div>
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
      {showCountryPicker && (
        <CountryPicker
          value={country}
          onChange={setCountry}
          onClose={() => setShowCountryPicker(false)}
          locale={locale}
          t={t}
        />
      )}
    </>
  );
}
