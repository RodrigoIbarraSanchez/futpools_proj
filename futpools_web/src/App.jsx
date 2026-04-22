import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { MainTabs } from './pages/MainTabs';
import { Home } from './pages/Home';
import { PoolDetail } from './pages/PoolDetail';
import { QuinielaPick } from './pages/QuinielaPick';
import { MyEntries } from './pages/MyEntries';
import { Account } from './pages/Account';
import { Settings } from './pages/Settings';
import { Recharge } from './pages/Recharge';
import { CreatePool, InviteResolver } from './pages/CreatePool';
import { LiveMatch } from './pages/LiveMatch';
import { GlobalLeaderboard } from './pages/GlobalLeaderboard';
import ArenaApp from './arena/ArenaApp';
import { SignupBonusModal } from './components/SignupBonusModal';

function PrivateRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null;
  return !isAuthenticated ? children : <Navigate to="/" replace />;
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

            <Route path="/" element={<PrivateRoute><MainTabs /></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="entries" element={<MyEntries />} />
              <Route path="shop" element={<Recharge />} />
              <Route path="account" element={<Account />} />
            </Route>

            <Route path="/pool/:id" element={<PrivateRoute><PoolDetail /></PrivateRoute>} />
            <Route path="/pool/:id/pick" element={<PrivateRoute><QuinielaPick /></PrivateRoute>} />
            <Route path="/fixture/:fixtureId" element={<PrivateRoute><LiveMatch /></PrivateRoute>} />
            <Route path="/leaderboard" element={<PrivateRoute><GlobalLeaderboard /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/recharge" element={<Navigate to="/shop" replace />} />

            <Route path="/create" element={<PrivateRoute><CreatePool /></PrivateRoute>} />
            <Route path="/p/:code" element={<InviteResolver />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <SignupBonusModal />
        </BrowserRouter>
      </AuthProvider>
    </LocaleProvider>
  );
}
