export function AppBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: 'var(--app-background)',
        backgroundImage: [
          'linear-gradient(135deg, rgba(33, 226, 140, 0.12) 0%, rgba(54, 233, 255, 0.08) 50%, transparent 100%)',
          'radial-gradient(ellipse 420px 420px at 50% 0%, rgba(33, 226, 140, 0.08) 0%, transparent 70%)',
          'radial-gradient(ellipse 350px 350px at 50% 100%, rgba(12, 35, 34, 0.4) 0%, transparent 70%)',
          'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.15) 100%)',
        ].join(', '),
      }}
    />
  );
}
