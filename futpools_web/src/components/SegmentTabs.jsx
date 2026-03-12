/**
 * Capsule segment tabs like iOS SegmentTab: selected tab uses primary→accent gradient.
 */
export function SegmentTabs({ tabs, selectedIndex, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--spacing-xs)',
        padding: 'var(--spacing-xs)',
        background: 'rgba(27, 36, 48, 0.7)',
        borderRadius: 'var(--app-radius-pill)',
        border: '1px solid rgba(38, 50, 68, 0.7)',
      }}
    >
      {tabs.map((label, index) => {
        const isSelected = selectedIndex === index;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onChange(index)}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: 'none',
              borderRadius: 'var(--app-radius-pill)',
              background: isSelected
                ? 'linear-gradient(90deg, var(--app-primary), var(--app-accent))'
                : 'transparent',
              color: isSelected ? 'var(--app-text-primary)' : 'var(--app-text-secondary)',
              fontSize: 11,
              fontWeight: isSelected ? 600 : 400,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
