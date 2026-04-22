import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import {
  HudFrame, ArcadeButton, ArenaLabel, arenaInputStyle, IconButton, SectionLabel,
  DivisionBadge, XpBar,
} from '../arena-ui/primitives';
import {
  TIER_TO_DIVISION, TIER_NAMES, ACHIEVEMENTS, progressInTier,
} from '../rank/catalog';

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function Account() {
  const { user, token, logout, updateDisplayName } = useAuth();
  const { locale } = useLocale();
  const [showEditName, setShowEditName] = useState(false);
  const [editName, setEditName] = useState(user?.displayName || '');
  const [myPools, setMyPools] = useState([]);
  const [rankSummary, setRankSummary] = useState(null);

  const displayName = (user?.displayName || '').trim() || user?.email || 'Player';
  const username = user?.username || (user?.email?.split('@')[0] ?? 'player');
  const balance = user?.balance ?? 0;

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    Promise.all([
      api.get('/quinielas/mine/created', token).catch(() => []),
      api.get('/leaderboard/me', token).catch(() => null),
    ]).then(([pools, rank]) => {
      if (cancel) return;
      setMyPools(pools || []);
      setRankSummary(rank);
    });
    return () => { cancel = true; };
  }, [token]);

  const handleSave = async () => {
    await updateDisplayName(editName);
    setShowEditName(false);
  };

  const unlockedCodes = new Set((rankSummary?.achievements || []).map(a => a.code));

  return (
    <>
      {/* Top-right settings */}
      <div style={{
        padding: '14px 16px 0',
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <Link to="/settings" style={{ textDecoration: 'none' }}>
          <IconButton>⚙</IconButton>
        </Link>
      </div>

      {/* Hero — identity block */}
      <div style={{ padding: '12px 16px 16px', textAlign: 'center' }}>
        <div style={{
          width: 76, height: 76, margin: '0 auto 12px',
          background: 'var(--fp-surface-alt)',
          border: '1px solid var(--fp-stroke-strong)',
          clipPath: 'var(--fp-clip)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--fp-display)', fontSize: 30, fontWeight: 800,
          color: 'var(--fp-text)',
        }}>{initials(displayName)}</div>

        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 20, fontWeight: 800,
          letterSpacing: 0.5, color: 'var(--fp-text)',
        }}>{displayName}</div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          marginTop: 2,
        }}>
          <span style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 1,
            color: 'var(--fp-text-muted)',
          }}>@{username}</span>
          <button
            type="button"
            onClick={() => { setEditName(displayName); setShowEditName(true); }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--fp-primary)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >✎</button>
        </div>

        {user?.email && (
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 11,
            color: 'var(--fp-text-dim)', marginTop: 6,
          }}>{user.email}</div>
        )}
      </div>

      {/* Rank hero */}
      <div style={{ padding: '0 16px 10px' }}>
        <RankHero summary={rankSummary} locale={locale} />
      </div>

      {/* Stats grid */}
      <div style={{ padding: '0 16px 10px' }}>
        <StatsGrid summary={rankSummary} locale={locale} />
      </div>

      {/* Go to global leaderboard */}
      <div style={{ padding: '0 16px 14px' }}>
        <Link to="/leaderboard" style={{ textDecoration: 'none' }}>
          <HudFrame>
            <div style={{
              padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 800,
                color: 'var(--fp-primary)',
              }}>◆</span>
              <span style={{
                flex: 1,
                fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 800,
                letterSpacing: 2, color: 'var(--fp-text)',
              }}>
                {t(locale, 'VIEW GLOBAL LEADERBOARD')}
              </span>
              <span style={{
                fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
                color: 'var(--fp-primary)',
              }}>›</span>
            </div>
          </HudFrame>
        </Link>
      </div>

      {/* Balance → Shop */}
      <div style={{ padding: '0 16px 14px' }}>
        <Link to="/shop" style={{ textDecoration: 'none' }}>
          <HudFrame bg="linear-gradient(90deg, color-mix(in srgb, var(--fp-gold) 15%, transparent), var(--fp-surface) 60%)">
            <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, var(--fp-gold), #B88A1F)',
                boxShadow: '0 0 10px rgba(255,209,102,0.5)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
                  color: 'var(--fp-text-muted)',
                }}>{t(locale, 'BALANCE')}</div>
                <div style={{
                  fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 800,
                  color: 'var(--fp-gold)', letterSpacing: 0.5,
                }}>
                  {Number(balance).toLocaleString()} COINS
                </div>
              </div>
              <ArcadeButton size="sm" variant="accent">+ TOP UP</ArcadeButton>
            </div>
          </HudFrame>
        </Link>
      </div>

      {/* Achievements */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ marginBottom: 8 }}><SectionLabel>{t(locale, 'ACHIEVEMENTS')}</SectionLabel></div>
        <AchievementsGrid unlockedCodes={unlockedCodes} locale={locale} />
      </div>

      {/* My created pools */}
      {myPools.length > 0 && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ marginBottom: 8 }}><SectionLabel>{t(locale, 'MY CREATED POOLS')}</SectionLabel></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myPools.map((p) => (
              <Link key={p._id} to={`/pool/${p._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <HudFrame>
                  <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 700,
                        letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--fp-text)',
                      }}>{p.name}</div>
                      <div style={{
                        display: 'flex', gap: 6, marginTop: 4,
                        fontFamily: 'var(--fp-mono)', fontSize: 10,
                      }}>
                        {p.inviteCode && (
                          <span style={{ color: 'var(--fp-primary)', fontWeight: 700, letterSpacing: 1.5 }}>{p.inviteCode}</span>
                        )}
                        {p.visibility && (
                          <span style={{ color: 'var(--fp-text-muted)' }}>· {p.visibility.toUpperCase()}</span>
                        )}
                        {typeof p.entriesCount === 'number' && (
                          <span style={{ color: 'var(--fp-text-muted)' }}>· {p.entriesCount} {t(locale, 'PLAYERS')}</span>
                        )}
                      </div>
                    </div>
                    <span style={{ color: 'var(--fp-text-muted)', fontSize: 18, fontFamily: 'var(--fp-display)' }}>›</span>
                  </div>
                </HudFrame>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sign out */}
      <div style={{ padding: '0 16px 120px' }}>
        <ArcadeButton variant="surface" fullWidth onClick={logout}>
          {t(locale, 'Sign out').toUpperCase()}
        </ArcadeButton>
      </div>

      {/* Edit name modal */}
      {showEditName && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <HudFrame glow="var(--fp-primary)" style={{ width: '100%', maxWidth: 380 }}>
            <div style={{ padding: 20 }}>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 14, letterSpacing: 2,
                color: 'var(--fp-primary)', fontWeight: 800, marginBottom: 14,
              }}>{t(locale, 'Edit name').toUpperCase()}</div>
              <ArenaLabel>{t(locale, 'Your name').toUpperCase()}</ArenaLabel>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={arenaInputStyle}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <ArcadeButton variant="surface" fullWidth onClick={() => setShowEditName(false)}>
                  {t(locale, 'Cancel').toUpperCase()}
                </ArcadeButton>
                <ArcadeButton fullWidth onClick={handleSave}>
                  {t(locale, 'Save').toUpperCase()}
                </ArcadeButton>
              </div>
            </div>
          </HudFrame>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────

function RankHero({ summary, locale }) {
  const tierCode = summary?.tier || 'amateur';
  const division = TIER_TO_DIVISION[tierCode] || 'silver';
  const tierName = TIER_NAMES[tierCode] || 'Amateur';
  const hasData = (summary?.poolsPlayed ?? 0) > 0;

  const gradientTint = {
    bronze:  '#E08855',
    silver:  '#E6EAF0',
    gold:    '#FFD166',
    diamond: '#6FEBFF',
    legend:  '#FF55E0',
  }[division];

  return (
    <HudFrame bg={`linear-gradient(135deg, color-mix(in srgb, ${gradientTint} 18%, transparent), var(--fp-surface) 60%)`}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ filter: `drop-shadow(0 0 10px ${gradientTint}88)`, flexShrink: 0 }}>
            <DivisionBadge tier={division} size={74} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 900,
              letterSpacing: 2, color: 'var(--fp-text)', textTransform: 'uppercase',
            }}>{t(locale, tierName)}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <span style={{
                fontFamily: 'var(--fp-display)', fontSize: 26, fontWeight: 900,
                color: 'var(--fp-primary)',
              }}>{summary?.rating ?? 1000}</span>
              <span style={{
                fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 800,
                letterSpacing: 1.5, color: 'var(--fp-text-muted)',
              }}>{t(locale, 'RATING')}</span>
            </div>
            {hasData ? (
              <div style={{
                display: 'flex', gap: 10, marginTop: 4,
                fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700,
              }}>
                <span style={{ color: 'var(--fp-text-muted)' }}>
                  {t(locale, 'PEAK')} <span style={{ color: 'var(--fp-text)' }}>{summary?.ratingPeak ?? 1000}</span>
                </span>
                <span style={{ color: 'var(--fp-text-muted)' }}>
                  {t(locale, 'GLOBAL RANK')} <span style={{ color: 'var(--fp-text)' }}>#{summary?.rank ?? '—'}</span>
                </span>
              </div>
            ) : (
              <div style={{
                fontFamily: 'var(--fp-mono)', fontSize: 10,
                color: 'var(--fp-text-dim)', marginTop: 4,
              }}>
                {t(locale, 'Play a pool to start ranking.')}
              </div>
            )}
          </div>
        </div>

        {hasData && summary && (
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: 4,
              fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700,
              letterSpacing: 1.5,
            }}>
              <span style={{ color: 'var(--fp-text-muted)' }}>
                → {nextTierLabel(tierCode, locale)}
              </span>
              <span style={{ color: 'var(--fp-text-dim)' }}>
                {summary.rating}/{summary.tierMax}
              </span>
            </div>
            <XpBar
              value={progressInTier(summary) * 100}
              max={100}
              color={gradientTint}
              segments={24}
              height={6}
            />
          </div>
        )}
      </div>
    </HudFrame>
  );
}

function nextTierLabel(code, locale) {
  const next = {
    rookie:  'Amateur',
    amateur: 'Pro',
    pro:     'Veteran',
    veteran: 'Legend',
    legend:  'Legend',
  }[code] || 'Amateur';
  return t(locale, next).toUpperCase();
}

function StatsGrid({ summary, locale }) {
  const winRatePct = Math.round(((summary?.winRate ?? 0) * 100));
  const stats = [
    { label: t(locale, 'POOLS PLAYED'), value: summary?.poolsPlayed ?? 0, color: 'var(--fp-primary)' },
    { label: t(locale, 'POOLS WON'),    value: summary?.poolsWon ?? 0,    color: 'var(--fp-gold)' },
    { label: t(locale, 'WIN RATE'),     value: `${winRatePct}%`,          color: 'var(--fp-accent)' },
    { label: t(locale, 'BEST STREAK'),  value: summary?.streakBest ?? 0,  color: 'var(--fp-hot)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {stats.map((s) => (
        <div key={s.label} style={{
          padding: 12,
          background: 'var(--fp-surface)',
          border: '1px solid var(--fp-stroke)',
          clipPath: 'var(--fp-clip-sm)',
        }}>
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700,
            letterSpacing: 1.5, color: 'var(--fp-text-muted)',
          }}>{s.label}</div>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 900,
            color: s.color, marginTop: 2,
          }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function AchievementsGrid({ unlockedCodes, locale }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {ACHIEVEMENTS.map((a) => {
        const unlocked = unlockedCodes.has(a.code);
        return (
          <div key={a.code} style={{
            padding: '12px 6px',
            textAlign: 'center',
            background: unlocked
              ? `color-mix(in srgb, ${a.accent} 14%, transparent)`
              : 'var(--fp-surface)',
            border: `1px solid ${unlocked ? `color-mix(in srgb, ${a.accent} 55%, transparent)` : 'var(--fp-stroke)'}`,
            clipPath: 'var(--fp-clip-sm)',
            filter: unlocked ? `drop-shadow(0 0 6px ${a.accent}55)` : undefined,
          }}>
            <div style={{
              fontSize: 26,
              filter: unlocked ? undefined : 'grayscale(1)',
              opacity: unlocked ? 1 : 0.35,
              marginBottom: 4,
            }}>{a.icon}</div>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 8, fontWeight: 800,
              letterSpacing: 1.2,
              color: unlocked ? 'var(--fp-text)' : 'var(--fp-text-dim)',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}>{t(locale, a.titleKey)}</div>
          </div>
        );
      })}
    </div>
  );
}
