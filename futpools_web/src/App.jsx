import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { WebOnboarding } from './pages/onboarding/WebOnboarding';
import { LiveMatch } from './pages/LiveMatch';
import { GlobalLeaderboard } from './pages/GlobalLeaderboard';
import ArenaApp from './arena/ArenaApp';
import { LandingPage } from './pages/LandingPage';

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

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/arena" element={<ArenaApp />} />

            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            {/* simple_version onboarding (3 screens) — landing CTAs
                point here; finishes by routing the user to /register
                with their picks already in localStorage. */}
            <Route path="/onboarding" element={<PublicRoute><WebOnboarding /></PublicRoute>} />

            <Route path="/" element={<RootSwitch />}>
              <Route index element={<Home />} />
              <Route path="account" element={<Account />} />
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
