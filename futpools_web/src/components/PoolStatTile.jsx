/**
 * Stat tile like iOS PoolStatTile: icon circle + label + value (Prize, Entry, Fixtures, Entries).
 */
const ICONS = {
  prize: '🏆',
  entry: '🎫',
  fixtures: '⚽',
  entries: '👥',
};

export function PoolStatTile({ label, value, iconKey, accent }) {
  const emoji = ICONS[iconKey] ?? '•';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--app-surface-alt)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
        }}
      >
        {emoji}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: accent === 'gold' ? 'var(--app-gold)' : 'var(--app-text-primary)',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
