import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  HudFrame, ArcadeButton, ArenaLabel, arenaInputStyle,
} from '../arena-ui/primitives';

/**
 * Two-step password recovery (matches the backend /auth/forgot-password →
 * /auth/reset-password flow):
 *   1. enter email          → POST /auth/forgot-password (always generic reply)
 *   2. enter code + new pwd  → POST /auth/reset-password → { token, user }
 * On success the returned session signs the user in (applySession); the
 * PublicRoute guard then redirects away from /login.
 */
export function ForgotPasswordModal({ onClose, initialEmail = '' }) {
  const { locale } = useLocale();
  const { applySession } = useAuth();
  const c = (es, en) => (locale === 'es' ? es : en);

  const [step, setStep] = useState(1); // 1=email · 2=code+password · 3=done
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  const requestCode = async (e) => {
    if (e) e.preventDefault();
    setErr(null);
    const mail = email.trim().toLowerCase();
    if (!mail) { setErr(c('Escribe tu correo.', 'Enter your email.')); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: mail });
      setInfo(c(
        'Si existe una cuenta con ese correo, te enviamos un código de 6 dígitos. Revisa tu bandeja (y la carpeta de spam).',
        'If an account exists for that email, we sent a 6-digit code. Check your inbox (and spam).',
      ));
      setStep(2);
    } catch {
      // forgot-password is intentionally generic; surface a soft message.
      setErr(c('No pudimos enviar el código. Inténtalo de nuevo.', 'We could not send the code. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    if (e) e.preventDefault();
    setErr(null);
    if (code.trim().length < 6) { setErr(c('El código es de 6 dígitos.', 'The code is 6 digits.')); return; }
    if (newPassword.length < 6) { setErr(c('La contraseña debe tener al menos 6 caracteres.', 'Password must be at least 6 characters.')); return; }
    setLoading(true);
    try {
      const { token, user } = await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });
      applySession({ token, user }); // signs the user in
      setStep(3);
    } catch {
      // Backend replies in English; show a localized message for the common case.
      setErr(c('Código inválido o expirado. Pide uno nuevo.', 'Invalid or expired code. Request a new one.'));
    } finally {
      setLoading(false);
    }
  };

  const title = step === 3
    ? c('LISTO', 'ALL SET')
    : c('RECUPERAR CONTRASEÑA', 'RECOVER PASSWORD');

  // Portal to <body>: the Login subtree sits inside transformed/clamped
  // ancestors, so a position:fixed overlay rendered inline resolves against
  // them (offset + clipped on mobile). Rendering to body pins it to the viewport.
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400 }}>
        <HudFrame glow="var(--fp-primary)" brackets style={{ width: '100%' }}>
          <div style={{ padding: 24 }}>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
              letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--fp-primary)',
              marginBottom: 14, textAlign: 'center',
            }}>
              {title}
            </div>

            {step === 1 && (
              <form onSubmit={requestCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--fp-body)', fontSize: 13, color: 'var(--fp-text-dim)' }}>
                  {c(
                    'Escribe tu correo y te enviaremos un código para crear una nueva contraseña.',
                    'Enter your email and we will send you a code to set a new password.',
                  )}
                </div>
                <div>
                  <ArenaLabel>{c('CORREO', 'EMAIL')}</ArenaLabel>
                  <input
                    type="email" value={email} autoFocus
                    onChange={(e) => setEmail(e.target.value)}
                    required style={arenaInputStyle}
                  />
                </div>
                {err && <div style={{ color: 'var(--fp-danger)', fontSize: 12, fontFamily: 'var(--fp-mono)' }}>{err}</div>}
                <ArcadeButton type="submit" size="lg" fullWidth disabled={loading || !email}>
                  {loading ? c('ENVIANDO…', 'SENDING…') : c('ENVIAR CÓDIGO', 'SEND CODE')}
                </ArcadeButton>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={submitReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {info && (
                  <div style={{ fontFamily: 'var(--fp-body)', fontSize: 12.5, color: 'var(--fp-text-dim)', lineHeight: 1.5 }}>
                    {info}
                  </div>
                )}
                <div>
                  <ArenaLabel>{c('CÓDIGO DE 6 DÍGITOS', '6-DIGIT CODE')}</ArenaLabel>
                  <input
                    type="text" inputMode="numeric" autoComplete="one-time-code"
                    maxLength={6} value={code} autoFocus
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{ ...arenaInputStyle, letterSpacing: 8, textAlign: 'center', fontFamily: 'var(--fp-mono)', fontSize: 20 }}
                  />
                </div>
                <div>
                  <ArenaLabel>{c('NUEVA CONTRASEÑA', 'NEW PASSWORD')}</ArenaLabel>
                  <input
                    type="password" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required minLength={6} style={arenaInputStyle}
                  />
                </div>
                {err && <div style={{ color: 'var(--fp-danger)', fontSize: 12, fontFamily: 'var(--fp-mono)' }}>{err}</div>}
                <ArcadeButton type="submit" size="lg" fullWidth disabled={loading || !code || !newPassword}>
                  {loading ? c('GUARDANDO…', 'SAVING…') : c('CAMBIAR CONTRASEÑA', 'CHANGE PASSWORD')}
                </ArcadeButton>
                <button
                  type="button" onClick={requestCode} disabled={loading}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1,
                    color: 'var(--fp-text-dim)', textAlign: 'center', width: '100%',
                  }}
                >
                  {c('¿NO TE LLEGÓ? REENVIAR CÓDIGO', "DIDN'T GET IT? RESEND CODE")}
                </button>
              </form>
            )}

            {step === 3 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
                <div style={{ fontFamily: 'var(--fp-body)', fontSize: 14, color: 'var(--fp-text-dim)', marginBottom: 20, lineHeight: 1.5 }}>
                  {c(
                    'Tu contraseña se actualizó y ya iniciaste sesión.',
                    'Your password was updated and you are now signed in.',
                  )}
                </div>
                <ArcadeButton size="lg" fullWidth onClick={onClose}>
                  {c('CONTINUAR', 'CONTINUE')}
                </ArcadeButton>
              </div>
            )}

            {step !== 3 && (
              <button
                type="button" onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1,
                  color: 'var(--fp-text-faint)', marginTop: 14, width: '100%', textAlign: 'center',
                }}
              >
                {c('CANCELAR', 'CANCEL')}
              </button>
            )}
          </div>
        </HudFrame>
      </div>
    </div>,
    document.body,
  );
}
