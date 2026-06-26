import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { useSafeBack } from '../lib/safeBack';
import { AppBackground } from '../arena-ui/AppBackground';
import {
  HudFrame, ArcadeButton, IconButton, SectionLabel,
} from '../arena-ui/primitives';
import { useIsDesktop } from '../desktop/useIsDesktop';
import { DesktopShellChrome } from '../desktop/DesktopShell';
import { CountryPicker, countryName, flagEmoji } from '../components/CountryPicker';

/// Edit-profile screen — update display name, username and email. Email and
/// username are login identifiers, so the backend requires the current
/// password when either changes; we mirror that here by only revealing the
/// password field when the user actually edits one of them.
export function EditProfile() {
  const navigate = useNavigate();
  const goBack = useSafeBack('/account');
  const { user, updateProfile } = useAuth();
  const { locale } = useLocale();
  const isDesktop = useIsDesktop();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [errorField, setErrorField] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // ── Payout / banking info ──────────────────────────────────────────
  // Prefilled from the user record (serializePayout returns a stable
  // empty-MX skeleton for legacy accounts). country drives which fields
  // are required: MX → bank (CLABE), elsewhere → PayPal.
  const p0 = user?.payout || {};
  const [payoutCountry, setPayoutCountry] = useState(p0.country || 'MX');
  const [accountHolder, setAccountHolder] = useState(p0.accountHolder || '');
  const [bankName, setBankName] = useState(p0.bankName || '');
  const [clabe, setClabe] = useState(p0.clabe || '');
  const [accountNumber, setAccountNumber] = useState(p0.accountNumber || '');
  const [paypalEmail, setPaypalEmail] = useState(p0.paypalEmail || '');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const isMx = payoutCountry === 'MX';

  const emailChanged = email.trim().toLowerCase() !== (user?.email || '').toLowerCase();
  const usernameChanged = username.trim().toLowerCase() !== (user?.username || '').toLowerCase();
  const nameChanged = displayName.trim() !== (user?.displayName || '').trim();
  const needsPassword = emailChanged || usernameChanged;

  const payoutChanged = (
    payoutCountry !== (p0.country || 'MX')
    || accountHolder.trim() !== (p0.accountHolder || '')
    || bankName.trim() !== (p0.bankName || '')
    || clabe.replace(/[\s-]/g, '') !== (p0.clabe || '')
    || accountNumber.trim() !== (p0.accountNumber || '')
    || paypalEmail.trim().toLowerCase() !== (p0.paypalEmail || '')
  );
  const dirty = emailChanged || usernameChanged || nameChanged || payoutChanged;

  const submit = async () => {
    if (busy || !dirty) return;
    setError(null);
    setErrorField(null);
    setOkMsg(null);
    if (displayName.trim().length < 2) {
      setError(t(locale, 'Name must be at least 2 characters'));
      setErrorField('displayName');
      return;
    }
    if (needsPassword && !currentPassword) {
      setError(t(locale, 'Enter your current password to change your email or username'));
      setErrorField('currentPassword');
      return;
    }

    // Validate banking info only when the user actually touched it, so a
    // name-only edit isn't blocked. Mirrors the backend rules.
    let payout;
    if (payoutChanged) {
      const cleanClabe = clabe.replace(/[\s-]/g, '');
      if (isMx) {
        if (accountHolder.trim().length < 2) {
          setError(t(locale, 'Enter the account holder name'));
          setErrorField('payout.accountHolder');
          return;
        }
        if (!bankName.trim()) {
          setError(t(locale, 'Enter your bank name'));
          setErrorField('payout.bankName');
          return;
        }
        if (!/^\d{18}$/.test(cleanClabe)) {
          setError(t(locale, 'Enter a valid 18-digit CLABE'));
          setErrorField('payout.clabe');
          return;
        }
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail.trim())) {
        setError(t(locale, 'Enter your PayPal email so we can send your prize'));
        setErrorField('payout.paypalEmail');
        return;
      }
      payout = {
        country: payoutCountry,
        accountHolder: accountHolder.trim(),
        bankName: bankName.trim(),
        clabe: cleanClabe,
        accountNumber: accountNumber.trim(),
        paypalEmail: paypalEmail.trim().toLowerCase(),
      };
    }

    setBusy(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        currentPassword: needsPassword ? currentPassword : undefined,
        payout,
      });
      setOkMsg(t(locale, 'Profile updated.'));
      setCurrentPassword('');
      // Brief confirmation, then back to the account screen.
      setTimeout(() => navigate('/account'), 700);
    } catch (e) {
      // Backend messages double as i18n keys (es translations added), so t()
      // localizes them; unknown strings fall back to the raw message.
      setError(t(locale, e?.message || 'Failed to update profile'));
      setErrorField(e?.field || null);
    } finally {
      setBusy(false);
    }
  };

  const fields = {
    displayName, setDisplayName, username, setUsername, email, setEmail,
    currentPassword, setCurrentPassword, needsPassword, errorField, locale,
    // payout
    payoutCountry, isMx, openCountryPicker: () => setShowCountryPicker(true),
    accountHolder, setAccountHolder, bankName, setBankName,
    clabe, setClabe, accountNumber, setAccountNumber,
    paypalEmail, setPaypalEmail,
  };

  if (isDesktop) {
    return (
      <DesktopShellChrome crumbsOverride={[t(locale, 'My account'), t(locale, 'Edit profile')]}>
        <div className="fp-desktop-wide" style={{ maxWidth: 560 }}>
          <div className="fp-desktop-page-head">
            <div>
              <h1 className="fp-desktop-page-title">{t(locale, 'Edit profile')}</h1>
              <p className="fp-desktop-page-sub">{t(locale, 'Update your name, username and email.')}</p>
            </div>
          </div>
          <div className="fp-card">
            <FormFields {...fields} desktop />
            {error && <DeskBanner color="var(--fp-danger)">{error}</DeskBanner>}
            {okMsg && <DeskBanner color="var(--fp-primary)">✓ {okMsg}</DeskBanner>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="fp-btn primary block"
                style={{ flex: 1 }}
                onClick={submit}
                disabled={busy || !dirty}
              >{busy ? t(locale, 'Saving…') : t(locale, 'Save changes')}</button>
              <button type="button" className="fp-btn ghost" onClick={goBack} disabled={busy}>
                {t(locale, 'Cancel')}
              </button>
            </div>
          </div>
        </div>
        {showCountryPicker && (
          <CountryPicker
            value={payoutCountry} locale={locale} t={t}
            onChange={setPayoutCountry}
            onClose={() => setShowCountryPicker(false)}
          />
        )}
      </DesktopShellChrome>
    );
  }

  return (
    <>
      <AppBackground />
      <div style={{ padding: '14px 16px 120px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <IconButton onClick={goBack}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 14,
          }}>{t(locale, 'EDIT PROFILE')}</div>
          <div style={{ width: 32 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <SectionLabel color="var(--fp-primary)">{t(locale, 'YOUR DATA')}</SectionLabel>
        </div>

        <HudFrame>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormFields {...fields} />
            {error && <HudBanner color="var(--fp-danger)">{error}</HudBanner>}
            {okMsg && <HudBanner color="var(--fp-primary)">✓ {okMsg}</HudBanner>}
            <ArcadeButton size="lg" fullWidth onClick={submit} disabled={busy || !dirty}>
              {busy ? t(locale, 'SAVING…') : t(locale, 'SAVE CHANGES')}
            </ArcadeButton>
          </div>
        </HudFrame>
      </div>
      {showCountryPicker && (
        <CountryPicker
          value={payoutCountry} locale={locale} t={t}
          onChange={setPayoutCountry}
          onClose={() => setShowCountryPicker(false)}
        />
      )}
    </>
  );
}

function FormFields({
  displayName, setDisplayName, username, setUsername, email, setEmail,
  currentPassword, setCurrentPassword, needsPassword, errorField, locale, desktop = false,
  // payout
  payoutCountry, isMx, openCountryPicker,
  accountHolder, setAccountHolder, bankName, setBankName,
  clabe, setClabe, accountNumber, setAccountNumber,
  paypalEmail, setPaypalEmail,
}) {
  const inputStyle = desktop ? deskInput : hudInput;
  const errStyle = (field) => (errorField === field
    ? { borderColor: 'var(--fp-danger)' } : null);
  const Label = desktop ? FieldLabelDesktop : FieldLabelMobile;
  return (
    <>
      <div>
        <Label>{t(locale, 'Display name')}</Label>
        <input
          type="text" value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={{ ...inputStyle, ...errStyle('displayName') }}
        />
      </div>
      <div>
        <Label>{t(locale, 'Username')}</Label>
        <input
          type="text" value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none" autoCorrect="off"
          style={{ ...inputStyle, ...errStyle('username') }}
        />
      </div>
      <div>
        <Label>{t(locale, 'Email')}</Label>
        <input
          type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none" autoCorrect="off"
          style={{ ...inputStyle, ...errStyle('email') }}
        />
      </div>
      {needsPassword && (
        <div>
          <Label>{t(locale, 'Current password')}</Label>
          <input
            type="password" value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t(locale, 'Required to change email or username')}
            style={{ ...inputStyle, ...errStyle('currentPassword') }}
          />
          <div style={{
            marginTop: 4, fontSize: desktop ? 12 : 10,
            color: 'var(--fp-text-dim)', fontFamily: desktop ? 'inherit' : 'var(--fp-mono)',
          }}>{t(locale, 'For security, confirm your password to change your email or username.')}</div>
        </div>
      )}

      <PayoutSection
        desktop={desktop} locale={locale} inputStyle={inputStyle}
        errStyle={errStyle} Label={Label}
        payoutCountry={payoutCountry} isMx={isMx} openCountryPicker={openCountryPicker}
        accountHolder={accountHolder} setAccountHolder={setAccountHolder}
        bankName={bankName} setBankName={setBankName}
        clabe={clabe} setClabe={setClabe}
        accountNumber={accountNumber} setAccountNumber={setAccountNumber}
        paypalEmail={paypalEmail} setPaypalEmail={setPaypalEmail}
      />
    </>
  );
}

/// Banking / payout block. Where the user's prize gets sent. For Mexico we
/// collect a bank account (CLABE) and treat PayPal as optional; for any
/// other country bank rails don't reach them, so PayPal becomes the
/// required payout channel (a note explains this once they pick a country).
function PayoutSection({
  desktop, locale, inputStyle, errStyle, Label,
  payoutCountry, isMx, openCountryPicker,
  accountHolder, setAccountHolder, bankName, setBankName,
  clabe, setClabe, accountNumber, setAccountNumber,
  paypalEmail, setPaypalEmail,
}) {
  const noteStyle = {
    marginTop: 4, fontSize: desktop ? 12 : 10,
    color: 'var(--fp-text-dim)', fontFamily: desktop ? 'inherit' : 'var(--fp-mono)',
    lineHeight: 1.5,
  };
  const flag = flagEmoji(payoutCountry);
  return (
    <>
      <div style={{
        marginTop: 6, paddingTop: 14,
        borderTop: '1px solid var(--fp-stroke)',
      }}>
        <div style={{
          fontFamily: desktop ? 'inherit' : 'var(--fp-mono)',
          fontSize: desktop ? 13 : 11, fontWeight: 800, letterSpacing: desktop ? 0 : 1,
          color: 'var(--fp-primary)', marginBottom: 4,
          textTransform: desktop ? 'none' : 'uppercase',
        }}>{t(locale, 'Payout details')}</div>
        <div style={noteStyle}>
          {t(locale, 'Tell us where to send your prize if you win. Required so we can pay you.')}
        </div>
      </div>

      {/* Country selector — opens the searchable picker. Changing away from
          Mexico flips the form to the PayPal-required layout. */}
      <div>
        <Label>{t(locale, 'Country')}</Label>
        <button
          type="button"
          onClick={openCountryPicker}
          style={{
            ...inputStyle, display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 18 }}>{flag}</span>
          <span style={{ flex: 1 }}>{countryName(payoutCountry, locale) || t(locale, 'Select country')}</span>
          <span style={{ color: 'var(--fp-text-dim)' }}>▾</span>
        </button>
        <div style={noteStyle}>
          {isMx
            ? t(locale, "Not in Mexico? Pick your country and we'll enable PayPal so you can just leave your PayPal email.")
            : t(locale, "Outside Mexico we pay via PayPal — add your PayPal email below and you're set. Bank account is optional.")}
        </div>
      </div>

      {/* Bank account — required for Mexico, optional otherwise. */}
      <div>
        <Label>{isMx ? t(locale, 'Account holder') : t(locale, 'Account holder (optional)')}</Label>
        <input
          type="text" value={accountHolder}
          onChange={(e) => setAccountHolder(e.target.value)}
          placeholder={t(locale, 'Full name as it appears on the account')}
          style={{ ...inputStyle, ...errStyle('payout.accountHolder') }}
        />
      </div>
      <div>
        <Label>{isMx ? t(locale, 'Bank') : t(locale, 'Bank (optional)')}</Label>
        <input
          type="text" value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder={t(locale, 'e.g. BBVA, Santander, Banorte')}
          style={{ ...inputStyle, ...errStyle('payout.bankName') }}
        />
      </div>
      {isMx ? (
        <div>
          <Label>{t(locale, 'CLABE (18 digits)')}</Label>
          <input
            type="text" inputMode="numeric" value={clabe}
            onChange={(e) => setClabe(e.target.value)}
            placeholder={t(locale, '18-digit interbank CLABE')}
            maxLength={22}
            style={{ ...inputStyle, ...errStyle('payout.clabe') }}
          />
        </div>
      ) : (
        <div>
          <Label>{t(locale, 'Account / IBAN (optional)')}</Label>
          <input
            type="text" value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder={t(locale, 'Bank account number or IBAN')}
            style={{ ...inputStyle, ...errStyle('payout.accountNumber') }}
          />
        </div>
      )}

      {/* PayPal — required outside Mexico, optional inside. */}
      <div>
        <Label>{isMx ? t(locale, 'PayPal email (optional)') : t(locale, 'PayPal email')}</Label>
        <input
          type="email" value={paypalEmail}
          onChange={(e) => setPaypalEmail(e.target.value)}
          autoCapitalize="none" autoCorrect="off"
          placeholder={t(locale, 'your@email.com')}
          style={{ ...inputStyle, ...errStyle('payout.paypalEmail') }}
        />
      </div>
    </>
  );
}

function FieldLabelMobile({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
      color: 'var(--fp-text-muted)', marginBottom: 4,
    }}>{String(children).toUpperCase()}</div>
  );
}
function FieldLabelDesktop({ children }) {
  return <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{children}</div>;
}
function HudBanner({ color, children }) {
  return (
    <div style={{
      padding: 10, clipPath: 'var(--fp-clip-sm)',
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      color, fontFamily: 'var(--fp-mono)', fontSize: 12, wordBreak: 'break-word',
    }}>{children}</div>
  );
}
function DeskBanner({ color, children }) {
  return (
    <div style={{
      marginTop: 14, padding: '10px 12px', borderRadius: 10,
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      color, fontSize: 13, wordBreak: 'break-word',
    }}>{children}</div>
  );
}

const hudInput = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  background: 'var(--fp-bg2)', border: '1px solid var(--fp-stroke)',
  clipPath: 'var(--fp-clip-sm)', color: 'var(--fp-text)',
  fontFamily: 'var(--fp-mono)', fontSize: 13, outline: 'none',
};
const deskInput = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  background: 'var(--fp-surface-alt)', border: '1px solid var(--fp-stroke)',
  borderRadius: 10, color: 'var(--fp-text)', font: 'inherit', outline: 'none',
};
