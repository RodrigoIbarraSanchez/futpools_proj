import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';

const TOKEN_KEY = 'futpools_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const u = await api.get('/users/me', token);
      setUser(u);
      setError(null);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, [getToken]);

  useEffect(() => {
    const token = getToken();
    if (token) fetchUser().finally(() => setReady(true));
    else setReady(true);
  }, [getToken, fetchUser]);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const { token, user: u } = await api.post('/auth/login', { email: email.trim().toLowerCase(), password });
      localStorage.setItem(TOKEN_KEY, token);
      setUser(u);
      return true;
    } catch (e) {
      setError(e.message || 'Login failed');
      return false;
    }
  }, []);

  const register = useCallback(async (email, password, username, displayName) => {
    setError(null);
    try {
      const { token, user: u } = await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        username: username.trim().toLowerCase(),
        displayName: (displayName || '').trim(),
      });
      localStorage.setItem(TOKEN_KEY, token);
      setUser(u);
      return true;
    } catch (e) {
      setError(e.message || 'Registration failed');
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setError(null);
  }, []);

  const updateDisplayName = useCallback(async (displayName) => {
    const token = getToken();
    if (!token) return;
    try {
      const u = await api.put('/users/me', { displayName: displayName.trim() }, token);
      setUser(u);
    } catch (e) {
      setError(e.message);
    }
  }, [getToken]);

  const value = {
    user,
    token: getToken(),
    isAuthenticated: !!user,
    error,
    setError,
    login,
    register,
    logout,
    fetchUser,
    updateDisplayName,
    ready,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
