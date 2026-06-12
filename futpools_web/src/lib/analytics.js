/**
 * Google Analytics 4 (gtag.js), loaded only when VITE_GA_ID is set
 * (e.g. G-XXXXXXXXXX in Render's environment for the production build).
 * Without the env var everything here is a no-op, so dev and preview
 * builds send nothing.
 *
 * SPA note: we disable gtag's automatic page_view and send one manually
 * on every route change (AnalyticsTracker in App.jsx). Relying on GA4's
 * "enhanced measurement" history detection double-counts when combined
 * with a manual setup, so there is exactly ONE emitter: us.
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
  if (!GA_ID || typeof window === 'undefined') return;
  // Defer one tick so the destination page's useEffect has already set
  // document.title (landings set it on mount).
  setTimeout(() => {
    if (!window.gtag) return;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, 0);
}
