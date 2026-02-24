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
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

            <Route path="/" element={<PrivateRoute><MainTabs /></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="entries" element={<MyEntries />} />
              <Route path="account" element={<Account />} />
            </Route>

            <Route path="/pool/:id" element={<PrivateRoute><PoolDetail /></PrivateRoute>} />
            <Route path="/pool/:id/pick" element={<PrivateRoute><QuinielaPick /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/recharge" element={<PrivateRoute><Recharge /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LocaleProvider>
  );
}
