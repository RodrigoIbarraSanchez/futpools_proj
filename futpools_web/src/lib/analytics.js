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
