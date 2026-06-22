import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { t } from '../../i18n/translations';
import { useSafeBack } from '../../lib/safeBack';
import { AppBackground } from '../../arena-ui/AppBackground';
import {
  HudFrame, ArcadeButton, IconButton, SectionLabel,
} from '../../arena-ui/primitives';

/// Admin-only dashboard for MXN store-credit. The organizer types a user's
/// email + an amount in pesos and grants credit; when that user joins a paid
/// pool, the credit covers the entry instead of a fresh SPEI/PayPal transfer.
/// Typical case: someone paid for a pool they missed and the organizer rolls
/// the $50 forward. A recent-ledger list gives an at-a-glance audit trail.
export function AdminCredits() {
  const goBack = useSafeBack('/account');
  const { token } = useAuth();
  const { locale } = useLocale();

  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('50');
  const [note, setNote] = useState('');
  const [lookup, setLookup] = useState(null); // { id, email, displayName, balanceMXN }
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (forEmail) => {
    try {
      const qs = forEmail ? `?email=${encodeURIComponent(forEmail)}` : '';
      const res = await api.get(`/admin/credits${qs}`, token);
      setRecent(res?.recent || []);
      setLookup(res?.user || null);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Could not load credits');
      setRecent([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Debounced lookup so the admin sees the user's current balance as they type.
  useEffect(() => {
    const e = email.trim();
    if (!e || !e.includes('@')) { setLookup(null); return undefined; }
    const id = setTimeout(() => { load(e); }, 400);
    return () => clearTimeout(id);
  }, [email, load]);

  const submit = async (kind) => {
    if (busy) return;
    setError(null);
    setOkMsg(null);
    const amt = Math.round(Number(amount));
    if (!email.trim().includes('@')) { setError(t(locale, 'Enter a valid email.')); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError(t(locale, 'Enter an amount greater than 0.')); return; }
    setBusy(true);
    try {
      const path = kind === 'revoke' ? '/admin/credits/revoke' : '/admin/credits/grant';
      const res = await api.post(path, { email: email.trim(), amountMXN: amt, note: note.trim() }, token);
      const u = res?.user;
      setOkMsg(
        kind === 'revoke'
          ? `−$${amt} MXN · ${u?.email} · ${t(locale, 'Balance')}: $${u?.balanceMXN}`
          : `+$${amt} MXN · ${u?.email} · ${t(locale, 'Balance')}: $${u?.balanceMXN}`,
      );
      setNote('');
      await load(email.trim());
    } catch (e) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppBackground />
      <div style={{ padding: '14px 16px 120px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <IconButton onClick={goBack}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 14,
          }}>{t(locale, 'CREDITS')}</div>
          <div style={{ width: 32 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <SectionLabel color="var(--fp-primary)">{t(locale, 'GRANT CREDIT')}</SectionLabel>
        </div>

        <HudFrame>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label={t(locale, 'User email')}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@correo.com"
                autoCapitalize="none"
                autoCorrect="off"
                style={inputStyle}
              />
            </Field>

            {/* Live balance for the typed email so the admin doesn't double-grant. */}
            {lookup && (
              <div style={{
                padding: '8px 10px', clipPath: 'var(--fp-clip-sm)',
                background: 'color-mix(in srgb, var(--fp-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--fp-primary) 35%, transparent)',
                fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-text-dim)',
              }}>
                {lookup.displayName} · {t(locale, 'Current balance')}:{' '}
                <span style={{ color: 'var(--fp-primary)', fontWeight: 800 }}>${lookup.balanceMXN} MXN</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 130 }}>
                <Field label={t(locale, 'Amount (MXN)')}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label={t(locale, 'Note (optional)')}>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t(locale, 'e.g. paid late for last pool')}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>

            {error && <Banner color="var(--fp-danger)">{error}</Banner>}
            {okMsg && <Banner color="var(--fp-primary)">✓ {okMsg}</Banner>}

            <div style={{ display: 'flex', gap: 8 }}>
              <ArcadeButton size="md" fullWidth onClick={() => submit('grant')} disabled={busy}>
                {busy ? t(locale, 'SAVING…') : `+ ${t(locale, 'GRANT CREDIT')}`}
              </ArcadeButton>
              <button
                type="button"
                onClick={() => submit('revoke')}
                disabled={busy}
                style={{
                  padding: '0 16px', background: 'transparent',
                  border: '1px solid color-mix(in srgb, var(--fp-danger) 50%, transparent)',
                  color: 'var(--fp-danger)', clipPath: 'var(--fp-clip-sm)',
                  fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800,
                  letterSpacing: 1, cursor: busy ? 'default' : 'pointer',
                }}
              >{t(locale, 'REVOKE')}</button>
            </div>
          </div>
        </HudFrame>

        <div style={{ margin: '20px 0 12px' }}>
          <SectionLabel>{t(locale, 'RECENT MOVEMENTS')}</SectionLabel>
        </div>

        {recent && recent.length === 0 && (
          <HudFrame>
            <div style={{
              padding: 28, textAlign: 'center', color: 'var(--fp-text-muted)',
              fontFamily: 'var(--fp-mono)', fontSize: 12,
            }}>{t(locale, 'No credit movements yet.')}</div>
          </HudFrame>
        )}

        {recent && recent.map((tx) => {
          const positive = tx.amountMXN >= 0;
          return (
            <div key={tx.id} style={{ marginBottom: 8 }}>
              <HudFrame>
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--fp-mono)', fontSize: 12, color: 'var(--fp-text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{tx.user?.email || '—'}</div>
                    <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
                      {kindLabel(locale, tx.kind)}{tx.note ? ` · ${tx.note}` : ''}{tx.pool ? ` · ${tx.pool.name}` : ''}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 900,
                    color: positive ? 'var(--fp-primary)' : 'var(--fp-danger)',
                  }}>{positive ? '+' : '−'}${Math.abs(tx.amountMXN)}</div>
                </div>
              </HudFrame>
            </div>
          );
        })}
      </div>
    </>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px',
  background: 'var(--fp-bg2)', border: '1px solid var(--fp-stroke)',
  clipPath: 'var(--fp-clip-sm)', color: 'var(--fp-text)',
  fontFamily: 'var(--fp-mono)', fontSize: 13, outline: 'none',
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
        color: 'var(--fp-text-muted)', marginBottom: 4,
      }}>{label.toUpperCase()}</div>
      {children}
    </label>
  );
}

function Banner({ color, children }) {
  return (
    <div style={{
      padding: 10, clipPath: 'var(--fp-clip-sm)',
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      color, fontFamily: 'var(--fp-mono)', fontSize: 12, wordBreak: 'break-word',
    }}>{children}</div>
  );
}

function kindLabel(locale, kind) {
  if (kind === 'admin_grant') return t(locale, 'Grant');
  if (kind === 'admin_revoke') return t(locale, 'Revoke');
  if (kind === 'entry_use') return t(locale, 'Used for entry');
  return kind;
}
