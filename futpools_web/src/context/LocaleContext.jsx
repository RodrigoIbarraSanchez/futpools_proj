import { createContext, useContext, useState, useCallback } from 'react';

const KEY = 'futpools_locale';

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === 'es' || saved === 'en') return saved;
    return '';
  });

  const setLocale = useCallback((value) => {
    const next = value === 'es' || value === 'en' ? value : '';
    setLocaleState(next);
    if (next) localStorage.setItem(KEY, next);
    else localStorage.removeItem(KEY);
  }, []);

  const effectiveLocale = locale || (navigator.language.startsWith('es') ? 'es' : 'en');

  return (
    <LocaleContext.Provider value={{ locale: effectiveLocale, setLocale, rawLocale: locale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
