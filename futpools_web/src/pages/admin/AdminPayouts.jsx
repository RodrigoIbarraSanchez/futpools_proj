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
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const winner = pool.winners?.[0];

  const onMark = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/admin/pools/${pool.id}/mark-paid`, { note: note.trim() }, token);
      onMarkedPaid();
    } catch (e) {
      setErr(e?.message || 'Failed to mark paid');
      setBusy(false);
    }
  };

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

          {/* Winner card — biggest visual element. The admin needs the
              email + display name in plain text so they can match it
              against bank transfer records. */}
          {winner ? (
            <div style={{
              padding: 12, marginBottom: 14,
              background: 'color-mix(in srgb, var(--fp-primary) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--fp-primary) 35%, transparent)',
              clipPath: 'var(--fp-clip-sm)',
            }}>
              <div style={{
                fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
                color: 'var(--fp-text-muted)', marginBottom: 4,
              }}>{t(locale, 'WINNER')}</div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
                color: 'var(--fp-text)', marginBottom: 2,
              }}>{winner.displayName}</div>
              <div style={{
                fontFamily: 'var(--fp-mono)', fontSize: 11,
                color: 'var(--fp-primary)',
                userSelect: 'all',  // single-click copies the email
              }}>{winner.email}</div>
              {winner.username && (
                <div style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 10,
                  color: 'var(--fp-text-dim)', marginTop: 2,
                }}>@{winner.username}</div>
              )}
            </div>
          ) : (
            <div style={{
              padding: 12, marginBottom: 14, fontFamily: 'var(--fp-mono)',
              color: 'var(--fp-text-dim)', fontSize: 12,
            }}>{t(locale, 'No winner recorded — check the pool manually.')}</div>
          )}

          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
              color: 'var(--fp-text-muted)', marginBottom: 4,
            }}>{t(locale, 'TRANSFER REFERENCE (OPTIONAL)')}</div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(locale, 'e.g. SPEI ref ABC123')}
              maxLength={500}
              style={arenaInputStyle}
              disabled={busy || !winner}
            />
          </div>

          {err && (
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 11,
              color: 'var(--fp-danger)', marginBottom: 8,
            }}>{err}</div>
          )}

          <ArcadeButton
            size="md"
            fullWidth
            onClick={onMark}
            disabled={busy || !winner}
          >
            {busy ? t(locale, 'MARKING…') : `✓ ${t(locale, 'MARK AS PAID')}`}
          </ArcadeButton>
        </div>
      </HudFrame>
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
