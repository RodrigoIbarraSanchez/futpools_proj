/**
 * Challenge detail — actions depend on the viewer's role and the challenge's
 * status:
 *
 *   viewer=challenger, status=pending   → Cancel + Share link
 *   viewer=opponent,   status=pending   → Accept (pick opposite) + Decline
 *   *,                 status=accepted  → Show locked picks, watch for settlement
 *   *,                 status=settled   → Winner highlight + payout
 *   *,                 status=refunded  → "Uncovered outcome" copy
 *   *,                 status=declined|cancelled → dead state
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import { HudFrame, HudChip, ArcadeButton, IconButton, TeamCrest } from '../arena-ui/primitives';
import { pickLabel } from './Challenges';

const PICK_OPTIONS = {
  '1X2':  [{ k: '1', l: 'HOME' }, { k: 'X', l: 'DRAW' }, { k: '2', l: 'AWAY' }],
  'OU25': [{ k: 'OVER', l: 'OVER 2.5' }, { k: 'UNDER', l: 'UNDER 2.5' }],
  'BTTS': [{ k: 'YES', l: 'YES' }, { k: 'NO', l: 'NO' }],
};

export function ChallengeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, fetchUser } = useAuth();
  const { locale } = useLocale();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [opponentPick, setOpponentPick] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id || !token) return;
    setLoading(true); setError(null);
    try { setC(await api.get(`/challenges/${id}`, token)); }
    catch (e) { setError(e.message); setC(null); }
    finally { setLoading(false); }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async () => {
    if (!opponentPick) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post(`/challenges/${id}/accept`, { opponentPick }, token);
      setC(res);
      await fetchUser();
    } catch (e) {
      const msg = e.message || 'Failed';
      if (/INSUFFICIENT_BALANCE/.test(msg)) setError(t(locale, 'Insufficient balance — visit the shop to recharge.'));
      else if (/DUPLICATE_PICK/.test(msg)) setError(t(locale, 'Pick must differ from the challenger.'));
      else if (/FIXTURE_STARTED/.test(msg)) setError(t(locale, 'Fixture already started.'));
      else if (/ALREADY_CLAIMED/.test(msg)) {
        // Slot raced out from under us — refresh so the UI reflects the new state.
        setError(t(locale, 'Someone else just claimed this challenge.'));
        await load();
      }
      else if (/SELF_ACCEPT/.test(msg)) setError(t(locale, "You can't accept your own challenge."));
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/challenges/${id}/decline`, {}, token);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm(t(locale, 'Cancel this challenge? Your coins will be refunded.'))) return;
    setBusy(true); setError(null);
    try {
      await api.delete(`/challenges/${id}`, token);
      await fetchUser();
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleShare = async () => {
    if (!c?.code) return;
    // Use the bare branded origin (futpools.com in prod, localhost:5173 in
    // dev). The static-site `_redirects` file proxies /c/* to the backend's
    // og.js route, so WhatsApp/Telegram still scrape rich previews while the
    // visible URL stays on futpools.com. Identical strategy to
    // PoolDetail.ShareButton.
    const shareOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${shareOrigin}/c/${c.code}`;
    // Mobile-only native share; pass ONLY `url` so no target can concat a
    // `title`/`text` field onto it and produce a mangled link. Desktop always
    // copies to clipboard for predictable UX.
    const isMobile = typeof navigator !== 'undefined'
      && typeof navigator.share === 'function'
      && ((navigator.userAgentData && navigator.userAgentData.mobile === true)
        || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''));
    try {
      if (isMobile) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      try { window.prompt('Copy this link', url); } catch { /* noop */ }
    }
  };

  if (loading) {
    return (
      <>
        <AppBackground />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
          {t(locale, 'Loading…').toUpperCase()}
        </div>
      </>
    );
  }

  if (!c) {
    return (
      <>
        <AppBackground />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
          CHALLENGE NOT FOUND
        </div>
      </>
    );
  }

  const fx = c.fixture || {};
  const statusMeta = {
    pending:   { label: t(locale, 'PENDING'),   color: 'var(--fp-accent)' },
    accepted:  { label: t(locale, 'LOCKED'),    color: 'var(--fp-primary)' },
    settled:   { label: t(locale, 'SETTLED'),   color: 'var(--fp-gold)' },
    refunded:  { label: t(locale, 'REFUNDED'),  color: 'var(--fp-text-muted)' },
    declined:  { label: t(locale, 'DECLINED'),  color: 'var(--fp-text-muted)' },
    cancelled: { label: t(locale, 'CANCELLED'), color: 'var(--fp-text-muted)' },
  }[c.status] || { label: c.status, color: 'var(--fp-text-muted)' };

  const iWon = c.status === 'settled' && c.winnerUserId
    && String(c.winnerUserId) === (c.youAre === 'challenger'
      ? String(c.challenger?.id)
      : String(c.opponent?.id));
  const payout = Math.floor(c.stakeCoins * 2 * (1 - (c.rakePercent || 10) / 100));

  return (
    <>
      <AppBackground />

      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--fp-stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate(-1)}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 2,
            color: 'var(--fp-text-muted)',
          }}>[ CHALLENGE · {c.code} ]</div>
          <div style={{ width: 32 }} />
        </div>
      </div>

      <div style={{ padding: '14px 16px 140px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <HudChip color={statusMeta.color}>{statusMeta.label}</HudChip>
          <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
            {c.marketType}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 900,
            color: 'var(--fp-gold)',
          }}>🪙 {c.stakeCoins}</div>
        </div>

        {/* Fixture */}
        <HudFrame>
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <TeamCrest name={fx.homeTeam} logoURL={fx.homeLogo} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--fp-display)', fontSize: 15, fontWeight: 800 }}>
                  {fx.homeTeam} <span style={{ color: 'var(--fp-text-muted)', margin: '0 4px' }}>vs</span> {fx.awayTeam}
                </div>
                <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
                  {fx.leagueName}
                </div>
              </div>
              <TeamCrest name={fx.awayTeam} logoURL={fx.awayLogo} size={36} />
            </div>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-accent)',
              textAlign: 'center', marginTop: 4,
            }}>
              {fx.kickoff ? new Date(fx.kickoff).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }) : ''}
            </div>
          </div>
        </HudFrame>

        {/* Picks faceoff */}
        <div style={{ height: 10 }} />
        <HudFrame>
          <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <PickColumn
              label={c.challenger?.displayName || `@${c.challenger?.username || '—'}`}
              isMe={c.youAre === 'challenger'}
              pick={pickLabel(c.marketType, c.challengerPick)}
              winner={c.status === 'settled' && String(c.winnerUserId) === String(c.challenger?.id)}
            />
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 900,
              color: 'var(--fp-text-muted)',
            }}>VS</div>
            <PickColumn
              label={c.opponent?.displayName
                || (c.opponent?.username ? `@${c.opponent.username}` : t(locale, 'OPEN SLOT'))}
              isMe={c.youAre === 'opponent'}
              isOpen={c.isOpen}
              pick={c.opponentPick
                ? pickLabel(c.marketType, c.opponentPick)
                : (c.isOpen ? t(locale, 'WAITING') : t(locale, 'PENDING'))}
              winner={c.status === 'settled' && String(c.winnerUserId) === String(c.opponent?.id)}
            />
          </div>
        </HudFrame>

        {/* Action zone — depends on role + status + open/directed */}
        <div style={{ height: 12 }} />

        {/* Directed received pending: accept picker (with decline option) */}
        {c.youAre === 'opponent' && c.status === 'pending' && (
          <ClaimPicker
            locale={locale}
            challengerPick={c.challengerPick}
            marketType={c.marketType}
            stakeCoins={c.stakeCoins}
            opponentPick={opponentPick}
            setOpponentPick={setOpponentPick}
            busy={busy}
            onAccept={handleAccept}
            onDecline={handleDecline}
            showDecline
          />
        )}

        {/* Open + viewer is a third party (not the challenger): same picker
            but no Decline (they didn't receive a directed invite — there's
            nothing to decline). Self-accept is blocked by the backend; we
            also gate the UI so the challenger never sees this block. */}
        {c.isOpen && c.youAre === null && (
          <ClaimPicker
            locale={locale}
            challengerPick={c.challengerPick}
            marketType={c.marketType}
            stakeCoins={c.stakeCoins}
            opponentPick={opponentPick}
            setOpponentPick={setOpponentPick}
            busy={busy}
            onAccept={handleAccept}
            showDecline={false}
            heading={t(locale, 'CLAIM THIS CHALLENGE')}
          />
        )}

        {/* Sent pending: share + cancel. Copy + emphasis differ between
            directed (we're waiting for a known person) and open (we're
            waiting for any link recipient). */}
        {c.youAre === 'challenger' && c.status === 'pending' && (
          <HudFrame glow={c.isOpen ? 'var(--fp-accent)' : undefined}>
            <div style={{ padding: 14 }}>
              <div style={{
                fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 2,
                color: c.isOpen ? 'var(--fp-accent)' : 'var(--fp-primary)', marginBottom: 8,
              }}>
                ◆ {c.isOpen
                  ? t(locale, 'OPEN — SHARE THE LINK')
                  : tFormat(locale, 'WAITING FOR @{user}', { user: (c.opponent?.username || '—').toUpperCase() })}
              </div>
              {c.isOpen && (
                <div style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 10, lineHeight: 1.5,
                  color: 'var(--fp-text-muted)', marginBottom: 10,
                }}>
                  {t(locale, 'The first person to open this link and accept will become your opponent.')}
                </div>
              )}
              <ArcadeButton size="lg" fullWidth onClick={handleShare}>
                {copied ? t(locale, 'LINK COPIED ✓') : `▶ ${t(locale, 'SHARE LINK')}`}
              </ArcadeButton>
              <div style={{ height: 8 }} />
              <button
                type="button"
                disabled={busy}
                onClick={handleCancel}
                style={{
                  width: '100%', padding: 10,
                  background: 'transparent',
                  border: '1px solid color-mix(in srgb, var(--fp-danger) 45%, transparent)',
                  clipPath: 'var(--fp-clip-sm)',
                  color: 'var(--fp-danger)',
                  fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
                  cursor: 'pointer',
                }}
              >{t(locale, 'CANCEL CHALLENGE')}</button>
            </div>
          </HudFrame>
        )}

        {/* Accepted: waiting for settlement */}
        {c.status === 'accepted' && (
          <div style={{
            padding: 14,
            background: 'color-mix(in srgb, var(--fp-primary) 8%, var(--fp-surface) 92%)',
            border: '1px solid color-mix(in srgb, var(--fp-primary) 40%, transparent)',
            clipPath: 'var(--fp-clip-sm)',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: 'var(--fp-primary)', marginBottom: 4 }}>
              🔒 {t(locale, 'PICKS LOCKED')}
            </div>
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)' }}>
              {tFormat(locale, 'Winner takes {n} coins.', { n: payout })}
            </div>
          </div>
        )}

        {/* Settled */}
        {c.status === 'settled' && (
          <div style={{
            padding: 16,
            background: iWon
              ? 'color-mix(in srgb, var(--fp-primary) 14%, transparent)'
              : 'color-mix(in srgb, var(--fp-danger) 14%, transparent)',
            border: `1px solid ${iWon ? 'var(--fp-primary)' : 'var(--fp-danger)'}`,
            clipPath: 'var(--fp-clip-sm)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 4 }}>{iWon ? '🏆' : '💀'}</div>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 900, letterSpacing: 2,
              color: iWon ? 'var(--fp-primary)' : 'var(--fp-danger)',
            }}>
              {iWon ? tFormat(locale, 'YOU WON · +{n} COINS', { n: payout }) : t(locale, 'YOU LOST')}
            </div>
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)', marginTop: 4 }}>
              {tFormat(locale, 'Outcome: {o}', { o: pickLabel(c.marketType, c.outcomeKey) || c.outcomeKey })}
            </div>
          </div>
        )}

        {c.status === 'refunded' && (
          <div style={{
            padding: 14,
            background: 'color-mix(in srgb, var(--fp-text-muted) 8%, var(--fp-surface) 92%)',
            border: '1px solid var(--fp-stroke)',
            clipPath: 'var(--fp-clip-sm)',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: 'var(--fp-text)', marginBottom: 4 }}>
              {t(locale, 'BOTH REFUNDED')}
            </div>
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
              {tFormat(locale, 'Outcome {o} — neither pick matched, no rake.', { o: pickLabel(c.marketType, c.outcomeKey) || c.outcomeKey })}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 12, padding: 10,
            background: 'color-mix(in srgb, var(--fp-danger) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--fp-danger) 45%, transparent)',
            clipPath: 'var(--fp-clip-sm)',
            fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-danger)',
          }}>{error}</div>
        )}
      </div>
    </>
  );
}

function PickColumn({ label, isMe, isOpen, pick, winner }) {
  // Open-slot column gets the accent palette to read as a "claim me" badge
  // rather than a player. The label already says "OPEN SLOT" in this case.
  const labelColor = isOpen ? 'var(--fp-accent)'
    : isMe ? 'var(--fp-primary)'
    : 'var(--fp-text-muted)';
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 9, color: labelColor,
        letterSpacing: 1, marginBottom: 4,
      }}>{isMe ? 'YOU' : label}</div>
      <div style={{
        fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 900,
        color: winner ? 'var(--fp-primary)'
          : isOpen ? 'var(--fp-accent)'
          : 'var(--fp-text)',
        textShadow: winner ? '0 0 16px rgba(33,226,140,0.6)' : 'none',
      }}>
        {pick || '—'}
      </div>
    </div>
  );
}

// Shared accept-picker used for both directed-received and open-claim flows.
// Same visual; only the optional Decline button differs.
function ClaimPicker({
  locale, challengerPick, marketType, stakeCoins,
  opponentPick, setOpponentPick,
  busy, onAccept, onDecline, showDecline, heading,
}) {
  return (
    <HudFrame>
      <div style={{ padding: 14 }}>
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 2,
          color: 'var(--fp-primary)', marginBottom: 8,
        }}>◆ {heading || t(locale, 'PICK YOUR SIDE')}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(PICK_OPTIONS[marketType] || []).map((opt) => {
            const taken = opt.k === challengerPick;
            const active = opponentPick === opt.k;
            return (
              <button
                key={opt.k}
                type="button"
                disabled={taken}
                onClick={() => setOpponentPick(opt.k)}
                style={{
                  flex: 1, padding: '12px 4px',
                  background: taken ? 'var(--fp-bg2)' : active ? 'var(--fp-primary)' : 'var(--fp-surface)',
                  color: taken ? 'var(--fp-text-faint)' : active ? 'var(--fp-on-primary)' : 'var(--fp-text-dim)',
                  border: `1px solid ${active ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
                  clipPath: 'var(--fp-clip-sm)',
                  cursor: taken ? 'not-allowed' : 'pointer',
                  opacity: taken ? 0.45 : 1,
                  fontFamily: 'var(--fp-display)',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900 }}>{opt.k}</div>
                <div style={{ fontSize: 9, opacity: 0.75, fontFamily: 'var(--fp-mono)' }}>
                  {taken ? t(locale, 'TAKEN') : opt.l}
                </div>
              </button>
            );
          })}
        </div>
        <ArcadeButton
          size="lg"
          fullWidth
          disabled={!opponentPick || busy}
          onClick={onAccept}
        >
          {busy ? t(locale, 'ACCEPTING…') : `▶ ${tFormat(locale, 'ACCEPT · {n} COINS', { n: stakeCoins })}`}
        </ArcadeButton>
        {showDecline && (
          <>
            <div style={{ height: 8 }} />
            <button
              type="button"
              disabled={busy}
              onClick={onDecline}
              style={{
                width: '100%', padding: 10,
                background: 'transparent',
                border: '1px solid var(--fp-stroke)',
                clipPath: 'var(--fp-clip-sm)',
                color: 'var(--fp-text-muted)',
                fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
                cursor: 'pointer',
              }}
            >{t(locale, 'DECLINE')}</button>
          </>
        )}
      </div>
    </HudFrame>
  );
}

// ────────────────────────────────────────────────────────────────────
// Deep-link resolver for `/c/:code`. Auth users resolve to the detail;
// unauth users get pushed to /login with a return hint. Matches the pool
// invite pattern.

// Same sanitizer the pool invite resolver uses — tolerates trailing garbage
// from mangled shares. Invite alphabet is `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
const CHALLENGE_ALPHABET_RE = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
function sanitizeChallengeCode(raw) {
  if (!raw) return '';
  const upper = decodeURIComponent(String(raw)).toUpperCase();
  const matches = upper.match(CHALLENGE_ALPHABET_RE) || [];
  return matches.slice(0, 8).join('');
}

export function ChallengeInviteResolver() {
  const navigate = useNavigate();
  const { token, ready } = useAuth();
  const rawCode = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
  const code = sanitizeChallengeCode(rawCode);

  useEffect(() => {
    if (!ready) return;
    if (!code || code.length !== 8) { navigate('/', { replace: true }); return; }
    if (!token) { navigate('/login', { replace: true }); return; }
    let cancel = false;
    api.get(`/challenges/code/${code}`, token)
      .then((c) => { if (!cancel && c?._id) navigate(`/challenges/${c._id}`, { replace: true }); })
      .catch(() => { if (!cancel) navigate('/', { replace: true }); });
    return () => { cancel = true; };
  }, [code, navigate, token, ready]);

  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
      RESOLVING CHALLENGE…
    </div>
  );
}
