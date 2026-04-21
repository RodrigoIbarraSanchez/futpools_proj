// tokens.jsx — FutPools Arena design tokens + shared primitives
import React from 'react';

export const PALETTES = {
  neon: {
    primary: '#21E28C',
    primarySoft: '#2AF5A2',
    accent: '#36E9FF',
    hot: '#FF2BD6',
    danger: '#FF3B5C',
    gold: '#FFD166',
    silver: '#D0D4DA',
    bronze: '#E08855',
  },
  magenta: {
    primary: '#FF2BD6',
    primarySoft: '#FF55E0',
    accent: '#36E9FF',
    hot: '#21E28C',
    danger: '#FF3B5C',
    gold: '#FFD166',
    silver: '#D0D4DA',
    bronze: '#E08855',
  },
  gold: {
    primary: '#FFC738',
    primarySoft: '#FFD860',
    accent: '#36E9FF',
    hot: '#FF2BD6',
    danger: '#FF3B5C',
    gold: '#FFE27A',
    silver: '#D0D4DA',
    bronze: '#E08855',
  },
};

export const THEMES = {
  dark: {
    bg: '#07090D',
    bg2: '#0B0F14',
    surface: '#11161E',
    surfaceAlt: '#18202B',
    stroke: 'rgba(255,255,255,0.08)',
    strokeStrong: 'rgba(255,255,255,0.18)',
    text: '#F3F6FB',
    textDim: 'rgba(243,246,251,0.68)',
    textMuted: 'rgba(243,246,251,0.40)',
    textFaint: 'rgba(243,246,251,0.22)',
    pitch: '#0B2219',
    pitchLine: 'rgba(33,226,140,0.28)',
    scanline: 'rgba(255,255,255,0.022)',
  },
  light: {
    bg: '#EEF1F5',
    bg2: '#E4E8EE',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F7FA',
    stroke: 'rgba(7,14,22,0.08)',
    strokeStrong: 'rgba(7,14,22,0.18)',
    text: '#0A0F16',
    textDim: 'rgba(10,15,22,0.68)',
    textMuted: 'rgba(10,15,22,0.50)',
    textFaint: 'rgba(10,15,22,0.28)',
    pitch: '#E7F0EA',
    pitchLine: 'rgba(16,120,72,0.35)',
    scanline: 'rgba(0,0,0,0.02)',
  },
};

export const FONTS = {
  display: "'Oxanium', 'Chakra Petch', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Menlo', monospace",
  body: "'Inter', system-ui, sans-serif",
};

export const HUD_CLIP = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
export const HUD_CLIP_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
export const HUD_CLIP_LG = 'polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px)';

export function useTheme(themeKey = 'dark', paletteKey = 'neon') {
  const t = THEMES[themeKey];
  const p = PALETTES[paletteKey];
  return { ...t, ...p, themeKey, paletteKey };
}

export function HudFrame({ children, t, glow, style, clip = HUD_CLIP, bg, stroke, onClick, brackets = false }) {
  const fill = bg ?? t.surface;
  const strokeColor = stroke ?? t.stroke;
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        clipPath: clip,
        background: fill,
        cursor: onClick ? 'pointer' : undefined,
        filter: glow ? `drop-shadow(0 0 12px ${glow}66)` : undefined,
        ...style,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${strokeColor} 0%, transparent 40%, transparent 60%, ${strokeColor} 100%)`,
        clipPath: clip,
        padding: 1,
        pointerEvents: 'none',
      }}>
        <div style={{ width: '100%', height: '100%', background: fill, clipPath: clip }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      {brackets && <HudBrackets color={glow ?? t.primary} />}
    </div>
  );
}

export function HudBrackets({ color = '#21E28C', size = 10 }) {
  const s = { position: 'absolute', width: size, height: size, borderColor: color, pointerEvents: 'none' };
  return (
    <>
      <div style={{ ...s, top: 4, left: 4, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <div style={{ ...s, top: 4, right: 4, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
      <div style={{ ...s, bottom: 4, left: 4, borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <div style={{ ...s, bottom: 4, right: 4, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
    </>
  );
}

export function ScanlineOverlay({ intensity = 1, t }) {
  if (intensity <= 0) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100,
      opacity: intensity,
      background: `repeating-linear-gradient(0deg, ${t.scanline} 0, ${t.scanline} 1px, transparent 1px, transparent 3px)`,
      mixBlendMode: 'overlay',
    }} />
  );
}

export function HudChip({ children, color, bg, t, size = 'sm' }) {
  const c = color ?? t.primary;
  const fontSize = size === 'lg' ? 12 : size === 'sm' ? 10 : 11;
  const padH = size === 'lg' ? 10 : 8;
  const padV = size === 'lg' ? 5 : 3;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: `${padV}px ${padH}px`,
      background: bg ?? `${c}22`,
      color: c,
      fontFamily: FONTS.display,
      fontWeight: 700,
      fontSize,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
      lineHeight: 1,
    }}>{children}</span>
  );
}

export function LiveDot({ color = '#FF3B5C', size = 6 }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size, borderRadius: 999,
      background: color,
      boxShadow: `0 0 0 0 ${color}AA`,
      animation: 'futpoolsPulse 1.4s infinite',
    }} />
  );
}

export function TeamCrest({ name, color, size = 36 }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      clipPath: 'polygon(50% 0, 100% 22%, 100% 75%, 50% 100%, 0 75%, 0 22%)',
      background: `linear-gradient(180deg, ${color}, ${color}AA)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONTS.display,
      fontWeight: 800,
      fontSize: size * 0.36,
      color: '#fff',
      textShadow: '0 1px 0 rgba(0,0,0,0.3)',
      letterSpacing: 0.5,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export function XpBar({ value, max = 100, t, color, segments = 20, height = 8 }) {
  const fillColor = color ?? t.primary;
  const filled = Math.floor((value / max) * segments);
  return (
    <div style={{ display: 'flex', gap: 2, height }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} style={{
          flex: 1,
          background: i < filled ? fillColor : t.surfaceAlt,
          boxShadow: i < filled ? `0 0 4px ${fillColor}AA` : 'none',
        }} />
      ))}
    </div>
  );
}

export function DivisionBadge({ tier = 'gold', size = 44 }) {
  const tiers = {
    bronze: { c1: '#E08855', c2: '#9C5234', label: 'III' },
    silver: { c1: '#E6EAF0', c2: '#8A92A0', label: 'II' },
    gold:   { c1: '#FFD166', c2: '#C99122', label: 'I'  },
    diamond:{ c1: '#6FEBFF', c2: '#2B8AC0', label: '◆' },
    legend: { c1: '#FF55E0', c2: '#7A1FB8', label: '★' },
  };
  const tc = tiers[tier] ?? tiers.gold;
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      clipPath: 'polygon(50% 0, 100% 25%, 100% 70%, 50% 100%, 0 70%, 0 25%)',
      background: `linear-gradient(180deg, ${tc.c1}, ${tc.c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONTS.display,
      fontWeight: 900,
      fontSize: size * 0.42,
      color: '#0A0F16',
      textShadow: '0 1px 0 rgba(255,255,255,0.3)',
      flexShrink: 0,
    }}>
      {tc.label}
    </div>
  );
}

export function ArcadeButton({ children, onClick, variant = 'primary', size = 'md', disabled, t, fullWidth, style }) {
  const bg =
    variant === 'primary' ? t.primary :
    variant === 'accent'  ? t.accent :
    variant === 'hot'     ? t.hot :
    variant === 'ghost'   ? 'transparent' :
    t.surfaceAlt;
  const color = (variant === 'primary' || variant === 'accent' || variant === 'hot') ? '#061018' : t.text;
  const padV = size === 'lg' ? 16 : size === 'sm' ? 8 : 12;
  const padH = size === 'lg' ? 24 : size === 'sm' ? 14 : 20;
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 14;
  const border = variant === 'ghost' ? `1px solid ${t.strokeStrong}` : 'none';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        padding: `${padV}px ${padH}px`,
        background: bg,
        color,
        fontFamily: FONTS.display,
        fontWeight: 800,
        fontSize,
        letterSpacing: 2,
        textTransform: 'uppercase',
        border,
        clipPath: HUD_CLIP_SM,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        width: fullWidth ? '100%' : undefined,
        boxShadow: variant === 'primary' && !disabled ? `0 0 20px ${bg}55` : 'none',
        transition: 'transform 0.08s',
        ...style,
      }}
      onMouseDown={e => e.currentTarget.style.transform = 'translateY(1px)'}
      onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {children}
    </button>
  );
}

export function FutPoolsStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@400;600;700;800&family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');

      @keyframes futpoolsPulse {
        0% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
        70% { box-shadow: 0 0 0 8px transparent; opacity: 0.6; }
        100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
      }
      @keyframes futpoolsScan {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
      }
      @keyframes futpoolsGlow {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
      @keyframes futpoolsSheen {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes futpoolsCountUp {
        from { transform: translateY(8px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes futpoolsShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
      }
      @keyframes futpoolsBlink {
        0%, 50%, 100% { opacity: 1; }
        25%, 75% { opacity: 0.3; }
      }
      @keyframes futpoolsFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }
      @keyframes futpoolsSlide {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .fp-scroll::-webkit-scrollbar { width: 3px; height: 3px; }
      .fp-scroll::-webkit-scrollbar-thumb { background: rgba(33,226,140,0.4); }
      .fp-scroll::-webkit-scrollbar-track { background: transparent; }
    `}</style>
  );
}
