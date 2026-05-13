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
  // simple_version: signup bonus celebration is gone (no coin economy).
  // The backend /auth/register may still return signupBonus on master,
  // but we ignore it here since there's no UI to show it.

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
      // Login can also happen post-onboarding (user picked teams in the
      // web onboarding then chose 'I already have an account'). Same
      // sync path as register.
      syncPendingOnboarding(token);
      return true;
    } catch (e) {
      setError(e.message || 'Login failed');
      return false;
    }
  }, []);

  /// Push the team/league selections captured by WebOnboarding (saved
  /// to localStorage) up to /users/me/onboarding. Best-effort — failure
  /// is silent so a transient blip post-signup doesn't trip the user.
  /// Mirrors iOS's AuthService.syncPendingOnboarding so cross-platform
  /// users converge on the same backend record.
  function syncPendingOnboarding(token) {
    try {
      const teams = JSON.parse(localStorage.getItem('onboardingTeams') || '[]');
      const leagues = JSON.parse(localStorage.getItem('onboardingLeagues') || '[]');
      const customTeamIDs = JSON.parse(localStorage.getItem('onboardingCustomTeamIDs') || '[]');
      const customLeagueIDs = JSON.parse(localStorage.getItem('onboardingCustomLeagueIDs') || '[]');
      // The backend accepts arbitrary strings — iOS prefixes custom
      // picks with 'api:' to disambiguate them from the curated enum
      // rawValues. Match that shape here.
      const teamsPayload = [...teams, ...customTeamIDs.map((id) => `api:${id}`)];
      const leaguesPayload = [...leagues, ...customLeagueIDs.map((id) => `api:${id}`)];
      if (teamsPayload.length === 0 && leaguesPayload.length === 0) return;
      api.put('/users/me/onboarding', {
        goals: [],
        pains: [],
        leagues: leaguesPayload,
        teams: teamsPayload,
        demoPicks: [],
      }, token).catch(() => { /* silent — local state remains */ });
    } catch {
      // localStorage parse error → treat as no pending onboarding.
    }
  }

  const register = useCallback(async (email, password, username, displayName, dob, countryCode) => {
    setError(null);
    try {
      const { token, user: u } = await api.post('/auth/register', {
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
      // Ship any pre-signup onboarding selections (teams + leagues
      // captured by /onboarding before the user had a token) up to the
      // user's record. Mirrors the iOS AuthService.syncPendingOnboarding
      // path so cross-platform users converge on the same backend
      // payload.
      syncPendingOnboarding(token);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
