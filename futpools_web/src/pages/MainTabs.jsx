import { Outlet } from 'react-router-dom';
import { AppBackground } from '../arena-ui/AppBackground';
import { ArenaTabBar, TAB_BAR_HEIGHT } from '../arena-ui/TabBar';

export function MainTabs() {
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
