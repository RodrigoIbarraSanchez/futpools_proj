// MainTabs — chooses between the mobile bottom-tab shell and the
// desktop sidebar shell based on viewport width. The breakpoint is
// 1100px (matches `--app-sidebar-w` 260 + a comfortable content min).
//
// Below 1100px the existing 430-wide phone frame stays untouched.
// At ≥1100px the page expands to full-width and gets a persistent
// left sidebar + top bar, per the Claude Design `Futpools Desktop` mock.
import { Outlet } from 'react-router-dom';
import { AppBackground } from '../arena-ui/AppBackground';
import { ArenaTabBar, TAB_BAR_HEIGHT } from '../arena-ui/TabBar';
import { useIsDesktop } from '../desktop/useIsDesktop';
import { DesktopShell } from '../desktop/DesktopShell';

export function MainTabs() {
  const isDesktop = useIsDesktop();
  if (isDesktop) return <DesktopShell />;
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', paddingBottom: TAB_BAR_HEIGHT + 12 }}>
      <AppBackground />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <ArenaTabBar />
    </div>
  );
}
