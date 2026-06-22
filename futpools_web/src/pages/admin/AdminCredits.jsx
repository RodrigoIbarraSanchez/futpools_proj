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
import { useIsDesktop } from '../../desktop/useIsDesktop';
import { DesktopShellChrome } from '../../desktop/DesktopShell';

/// Admin-only dashboard for MXN store-credit. The organizer searches a user by
/// name or email (they rarely know the exact address), picks them, and grants
/// pesos; when that user joins a paid pool the credit covers the entry instead
/// of a fresh SPEI/PayPal transfer. Renders a native desktop layout inside the
/// desktop shell, and the arcade-HUD layout on mobile.
export function AdminCredits() {
  const isDesktop = useIsDesktop();
  const { token } = useAuth();
  const { locale } = useLocale();
  const goBack = useSafeBack('/account');

  const [selected, setSelected] = useState(null); // { id, email, displayName, balanceMXN }
  const [amount, setAmount] = useState('50');
  const [note, setNote] = useState('');
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/credits', token);
      setRecent(res?.recent || []);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Could not load credits');
      setRecent([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const submit = async (kind) => {
    if (busy) return;
    setError(null);
    setOkMsg(null);
    if (!selected?.email) { setError(t(locale, 'Search and pick a user first.')); return; }
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) { setError(t(locale, 'Enter an amount greater than 0.')); return; }
    setBusy(true);
    try {
      const path = kind === 'revoke' ? '/admin/credits/revoke' : '/admin/credits/grant';
      const res = await api.post(path, { email: selected.email, amountMXN: amt, note: note.trim() }, token);
      const u = res?.user;
      if (u) setSelected((prev) => ({ ...prev, balanceMXN: u.balanceMXN }));
      setOkMsg(
        `${kind === 'revoke' ? '−' : '+'}$${amt} MXN · ${u?.email} · ${t(locale, 'Balance')}: $${u?.balanceMXN}`,
      );
      setNote('');
      await load();
    } catch (e) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const shared = {
    token, locale, selected, setSelected,
    amount, setAmount, note, setNote,
    recent, error, okMsg, busy, submit,
  };

  if (isDesktop) return <CreditsDesktop {...shared} />;
  return <CreditsMobile {...shared} goBack={goBack} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Shared user-search hook — debounced typeahead against /admin/credits/search.
// ─────────────────────────────────────────────────────────────────────────
function useUserSearch(token) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return undefined; }
    let on = true;
    setLoading(true);
    const id = setTimeout(() => {
      api.get(`/admin/credits/search?q=${encodeURIComponent(q)}`, token)
        .then((list) => { if (on) setResults(Array.isArray(list) ? list : []); })
        .catch(() => { if (on) setResults([]); })
        .finally(() => { if (on) setLoading(false); });
    }, 300);
    return () => { on = false; clearTimeout(id); };
  }, [query, token]);

  return { query, setQuery, results, loading, setResults };
}

function kindLabel(locale, kind) {
  if (kind === 'admin_grant') return t(locale, 'Grant');
  if (kind === 'admin_revoke') return t(locale, 'Revoke');
  if (kind === 'entry_use') return t(locale, 'Used for entry');
  return kind;
}

// ─────────────────────────────────────────────────────────────────────────
// Desktop
// ─────────────────────────────────────────────────────────────────────────
function CreditsDesktop({
  token, locale, selected, setSelected,
  amount, setAmount, note, setNote, recent, error, okMsg, busy, submit,
}) {
  return (
    <DesktopShellChrome crumbsOverride={[t(locale, 'Admin'), t(locale, 'Credits')]}>
      <div className="fp-desktop-wide">
        <div className="fp-desktop-page-head">
          <div>
            <div className="muted" style={{
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{t(locale, 'Admin')}</div>
            <h1 className="fp-desktop-page-title" style={{ marginTop: 4 }}>{t(locale, 'Credits')}</h1>
            <p className="fp-desktop-page-sub">
              {t(locale, 'Search a player, then grant credit to cover their pool entry.')}
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '420px 1fr',
          gap: 'var(--app-space-6)', alignItems: 'flex-start',
        }}>
          {/* Grant form */}
          <div className="fp-card">
            <h4 className="fp-section-title">{t(locale, 'Grant credit')}</h4>

            <div style={{ marginTop: 14 }}>
              <FieldLabelDesktop>{t(locale, 'User')}</FieldLabelDesktop>
              <UserSearchField
                token={token}
                locale={locale}
                selected={selected}
                onSelect={setSelected}
                onClear={() => setSelected(null)}
                desktop
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <div style={{ width: 130 }}>
                <FieldLabelDesktop>{t(locale, 'Amount (MXN)')}</FieldLabelDesktop>
                <input
                  type="number" inputMode="numeric" min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={deskInput}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabelDesktop>{t(locale, 'Note (optional)')}</FieldLabelDesktop>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t(locale, 'e.g. paid late for last pool')}
                  style={deskInput}
                />
              </div>
            </div>

            {error && <DeskBanner color="var(--fp-danger)">{error}</DeskBanner>}
            {okMsg && <DeskBanner color="var(--fp-primary)">✓ {okMsg}</DeskBanner>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="fp-btn primary block"
                style={{ flex: 1 }}
                disabled={busy || !selected}
                onClick={() => submit('grant')}
              >
                {busy ? t(locale, 'Saving…') : `+ ${t(locale, 'Grant credit')}`}
              </button>
              <button
                type="button"
                className="fp-btn ghost"
                disabled={busy || !selected}
                onClick={() => submit('revoke')}
                style={{ color: 'var(--fp-danger)', borderColor: 'color-mix(in srgb, var(--fp-danger) 45%, transparent)' }}
              >{t(locale, 'Remove credit')}</button>
            </div>
          </div>

          {/* Recent movements */}
          <div className="fp-card">
            <h4 className="fp-section-title">{t(locale, 'Recent movements')}</h4>
            {recent && recent.length === 0 && (
              <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
                {t(locale, 'No credit movements yet.')}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
              {(recent || []).map((tx) => {
                const positive = tx.amountMXN >= 0;
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--fp-text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{tx.user?.displayName || tx.user?.email || '—'}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {kindLabel(locale, tx.kind)}{tx.note ? ` · ${tx.note}` : ''}{tx.pool ? ` · ${tx.pool.name}` : ''}
                      </div>
                    </div>
                    <div className="num" style={{
                      fontSize: 16, fontWeight: 800,
                      color: positive ? 'var(--fp-primary)' : 'var(--fp-danger)',
                    }}>{positive ? '+' : '−'}${Math.abs(tx.amountMXN)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DesktopShellChrome>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mobile (arcade HUD)
// ─────────────────────────────────────────────────────────────────────────
function CreditsMobile({
  token, locale, selected, setSelected,
  amount, setAmount, note, setNote, recent, error, okMsg, busy, submit, goBack,
}) {
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
            <div>
              <FieldLabelMobile>{t(locale, 'User')}</FieldLabelMobile>
              <UserSearchField
                token={token}
                locale={locale}
                selected={selected}
                onSelect={setSelected}
                onClear={() => setSelected(null)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 130 }}>
                <FieldLabelMobile>{t(locale, 'Amount (MXN)')}</FieldLabelMobile>
                <input
                  type="number" inputMode="numeric" min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={hudInput}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabelMobile>{t(locale, 'Note (optional)')}</FieldLabelMobile>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t(locale, 'e.g. paid late for last pool')}
                  style={hudInput}
                />
              </div>
            </div>

            {error && <HudBanner color="var(--fp-danger)">{error}</HudBanner>}
            {okMsg && <HudBanner color="var(--fp-primary)">✓ {okMsg}</HudBanner>}

            <div style={{ display: 'flex', gap: 8 }}>
              <ArcadeButton size="md" fullWidth onClick={() => submit('grant')} disabled={busy || !selected}>
                {busy ? t(locale, 'SAVING…') : `+ ${t(locale, 'GRANT CREDIT')}`}
              </ArcadeButton>
              <button
                type="button"
                onClick={() => submit('revoke')}
                disabled={busy || !selected}
                style={{
                  padding: '0 16px', background: 'transparent',
                  border: '1px solid color-mix(in srgb, var(--fp-danger) 50%, transparent)',
                  color: 'var(--fp-danger)', clipPath: 'var(--fp-clip-sm)',
                  fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800,
                  letterSpacing: 1, cursor: (busy || !selected) ? 'default' : 'pointer',
                  opacity: (busy || !selected) ? 0.5 : 1,
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
                    }}>{tx.user?.displayName || tx.user?.email || '—'}</div>
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

// ─────────────────────────────────────────────────────────────────────────
// User search field — shared by both layouts (desktop flag flips the styling).
// When a user is chosen it collapses to a "selected" chip with their current
// balance + a Change button; otherwise it's a search input with a result list.
// ─────────────────────────────────────────────────────────────────────────
function UserSearchField({ token, locale, selected, onSelect, onClear, desktop = false }) {
  const { query, setQuery, results, loading, setResults } = useUserSearch(token);
  const [open, setOpen] = useState(false);

  if (selected) {
    return (
      <div style={desktop ? deskSelectedChip : hudSelectedChip}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, color: 'var(--fp-text)',
            fontFamily: desktop ? 'inherit' : 'var(--fp-mono)',
            fontSize: desktop ? 14 : 13,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{selected.displayName}</div>
          <div style={{
            fontSize: desktop ? 12 : 10, color: 'var(--fp-text-dim)',
            fontFamily: 'var(--fp-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {selected.email} · {t(locale, 'Balance')}:{' '}
            <span style={{ color: 'var(--fp-primary)', fontWeight: 800 }}>${selected.balanceMXN} MXN</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { onClear(); setQuery(''); setResults([]); setOpen(false); }}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fp-accent)', fontFamily: 'var(--fp-mono)', fontSize: 11,
            fontWeight: 700, padding: '4px 6px', flexShrink: 0,
          }}
        >{t(locale, 'Change')}</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t(locale, 'Search by name or email…')}
        autoCapitalize="none"
        autoCorrect="off"
        style={desktop ? deskInput : hudInput}
      />
      {open && query.trim().length >= 2 && (
        <div style={desktop ? deskDropdown : hudDropdown}>
          {loading && (
            <div style={dropdownEmpty}>{t(locale, 'Searching…')}</div>
          )}
          {!loading && results.length === 0 && (
            <div style={dropdownEmpty}>{t(locale, 'No users found.')}</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              // onMouseDown (not onClick) so selection fires before the input's
              // onBlur closes the dropdown.
              onMouseDown={() => { onSelect(u); setQuery(''); setResults([]); setOpen(false); }}
              style={dropdownRow}
            >
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--fp-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{u.displayName}</div>
                <div style={{
                  fontSize: 11, color: 'var(--fp-text-muted)', fontFamily: 'var(--fp-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{u.email}</div>
              </div>
              <div style={{
                fontSize: 12, fontWeight: 800, color: 'var(--fp-primary)',
                fontFamily: 'var(--fp-mono)', flexShrink: 0,
              }}>${u.balanceMXN}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── small presentational helpers ─────────────────────────────────────────
function FieldLabelMobile({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
      color: 'var(--fp-text-muted)', marginBottom: 4,
    }}>{String(children).toUpperCase()}</div>
  );
}
function FieldLabelDesktop({ children }) {
  return (
    <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{children}</div>
  );
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
      marginTop: 12, padding: '10px 12px', borderRadius: 10,
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      color, fontSize: 13, wordBreak: 'break-word',
    }}>{children}</div>
  );
}

// ── styles ───────────────────────────────────────────────────────────────
const hudInput = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px',
  background: 'var(--fp-bg2)', border: '1px solid var(--fp-stroke)',
  clipPath: 'var(--fp-clip-sm)', color: 'var(--fp-text)',
  fontFamily: 'var(--fp-mono)', fontSize: 13, outline: 'none',
};
const deskInput = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  background: 'var(--fp-surface-alt)', border: '1px solid var(--fp-stroke)',
  borderRadius: 10, color: 'var(--fp-text)', font: 'inherit', outline: 'none',
};
const hudSelectedChip = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
  background: 'color-mix(in srgb, var(--fp-primary) 12%, transparent)',
  border: '1px solid color-mix(in srgb, var(--fp-primary) 35%, transparent)',
  clipPath: 'var(--fp-clip-sm)',
};
const deskSelectedChip = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
  background: 'color-mix(in srgb, var(--fp-primary) 10%, transparent)',
  border: '1px solid color-mix(in srgb, var(--fp-primary) 30%, transparent)',
  borderRadius: 10,
};
const hudDropdown = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
  background: 'var(--fp-surface)', border: '1px solid var(--fp-stroke-strong)',
  clipPath: 'var(--fp-clip-sm)', maxHeight: 260, overflowY: 'auto',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};
const deskDropdown = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
  background: 'var(--fp-surface)', border: '1px solid var(--fp-stroke-strong)',
  borderRadius: 10, maxHeight: 280, overflowY: 'auto',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};
const dropdownRow = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '9px 12px', background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
};
const dropdownEmpty = {
  padding: '12px', textAlign: 'center', color: 'var(--fp-text-muted)',
  fontFamily: 'var(--fp-mono)', fontSize: 12,
};
