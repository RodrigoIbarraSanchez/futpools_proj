// Single source of truth for FutPools Rank tier + achievement lookups on web.
// Mirrors iOS AchievementCatalog.swift so backend code maps cleanly to both.

/** Backend tier code → DivisionBadge visual tier. */
export const TIER_TO_DIVISION = {
  rookie:  'bronze',
  amateur: 'silver',
  pro:     'gold',
  veteran: 'diamond',
  legend:  'legend',
};

/** Human-readable tier names (ES handled via i18n at render time). */
export const TIER_NAMES = {
  rookie:  'Rookie',
  amateur: 'Amateur',
  pro:     'Pro',
  veteran: 'Veteran',
  legend:  'Legend',
};

/**
 * Ordered catalog — render order matters (early-game unlocks first so new users
 * see attainable goals at the top). Accent colors use the same CSS variable
 * palette as the rest of the Arena UI.
 */
export const ACHIEVEMENTS = [
  { code: 'first_pool',             titleKey: 'First Pool',         detailKey: 'Played your first pool.',       icon: '🎯', accent: 'var(--fp-primary)' },
  { code: 'first_win',              titleKey: 'First Win',          detailKey: 'Won your first pool.',          icon: '🏆', accent: 'var(--fp-gold)'    },
  { code: 'first_perfect_matchday', titleKey: 'Perfect Matchday',   detailKey: '100% correct in a pool.',       icon: '✨', accent: 'var(--fp-gold)'    },
  { code: 'streak_5',               titleKey: 'Streak 5',           detailKey: 'Win 5 pools in a row.',         icon: '🔥', accent: 'var(--fp-hot)'     },
  { code: 'streak_10',              titleKey: 'Streak 10',          detailKey: 'Win 10 pools in a row.',        icon: '🔥', accent: 'var(--fp-hot)'     },
  { code: 'streak_20',              titleKey: 'Streak 20',          detailKey: 'Win 20 pools in a row.',        icon: '🔥', accent: 'var(--fp-hot)'     },
  { code: 'veteran_25_pools',       titleKey: 'Veteran (25)',       detailKey: 'Played 25 pools.',              icon: '🎖', accent: 'var(--fp-accent)'  },
  { code: 'veteran_100_pools',      titleKey: 'Century (100)',      detailKey: 'Played 100 pools.',             icon: '💯', accent: 'var(--fp-accent)'  },
  { code: 'tier_amateur_reached',   titleKey: 'Amateur Unlocked',   detailKey: 'Reached the Amateur tier.',     icon: 'II', accent: 'var(--fp-text-dim)' },
  { code: 'tier_pro_reached',       titleKey: 'Pro Unlocked',       detailKey: 'Reached the Pro tier.',         icon: 'I',  accent: 'var(--fp-gold)'    },
  { code: 'tier_veteran_reached',   titleKey: 'Veteran Unlocked',   detailKey: 'Reached the Veteran tier.',     icon: '◆',  accent: 'var(--fp-accent)'  },
  { code: 'tier_legend_reached',    titleKey: 'Legend Unlocked',    detailKey: 'Reached the Legend tier.',      icon: '★',  accent: '#FF55E0'           },
  { code: 'top3_x10',               titleKey: 'Podium Pro',         detailKey: '10 top-3 finishes.',            icon: '🥉', accent: 'var(--fp-primary)' },
  { code: 'weekly_winner',          titleKey: 'Weekly Winner',      detailKey: 'Won a weekly event.',           icon: '🗓', accent: 'var(--fp-primary)' },
  { code: 'comeback_kid',           titleKey: 'Comeback Kid',       detailKey: 'Win after three losses.',       icon: '⚡', accent: 'var(--fp-hot)'     },
];

export function metaForAchievement(code) {
  return ACHIEVEMENTS.find((a) => a.code === code) || null;
}

/** Percent [0..1] through the current tier, from a rank summary. */
export function progressInTier(summary) {
  if (!summary) return 0;
  const span = Math.max(summary.tierMax - summary.tierMin, 1);
  const pos = Math.max(0, Math.min(summary.tierMax - summary.tierMin, summary.rating - summary.tierMin));
  return pos / span;
}
