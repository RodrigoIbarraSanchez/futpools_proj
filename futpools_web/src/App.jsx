import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { initAnalytics, trackPageView, captureFirstTouch } from './lib/analytics';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { MainTabs } from './pages/MainTabs';
import { Home } from './pages/Home';
import { PoolDetail } from './pages/PoolDetail';
import { QuinielaPick } from './pages/QuinielaPick';
import { Account } from './pages/Account';
import { Settings } from './pages/Settings';
import { CreatePool, InviteResolver } from './pages/CreatePool';
import { AdminPayouts } from './pages/admin/AdminPayouts';
import { AdminSpeiPayments } from './pages/admin/AdminSpeiPayments';
import { WebOnboarding } from './pages/onboarding/WebOnboarding';
import { LiveMatch } from './pages/LiveMatch';
import { LiveScores } from './pages/LiveScores';
import { GlobalLeaderboard } from './pages/GlobalLeaderboard';
import ArenaApp from './arena/ArenaApp';
import { LandingPage } from './pages/LandingPage';
import { WorldCup2026Calendar } from './pages/WorldCup2026Calendar';
import { WorldCup2026Landing } from './pages/WorldCup2026Landing';
import { MexicoWorldCup2026 } from './pages/MexicoWorldCup2026';
import { QuinielaDeLaSemana } from './pages/QuinielaDeLaSemana';
import { PronosticosFutbol } from './pages/PronosticosFutbol';
import { PronosticosFutbolHoy } from './pages/PronosticosFutbolHoy';
import { QuinielaFutbolHoy } from './pages/QuinielaFutbolHoy';

function PrivateRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  const from = location.state?.from || '/';
  return !isAuthenticated ? children : <Navigate to={from} replace />;
}

/**
 * Admin-only routes — pool creation, payouts dashboard. The simple_version
 * product spec keeps creation behind ADMIN_EMAILS (matched server-side too,
 * so this is a UX gate rather than a security boundary). Non-admin users
 * who somehow land on /admin/* get bounced to home.
 */
function AdminRoute({ children }) {
  const { isAuthenticated, ready, user } = useAuth();
  if (!ready) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;
  return children;
}

/**
 * `/` renders the marketing landing for anonymous visitors and the real
 * in-app home (MainTabs) for authenticated users. Nested tab routes
 * (/account) are the same URLs they were before — but unauth visitors
 * who land there see the Landing instead of a tab layout, since we
 * don't render an `<Outlet/>` in the landing branch.
 *
 * simple_version: removed /entries and /shop child routes — the simplified
 * product has neither an entry-history page nor a coin shop. Pool entries
 * live on each pool's detail page; "shop" is gone entirely.
 */
function RootSwitch() {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null;
  return isAuthenticated ? <MainTabs /> : <LandingPage />;
}

/**
 * GA4 page tracking — renders nothing. Lives inside BrowserRouter so it
 * sees every route change; sends one page_view per navigation (the
 * automatic one is disabled in analytics.js). No-op without VITE_GA_ID.
 */
function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    initAnalytics();
    captureFirstTouch(location.pathname + location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <BrowserRouter>
          <AnalyticsTracker />
          <Routes>
            <Route path="/arena" element={<ArenaApp />} />

            {/* Public World Cup 2026 calendar tool — no auth required. The
                page is bilingual (ES/EN) and lets visitors export the FIFA
                WC 2026 schedule to iPhone, Google Calendar, Android, or
                Outlook. Backed by /world-cup-2026/* on the API. */}
            {/* SEO landing pages (content) — the CTA navigates to the tool. */}
            <Route path="/calendario-mundial-2026" element={<WorldCup2026Landing />} />
            <Route path="/world-cup-2026-calendar" element={<WorldCup2026Landing />} />
            {/* The calendar tool (3-step export) lives under the landing. */}
            <Route path="/calendario-mundial-2026/agregar" element={<WorldCup2026Calendar />} />
            <Route path="/world-cup-2026-calendar/add" element={<WorldCup2026Calendar />} />
            {/* Team landing (topic-cluster child of the calendar landing). */}
            <Route path="/mexico-mundial-2026" element={<MexicoWorldCup2026 />} />
            <Route path="/mexico-world-cup-2026" element={<MexicoWorldCup2026 />} />
            {/* ES-only evergreen landing (Progol / quiniela de la semana). */}
            <Route path="/quiniela-de-la-semana" element={<QuinielaDeLaSemana />} />
            {/* ES-only evergreen landing — dynamic CTA to the next open pool. */}
            <Route path="/pronosticos-de-futbol" element={<PronosticosFutbol />} />
            {/* Cluster child — dynamic "today's matches" module. */}
            <Route path="/pronosticos-futbol-hoy" element={<PronosticosFutbolHoy />} />
            {/* Transactional "hoy" sibling — open pool as the hero. */}
            <Route path="/quiniela-futbol-hoy" element={<QuinielaFutbolHoy />} />
            {/* Legacy concatenated slugs → 301 at the host (_redirects); this
                client-side Navigate covers any in-app navigation. */}
            <Route path="/calendariomundial2026" element={<Navigate to="/calendario-mundial-2026" replace />} />
            <Route path="/worldcup2026calendar" element={<Navigate to="/world-cup-2026-calendar" replace />} />

            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            {/* simple_version onboarding (3 screens) — landing CTAs
                point here; finishes by routing the user to /register
                with their picks already in localStorage. */}
            <Route path="/onboarding" element={<PublicRoute><WebOnboarding /></PublicRoute>} />

            <Route path="/" element={<RootSwitch />}>
              <Route index element={<Home />} />
              <Route path="scores" element={<LiveScores />} />
              <Route path="account" element={<Account />} />
              {/* Legacy: /entries existed briefly in the desktop redesign
                  but was removed per product spec — Mis Apuestas content
                  surfaces inside each pool's detail instead. Bounce to
                  Home so old bookmarks don't 404. */}
              <Route path="entries" element={<Navigate to="/" replace />} />
            </Route>

            <Route path="/pool/:id" element={<PoolDetail />} />
            <Route path="/pool/:id/pick" element={<PrivateRoute><QuinielaPick /></PrivateRoute>} />
            <Route path="/fixture/:fixtureId" element={<PrivateRoute><LiveMatch /></PrivateRoute>} />
            <Route path="/leaderboard" element={<PrivateRoute><GlobalLeaderboard /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />

            {/* Admin pool creation. Backend POST /quinielas also requires
                admin in simple_version, so this is a UX gate; trying to hit
                the route as a regular user just bounces back to /. */}
            <Route path="/admin/pools/new" element={<AdminRoute><CreatePool /></AdminRoute>} />
            <Route path="/admin/payouts" element={<AdminRoute><AdminPayouts /></AdminRoute>} />
            <Route path="/admin/spei" element={<AdminRoute><AdminSpeiPayments /></AdminRoute>} />

            {/* Pool invite deep link — public so unauthenticated friends
                can land on the join page. */}
            <Route path="/p/:code" element={<InviteResolver />} />

            {/* Legacy redirects: pre-simple_version URLs that bookmarks may
                still target. Bouncing to / preserves a working back-button
                without a confusing 404. */}
            <Route path="/create" element={<Navigate to="/admin/pools/new" replace />} />
            <Route path="/entries" element={<Navigate to="/" replace />} />
            <Route path="/shop" element={<Navigate to="/" replace />} />
            <Route path="/recharge" element={<Navigate to="/" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LocaleProvider>
  );
}

// AdminPayoutsPlaceholder removed — replaced by the real
// pages/admin/AdminPayouts.jsx in Phase 9.
