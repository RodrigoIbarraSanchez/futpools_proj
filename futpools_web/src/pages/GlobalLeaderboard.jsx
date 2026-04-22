import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { HudFrame, DivisionBadge, IconButton } from '../arena-ui/primitives';
import { TIER_TO_DIVISION } from '../rank/catalog';

export function GlobalLeaderboard() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api.get('/leaderboard/global?top=100')
      .then((res) => {
        if (cancel) return;
        setRows(res?.leaderboard || []);
        setError(null);
      })
      .catch((e) => { if (!cancel) setError(e.message || 'error'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  return (
    <>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--fp-stroke)',
        display: 'flex', alignItems: 'center',
      }}>
        <Link to="/account" style={{ textDecoration: 'none' }}>
          <IconButton>←</IconButton>
        </Link>
        <div style={{
          flex: 1, textAlign: 'center',
          fontFamily: 'var(--fp-display)', fontSize: 13, letterSpacing: 3,
          fontWeight: 900, color: 'var(--fp-text)',
        }}>
          {t(locale, 'GLOBAL RANK')}
        </div>
        <div style={{ width: 32 }} />
      </div>

      {loading && rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 11 }}>
          {t(locale, 'Loading…')}
        </div>
      ) : error ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 11 }}>
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 36, fontWeight: 900,
            color: 'var(--fp-primary)', opacity: 0.4, marginBottom: 10,
          }}>◆</div>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 900,
            letterSpacing: 3, color: 'var(--fp-text)', marginBottom: 6,
          }}>{t(locale, 'NO RANKINGS YET')}</div>
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11,
            color: 'var(--fp-text-dim)',
          }}>{t(locale, 'Play a pool to appear here.')}</div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px 120px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row) => (
            <Row key={row.userId} row={row} mine={row.userId === user?._id} />
          ))}
        </div>
      )}
    </>
  );
}

function Row({ row, mine }) {
  const division = TIER_TO_DIVISION[row.tier] || 'silver';
  const rankColor = row.rank <= 3 ? 'var(--fp-gold)' : 'var(--fp-text-muted)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: mine
        ? 'color-mix(in srgb, var(--fp-primary) 14%, transparent)'
        : 'var(--fp-surface)',
      border: `1px solid ${mine ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
      clipPath: 'var(--fp-clip-sm)',
    }}>
      <div style={{
        width: 44, fontFamily: 'var(--fp-mono)', fontSize: 11, fontWeight: 800,
        letterSpacing: 1, color: rankColor,
      }}>#{row.rank}</div>
      <DivisionBadge tier={division} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 700,
          color: 'var(--fp-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{row.displayName}</div>
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 9,
          color: 'var(--fp-text-dim)',
        }}>@{row.username}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
          color: 'var(--fp-primary)',
        }}>{row.rating}</div>
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 9,
          color: 'var(--fp-text-muted)',
        }}>{row.poolsWon} W · {row.poolsPlayed} P</div>
      </div>
    </div>
  );
}
