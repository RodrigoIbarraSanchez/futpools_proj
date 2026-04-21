// screens1.jsx — Login / Home / Pool Detail
import React from 'react';
import {
  FONTS, HUD_CLIP_LG, HUD_CLIP_SM,
  HudFrame, HudChip, LiveDot, TeamCrest,
  XpBar, DivisionBadge, ArcadeButton,
} from './tokens';

// ═══════════════════════════════════════════════════════════
// LOGIN / ARENA ENTRANCE
// ═══════════════════════════════════════════════════════════
export function LoginScreen({ t, onLogin }) {
  const [email, setEmail] = React.useState('diego@futpools.mx');
  const [pw, setPw] = React.useState('••••••••');

  return (
    <div style={{ width: '100%', height: '100%', background: t.bg, color: t.text, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 80% 50% at 50% 20%, ${t.primary}22 0%, transparent 50%),
                     radial-gradient(ellipse 60% 40% at 50% 80%, ${t.accent}15 0%, transparent 60%),
                     ${t.bg}`,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
        background: `repeating-linear-gradient(0deg, transparent 0, transparent 24px, ${t.primary}22 24px, ${t.primary}22 25px),
                     repeating-linear-gradient(90deg, transparent 0, transparent 24px, ${t.primary}22 24px, ${t.primary}22 25px)`,
        transform: 'perspective(400px) rotateX(60deg)',
        transformOrigin: 'bottom',
        maskImage: 'linear-gradient(0deg, black 0%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(0deg, black 0%, transparent 100%)',
      }} />

      <div style={{ position: 'relative', zIndex: 2, padding: '120px 28px 40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontFamily: FONTS.display, fontWeight: 800, fontSize: 44,
            color: t.text, letterSpacing: 6, lineHeight: 1,
          }}>
            FUT<span style={{ color: t.primary, textShadow: `0 0 20px ${t.primary}` }}>POOLS</span>
          </div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 4,
            color: t.textDim, marginTop: 6,
          }}>
            · ARENA v2.0 ·
          </div>
        </div>

        <HudFrame t={t} style={{ padding: 22 }} glow={t.primary} brackets>
          <div style={{
            fontFamily: FONTS.display, fontSize: 13, letterSpacing: 3,
            color: t.primary, marginBottom: 16, textTransform: 'uppercase',
          }}>
            ▶ INSERT COIN TO CONTINUE
          </div>

          <label style={{ display: 'block', fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 2, color: t.textMuted, marginBottom: 4 }}>
            EMAIL
          </label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 14,
              background: t.bg, border: `1px solid ${t.stroke}`,
              color: t.text, fontFamily: FONTS.mono, fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
          />

          <label style={{ display: 'block', fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 2, color: t.textMuted, marginBottom: 4 }}>
            PASSWORD
          </label>
          <input
            value={pw} type="password"
            onChange={e => setPw(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 18,
              background: t.bg, border: `1px solid ${t.stroke}`,
              color: t.text, fontFamily: FONTS.mono, fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
          />

          <ArcadeButton t={t} fullWidth size="lg" onClick={onLogin}>
            ▶ Start Match
          </ArcadeButton>
        </HudFrame>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textMuted, letterSpacing: 1 }}>
            NEW PLAYER? </span>
          <span style={{ fontFamily: FONTS.display, fontSize: 12, color: t.primary, letterSpacing: 2, fontWeight: 700 }}>
            CREATE ACCOUNT →
          </span>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{
          textAlign: 'center',
          fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 3, color: t.textFaint,
        }}>
          © 2026 FUTPOOLS · PRESS START
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HOME / POOLS LOBBY
// ═══════════════════════════════════════════════════════════
export function HomeScreen({ t, user, pools, onPoolTap }) {
  return (
    <div style={{ background: t.bg, color: t.text, minHeight: '100%', paddingBottom: 110 }}>
      <TopBar t={t} user={user} />

      <div style={{ padding: '8px 16px 12px' }}>
        <div style={{
          fontFamily: FONTS.display, fontSize: 10, letterSpacing: 3,
          color: t.primary, marginBottom: 8,
        }}>
          ◆ QUICK PLAY
        </div>
        <HudFrame t={t} clip={HUD_CLIP_LG} bg={`linear-gradient(135deg, ${t.surface} 0%, ${t.surfaceAlt} 60%, ${t.primary}22 120%)`} glow={t.primary}>
          <div style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: t.primary, boxShadow: `0 0 10px ${t.primary}` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <LiveDot color={t.danger} />
              <span style={{ fontFamily: FONTS.display, fontSize: 10, letterSpacing: 2, color: t.danger, fontWeight: 800 }}>LIVE NOW</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted, marginLeft: 'auto' }}>847 JUGADORES</span>
            </div>
            <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 800, letterSpacing: 1, lineHeight: 1.1, marginBottom: 8 }}>
              LA LIGA · JORNADA 28
            </div>
            <div style={{ display: 'flex', gap: 18, marginBottom: 12 }}>
              <StatInline label="PRIZE POOL" value="$12,500" color={t.primary} t={t} mono />
              <StatInline label="ENTRY" value="$15" color={t.accent} t={t} mono />
              <StatInline label="RANK" value="#3" color={t.gold} t={t} mono />
            </div>
            <ArcadeButton t={t} size="md" onClick={() => onPoolTap('p1')}>
              ▶ Resume
            </ArcadeButton>
          </div>
        </HudFrame>
      </div>

      <FilterStrip t={t} />

      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 10, letterSpacing: 3, color: t.textMuted, margin: '14px 0 10px' }}>
          ◆ ACTIVE POOLS
        </div>
        {pools.map((p, i) => (
          <div key={p.id} style={{ animation: `futpoolsSlide 0.4s ${i * 0.06}s both` }}>
            <PoolCard pool={p} t={t} onTap={() => onPoolTap(p.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TopBar({ t, user }) {
  return (
    <div style={{
      padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: `1px solid ${t.stroke}`,
      background: `linear-gradient(180deg, ${t.bg2}, ${t.bg})`,
    }}>
      <DivisionBadge tier={user.division} size={36} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted, letterSpacing: 1 }}>
          LVL {user.level} · {user.divisionLabel}
        </div>
        <XpBar value={user.xp} max={user.xpMax} t={t} color={t.primary} segments={16} height={5} />
      </div>
      <CoinDisplay value={user.coins} t={t} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: `${t.hot}22`, clipPath: HUD_CLIP_SM }}>
        <span style={{ fontSize: 14 }}>🔥</span>
        <span style={{ fontFamily: FONTS.display, fontSize: 13, fontWeight: 800, color: t.hot }}>{user.streak}</span>
      </div>
    </div>
  );
}

function CoinDisplay({ value, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: `${t.gold}22`, clipPath: HUD_CLIP_SM }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${t.gold}, #B88A1F)`,
        boxShadow: `0 0 6px ${t.gold}80`,
      }} />
      <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.gold }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function StatInline({ label, value, color, t, mono }) {
  return (
    <div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.5, color: t.textMuted }}>
        {label}
      </div>
      <div style={{
        fontFamily: mono ? FONTS.mono : FONTS.display,
        fontSize: 18, fontWeight: 800, color, letterSpacing: 0.5,
      }}>
        {value}
      </div>
    </div>
  );
}

function FilterStrip({ t }) {
  const [active, setActive] = React.useState('all');
  const items = [
    { id: 'all', label: 'ALL' },
    { id: 'live', label: 'LIVE', count: 2, color: t.danger },
    { id: 'open', label: 'OPEN', count: 4 },
    { id: 'high', label: '$HIGH', color: t.gold },
    { id: 'friends', label: 'FRIENDS' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 16px', overflowX: 'auto' }} className="fp-scroll">
      {items.map(item => {
        const isActive = active === item.id;
        return (
          <button key={item.id} onClick={() => setActive(item.id)} style={{
            padding: '6px 12px',
            background: isActive ? (item.color ?? t.primary) : t.surfaceAlt,
            color: isActive ? '#061018' : t.textDim,
            fontFamily: FONTS.display, fontSize: 11, fontWeight: 700, letterSpacing: 2,
            clipPath: HUD_CLIP_SM, border: 'none', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
            {item.label}{item.count ? ` ${item.count}` : ''}
          </button>
        );
      })}
    </div>
  );
}

function PoolCard({ pool, t, onTap }) {
  const statusMeta = {
    live: { c: t.danger, label: 'LIVE' },
    open: { c: t.primary, label: 'OPEN' },
    upcoming: { c: t.accent, label: 'UPCOMING' },
    closed: { c: t.textMuted, label: 'CLOSED' },
  }[pool.status];

  return (
    <HudFrame t={t} onClick={onTap} style={{ marginBottom: 10 }}>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 800, letterSpacing: 1.2, flex: 1 }}>
            {pool.name}
          </div>
          <HudChip t={t} color={statusMeta.c}>
            {pool.status === 'live' && <LiveDot color={statusMeta.c} size={5} />}
            {statusMeta.label}
          </HudChip>
        </div>

        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textDim, marginBottom: 10, letterSpacing: 0.5 }}>
          {pool.subtitle}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: pool.fixtures.length ? 10 : 0 }}>
          <StatTile label="POT"     value={pool.prize}     color={t.gold}    t={t} />
          <StatTile label="ENTRY"   value={pool.entry}     color={t.text}    t={t} />
          <StatTile label="PLAYERS" value={pool.entries}   color={t.accent}  t={t} />
        </div>

        {pool.status !== 'closed' && (
          <div style={{ marginBottom: pool.fixtures.length ? 10 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.mono, fontSize: 9, color: t.textMuted, letterSpacing: 1, marginBottom: 3 }}>
              <span>◆ POOL HEAT</span><span>{pool.heat}%</span>
            </div>
            <XpBar value={pool.heat} max={100} t={t} color={pool.heat > 75 ? t.hot : t.primary} segments={24} height={4} />
          </div>
        )}

        {pool.fixtures.length > 0 && (
          <div style={{ background: t.bg2, padding: 8, clipPath: HUD_CLIP_SM }}>
            {pool.fixtures.slice(0, 2).map((fx, i) => (
              <div key={fx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: i > 0 ? `1px dashed ${t.stroke}` : 'none' }}>
                <TeamCrest name={fx.home.name} color={fx.home.color} size={22} />
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, flex: 1, color: t.textDim }}>
                  {fx.home.short} <span style={{ color: t.textFaint }}>vs</span> {fx.away.short}
                </div>
                <TeamCrest name={fx.away.name} color={fx.away.color} size={22} />
                {fx.status === 'live' && fx.score ? (
                  <span style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color: t.danger, marginLeft: 6 }}>
                    {fx.score[0]}-{fx.score[1]} {fx.minute}
                  </span>
                ) : (
                  <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted, marginLeft: 6 }}>
                    {fx.time}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {pool.wonAmount && (
          <div style={{
            marginTop: 10, padding: '8px 10px',
            background: `${t.primary}22`,
            fontFamily: FONTS.display, fontSize: 12, color: t.primary, fontWeight: 800, letterSpacing: 1,
            clipPath: HUD_CLIP_SM,
          }}>
            🏆 WON {pool.wonAmount}
          </div>
        )}
      </div>
    </HudFrame>
  );
}

function StatTile({ label, value, color, t }) {
  return (
    <div style={{ padding: '6px 8px', background: t.bg2, clipPath: HUD_CLIP_SM }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: 8, letterSpacing: 1.5, color: t.textMuted }}>{label}</div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color, letterSpacing: 0.3 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// POOL DETAIL
// ═══════════════════════════════════════════════════════════
export function PoolDetailScreen({ t, pool, leaderboard, onBack, onPick, onMatchTap }) {
  const [tab, setTab] = React.useState('fixtures');

  return (
    <div style={{ background: t.bg, color: t.text, minHeight: '100%', paddingBottom: 110 }}>
      <div style={{
        padding: '14px 16px 18px',
        background: `linear-gradient(180deg, ${t.primary}18 0%, transparent 100%)`,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={onBack} style={{
            width: 32, height: 32, background: t.surface, border: `1px solid ${t.stroke}`,
            color: t.text, fontFamily: FONTS.display, fontSize: 14, cursor: 'pointer',
            clipPath: HUD_CLIP_SM,
          }}>←</button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted, letterSpacing: 2 }}>
            [ POOL · {pool.code} ]
          </div>
          <button style={{
            width: 32, height: 32, background: t.surface, border: `1px solid ${t.stroke}`,
            color: t.text, fontFamily: FONTS.display, fontSize: 14, cursor: 'pointer',
            clipPath: HUD_CLIP_SM,
          }}>↗</button>
        </div>

        <div style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 800, letterSpacing: 1, lineHeight: 1.1, marginBottom: 6 }}>
          {pool.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <LiveDot color={t.danger} />
          <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.danger, letterSpacing: 1, fontWeight: 700 }}>{pool.startsIn}</span>
          <span style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted }}>
            {pool.entriesCount} JUGADORES
          </span>
        </div>

        <HudFrame t={t} bg={`linear-gradient(135deg, ${t.gold}22 0%, ${t.bg2} 60%)`} glow={t.gold}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 32, filter: `drop-shadow(0 0 8px ${t.gold})` }}>🏆</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 2, color: t.textMuted }}>PRIZE POOL</div>
              <div style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 800, color: t.gold, letterSpacing: 1, lineHeight: 1 }}>
                {pool.prize}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 2, color: t.textMuted }}>ENTRY</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: t.text }}>{pool.entry}</div>
            </div>
          </div>
        </HudFrame>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', gap: 4, marginBottom: 10 }}>
        {[['fixtures', 'FIXTURES'], ['ranking', 'RANKING'], ['rules', 'RULES']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: '9px 8px',
            background: tab === k ? t.primary : t.surfaceAlt,
            color: tab === k ? '#061018' : t.textDim,
            fontFamily: FONTS.display, fontWeight: 700, fontSize: 11, letterSpacing: 2,
            clipPath: HUD_CLIP_SM, border: 'none', cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '6px 16px' }}>
        {tab === 'fixtures' && (
          <>
            {pool.fixtures.map(fx => (
              <FixtureCard key={fx.id} fx={fx} t={t} onTap={() => onMatchTap(fx)} />
            ))}
          </>
        )}
        {tab === 'ranking' && <LeaderboardPanel leaderboard={leaderboard} t={t} />}
        {tab === 'rules' && <RulesPanel t={t} />}
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 92,
        padding: '8px 16px',
        background: `linear-gradient(180deg, transparent, ${t.bg} 40%)`,
      }}>
        <ArcadeButton t={t} fullWidth size="lg" onClick={onPick}>
          ▶ MAKE PICKS · {pool.entry}
        </ArcadeButton>
      </div>
    </div>
  );
}

function FixtureCard({ fx, t, onTap }) {
  const isLive = fx.status === 'live';
  return (
    <HudFrame t={t} onClick={onTap} glow={isLive ? t.danger : null} style={{ marginBottom: 8 }}>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: t.textMuted, letterSpacing: 1.5 }}>
            {fx.time}
          </span>
          {isLive && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <LiveDot color={t.danger} size={5} />
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.danger, fontWeight: 700, letterSpacing: 1 }}>
                {fx.minute}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-start' }}>
            <TeamCrest name={fx.home.name} color={fx.home.color} size={32} />
            <div style={{ fontFamily: FONTS.display, fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
              {fx.home.short}
            </div>
          </div>
          {isLive && fx.score ? (
            <div style={{
              fontFamily: FONTS.mono, fontSize: 22, fontWeight: 800,
              color: t.text, padding: '4px 12px',
              background: t.bg2, clipPath: HUD_CLIP_SM,
              textShadow: `0 0 8px ${t.danger}`,
            }}>
              {fx.score[0]}–{fx.score[1]}
            </div>
          ) : (
            <div style={{ fontFamily: FONTS.display, fontSize: 10, color: t.textMuted, letterSpacing: 2 }}>VS</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
              {fx.away.short}
            </div>
            <TeamCrest name={fx.away.name} color={fx.away.color} size={32} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { p: '1', pct: 52, label: fx.home.short },
            { p: 'X', pct: 22, label: 'DRAW' },
            { p: '2', pct: 26, label: fx.away.short },
          ].map(row => {
            const isMyPick = fx.pick === row.p;
            return (
              <div key={row.p} style={{
                flex: 1, padding: '5px 7px',
                background: isMyPick ? t.primary : t.bg2,
                color: isMyPick ? '#061018' : t.textDim,
                clipPath: HUD_CLIP_SM,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              }}>
                <span style={{ fontFamily: FONTS.display, fontSize: 13, fontWeight: 800 }}>{row.p}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 8, opacity: 0.7 }}>{row.pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </HudFrame>
  );
}

function LeaderboardPanel({ leaderboard, t }) {
  return (
    <HudFrame t={t}>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'center', marginBottom: 16, height: 120 }}>
          <PodiumBlock rank={2} entry={leaderboard[1]} height={70} t={t} />
          <PodiumBlock rank={1} entry={leaderboard[0]} height={100} t={t} />
          <PodiumBlock rank={3} entry={leaderboard[2]} height={55} t={t} />
        </div>
        <div style={{ borderTop: `1px dashed ${t.stroke}`, paddingTop: 8 }}>
          {leaderboard.slice(3).map(row => (
            <div key={row.rank} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
              background: row.you ? `${t.primary}18` : 'transparent',
              clipPath: row.you ? HUD_CLIP_SM : 'none',
            }}>
              <div style={{
                width: 24, fontFamily: FONTS.mono, fontWeight: 700,
                color: row.you ? t.primary : t.textDim,
                fontSize: 12, textAlign: 'center',
              }}>
                {row.rank}
              </div>
              <div style={{
                width: 24, height: 24, borderRadius: 4,
                background: row.avatar, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONTS.display, fontSize: 10, fontWeight: 800, color: '#061018',
              }}>
                {row.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, fontFamily: FONTS.mono, fontSize: 12, color: row.you ? t.primary : t.text, fontWeight: row.you ? 700 : 500 }}>
                {row.name}{row.you && ' · YOU'}
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.primary }}>
                {row.score}/{row.of}
              </div>
            </div>
          ))}
        </div>
      </div>
    </HudFrame>
  );
}

function PodiumBlock({ rank, entry, height, t }) {
  const colors = { 1: t.gold, 2: t.silver, 3: t.bronze };
  const c = colors[rank];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 6,
        background: entry.avatar,
        border: `2px solid ${c}`,
        boxShadow: `0 0 14px ${c}88`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONTS.display, fontSize: 16, fontWeight: 800, color: '#061018',
      }}>
        {entry.name[0].toUpperCase()}
      </div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.text, fontWeight: 600 }}>{entry.name}</div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: c, fontWeight: 700 }}>{entry.score}/{entry.of}</div>
      <div style={{
        width: '100%', height,
        background: `linear-gradient(180deg, ${c}, ${c}66)`,
        clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8,
        fontFamily: FONTS.display, fontSize: 22, fontWeight: 900, color: '#061018',
      }}>
        {rank}
      </div>
    </div>
  );
}

function RulesPanel({ t }) {
  return (
    <HudFrame t={t}>
      <div style={{ padding: 14 }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 12, letterSpacing: 2, color: t.primary, marginBottom: 10 }}>◆ GAME RULES</div>
        {[
          ['01', 'Predice 1 (local), X (empate) o 2 (visitante) para cada partido.'],
          ['02', '+1 pt por cada acierto. Multiplicadores x2 en partidos 🔥 HOT.'],
          ['03', 'Los picks se cierran al iniciar el primer partido.'],
          ['04', 'El premio se reparte 60/30/10 entre top 3.'],
          ['05', 'Ganar sube tu XP y tu división. ¡Llega a LEGEND!'],
        ].map(([n, text]) => (
          <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 8, fontFamily: FONTS.body, fontSize: 12, color: t.textDim }}>
            <span style={{ fontFamily: FONTS.mono, color: t.primary, fontWeight: 700 }}>{n}</span>
            <span style={{ flex: 1 }}>{text}</span>
          </div>
        ))}
      </div>
    </HudFrame>
  );
}
