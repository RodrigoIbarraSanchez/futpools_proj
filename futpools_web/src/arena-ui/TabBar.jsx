// TabBar.jsx — 4-tab Arena bottom nav with an elevated centre "+" create button.
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n/translations';

export const TAB_BAR_HEIGHT = 88;

// Mirrors the iOS MainTabView: tabs split around a centre create FAB so the
// primary action lives inside the bar itself (Strava/Instagram pattern).
const LEFT_TABS = [
  { path: '/',        key: 'POOLS',    icon: '◆' },
  { path: '/entries', key: 'ENTRIES',  icon: '▤' },
];
const RIGHT_TABS = [
  { path: '/shop',    key: 'SHOP',     icon: '$' },
  { path: '/account', key: 'PROFILE',  icon: '◉' },
];

const CLIP_HUD_SM =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const CLIP_HUD_MD =
  'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';

export function ArenaTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const { isAuthenticated } = useAuth();

  const activeFor = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const isCreateActive = location.pathname.startsWith('/create');

  const renderTab = (tab) => {
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
          clipPath: CLIP_HUD_SM,
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
        }}>{t(locale, tab.key)}</span>
      </button>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        right: 12,
        maxWidth: 430 - 24,
        margin: '0 auto',
        zIndex: 50,
        // container sits around the bar so the lifted centre button isn't clipped
      }}
    >
      <nav
        style={{
          padding: 6,
          background: 'var(--fp-surface)',
          border: '1px solid var(--fp-stroke)',
          clipPath: CLIP_HUD_MD,
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          display: 'flex',
          gap: 4,
          alignItems: 'stretch',
        }}
      >
        {LEFT_TABS.map(renderTab)}
        {/* Placeholder keeps spacing symmetric; real "+" is absolutely lifted */}
        <div style={{ flex: 1, minWidth: 56 }} />
        {RIGHT_TABS.map(renderTab)}
      </nav>

      {/* Elevated centre create button */}
      {isAuthenticated && (
        <button
          type="button"
          onClick={() => navigate('/create')}
          aria-label={t(locale, 'Create pool')}
          style={{
            position: 'absolute',
            left: '50%',
            top: -22,
            transform: 'translateX(-50%)',
            width: 56,
            height: 56,
            background: 'var(--fp-primary)',
            color: 'var(--fp-on-primary)',
            border: '3px solid var(--fp-bg)',
            clipPath: CLIP_HUD_MD,
            cursor: 'pointer',
            fontFamily: 'var(--fp-display)',
            fontSize: 24,
            fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 22px rgba(33,226,140,0.55)',
            outline: isCreateActive ? '2px solid var(--fp-primary-soft, var(--fp-primary))' : 'none',
            outlineOffset: isCreateActive ? 2 : 0,
          }}
        >+</button>
      )}
    </div>
  );
}
