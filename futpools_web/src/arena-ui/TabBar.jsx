// TabBar.jsx — 4-tab Arena bottom nav (POOLS / ENTRIES / SHOP / PROFILE).
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const TAB_BAR_HEIGHT = 88; // total height incl. safe-area padding (use for bottom spacer)

// Mirrors the iOS Arena tab bar. /shop on web is informational (real purchases
// happen via iOS StoreKit) but the tab stays for visual parity.
const TABS = [
  { path: '/',        label: 'POOLS',    icon: '◆' },
  { path: '/entries', label: 'ENTRIES',  icon: '▤' },
  { path: '/shop',    label: 'SHOP',     icon: '$' },
  { path: '/account', label: 'PROFILE',  icon: '◉' },
];

export function ArenaTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeFor = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        right: 12,
        maxWidth: 430 - 24,
        margin: '0 auto',
        padding: 6,
        background: 'var(--fp-surface)',
        border: '1px solid var(--fp-stroke)',
        clipPath: 'var(--fp-clip)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        display: 'flex',
        gap: 4,
        zIndex: 50,
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeFor(tab.path);
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              padding: '8px 4px',
              position: 'relative',
              background: isActive ? 'color-mix(in srgb, var(--fp-primary) 15%, transparent)' : 'transparent',
              color: isActive ? 'var(--fp-primary)' : 'var(--fp-text-muted)',
              border: 'none',
              clipPath: 'var(--fp-clip-sm)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
            }}
          >
            {isActive && (
              <span style={{
                position: 'absolute',
                top: 0, left: '20%', right: '20%',
                height: 2,
                background: 'var(--fp-primary)',
                boxShadow: '0 0 6px var(--fp-primary)',
              }} />
            )}
            <span style={{ fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 16 }}>{tab.icon}</span>
            <span style={{
              fontFamily: 'var(--fp-display)',
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
