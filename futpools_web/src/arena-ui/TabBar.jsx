// TabBar.jsx — bottom nav for simple_version.
//
// Reduced from the master 4-tabs+FAB ("POOLS · ENTRIES · [+] · SHOP · PROFILE")
// to a 3-tab layout (POOLS · PROFILE, plus an admin-only ADMIN tab).
// The "+" creation FAB is gone — pool creation is admin-only and reached via
// /admin/pools/new from the Account page; regular users have no creation
// surface at all in simple_version.
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n/translations';

export const TAB_BAR_HEIGHT = 88;

const CLIP_HUD_SM =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const CLIP_HUD_MD =
  'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';

export function ArenaTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const { user } = useAuth();

  // Admins get the extra ADMIN tab pointing to the create-pool form. The
  // backend gates POST /quinielas to admin, so non-admins never see the tab
  // (and would be bounced by AdminRoute even if they navigated by URL).
  const tabs = [
    { path: '/',        key: 'POOLS',    icon: '◆' },
    { path: '/account', key: 'PROFILE',  icon: '◉' },
  ];
  if (user?.isAdmin) {
    tabs.push({ path: '/admin/pools/new', key: 'ADMIN', icon: '⚙' });
  }

  const activeFor = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

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
        {tabs.map(renderTab)}
      </nav>
    </div>
  );
}
