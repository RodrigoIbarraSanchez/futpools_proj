// ThermometerLadder — the gamified prize-ladder hero for prize_ladder pools.
// A vertical thermometer (mercury rises with your aciertos) next to the tier
// cards, plus a big animated "live prize" readout. Built on the same CSS
// tokens / clip-path aesthetic as the rest of arena-ui.
import React, { useEffect, useRef, useState } from 'react';
import { HudFrame, HudChip } from './primitives';
import { t, tFormat } from '../i18n/translations';
import { prizeForCorrect, formatMXN, tierRangeLabel } from '../lib/prizeLadder';

// Map a "how close to the top" ratio (0..1) to the thermometer color ramp:
// green (hot/winning) at the top → red (cold) at the bottom, matching the
// product mock.
function rampColor(ratio) {
  if (ratio >= 0.92) return 'var(--fp-primary)';   // neon green
  if (ratio >= 0.75) return '#7CE05A';              // lime
  if (ratio >= 0.6) return 'var(--fp-gold)';        // gold
  if (ratio >= 0.45) return '#FF9F45';              // orange
  return 'var(--fp-danger)';                        // red
}

// Smoothly tween a number when it changes (count-up on the live prize).
function useCountUp(target, durationMs = 700) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = Number(target) || 0;
    if (from === to) { setDisplay(to); return; }
    startRef.current = 0;
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);
  return display;
}

export function ThermometerLadder({
  ladder = [],
  liveScore = 0,
  settledScore = 0,
  fixtureCount = 0,
  hasLiveFixtures = false,
  locale = 'es',
}) {
  const denom = Math.max(fixtureCount, 1);
  const livePrize = prizeForCorrect(ladder, liveScore);
  const displayPrize = useCountUp(livePrize);
  const fillRatio = Math.max(0, Math.min(1, liveScore / denom));

  // Which tier the player currently sits in (for the highlight).
  const currentTier = ladder.find((tr) => liveScore >= tr.min && liveScore <= tr.max) || null;

  // Bump animation key — re-trigger the glow pulse whenever the live prize
  // ticks up so the user feels the moment.
  const prevPrizeRef = useRef(livePrize);
  const [bumpKey, setBumpKey] = useState(0);
  useEffect(() => {
    if (livePrize > prevPrizeRef.current) setBumpKey((k) => k + 1);
    prevPrizeRef.current = livePrize;
  }, [livePrize]);

  return (
    <div>
      {/* keyframes (scoped, injected once) */}
      <style>{`
        @keyframes fpThermoBump { 0%{transform:scale(1)} 35%{transform:scale(1.08)} 100%{transform:scale(1)} }
        @keyframes fpThermoRise { from{filter:brightness(1.4)} to{filter:brightness(1)} }
      `}</style>

      {/* Live prize readout */}
      <HudFrame clip="md" glow={rampColor(fillRatio)} brackets
        bg="var(--fp-surface)"
        style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 10, fontWeight: 700,
            letterSpacing: 2, color: 'var(--fp-text-muted)', textTransform: 'uppercase',
          }}>
            {hasLiveFixtures ? t(locale, 'YOUR LIVE PRIZE') : t(locale, 'YOUR PRIZE')}
          </div>
          {hasLiveFixtures && (
            <HudChip color="var(--fp-danger)" showLiveDot>{t(locale, 'LIVE · MAY CHANGE')}</HudChip>
          )}
        </div>
        <div
          key={bumpKey}
          style={{
            fontFamily: 'var(--fp-display)', fontWeight: 900, fontSize: 44,
            lineHeight: 1.05, marginTop: 4,
            color: rampColor(fillRatio),
            textShadow: `0 0 24px ${rampColor(fillRatio)}66`,
            animation: bumpKey ? 'fpThermoBump 0.5s ease-out' : undefined,
          }}
        >
          {formatMXN(displayPrize)}
        </div>
        <div style={{
          marginTop: 2, fontFamily: 'var(--fp-mono)', fontSize: 11,
          color: 'var(--fp-text-dim)',
        }}>
          {tFormat(locale, '{n} of {total} correct', { n: liveScore, total: fixtureCount })}
        </div>
      </HudFrame>

      {/* Thermometer + tier cards */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Thermometer tube */}
        <div style={{
          width: 46, flexShrink: 0, position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            position: 'relative', flex: 1, width: 26,
            borderRadius: 14,
            background: 'var(--fp-bg2)',
            border: '1px solid var(--fp-stroke)',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 8px rgba(0,0,0,0.5)',
          }}>
            {/* faint full-scale gradient backdrop */}
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.18,
              background: 'linear-gradient(to top, var(--fp-danger), #FF9F45, var(--fp-gold), #7CE05A, var(--fp-primary))',
            }} />
            {/* mercury fill (rises from bottom) */}
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: `${fillRatio * 100}%`,
              background: 'linear-gradient(to top, var(--fp-danger), #FF9F45, var(--fp-gold), #7CE05A, var(--fp-primary))',
              boxShadow: `0 0 16px ${rampColor(fillRatio)}AA`,
              transition: 'height 0.8s cubic-bezier(0.22,1,0.36,1)',
              animation: bumpKey ? 'fpThermoRise 0.8s ease-out' : undefined,
            }} />
          </div>
          {/* bulb — carries the player's current acierto count */}
          <div style={{
            width: 44, height: 44, borderRadius: '50%', marginTop: -8,
            background: `radial-gradient(circle at 35% 30%, ${rampColor(fillRatio)}, var(--fp-danger))`,
            border: '1px solid var(--fp-stroke)',
            boxShadow: `0 0 18px ${rampColor(fillRatio)}AA`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            title={`${liveScore} / ${fixtureCount}`}
          >
            <span style={{
              fontFamily: 'var(--fp-display)', fontWeight: 900, fontSize: 18, lineHeight: 1,
              color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.45)',
            }}>{liveScore}</span>
          </div>
        </div>

        {/* Tier cards */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ladder.map((tr, i) => {
            const ratio = Math.max(0, Math.min(1, tr.max / denom));
            const color = rampColor(ratio);
            const isCurrent = currentTier && tr.min === currentTier.min && tr.max === currentTier.max;
            const zeroPrize = Number(tr.prizeMXN) <= 0;
            return (
              <div key={`${tr.min}-${tr.max}-${i}`}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, padding: '9px 12px',
                  clipPath: 'var(--fp-clip-sm)',
                  background: isCurrent
                    ? `color-mix(in srgb, ${color} 22%, var(--fp-surface))`
                    : 'var(--fp-surface)',
                  border: `1px solid ${isCurrent ? color : 'var(--fp-stroke)'}`,
                  boxShadow: isCurrent ? `0 0 16px ${color}66` : 'none',
                  transform: isCurrent ? 'scale(1.015)' : 'none',
                  transition: 'all 0.25s ease',
                  opacity: zeroPrize && !isCurrent ? 0.6 : 1,
                }}>
                <div style={{
                  fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 14,
                  letterSpacing: 0.5, color: isCurrent ? 'var(--fp-text)' : 'var(--fp-text-dim)',
                }}>
                  {tierRangeLabel(tr, locale)}
                </div>
                <div style={{
                  fontFamily: 'var(--fp-display)', fontWeight: 900, fontSize: 18,
                  color: zeroPrize ? 'var(--fp-text-muted)' : color,
                  textShadow: isCurrent ? `0 0 12px ${color}88` : 'none',
                }}>
                  {formatMXN(tr.prizeMXN)}
                </div>
                {isCurrent && (
                  <div style={{
                    position: 'absolute', left: -7, top: '50%', transform: 'translateY(-50%)',
                    width: 0, height: 0,
                    borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
                    borderLeft: `7px solid ${color}`,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ThermometerLadder;
