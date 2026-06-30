import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { t, tFormat } from '../../i18n/translations';
import { useSafeBack } from '../../lib/safeBack';
import { AppBackground } from '../../arena-ui/AppBackground';
import {
  HudFrame, ArcadeButton, IconButton, SectionLabel, arenaInputStyle,
} from '../../arena-ui/primitives';

/// Admin-only dashboard listing pools that have been settled (winner
/// computed) but not yet paid out. simple_version doesn't use Stripe
/// Connect — bank transfers happen off-band, and this page is the
/// admin's source of truth for "what do I owe and to whom".
export function AdminPayouts() {
  const navigate = useNavigate();
  const goBack = useSafeBack('/account');
  const { token } = useAuth();
  const { locale } = useLocale();
  const [pools, setPools] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = await api.get('/admin/payouts', token);
      setPools(list || []);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Could not load payouts');
      setPools([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <AppBackground />
      <div style={{ padding: '14px 16px 120px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <IconButton onClick={goBack}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 14,
          }}>{t(locale, 'PENDING PAYOUTS')}</div>
          <div style={{ width: 32 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <SectionLabel color="var(--fp-primary)">
            {pools == null
              ? t(locale, 'LOADING…')
              : tFormat(locale, '{n} POOLS WAITING FOR PAYOUT', { n: pools.length })}
          </SectionLabel>
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: 10,
            background: 'color-mix(in srgb, var(--fp-danger) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--fp-danger) 40%, transparent)',
            clipPath: 'var(--fp-clip-sm)',
            color: 'var(--fp-danger)',
            fontFamily: 'var(--fp-mono)', fontSize: 12,
          }}>{error}</div>
        )}

        {pools && pools.length === 0 && !error && (
          <HudFrame>
            <div style={{
              padding: 32, textAlign: 'center',
              color: 'var(--fp-text-muted)',
              fontFamily: 'var(--fp-mono)', fontSize: 12,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <div>{t(locale, 'No pending payouts. All settled pools are paid.')}</div>
            </div>
          </HudFrame>
        )}

        {pools && pools.map((pool) => (
          <PayoutCard key={pool.id} pool={pool} token={token} locale={locale} onMarkedPaid={load} />
        ))}
      </div>
    </>
  );
}

function PayoutCard({ pool, token, locale, onMarkedPaid }) {
  const isLadder = pool.poolType === 'prize_ladder';
  const winners = pool.winners || [];

  return (
    <div style={{ marginBottom: 12 }}>
      <HudFrame>
        <div style={{ padding: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6,
          }}>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
              letterSpacing: 1, textTransform: 'uppercase',
              color: 'var(--fp-text)', flex: 1,
            }}>{pool.name}</div>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1.5,
              color: 'var(--fp-text-muted)',
            }}>
              {pool.entriesCount} {t(locale, 'JUGADORES').toUpperCase()}
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14,
          }}>
            <Stat label={t(locale, 'PRIZE TO PAY')} value={`$${pool.prizeMXN} MXN`} accent="var(--fp-gold)" />
            <Stat label={t(locale, 'SETTLED')} value={formatDate(pool.settledAt)} />
          </div>

          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
            color: 'var(--fp-text-muted)', marginBottom: 8,
          }}>{tFormat(locale, '{n} WINNERS TO PAY', { n: winners.length })}</div>

          {/* Each winner is paid individually. Multiple winning entries from
              the SAME user are already grouped into one row by the backend. */}
          {winners.length === 0 ? (
            <PoolLevelMark pool={pool} token={token} locale={locale} onMarkedPaid={onMarkedPaid} isLadder={isLadder} />
          ) : (
            winners.map((w) => (
              <WinnerRow
                key={w.userId || w.email}
                pool={pool} winner={w} token={token} locale={locale}
                isLadder={isLadder} onMarkedPaid={onMarkedPaid}
              />
            ))
          )}
        </div>
      </HudFrame>
    </div>
  );
}

/// A single winner (grouped by user) with its own reference field + mark-paid
/// button — or a "paid" badge once done. This is the per-winner unit the admin
/// transfers and clears one at a time.
function WinnerRow({ pool, winner, token, locale, isLadder, onMarkedPaid }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const paid = !!winner.paidAt;

  const onMark = async () => {
    if (busy || !winner.userId) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/admin/pools/${pool.id}/winners/${winner.userId}/mark-paid`, { note: note.trim() }, token);
      onMarkedPaid();
    } catch (e) {
      setErr(e?.message || 'Failed to mark paid');
      setBusy(false);
    }
  };

  return (
    <div style={{
      padding: 12, marginBottom: 10,
      background: paid
        ? 'color-mix(in srgb, var(--fp-text-muted) 8%, transparent)'
        : 'color-mix(in srgb, var(--fp-primary) 10%, transparent)',
      border: `1px solid ${paid
        ? 'color-mix(in srgb, var(--fp-text-muted) 30%, transparent)'
        : 'color-mix(in srgb, var(--fp-primary) 30%, transparent)'}`,
      clipPath: 'var(--fp-clip-sm)',
      opacity: paid ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 15, fontWeight: 800,
            color: 'var(--fp-text)',
          }}>{winner.displayName}</div>
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-primary)',
            userSelect: 'all', wordBreak: 'break-all',
          }}>{winner.email}</div>
          {isLadder && (
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)', marginTop: 2,
            }}>
              {tFormat(locale, '{n} aciertos', { n: winner.score })}
              {winner.entriesCount > 1 && ` · ${tFormat(locale, '{n} entradas', { n: winner.entriesCount })}`}
            </div>
          )}
        </div>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 18, fontWeight: 900,
          color: 'var(--fp-gold)', whiteSpace: 'nowrap',
        }}>${winner.prizeMXN} MXN</div>
      </div>

      <PayoutDetails payout={winner.payout} locale={locale} />

      {paid ? (
        <div style={{
          marginTop: 10, padding: '8px 10px', clipPath: 'var(--fp-clip-sm)',
          background: 'color-mix(in srgb, var(--fp-primary) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fp-primary) 35%, transparent)',
          fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-primary)',
        }}>
          ✓ {tFormat(locale, 'Paid {date}', { date: formatDate(winner.paidAt) })}
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(locale, 'Transfer reference (optional)')}
            maxLength={500}
            style={arenaInputStyle}
            disabled={busy}
          />
          {err && (
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 11,
              color: 'var(--fp-danger)', margin: '6px 0',
            }}>{err}</div>
          )}
          <div style={{ height: 8 }} />
          <ArcadeButton
            size="md"
            fullWidth
            onClick={onMark}
            disabled={busy || !winner.userId}
          >
            {busy ? t(locale, 'MARKING…') : `✓ ${t(locale, 'MARK AS PAID')}`}
          </ArcadeButton>
        </div>
      )}
    </div>
  );
}

/// Fallback for pools with no individual winners to pay (e.g. a ladder where
/// nobody reached a paying tier). Keeps a single pool-level "mark paid" so the
/// pool can still be cleared off the dashboard.
function PoolLevelMark({ pool, token, locale, onMarkedPaid, isLadder }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const onMark = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/admin/pools/${pool.id}/mark-paid`, {}, token);
      onMarkedPaid();
    } catch (e) {
      setErr(e?.message || 'Failed to mark paid');
      setBusy(false);
    }
  };
  return (
    <div>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 12, color: 'var(--fp-text-dim)', padding: '4px 0 10px',
      }}>
        {isLadder
          ? t(locale, 'No one reached a paying tier — nothing to transfer.')
          : t(locale, 'No winner recorded — check the pool manually.')}
      </div>
      {err && (
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-danger)', marginBottom: 8,
        }}>{err}</div>
      )}
      <ArcadeButton size="md" fullWidth onClick={onMark} disabled={busy}>
        {busy ? t(locale, 'MARKING…') : `✓ ${t(locale, 'MARK AS PAID')}`}
      </ArcadeButton>
    </div>
  );
}

/// Renders a winner's banking / PayPal details so the admin knows exactly
/// where to send the transfer. Values are user-select:all so a single click
/// copies them into a banking app. Shows a clear warning when the winner
/// hasn't filled in any payout info yet.
function PayoutDetails({ payout, locale }) {
  const p = payout || {};
  const hasBank = p.clabe || p.accountNumber || p.accountHolder || p.bankName;
  const hasPaypal = p.paypalEmail;

  if (!hasBank && !hasPaypal) {
    return (
      <div style={{
        marginTop: 8, padding: '8px 10px',
        background: 'color-mix(in srgb, var(--fp-danger) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--fp-danger) 35%, transparent)',
        clipPath: 'var(--fp-clip-sm)',
        fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-danger)',
      }}>
        {t(locale, 'No banking info on file — ask this winner to add it in Edit profile.')}
      </div>
    );
  }

  const country = (p.country || 'MX').toUpperCase();
  return (
    <div style={{
      marginTop: 8, padding: '8px 10px',
      background: 'var(--fp-bg2)', clipPath: 'var(--fp-clip-sm)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <Row label={t(locale, 'COUNTRY')} value={country} />
      {p.accountHolder ? <Row label={t(locale, 'HOLDER')} value={p.accountHolder} /> : null}
      {p.bankName ? <Row label={t(locale, 'BANK')} value={p.bankName} /> : null}
      {p.clabe ? <Row label={t(locale, 'CLABE')} value={p.clabe} mono /> : null}
      {p.accountNumber ? <Row label={t(locale, 'ACCOUNT')} value={p.accountNumber} mono /> : null}
      {p.paypalEmail ? <Row label={t(locale, 'PAYPAL')} value={p.paypalEmail} /> : null}
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1, minWidth: 56,
        color: 'var(--fp-text-muted)',
      }}>{label}</div>
      <div style={{
        flex: 1,
        fontFamily: mono ? 'var(--fp-mono)' : 'var(--fp-body)', fontSize: 12,
        color: 'var(--fp-text)', userSelect: 'all', wordBreak: 'break-all',
      }}>{value}</div>
    </div>
  );
}

function Stat({ label, value, accent = 'var(--fp-text)' }) {
  return (
    <div style={{
      padding: 10,
      background: 'var(--fp-bg2)',
      clipPath: 'var(--fp-clip-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
        color: 'var(--fp-text-muted)', marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
        color: accent,
      }}>{value}</div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
