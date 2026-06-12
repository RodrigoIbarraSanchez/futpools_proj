/**
 * Google Analytics 4 page tracking for the SPA.
 *
 * The gtag.js tag itself lives in index.html (hostname-gated to
 * futpools.com, `send_page_view: false`) so Google's tag detector sees
 * it and it loads as early as possible. This module only sends the
 * manual page_view on every route change (AnalyticsTracker in App.jsx) —
 * exactly ONE page_view emitter, no double counting.
 *
 * initAnalytics() is a fallback injector gated on VITE_GA_ID for builds
 * whose index.html lacks the tag; with the standard setup it no-ops
 * because window.gtag already exists.
 */

const GA_ID = import.meta.env.VITE_GA_ID;

export function initAnalytics() {
  if (!GA_ID || typeof window === 'undefined' || window.gtag) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false });
}

/**
 * Custom GA4 event (e.g. cta_click, sign_up). No-op when the tag isn't
 * loaded (dev/preview, hostname gate in index.html).
 */
export function trackEvent(name, params = {}) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}

/**
 * First-touch attribution: remembers the FIRST page this visitor ever
 * landed on (and the external referrer, e.g. google.com) so the signup
 * can report which landing brought the user. Stored once, never
 * overwritten.
 */
export function captureFirstTouch(path) {
  try {
    if (!localStorage.getItem('fp_first_path')) {
      localStorage.setItem('fp_first_path', path);
      if (document.referrer) localStorage.setItem('fp_referrer', document.referrer);
    }
  } catch { /* storage blocked (private mode) — attribution is best-effort */ }
}

export function getFirstTouch() {
  try {
    return {
      path: localStorage.getItem('fp_first_path') || undefined,
      referrer: localStorage.getItem('fp_referrer') || undefined,
    };
  } catch {
    return {};
  }
}

export function trackPageView(path) {
  if (typeof window === 'undefined') return;
  // Defer one tick so the destination page's useEffect has already set
  // document.title (landings set it on mount). In dev window.gtag never
  // exists (hostname gate in index.html) → no-op.
  setTimeout(() => {
    if (!window.gtag) return;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, 0);
}
