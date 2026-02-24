export function CardView({ children, style = {} }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--app-surface), var(--app-surface-alt))',
        borderRadius: 'var(--app-radius-card)',
        padding: 'var(--spacing-md)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
