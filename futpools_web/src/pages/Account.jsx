import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import {
  HudFrame, ArcadeButton, ArenaLabel, arenaInputStyle, IconButton, SectionLabel,
} from '../arena-ui/primitives';

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function Account() {
  const { user, token, logout, updateDisplayName } = useAuth();
  const { locale } = useLocale();
  const [showEditName, setShowEditName] = useState(false);
  const [editName, setEditName] = useState(user?.displayName || '');
  const [myPools, setMyPools] = useState([]);

  const displayName = (user?.displayName || '').trim() || user?.email || 'Player';
  const username = user?.username || (user?.email?.split('@')[0] ?? 'player');
  const balance = user?.balance ?? 0;

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    api.get('/quinielas/mine/created', token)
      .then((list) => { if (!cancel) setMyPools(list); })
      .catch(() => { if (!cancel) setMyPools([]); });
    return () => { cancel = true; };
  }, [token]);

  const handleSave = async () => {
    await updateDisplayName(editName);
    setShowEditName(false);
  };

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

      {/* Hero — simple avatar with initials */}
      <div style={{ padding: '12px 16px 20px', textAlign: 'center' }}>
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
                }}>BALANCE</div>
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
      <div style={{ padding: '0 16px 20px' }}>
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
