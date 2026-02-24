export function AppBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--app-background)',
        zIndex: -1,
      }}
    />
  );
}
