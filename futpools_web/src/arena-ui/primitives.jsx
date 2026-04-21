// primitives.jsx — self-contained Arena UI components for production pages.
// They read from CSS variables (:root) so no theme prop is needed.
import React from 'react';

// ──────────────────────────────────────────────────────────────
// HudFrame — corner-cut container with optional glow + brackets
// ──────────────────────────────────────────────────────────────
export function HudFrame({
  children, clip = 'md', glow, brackets, bg, stroke,
  style, onClick,
}) {
  const clipPath =
    clip === 'sm' ? 'var(--fp-clip-sm)' :
    clip === 'lg' ? 'var(--fp-clip-lg)' :
    'var(--fp-clip)';

  const fill = bg ?? 'var(--fp-surface)';
  const strokeColor = stroke ?? 'var(--fp-stroke)';

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        clipPath,
        background: fill,
        cursor: onClick ? 'pointer' : undefined,
        filter: glow ? `drop-shadow(0 0 12px ${glow}66)` : undefined,
        ...style,
      }}
    >
      {/* Border via gradient sandwich (clip-path kills border) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${strokeColor} 0%, transparent 40%, transparent 60%, ${strokeColor} 100%)`,
        clipPath,
        padding: 1,
        pointerEvents: 'none',
      }}>
        <div style={{ width: '100%', height: '100%', background: fill, clipPath }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      {brackets && <HudBrackets color={glow ?? 'var(--fp-primary)'} />}
    </div>
  );
}

function HudBrackets({ color, size = 10 }) {
  const s = { position: 'absolute', width: size, height: size, pointerEvents: 'none' };
  return (
    <>
      <div style={{ ...s, top: 4, left: 4,  borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <div style={{ ...s, top: 4, right: 4, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
      <div style={{ ...s, bottom: 4, left: 4,  borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <div style={{ ...s, bottom: 4, right: 4, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// ArcadeButton — chunky HUD CTA
// ──────────────────────────────────────────────────────────────
export function ArcadeButton({
  children, onClick, variant = 'primary', size = 'md',
  fullWidth, disabled, type = 'button', style,
}) {
  const bg =
    variant === 'primary' ? 'var(--fp-primary)' :
    variant === 'accent'  ? 'var(--fp-accent)'  :
    variant === 'hot'     ? 'var(--fp-hot)'     :
    variant === 'ghost'   ? 'transparent'       :
    'var(--fp-surface-alt)';

  const color = (variant === 'primary' || variant === 'accent' || variant === 'hot')
    ? 'var(--fp-on-primary)'
    : 'var(--fp-text)';

  const padV = size === 'lg' ? 16 : size === 'sm' ? 8 : 12;
  const padH = size === 'lg' ? 24 : size === 'sm' ? 14 : 20;
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 14;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        padding: `${padV}px ${padH}px`,
        background: bg,
        color,
        fontFamily: 'var(--fp-display)',
        fontWeight: 800,
        fontSize,
        letterSpacing: 2,
        textTransform: 'uppercase',
        border: variant === 'ghost' ? `1px solid var(--fp-stroke-strong)` : 'none',
        clipPath: 'var(--fp-clip-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        width: fullWidth ? '100%' : undefined,
        boxShadow: variant === 'primary' && !disabled ? `0 0 20px ${'var(--fp-primary)'}55` : 'none',
        transition: 'transform 0.08s',
        ...style,
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(1px)'; }}
      onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────
// HudChip — parallelogram status pill
// ──────────────────────────────────────────────────────────────
export function HudChip({ children, color = 'var(--fp-primary)', showLiveDot, bg, size = 'sm' }) {
  const fontSize = size === 'lg' ? 12 : 10;
  const padH = size === 'lg' ? 10 : 8;
  const padV = size === 'lg' ? 5 : 3;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: `${padV}px ${padH}px`,
      background: bg ?? `color-mix(in srgb, ${color} 15%, transparent)`,
      color,
      fontFamily: 'var(--fp-display)',
      fontWeight: 700,
      fontSize,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
      lineHeight: 1,
    }}>
      {showLiveDot && <LiveDot color={color} size={5} />}
      {children}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// LiveDot — pulsing status dot
// ──────────────────────────────────────────────────────────────
export function LiveDot({ color = 'var(--fp-danger)', size = 6 }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size, borderRadius: 999,
      background: color,
      boxShadow: `0 0 0 0 ${color}AA`,
      animation: 'fpPulse 1.4s infinite',
    }} />
  );
}

// ──────────────────────────────────────────────────────────────
// TeamCrest — logo image or initials fallback (no hex shield)
// ──────────────────────────────────────────────────────────────
export function TeamCrest({ name, color = 'var(--fp-accent)', size = 36, logoURL }) {
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  if (logoURL) {
    return (
      <img
        src={logoURL}
        alt={name}
        style={{
          width: size, height: size,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--fp-surface-alt)',
      border: `1px solid ${color}66`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--fp-display)',
      fontWeight: 800,
      fontSize: size * 0.34,
      color: 'var(--fp-text)',
      flexShrink: 0,
    }}>{initials}</div>
  );
}

// ──────────────────────────────────────────────────────────────
// XpBar — segmented pixel progress bar
// ──────────────────────────────────────────────────────────────
export function XpBar({ value, max = 100, color = 'var(--fp-primary)', segments = 20, height = 8 }) {
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const filled = Math.floor(ratio * segments);
  return (
    <div style={{ display: 'flex', gap: 2, height }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} style={{
          flex: 1,
          background: i < filled ? color : 'var(--fp-surface-alt)',
          boxShadow: i < filled ? `0 0 4px ${color}AA` : 'none',
        }} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// DivisionBadge — rank shield
// ──────────────────────────────────────────────────────────────
export function DivisionBadge({ tier = 'gold', size = 44 }) {
  const tiers = {
    bronze:  { c1: '#E08855', c2: '#9C5234', label: 'III' },
    silver:  { c1: '#E6EAF0', c2: '#8A92A0', label: 'II' },
    gold:    { c1: '#FFD166', c2: '#C99122', label: 'I' },
    diamond: { c1: '#6FEBFF', c2: '#2B8AC0', label: '◆' },
    legend:  { c1: '#FF55E0', c2: '#7A1FB8', label: '★' },
  };
  const tc = tiers[tier] ?? tiers.gold;
  return (
    <div style={{
      width: size, height: size,
      clipPath: 'polygon(50% 0, 100% 25%, 100% 70%, 50% 100%, 0 70%, 0 25%)',
      background: `linear-gradient(180deg, ${tc.c1}, ${tc.c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--fp-display)',
      fontWeight: 900,
      fontSize: size * 0.42,
      color: 'var(--fp-on-primary)',
      textShadow: '0 1px 0 rgba(255,255,255,0.3)',
      flexShrink: 0,
    }}>{tc.label}</div>
  );
}

// ──────────────────────────────────────────────────────────────
// StatTile / StatInline
// ──────────────────────────────────────────────────────────────
export function StatTile({ label, value, color = 'var(--fp-text)' }) {
  return (
    <div style={{
      padding: '6px 8px',
      background: 'var(--fp-bg2)',
      clipPath: 'var(--fp-clip-sm)',
    }}>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 8, letterSpacing: 1.5,
        color: 'var(--fp-text-muted)', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 14, fontWeight: 700,
        color, letterSpacing: 0.3,
      }}>{value}</div>
    </div>
  );
}

export function StatInline({ label, value, color = 'var(--fp-text)', mono }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1.5,
        color: 'var(--fp-text-muted)', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? 'var(--fp-mono)' : 'var(--fp-display)',
        fontSize: 18, fontWeight: 800, color, letterSpacing: 0.5,
      }}>{value}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ArenaInput — styled text input
// ──────────────────────────────────────────────────────────────
export const arenaInputStyle = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--fp-bg2)',
  border: '1px solid var(--fp-stroke)',
  color: 'var(--fp-text)',
  fontFamily: 'var(--fp-mono)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

export function ArenaLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 2,
      color: 'var(--fp-text-muted)', textTransform: 'uppercase', marginBottom: 4,
    }}>{children}</div>
  );
}

// ──────────────────────────────────────────────────────────────
// SectionLabel — "◆ TITLE" header
// ──────────────────────────────────────────────────────────────
export function SectionLabel({ children, color = 'var(--fp-text-muted)' }) {
  return (
    <div style={{
      fontFamily: 'var(--fp-display)',
      fontSize: 10, fontWeight: 700, letterSpacing: 3,
      color, textTransform: 'uppercase',
    }}>
      ◆ {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// IconButton — square HUD-cut back / share / settings button
// ──────────────────────────────────────────────────────────────
export function IconButton({ children, onClick, size = 32 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: size, height: size,
        background: 'var(--fp-surface)',
        border: '1px solid var(--fp-stroke)',
        color: 'var(--fp-text)',
        fontFamily: 'var(--fp-display)',
        fontWeight: 800,
        fontSize: 14,
        clipPath: 'var(--fp-clip-sm)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}
