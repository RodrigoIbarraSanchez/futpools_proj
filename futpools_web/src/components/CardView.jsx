export function CardView({ children, style = {} }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--app-surface) 0%, var(--app-surface-alt) 100%)',
        borderRadius: 'var(--app-radius-card)',
        padding: 'var(--spacing-md)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: [
          '0 0 16px rgba(33, 226, 140, 0.1)',
          '0 12px 18px rgba(0, 0, 0, 0.4)',
        ].join(', '),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
