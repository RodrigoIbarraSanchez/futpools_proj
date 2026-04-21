// ArenaApp.jsx — FutPools Arena prototype root (port of FutPools Arena.html)
import React from 'react';
import { FONTS, useTheme, FutPoolsStyles, ScanlineOverlay } from './tokens';
import { IOSDevice } from './iosFrame';
import {
  MOCK_USER, MOCK_POOL, MOCK_POOLS, MOCK_LEADERBOARD,
  MOCK_ENTRIES, MOCK_ACHIEVEMENTS, RECHARGE_PACKS,
} from './mockData';
import { LoginScreen, HomeScreen, PoolDetailScreen } from './screens1';
import {
  PickScreen, EntriesScreen, ProfileScreen, RechargeScreen,
  LiveMatchScreen, SuccessOverlay, TabBar,
} from './screens2';

const DEFAULTS = {
  theme: 'dark',
  palette: 'neon',
  scanlines: 0.25,
  screen: 'home',
};

const SCREENS = [
  ['login',   '01 Login / Arena'],
  ['home',    '02 Home / Lobby'],
  ['detail',  '03 Pool Detail'],
  ['pick',    '04 Make Picks'],
  ['success', '05 Picks Locked'],
  ['live',    '06 Live Match'],
  ['entries', '07 My Entries'],
  ['profile', '08 Profile'],
  ['shop',    '09 Coin Shop'],
];

export default function ArenaApp() {
  const [theme, setTheme] = React.useState(DEFAULTS.theme);
  const [palette, setPalette] = React.useState(DEFAULTS.palette);
  const [scanlines, setScanlines] = React.useState(DEFAULTS.scanlines);
  const [screen, setScreen] = React.useState(() => {
    try { return localStorage.getItem('fp.arena.screen') || DEFAULTS.screen; } catch { return DEFAULTS.screen; }
  });
  const [activeTab, setActiveTab] = React.useState('home');
  const [currentPool, setCurrentPool] = React.useState(MOCK_POOL);
  const [currentFx, setCurrentFx] = React.useState(MOCK_POOL.fixtures[0]);

  const t = useTheme(theme, palette);

  React.useEffect(() => {
    try { localStorage.setItem('fp.arena.screen', screen); } catch {}
  }, [screen]);

  const goTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'home') setScreen('home');
    else if (tab === 'entries') setScreen('entries');
    else if (tab === 'shop') setScreen('shop');
    else if (tab === 'profile') setScreen('profile');
  };

  const handlePoolTap = (id) => {
    const pool = MOCK_POOLS.find(p => p.id === id);
    setCurrentPool(id === 'p1' ? MOCK_POOL : { ...MOCK_POOL, ...pool, code: id.toUpperCase(), entriesCount: pool.entries });
    setScreen('detail');
  };

  const handleMatchTap = (fx) => {
    if (fx.status === 'live') {
      setCurrentFx(fx);
      setScreen('live');
    }
  };

  let content;
  const screenLabel = SCREENS.find(s => s[0] === screen)?.[1] ?? screen;
  switch (screen) {
    case 'login':
      content = <LoginScreen t={t} onLogin={() => setScreen('home')} />;
      break;
    case 'home':
      content = (
        <HomeScreen t={t} user={MOCK_USER} pools={MOCK_POOLS} onPoolTap={handlePoolTap} />
      );
      break;
    case 'detail':
      content = (
        <PoolDetailScreen
          t={t} pool={currentPool} leaderboard={MOCK_LEADERBOARD}
          onBack={() => setScreen('home')}
          onPick={() => setScreen('pick')}
          onMatchTap={handleMatchTap}
        />
      );
      break;
    case 'pick':
      content = (
        <PickScreen
          t={t} pool={currentPool}
          onBack={() => setScreen('detail')}
          onSubmit={() => setScreen('success')}
        />
      );
      break;
    case 'success':
      content = (
        <>
          <HomeScreen t={t} user={MOCK_USER} pools={MOCK_POOLS} onPoolTap={handlePoolTap} />
          <SuccessOverlay t={t} onDismiss={() => setScreen('entries')} />
        </>
      );
      break;
    case 'live':
      content = <LiveMatchScreen t={t} fx={currentFx} onBack={() => setScreen('detail')} />;
      break;
    case 'entries':
      content = <EntriesScreen t={t} entries={MOCK_ENTRIES} user={MOCK_USER} onEntryTap={() => setScreen('detail')} />;
      break;
    case 'profile':
      content = (
        <ProfileScreen
          t={t} user={MOCK_USER} achievements={MOCK_ACHIEVEMENTS}
          onRecharge={() => setScreen('shop')}
        />
      );
      break;
    case 'shop':
      content = (
        <RechargeScreen
          t={t} user={MOCK_USER} packs={RECHARGE_PACKS}
          onBack={() => setScreen('profile')}
          onBuy={() => setScreen('profile')}
        />
      );
      break;
    default:
      content = <div style={{ padding: 40, color: t.text }}>Screen not found</div>;
  }

  const tabbedScreens = ['home', 'entries', 'profile', 'shop', 'detail'];
  const showTabs = tabbedScreens.includes(screen);

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse 70% 60% at 50% 0%, #21E28C14 0%, transparent 60%),
                   radial-gradient(ellipse 50% 40% at 50% 100%, #FF2BD611 0%, transparent 70%),
                   #07090D`,
      color: '#F3F6FB',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '32px 16px 80px',
      boxSizing: 'border-box',
    }}>
      <FutPoolsStyles />

      <div style={{ textAlign: 'center', marginBottom: 20, maxWidth: 420 }}>
        <div style={{
          fontFamily: FONTS.display, fontSize: 28, fontWeight: 800, letterSpacing: 4,
          color: '#F3F6FB',
        }}>
          FUT<span style={{ color: t.primary, textShadow: `0 0 16px ${t.primary}` }}>POOLS</span>
          <span style={{ fontSize: 14, color: 'rgba(243,246,251,0.35)', marginLeft: 12, letterSpacing: 3 }}>· ARENA</span>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: 'rgba(243,246,251,0.4)', marginTop: 4, letterSpacing: 2 }}>
          Prototipo · HUD cyber-arcade · {screenLabel}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <IOSDevice dark={theme === 'dark'} width={402} height={874}>
          <div style={{
            width: '100%', height: '100%', position: 'relative',
            background: t.bg, color: t.text, overflow: 'hidden',
          }}>
            <div style={{
              width: '100%', height: '100%',
              overflowY: 'auto', overflowX: 'hidden',
              paddingTop: screen === 'login' ? 0 : 52,
            }} className="fp-scroll">
              {content}
            </div>

            {showTabs && screen !== 'success' && (
              <TabBar t={t} active={activeTab} onChange={goTab} />
            )}

            {scanlines > 0 && <ScanlineOverlay intensity={scanlines * 0.5} t={t} />}

            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 99,
              background: `radial-gradient(ellipse 100% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.45) 100%)`,
              mixBlendMode: 'multiply',
            }} />
          </div>
        </IOSDevice>
      </div>

      {/* Screen navigator */}
      <div style={{
        marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
        maxWidth: 520,
      }}>
        {SCREENS.map(([id, label]) => {
          const active = screen === id;
          return (
            <button key={id} onClick={() => setScreen(id)} style={{
              padding: '8px 12px',
              background: active ? t.primary : 'rgba(255,255,255,0.05)',
              color: active ? '#061018' : 'rgba(243,246,251,0.7)',
              fontFamily: FONTS.display, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              border: `1px solid ${active ? t.primary : 'rgba(255,255,255,0.08)'}`,
              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
              cursor: 'pointer',
            }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Tweaks panel */}
      <TweaksPanel
        theme={theme} setTheme={setTheme}
        palette={palette} setPalette={setPalette}
        scanlines={scanlines} setScanlines={setScanlines}
      />
    </div>
  );
}

function TweaksPanel({ theme, setTheme, palette, setPalette, scanlines, setScanlines }) {
  const [open, setOpen] = React.useState(false);

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: FONTS.display, fontSize: 9, letterSpacing: 2.5,
        color: '#21E28C', marginBottom: 6,
      }}>◆ {title}</div>
      {children}
    </div>
  );

  const Pill = ({ active, onClick, children, accent = '#21E28C' }) => (
    <button onClick={onClick} style={{
      padding: '6px 10px',
      background: active ? accent : 'rgba(255,255,255,0.06)',
      color: active ? '#061018' : 'rgba(243,246,251,0.75)',
      fontFamily: FONTS.display, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
      border: 'none',
      clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)',
      cursor: 'pointer', marginRight: 4, marginBottom: 4,
    }}>{children}</button>
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 500,
          width: 44, height: 44,
          background: 'rgba(11,15,20,0.92)',
          border: '1px solid rgba(33,226,140,0.3)',
          color: '#F3F6FB',
          fontFamily: FONTS.display, fontSize: 18, fontWeight: 800,
          cursor: 'pointer',
          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
          boxShadow: '0 0 20px rgba(33,226,140,0.2)',
        }}
      >⚙</button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 500,
      width: 260, padding: 14,
      background: 'rgba(11,15,20,0.92)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(33,226,140,0.3)',
      clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
      boxShadow: '0 0 24px rgba(33,226,140,0.15)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', marginBottom: 12,
      }}>
        <div style={{
          fontFamily: FONTS.display, fontSize: 12, fontWeight: 800, letterSpacing: 3,
          color: '#F3F6FB', textTransform: 'uppercase', flex: 1,
        }}>
          ⚙ Tweaks
        </div>
        <button onClick={() => setOpen(false)} style={{
          background: 'transparent', border: 'none', color: 'rgba(243,246,251,0.5)',
          fontSize: 18, cursor: 'pointer', lineHeight: 1,
        }}>×</button>
      </div>

      <Section title="THEME">
        <Pill active={theme === 'dark'}  onClick={() => setTheme('dark')}>DARK</Pill>
        <Pill active={theme === 'light'} onClick={() => setTheme('light')}>LIGHT</Pill>
      </Section>

      <Section title="ACCENT PALETTE">
        <Pill active={palette === 'neon'}    onClick={() => setPalette('neon')}    accent="#21E28C">NEON</Pill>
        <Pill active={palette === 'magenta'} onClick={() => setPalette('magenta')} accent="#FF2BD6">MAGENTA</Pill>
        <Pill active={palette === 'gold'}    onClick={() => setPalette('gold')}    accent="#FFC738">GOLD</Pill>
      </Section>

      <Section title={`SCANLINES · ${Math.round(scanlines * 100)}%`}>
        <input
          type="range" min="0" max="1" step="0.05" value={scanlines}
          onChange={e => setScanlines(+e.target.value)}
          style={{ width: '100%', accentColor: '#21E28C' }}
        />
      </Section>
    </div>
  );
}
