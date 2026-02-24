export function Pill({ label }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'var(--app-surface-alt)',
        color: 'var(--app-text-secondary)',
      }}
    >
      {label}
    </span>
  );
}
