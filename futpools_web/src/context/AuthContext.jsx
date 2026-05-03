import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';

const TOKEN_KEY = 'futpools_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [errorField, setErrorField] = useState(null);
  const [ready, setReady] = useState(false);
  // One-shot signup celebration state — set by register() when the server
  // grants a bonus, cleared by acknowledgeSignupBonus() after the modal is
  // dismissed. Deliberately session-only; a re-login won't reshow it.
  const [pendingSignupBonus, setPendingSignupBonus] = useState(null);

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

  const register = useCallback(async (email, password, username, displayName, dob, countryCode) => {
    setError(null);
    try {
      const { token, user: u, signupBonus } = await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        username: username.trim().toLowerCase(),
        displayName: (displayName || '').trim(),
        // Fase 5 — sweepstakes eligibility. Backend rejects under-18 and
        // missing fields; we send them when the form has them.
        dob: dob || undefined,
        countryCode: countryCode || undefined,
      });
      localStorage.setItem(TOKEN_KEY, token);
      setUser(u);
      // Trigger the welcome modal only when the server actually credited a
      // bonus on this call. Idempotent re-registers return null.
      if (typeof signupBonus === 'number' && signupBonus > 0) {
        setPendingSignupBonus(signupBonus);
      }
      return true;
    } catch (e) {
      // Keep `error` as a plain string so existing consumers
      // (`{error}` in JSX) keep working. `errorCode` and
      // `errorField` carry the structured info the Register form
      // uses to localize the message and highlight the right input.
      setError(e.message || 'Registration failed');
      setErrorCode(e.code || null);
      setErrorField(e.field || null);
      return false;
    }
  }, []);

  const acknowledgeSignupBonus = useCallback(() => {
    setPendingSignupBonus(null);
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

  // Wrap setError so consumers can also clear errorCode + errorField
  // in one call. Backwards-compatible — `setError(null)` still works.
  const setErrorAll = useCallback((value) => {
    setError(value);
    if (value == null) {
      setErrorCode(null);
      setErrorField(null);
    }
  }, []);

  const value = {
    user,
    token: getToken(),
    isAuthenticated: !!user,
    error,
    errorCode,
    errorField,
    setError: setErrorAll,
    login,
    register,
    logout,
    fetchUser,
    updateDisplayName,
    ready,
    pendingSignupBonus,
    acknowledgeSignupBonus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
