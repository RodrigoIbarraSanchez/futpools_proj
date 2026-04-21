// screens2.jsx — Pick / Entries / Profile / Recharge / Live / Success / TabBar
import React from 'react';
import {
  FONTS, HUD_CLIP, HUD_CLIP_SM,
  HudFrame, HudChip, LiveDot, TeamCrest,
  XpBar, DivisionBadge, ArcadeButton,
} from './tokens';

// ═══════════════════════════════════════════════════════════
// PICK SCREEN
// ═══════════════════════════════════════════════════════════
export function PickScreen({ t, pool, onBack, onSubmit }) {
  const [picks, setPicks] = React.useState({});
  const [focused, setFocused] = React.useState(null);
  const count = Object.keys(picks).length;
  const total = pool.fixtures.length;
  const complete = count === total;

  return (
    <div style={{ background: t.bg, color: t.text, minHeight: '100%', paddingBottom: 120 }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${t.stroke}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <button onClick={onBack} style={{
            width: 32, height: 32, background: t.surface, border: `1px solid ${t.stroke}`,
            color: t.text, fontFamily: FONTS.display, fontSize: 14, cursor: 'pointer',
            clipPath: HUD_CLIP_SM,
          }}>←</button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.display, fontSize: 12, letterSpacing: 3, color: t.text }}>
            MAKE YOUR PICKS
          </div>
          <div style={{ width: 32 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: t.textMuted, letterSpacing: 1.5, marginBottom: 3 }}>
              ◆ PROGRESS · {count}/{total}
            </div>
            <XpBar value={count} max={total} t={t} color={complete ? t.primary : t.accent} segments={total} height={6} />
          </div>
          <HudChip t={t} color={complete ? t.primary : t.textMuted}>
            {complete ? 'READY' : `${total - count} LEFT`}
          </HudChip>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {pool.fixtures.map((fx, i) => (
          <PickRow
            key={fx.id} fx={fx} t={t} index={i}
            pick={picks[fx.id]}
            focused={focused === fx.id}
            onFocus={() => setFocused(fx.id)}
            onPick={p => {
              setPicks({ ...picks, [fx.id]: p });
              const next = pool.fixtures[i + 1];
              if (next) setTimeout(() => setFocused(next.id), 120);
            }}
          />
        ))}
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 36,
        padding: '12px 16px',
        background: `linear-gradient(180deg, transparent, ${t.bg} 30%)`,
      }}>
        <ArcadeButton t={t} fullWidth size="lg" disabled={!complete} onClick={onSubmit}>
          {complete ? '▶ SUBMIT PICKS' : `COMPLETE ALL (${total - count} LEFT)`}
        </ArcadeButton>
      </div>
    </div>
  );
}

function PickRow({ fx, t, pick, onPick, focused, onFocus, index }) {
  return (
    <div style={{
      padding: 12, marginBottom: 8,
      background: focused ? `${t.primary}0E` : t.surface,
      border: focused ? `1px solid ${t.primary}55` : `1px solid ${t.stroke}`,
      clipPath: HUD_CLIP_SM,
      animation: `futpoolsSlide 0.35s ${index * 0.05}s both`,
    }} onClick={onFocus}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.primary, letterSpacing: 1.5, fontWeight: 700 }}>
          #{String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ marginLeft: 8, fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted }}>
          {fx.time}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
          <TeamCrest name={fx.home.name} color={fx.home.color} size={34} />
          <div style={{ fontFamily: FONTS.display, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{fx.home.short}</div>
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 10, color: t.textMuted, letterSpacing: 2 }}>VS</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
          <TeamCrest name={fx.away.name} color={fx.away.color} size={34} />
          <div style={{ fontFamily: FONTS.display, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{fx.away.short}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { p: '1', label: fx.home.short },
          { p: 'X', label: 'DRAW' },
          { p: '2', label: fx.away.short },
        ].map(opt => {
          const active = pick === opt.p;
          return (
            <button
              key={opt.p}
              onClick={e => { e.stopPropagation(); onPick(opt.p); }}
              style={{
                flex: 1, padding: '10px 6px',
                background: active ? t.primary : t.bg2,
                color: active ? '#061018' : t.textDim,
                fontFamily: FONTS.display, fontSize: 15, fontWeight: 800, letterSpacing: 1,
                clipPath: HUD_CLIP_SM, border: 'none', cursor: 'pointer',
                boxShadow: active ? `0 0 12px ${t.primary}80, inset 0 0 0 2px ${t.primary}` : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                transition: 'all 0.1s',
              }}
            >
              <span style={{ fontSize: 18 }}>{opt.p}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 8, opacity: 0.75, letterSpacing: 1 }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MY ENTRIES
// ═══════════════════════════════════════════════════════════
export function EntriesScreen({ t, entries, user, onEntryTap }) {
  return (
    <div style={{ background: t.bg, color: t.text, minHeight: '100%', paddingBottom: 110 }}>
      <div style={{ padding: '18px 16px 10px' }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>
          MY ENTRIES
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted, letterSpacing: 1 }}>
          [ {user.totalEntries} TOTAL · {user.winRate}% WIN RATE ]
        </div>
      </div>

      <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatMini icon="✓" label="ACIERTOS" value={user.correctPicks} color={t.primary} t={t} />
        <StatMini icon="🏆" label="GANADAS" value={user.poolsWon} color={t.gold} t={t} />
        <StatMini icon="🔥" label="RACHA" value={user.streak} color={t.hot} t={t} />
      </div>

      <div style={{ padding: '0 16px 20px' }}>
        {entries.map((e, i) => (
          <div key={e.id} style={{ animation: `futpoolsSlide 0.4s ${i * 0.05}s both` }}>
            <EntryCard entry={e} t={t} onTap={() => onEntryTap(e)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatMini({ icon, label, value, color, t }) {
  return (
    <HudFrame t={t}>
      <div style={{ padding: '10px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
        <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 800, color, letterSpacing: 0.5 }}>
          {value}
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: t.textMuted, letterSpacing: 1.5 }}>
          {label}
        </div>
      </div>
    </HudFrame>
  );
}

function EntryCard({ entry, t, onTap }) {
  const statusColors = {
    live:    { c: t.danger,    label: 'LIVE' },
    pending: { c: t.accent,    label: 'PENDING' },
    won:     { c: t.gold,      label: 'WON' },
    lost:    { c: t.textMuted, label: 'CLOSED' },
  }[entry.status];

  return (
    <HudFrame t={t} onClick={onTap} glow={entry.status === 'won' ? t.gold : (entry.status === 'live' ? t.danger : null)} style={{ marginBottom: 10 }}>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 800, letterSpacing: 1, flex: 1 }}>
            {entry.poolName}
          </div>
          <HudChip t={t} color={statusColors.c}>
            {entry.status === 'live' && <LiveDot color={statusColors.c} size={5} />}
            {statusColors.label}
          </HudChip>
        </div>

        <div style={{ display: 'flex', gap: 10, fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted, marginBottom: 10 }}>
          <span>ENTRY #{entry.entryNum}</span>
          <span>·</span>
          <span>{entry.date}</span>
          {entry.prize && <span style={{ color: t.gold, marginLeft: 'auto', fontWeight: 700 }}>{entry.prize}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <XpBar value={entry.score} max={entry.of} t={t} color={statusColors.c} segments={entry.of} height={8} />
          </div>
          <div style={{
            fontFamily: FONTS.mono, fontSize: 14, fontWeight: 800,
            color: statusColors.c, minWidth: 44, textAlign: 'right',
          }}>
            {entry.score}/{entry.of}
          </div>
        </div>

        {entry.fixtures.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {entry.fixtures.map(fx => {
              const isLive = fx.status === 'live';
              const correct = isLive ? null : (fx.pick === '1');
              return (
                <div key={fx.id} style={{
                  padding: '3px 6px', fontFamily: FONTS.mono, fontSize: 9, fontWeight: 700,
                  background: isLive ? `${t.danger}33` : (correct ? `${t.primary}33` : t.surfaceAlt),
                  color: isLive ? t.danger : (correct ? t.primary : t.textMuted),
                  letterSpacing: 1,
                }}>
                  {fx.home.short} {fx.pick} {fx.away.short}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </HudFrame>
  );
}

// ═══════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════
export function ProfileScreen({ t, user, achievements, onRecharge }) {
  return (
    <div style={{ background: t.bg, color: t.text, minHeight: '100%', paddingBottom: 110 }}>
      <div style={{
        padding: '20px 16px 18px',
        background: `radial-gradient(ellipse 100% 80% at 50% 0%, ${t.primary}22 0%, transparent 70%)`,
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 14, right: 16, display: 'flex', gap: 6 }}>
          <button style={{
            width: 32, height: 32, background: t.surface, border: `1px solid ${t.stroke}`,
            color: t.text, fontSize: 14, cursor: 'pointer',
            clipPath: HUD_CLIP_SM,
          }}>⚙</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 76, height: 76, position: 'relative',
              background: `linear-gradient(135deg, ${user.avatar} 0%, ${user.avatar}88 100%)`,
              clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONTS.display, fontSize: 32, fontWeight: 900,
              color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.35)',
              boxShadow: `0 0 22px ${user.avatar}66`,
            }}>
              {user.displayName.split(' ').map(w => w[0]).join('')}
            </div>
            <div style={{ position: 'absolute', bottom: -6, right: -8 }}>
              <DivisionBadge tier={user.division} size={32} />
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>
              {user.displayName}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textMuted, letterSpacing: 1 }}>
              @{user.username}
            </div>
          </div>
        </div>

        <HudFrame t={t}>
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: 2, color: t.primary, fontWeight: 700 }}>
                LVL {user.level}
              </div>
              <div style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.mono, fontSize: 10, color: t.textDim, letterSpacing: 1 }}>
                {user.divisionLabel} · #{user.rankGlobal.toLocaleString()} GLOBAL
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted }}>
                LVL {user.level + 1}
              </div>
            </div>
            <XpBar value={user.xp} max={user.xpMax} t={t} color={t.primary} segments={20} height={7} />
            <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: t.textMuted, marginTop: 4, letterSpacing: 1 }}>
              {user.xp} / {user.xpMax} XP
            </div>
          </div>
        </HudFrame>
      </div>

      <div style={{ padding: '0 16px 14px' }}>
        <HudFrame t={t} bg={`linear-gradient(90deg, ${t.gold}18 0%, ${t.surface} 60%)`} onClick={onRecharge}>
          <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${t.gold}, #B88A1F)`,
              boxShadow: `0 0 10px ${t.gold}80`,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: t.textMuted, letterSpacing: 1.5 }}>BALANCE</div>
              <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 800, color: t.gold, letterSpacing: 0.5 }}>
                {user.coins.toLocaleString()} COINS
              </div>
            </div>
            <ArcadeButton t={t} size="sm" variant="accent" onClick={onRecharge}>+ TOP UP</ArcadeButton>
          </div>
        </HudFrame>
      </div>

      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 10, letterSpacing: 3, color: t.textMuted, marginBottom: 8 }}>
          ◆ CAREER STATS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CareerStatCell label="ENTRIES" value={user.totalEntries} color={t.text} t={t} />
          <CareerStatCell label="WIN RATE" value={`${user.winRate}%`} color={t.primary} t={t} />
          <CareerStatCell label="POOLS WON" value={user.poolsWon} color={t.gold} t={t} />
          <CareerStatCell label="BEST STREAK" value={user.streakBest} color={t.hot} t={t} />
        </div>
      </div>

      <div style={{ padding: '0 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 10, letterSpacing: 3, color: t.textMuted }}>
            ◆ ACHIEVEMENTS
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 10, color: t.primary }}>
            {achievements.filter(a => a.unlocked).length}/{achievements.length}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {achievements.map(a => <AchievementTile key={a.id} a={a} t={t} />)}
        </div>
      </div>
    </div>
  );
}

function CareerStatCell({ label, value, color, t }) {
  return (
    <HudFrame t={t}>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.5, color: t.textMuted }}>
          {label}
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 800, color, letterSpacing: 0.5 }}>
          {value}
        </div>
      </div>
    </HudFrame>
  );
}

function AchievementTile({ a, t }) {
  const rarityColors = {
    common: t.textMuted, rare: t.accent, epic: t.hot, legendary: t.gold,
  };
  return (
    <div style={{
      padding: '12px 6px',
      background: a.unlocked ? t.surface : t.bg2,
      border: `1px solid ${a.unlocked ? rarityColors[a.rarity] + '55' : t.stroke}`,
      clipPath: HUD_CLIP_SM,
      textAlign: 'center',
      opacity: a.unlocked ? 1 : 0.4,
      position: 'relative',
    }}>
      <div style={{
        fontSize: 24, marginBottom: 4,
        filter: a.unlocked ? `drop-shadow(0 0 8px ${rarityColors[a.rarity]})` : 'grayscale(1)',
      }}>
        {a.unlocked ? a.icon : '🔒'}
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: a.unlocked ? t.text : t.textMuted, lineHeight: 1.2, marginBottom: 2 }}>
        {a.name}
      </div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 7, letterSpacing: 1.5, color: rarityColors[a.rarity] }}>
        {a.rarity.toUpperCase()}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RECHARGE / COIN SHOP
// ═══════════════════════════════════════════════════════════
export function RechargeScreen({ t, user, packs, onBack, onBuy }) {
  const [selected, setSelected] = React.useState('p100');
  return (
    <div style={{ background: t.bg, color: t.text, minHeight: '100%', paddingBottom: 110 }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${t.stroke}` }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={onBack} style={{
            width: 32, height: 32, background: t.surface, border: `1px solid ${t.stroke}`,
            color: t.text, fontSize: 14, cursor: 'pointer',
            clipPath: HUD_CLIP_SM, fontFamily: FONTS.display,
          }}>←</button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.display, fontSize: 12, letterSpacing: 3 }}>
            COIN SHOP
          </div>
          <div style={{ width: 32 }} />
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <HudFrame t={t} bg={`linear-gradient(135deg, ${t.gold}22 0%, ${t.surface} 60%)`} glow={t.gold}>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 2, color: t.textMuted, marginBottom: 4 }}>
              CURRENT BALANCE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${t.gold}, #B88A1F)`,
                boxShadow: `0 0 10px ${t.gold}80`,
              }} />
              <div style={{ fontFamily: FONTS.display, fontSize: 32, fontWeight: 800, color: t.gold, letterSpacing: 1 }}>
                {user.coins.toLocaleString()}
              </div>
            </div>
          </div>
        </HudFrame>

        <div style={{ fontFamily: FONTS.display, fontSize: 10, letterSpacing: 3, color: t.textMuted, margin: '18px 0 10px' }}>
          ◆ SELECT A PACK
        </div>

        {packs.map((pack) => {
          const isSel = selected === pack.id;
          const total = pack.coins + pack.bonus;
          return (
            <div key={pack.id} onClick={() => setSelected(pack.id)} style={{ marginBottom: 8 }}>
              <HudFrame t={t} glow={isSel ? t.primary : null} bg={isSel ? `linear-gradient(135deg, ${t.primary}18, ${t.surface})` : t.surface}>
                <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
                    {[0, 1, 2].slice(0, Math.min(3, Math.ceil(pack.coins / 100) + 1)).map(j => (
                      <div key={j} style={{
                        position: 'absolute', left: j * 3, bottom: j * 5,
                        width: 40, height: 40, borderRadius: '50%',
                        background: `radial-gradient(circle at 35% 35%, ${t.gold}, #B88A1F)`,
                        boxShadow: `0 0 6px ${t.gold}66, inset 0 -4px 0 rgba(0,0,0,0.2)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: FONTS.display, fontSize: 13, fontWeight: 900, color: '#6B4A0F',
                      }}>$</div>
                    ))}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <div style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 800, color: t.gold, letterSpacing: 0.5 }}>
                        {total}
                      </div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted }}>COINS</div>
                      {pack.bonus > 0 && (
                        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.primary, fontWeight: 700 }}>
                          +{pack.bonus} BONUS
                        </div>
                      )}
                    </div>
                    {pack.tag && (
                      <HudChip t={t} color={pack.tag.includes('BONUS') ? t.primary : (pack.tag === 'Mejor valor' ? t.hot : t.accent)}>
                        {pack.tag}
                      </HudChip>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 800, color: t.text }}>
                      {pack.price}
                    </div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: t.textMuted }}>MXN</div>
                  </div>
                </div>
              </HudFrame>
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 36,
        padding: '12px 16px',
        background: `linear-gradient(180deg, transparent, ${t.bg} 30%)`,
      }}>
        <ArcadeButton t={t} fullWidth size="lg" onClick={onBuy}>
          ▶ PURCHASE {packs.find(p => p.id === selected)?.price}
        </ArcadeButton>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LIVE MATCH VIEW
// ═══════════════════════════════════════════════════════════
export function LiveMatchScreen({ t, fx, onBack }) {
  return (
    <div style={{ background: t.bg, color: t.text, minHeight: '100%' }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={onBack} style={{
            width: 32, height: 32, background: t.surface, border: `1px solid ${t.stroke}`,
            color: t.text, fontSize: 14, cursor: 'pointer', clipPath: HUD_CLIP_SM, fontFamily: FONTS.display,
          }}>←</button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 2, color: t.textMuted }}>
            [ MATCH · LIVE ]
          </div>
          <div style={{ width: 32 }} />
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <div style={{
          position: 'relative', height: 180,
          background: t.pitch,
          clipPath: HUD_CLIP,
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 16, border: `2px solid ${t.pitchLine}` }} />
          <div style={{ position: 'absolute', left: '50%', top: 16, bottom: 16, width: 2, background: t.pitchLine }} />
          <div style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            width: 48, height: 48, borderRadius: '50%', border: `2px solid ${t.pitchLine}`,
          }} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <TeamCrest name={fx.home.name} color={fx.home.color} size={48} />
                <div style={{ fontFamily: FONTS.display, fontSize: 12, fontWeight: 700, marginTop: 4 }}>{fx.home.short}</div>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 40, fontWeight: 800, color: t.text, letterSpacing: 2, textShadow: `0 0 14px ${t.danger}` }}>
                {fx.score[0]}<span style={{ color: t.textMuted }}>–</span>{fx.score[1]}
              </div>
              <div style={{ textAlign: 'center' }}>
                <TeamCrest name={fx.away.name} color={fx.away.color} size={48} />
                <div style={{ fontFamily: FONTS.display, fontSize: 12, fontWeight: 700, marginTop: 4 }}>{fx.away.short}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <LiveDot color={t.danger} />
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.danger, fontWeight: 700, letterSpacing: 2 }}>
                LIVE · {fx.minute}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <HudFrame t={t} glow={t.primary}>
          <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 52, height: 52,
              background: t.primary, clipPath: HUD_CLIP_SM,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONTS.display, fontSize: 28, fontWeight: 900, color: '#061018',
            }}>
              {fx.pick}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted, letterSpacing: 1.5 }}>YOUR PICK</div>
              <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 700, color: t.text }}>
                {fx.pick === '1' ? 'HOME WIN' : fx.pick === '2' ? 'AWAY WIN' : 'DRAW'}
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: t.primary, marginTop: 2 }}>
                ◆ LEADING · +1 PT IF IT HOLDS
              </div>
            </div>
          </div>
        </HudFrame>
      </div>

      <div style={{ padding: '0 16px 20px' }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 10, letterSpacing: 3, color: t.textMuted, marginBottom: 8 }}>
          ◆ MATCH FEED
        </div>
        {[
          { min: "34'", icon: '⚽', text: 'GOL · Vinicius Jr.', team: fx.home, hot: true },
          { min: "22'", icon: '🟨', text: 'AMONESTACIÓN · Pedri', team: fx.away },
          { min: "18'", icon: '⚽', text: 'GOL · Bellingham', team: fx.home, hot: true },
          { min: "07'", icon: '⚽', text: 'GOL · Lewandowski', team: fx.away, hot: true },
        ].map((ev, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 4,
            background: ev.hot ? `${t.primary}0A` : t.surface, clipPath: HUD_CLIP_SM,
            borderLeft: `3px solid ${ev.team.color}`,
          }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textMuted, width: 38, fontWeight: 700 }}>
              {ev.min}
            </span>
            <span style={{ fontSize: 16 }}>{ev.icon}</span>
            <span style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: t.text }}>{ev.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUCCESS OVERLAY
// ═══════════════════════════════════════════════════════════
export function SuccessOverlay({ t, onDismiss }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'futpoolsSlide 0.3s both',
    }}>
      <div style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 10, filter: `drop-shadow(0 0 20px ${t.primary})` }}>🏆</div>
        <div style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 900, color: t.primary, letterSpacing: 3, marginBottom: 4 }}>
          PICKS LOCKED!
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.text, letterSpacing: 2, marginBottom: 4 }}>
          +25 XP · +1 STREAK
        </div>
        <div style={{ fontFamily: FONTS.body, fontSize: 12, color: t.textDim, marginBottom: 20 }}>
          ¡Buena suerte, jugador!
        </div>
        <ArcadeButton t={t} onClick={onDismiss}>▶ CONTINUE</ArcadeButton>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB BAR
// ═══════════════════════════════════════════════════════════
export function TabBar({ t, active, onChange }) {
  const tabs = [
    { id: 'home',     label: 'POOLS',    icon: '◆' },
    { id: 'entries',  label: 'ENTRIES',  icon: '▤' },
    { id: 'shop',     label: 'SHOP',     icon: '$' },
    { id: 'profile',  label: 'PROFILE',  icon: '◉' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: '8px 8px 36px',
      background: `linear-gradient(180deg, transparent, ${t.bg2} 30%)`,
      zIndex: 40,
    }}>
      <div style={{
        display: 'flex', gap: 4, padding: 6,
        background: t.surface, clipPath: HUD_CLIP,
        border: `1px solid ${t.stroke}`,
      }}>
        {tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onChange(tab.id)} style={{
              flex: 1, padding: '8px 4px',
              background: isActive ? `${t.primary}20` : 'transparent',
              color: isActive ? t.primary : t.textMuted,
              border: 'none', cursor: 'pointer',
              clipPath: HUD_CLIP_SM,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              position: 'relative',
            }}>
              {isActive && (
                <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, background: t.primary, boxShadow: `0 0 6px ${t.primary}` }} />
              )}
              <span style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 800 }}>{tab.icon}</span>
              <span style={{ fontFamily: FONTS.display, fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
