import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'futpools_locale';
// Cache the IP lookup result across navigations but not across reloads — if
// the user travels or switches networks we want to re-evaluate.
const IP_CACHE_KEY = 'futpools_locale_ip_country';

// ISO 3166-1 alpha-2 codes for countries where Spanish is the primary language.
// Users landing in any of these default to `es`; everywhere else falls through
// to the browser language and finally to `en`.
const SPANISH_COUNTRIES = new Set([
  'MX', 'ES', 'AR', 'CL', 'CO', 'PE', 'EC', 'BO', 'PY', 'UY', 'VE',
  'CR', 'GT', 'HN', 'NI', 'PA', 'SV', 'DO', 'CU', 'PR', 'GQ',
]);

/**
 * Fetch the user's country code from a CORS-enabled geolocation service.
 * `ipapi.co` offers a free tier (1k req/day/IP) with no API key. Returns
 * `null` on any failure so callers can fall back gracefully.
 */
async function detectCountryByIP() {
  const cached = sessionStorage.getItem(IP_CACHE_KEY);
  if (cached) return cached === 'NULL' ? null : cached;
  try {
    // AbortController so a hung request doesn't block locale resolution.
    // 3s is plenty — this is a ~100-byte response; anything longer means
    // the service is degraded and we should fall back to browser locale.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipapi.co/country/', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      sessionStorage.setItem(IP_CACHE_KEY, 'NULL');
      return null;
    }
    const country = (await res.text()).trim().toUpperCase();
    // Valid ISO codes are 2 letters. Anything else is probably an error page.
    if (!/^[A-Z]{2}$/.test(country)) {
      sessionStorage.setItem(IP_CACHE_KEY, 'NULL');
      return null;
    }
    sessionStorage.setItem(IP_CACHE_KEY, country);
    return country;
  } catch {
    sessionStorage.setItem(IP_CACHE_KEY, 'NULL');
    return null;
  }
}

function browserLocaleFallback() {
  return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  // `rawLocale` is the user's explicit pick ('' = auto). `autoLocale` is what
  // we inferred from IP/browser — used only when `rawLocale` is empty.
  const [rawLocale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'es' || saved === 'en' ? saved : '';
  });
  const [autoLocale, setAutoLocale] = useState(browserLocaleFallback);

  // On mount (only when the user hasn't picked explicitly), ask the IP
  // geolocation service for the country. If it's Spanish-speaking, upgrade
  // the auto locale to 'es'. Non-blocking — the app renders immediately in
  // the browser-inferred language and switches when the IP lookup resolves.
  useEffect(() => {
    if (rawLocale) return;  // user already picked — IP is irrelevant
    let cancelled = false;
    (async () => {
      const country = await detectCountryByIP();
      if (cancelled) return;
      if (country && SPANISH_COUNTRIES.has(country)) {
        setAutoLocale('es');
      } else if (country) {
        // IP succeeded but isn't Spanish-speaking — honor browser preference
        // (which might still be 'es' for an expat using an ES browser).
        setAutoLocale(browserLocaleFallback());
      }
    })();
    return () => { cancelled = true; };
  }, [rawLocale]);

  const setLocale = useCallback((value) => {
    const next = value === 'es' || value === 'en' ? value : '';
    setLocaleState(next);
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const effectiveLocale = rawLocale || autoLocale;

  return (
    <LocaleContext.Provider value={{ locale: effectiveLocale, setLocale, rawLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
