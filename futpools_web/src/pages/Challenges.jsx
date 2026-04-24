/**
 * Challenges feed — lists the current user's 1v1 challenges grouped by tab
 * (received / sent / active / settled). The backend opportunistically settles
 * eligible challenges when this endpoint is hit, so a user simply opening
 * this screen progresses any pending payouts.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import { HudFrame, HudChip, ArcadeButton, IconButton } from '../arena-ui/primitives';

const TABS = [
  { key: 'active',   en: 'ACTIVE',   es: 'ACTIVOS' },
  { key: 'received', en: 'RECEIVED', es: 'RECIBIDOS' },
  { key: 'sent',     en: 'SENT',     es: 'ENVIADOS' },
  { key: 'settled',  en: 'HISTORY',  es: 'HISTORIAL' },
];

export function Challenges() {
  const { token } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/challenges/me?tab=${tab}`, token);
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <AppBackground />

      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--fp-stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <IconButton onClick={() => navigate(-1)}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontSize: 12, letterSpacing: 3,
            fontWeight: 700,
          }}>
            ⚔ {t(locale, 'CHALLENGES')}
          </div>
          <Link to="/challenges/new" style={{ textDecoration: 'none' }}>
            <IconButton>＋</IconButton>
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              style={{
                padding: '6px 10px',
                background: tab === tb.key ? 'var(--fp-primary)' : 'transparent',
                color: tab === tb.key ? 'var(--fp-on-primary)' : 'var(--fp-text-dim)',
                border: `1px solid ${tab === tb.key ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
                clipPath: 'var(--fp-clip-sm)',
                fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >{locale === 'es' ? tb.es : tb.en}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 16px 120px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
            {t(locale, 'Loading…')}
          </div>
        ) : error ? (
          <div style={{ padding: 16, color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 11 }}>{error}</div>
        ) : items.length === 0 ? (
          <EmptyState locale={locale} tab={tab} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((c) => (
              <ChallengeRow key={c._id} challenge={c} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EmptyState({ locale, tab }) {
  const messages = {
    active:   [t(locale, 'No active challenges'),  t(locale, 'Send your first one.')],
    received: [t(locale, 'Nothing to accept'),     t(locale, "You don't have incoming challenges.")],
    sent:     [t(locale, 'No outgoing challenges'), t(locale, 'Tap + to create one.')],
    settled:  [t(locale, 'No history yet'),        t(locale, 'Finished challenges show up here.')],
  };
  const [title, sub] = messages[tab] || messages.active;
  return (
    <HudFrame>
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>⚔</div>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800, letterSpacing: 2,
          color: 'var(--fp-text)', marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)', marginBottom: 14 }}>{sub}</div>
        <Link to="/challenges/new" style={{ textDecoration: 'none' }}>
          <ArcadeButton size="sm">▶ {t(locale, 'NEW CHALLENGE')}</ArcadeButton>
        </Link>
      </div>
    </HudFrame>
  );
}

function ChallengeRow({ challenge, locale }) {
  const fx = challenge.fixture || {};
  const statusMeta = {
    pending:   { label: t(locale, 'PENDING'),   color: 'var(--fp-accent)' },
    accepted:  { label: t(locale, 'LOCKED'),    color: 'var(--fp-primary)' },
    settled:   { label: t(locale, 'SETTLED'),   color: 'var(--fp-gold)' },
    refunded:  { label: t(locale, 'REFUNDED'),  color: 'var(--fp-text-muted)' },
    declined:  { label: t(locale, 'DECLINED'),  color: 'var(--fp-text-muted)' },
    cancelled: { label: t(locale, 'CANCELLED'), color: 'var(--fp-text-muted)' },
  }[challenge.status] || { label: challenge.status, color: 'var(--fp-text-muted)' };

  const opponentName = (challenge.youAre === 'challenger'
    ? challenge.opponent?.username
    : challenge.challenger?.username) || '—';

  const myPick = challenge.youAre === 'challenger' ? challenge.challengerPick : challenge.opponentPick;
  const theirPick = challenge.youAre === 'challenger' ? challenge.opponentPick : challenge.challengerPick;
  const iWon = challenge.status === 'settled' && challenge.winnerUserId
    && String(challenge.winnerUserId) === (challenge.youAre === 'challenger'
      ? String(challenge.challenger?.id)
      : String(challenge.opponent?.id));

  return (
    <Link to={`/challenges/${challenge._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <HudFrame>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <HudChip color={statusMeta.color}>{statusMeta.label}</HudChip>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-muted)',
            }}>{challenge.marketType}</div>
            <div style={{ flex: 1 }} />
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
              color: 'var(--fp-gold)',
            }}>🪙 {challenge.stakeCoins}</div>
          </div>

          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 700,
            letterSpacing: 0.5, marginBottom: 4,
          }}>
            {fx.homeTeam} <span style={{ color: 'var(--fp-text-muted)' }}>vs</span> {fx.awayTeam}
          </div>
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)',
            marginBottom: 8,
          }}>
            {fx.leagueName} · {fx.kickoff ? new Date(fx.kickoff).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : ''}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-muted)' }}>
                {t(locale, 'YOU')}
              </div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800,
                color: 'var(--fp-primary)',
              }}>{pickLabel(challenge.marketType, myPick) || '—'}</div>
            </div>
            <div style={{ fontFamily: 'var(--fp-display)', fontSize: 12, color: 'var(--fp-text-muted)' }}>vs</div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-muted)' }}>
                @{opponentName}
              </div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800,
                color: 'var(--fp-hot)',
              }}>{pickLabel(challenge.marketType, theirPick) || '—'}</div>
            </div>
          </div>

          {challenge.status === 'settled' && (
            <div style={{
              marginTop: 10, padding: '6px 10px',
              background: iWon
                ? 'color-mix(in srgb, var(--fp-primary) 12%, transparent)'
                : 'color-mix(in srgb, var(--fp-danger) 12%, transparent)',
              clipPath: 'var(--fp-clip-sm)',
              fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
              color: iWon ? 'var(--fp-primary)' : 'var(--fp-danger)',
              textAlign: 'center',
            }}>
              {iWon
                ? tFormat(locale, 'YOU WON · +{n} COINS', { n: Math.floor(challenge.stakeCoins * 2 * (1 - challenge.rakePercent / 100)) })
                : t(locale, 'YOU LOST')}
            </div>
          )}
        </div>
      </HudFrame>
    </Link>
  );
}

/** Human-friendly pick label for each market type. */
export function pickLabel(marketType, pick) {
  if (!pick) return null;
  if (marketType === '1X2') return pick === '1' ? 'HOME' : pick === '2' ? 'AWAY' : 'DRAW';
  return pick;
}
