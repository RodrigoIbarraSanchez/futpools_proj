import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';

const tabs = [
  { path: '/', labelKey: 'Pools', icon: '🏆' },
  { path: '/entries', labelKey: 'My Entries', icon: '🎫' },
  { path: '/account', labelKey: 'Account', icon: '👤' },
];

export function MainTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const current = tabs.find((tab) => location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', paddingBottom: 60 }}>
      <AppBackground />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 430,
          margin: '0 auto',
          background: 'var(--app-surface)',
          borderTop: '1px solid var(--app-stroke)',
          display: 'flex',
          justifyContent: 'space-around',
          padding: 'var(--spacing-sm) 0',
          zIndex: 50,
        }}
      >
        {tabs.map((tab) => {
          const isActive = current?.path === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                background: isActive ? 'rgba(33, 226, 140, 0.2)' : 'transparent',
                border: 'none',
                borderRadius: 12,
                padding: 'var(--spacing-sm) var(--spacing-md)',
                color: isActive ? 'var(--app-primary)' : 'var(--app-text-muted)',
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              {t(locale, tab.labelKey)}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
