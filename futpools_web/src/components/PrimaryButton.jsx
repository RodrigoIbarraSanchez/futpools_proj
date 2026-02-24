export function PrimaryButton({ children, onClick, disabled, style = 'purple', type = 'button' }) {
  const isGreen = style === 'green';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        fontSize: 17,
        fontWeight: 600,
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--app-radius-button)',
        background: isGreen
          ? 'linear-gradient(to right, var(--app-primary-soft), var(--app-primary))'
          : 'linear-gradient(to right, var(--app-primary), var(--app-accent))',
        boxShadow: '0 10px 16px rgba(33, 226, 140, 0.35)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
