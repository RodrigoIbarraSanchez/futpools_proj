// DesktopShell — sidebar + topbar wrapper that replaces the bottom tab
// bar at viewport ≥ 1100px. Renders the same <Outlet/> as MainTabs so
// route children (Home, LiveScores, MyEntries, Account, Settings) work
// in either shell unchanged.
//
// Sidebar items mirror simple_version's surfaces:
//   Quinielas (/) · En Vivo (/scores) · Mis Apuestas (/entries) ·
//   Mi Cuenta (/account) + Ajustes (/settings) + Cerrar sesión.
//
// Top bar carries breadcrumbs (derived from the current route) and an
// avatar tile. There's no balance pill — simple_version has no coin/
// credit economy; pool entry is paid per-pool via Stripe.
import { useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';

const Icon = ({ name, size = 18 }) => {
  const props = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'trophy':
      return <svg {...props}><path d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>;
    case 'fire':
      return <svg {...props}><path d="M12 22a7 7 0 0 1-7-7c0-4 3-6 4-9 0 0 4 1 4 6 1-1 2-2 2-4 3 2 5 5 5 8a7 7 0 0 1-8 6z"/></svg>;
    case 'ticket':
      return <svg {...props}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M9 6v12"/></svg>;
    case 'user':
      return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'logout':
      return <svg {...props}><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>;
    case 'menu':
      return <svg {...props}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'wallet':
      return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v2H5a2 2 0 0 0 0 4h15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="16" cy="11.5" r="1"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
  }
};

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || parts[0][0];
}

// Maps a path to a `[parent, current]` breadcrumb pair. Keeps it simple:
// the design's design only ever shows one or two crumbs.
function crumbsFor(pathname, locale) {
  const tr = (k) => t(locale, k);
  if (pathname === '/' || pathname.startsWith('/?')) return [tr('Pools')];
  if (pathname.startsWith('/scores')) return [tr('Pools'), tr('Live')];
  if (pathname.startsWith('/account')) return [tr('Account')];
  if (pathname.startsWith('/settings')) return [tr('Account'), tr('Settings')];
  if (pathname.startsWith('/leaderboard')) return [tr('Account'), tr('Leaderboard')];
  if (pathname.startsWith('/admin/payouts')) return ['Admin', tr('Pending payouts')];
  if (pathname.startsWith('/admin/pools/new')) return ['Admin', tr('Create pool')];
  return [tr('Pools')];
}

function NavItem({ icon, label, active, badge, count, onClick }) {
  return (
    <button
      type="button"
      className={`fp-nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="fp-nav-icon"><Icon name={icon} /></span>
      <span className="fp-label">{label}</span>
      {badge && <span className="fp-nav-badge">{badge}</span>}
      {count != null && !badge && <span className="fp-nav-count">{count}</span>}
    </button>
  );
}

function Sidebar({ pathname, navigate, mini, locale, isAdmin, logout, navigateOnboarding }) {
  // Active-route matching is conservative: '/' must match exactly so it
  // doesn't light up under '/account' or '/scores'.
  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <aside className={`fp-desktop-sidebar`}>
      <div className="fp-brand">
        <div className="fp-brand-mark">F</div>
        {!mini && <div className="fp-brand-name">fut<span>pools</span></div>}
      </div>

      {!mini && <div className="fp-nav-section">{t(locale, 'PLAY')}</div>}
      <NavItem icon="trophy" label={t(locale, 'Pools')}
               active={isActive('/')} onClick={() => navigate('/')} />
      <NavItem icon="fire" label={t(locale, 'Live')}
               active={isActive('/scores')} onClick={() => navigate('/scores')} />

      {!mini && <div className="fp-nav-section">{t(locale, 'ACCOUNT')}</div>}
      <NavItem icon="user" label={t(locale, 'Account')}
               active={isActive('/account')} onClick={() => navigate('/account')} />

      {isAdmin && (
        <>
          {!mini && <div className="fp-nav-section">Admin</div>}
          <NavItem icon="plus" label={t(locale, 'Create pool')}
                   active={isActive('/admin/pools/new')} onClick={() => navigate('/admin/pools/new')} />
          <NavItem icon="wallet" label={t(locale, 'Pending payouts')}
                   active={isActive('/admin/payouts')} onClick={() => navigate('/admin/payouts')} />
        </>
      )}

      <div className="fp-sidebar-foot">
        <NavItem icon="settings" label={t(locale, 'Settings')}
                 active={isActive('/settings')} onClick={() => navigate('/settings')} />
        <NavItem icon="logout" label={t(locale, 'Sign out')} onClick={logout} />
        {!mini && (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'8px 12px', color:'var(--fp-text-faint)', fontSize:11,
            fontFamily: 'var(--app-font-mono)',
          }}>
            <span>FutPools · {locale.toUpperCase()}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function TopBar({ crumbs, displayName, mini, onMenu, locale, setLocale }) {
  return (
    <header className="fp-desktop-topbar">
      <button
        type="button"
        className="fp-icon-btn"
        onClick={onMenu}
        title={mini ? t(locale, 'Expand sidebar') : t(locale, 'Collapse sidebar')}
        aria-label="Toggle sidebar"
      >
        <Icon name="menu" size={16}/>
      </button>
      <div className="fp-crumb">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'now' : ''}>{c}</span>
          </span>
        ))}
      </div>

      <div className="fp-top-actions">
        {/* Language picker — keeps the EN/ES toggle visible without a
            full Settings round-trip. */}
        <div className="fp-lang">
          <button
            type="button"
            className={locale === 'en' ? 'active' : ''}
            onClick={() => setLocale('en')}
          >EN</button>
          <button
            type="button"
            className={locale === 'es' ? 'active' : ''}
            onClick={() => setLocale('es')}
          >ES</button>
        </div>
        {/* Avatar acts as the shortcut to /account, mirroring the design. */}
        <Link
          to="/account"
          className="fp-avatar"
          title={displayName || 'Cuenta'}
          style={{ textDecoration: 'none' }}
        >{initials(displayName)}</Link>
      </div>
    </header>
  );
}

/**
 * The visual chrome (sidebar + topbar + content area) without any
 * router knowledge — accepts children directly so top-level routes
 * (PoolDetail, QuinielaPick) can wrap themselves in the same shell
 * the routed `<MainTabs>` children get.
 *
 * Use `crumbsOverride` when the URL → breadcrumbs mapping isn't
 * sufficient (e.g. dynamic pool names). Pass `null` to hide the
 * breadcrumb area entirely.
 */
export function DesktopShellChrome({ children, crumbsOverride }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { locale, setLocale } = useLocale();
  const [mini, setMini] = useState(false);

  const displayName = user?.displayName || user?.email || 'Player';
  const isAdmin = !!user?.isAdmin;
  const defaultCrumbs = useMemo(() => crumbsFor(location.pathname, locale),
                                [location.pathname, locale]);
  const crumbs = crumbsOverride !== undefined ? crumbsOverride : defaultCrumbs;

  return (
    <div className={`fp-desktop-shell ${mini ? 'mini' : ''}`}>
      <Sidebar
        pathname={location.pathname}
        navigate={navigate}
        mini={mini}
        locale={locale}
        isAdmin={isAdmin}
        logout={logout}
      />
      <main className="fp-desktop-main">
        <TopBar
          crumbs={crumbs || []}
          displayName={displayName}
          mini={mini}
          onMenu={() => setMini((m) => !m)}
          locale={locale}
          setLocale={setLocale}
        />
        <div className="fp-desktop-content">
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Routed-shell entry. Used as the `element` for /, /scores, /account.
 * Just delegates to `DesktopShellChrome` with `<Outlet />` as children.
 */
export function DesktopShell() {
  return (
    <DesktopShellChrome>
      <Outlet />
    </DesktopShellChrome>
  );
}
