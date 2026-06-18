/**
 * Invite share links MUST go through the backend origin
 * (https://api.futpools.com/p/CODE), never futpools.com/p/CODE.
 *
 * Why: futpools.com is a Render Static Site whose SPA catch-all returns
 * HTTP 404 for non-file routes — users see the app fine, but WhatsApp /
 * Telegram / iMessage crawlers discard 404 responses, so shared links get
 * NO preview. The backend serves /p/:code with og: meta tags + a generated
 * fixture-card image, then redirects humans to the SPA.
 *
 * VITE_API_URL must be absolute (https://…) for this; if it's relative or
 * unset (dev proxy) we fall back to the current origin.
 */
const apiBase = import.meta.env.VITE_API_URL || '';

export function shareOrigin() {
  if (apiBase.startsWith('http')) return apiBase.replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function inviteShareUrl(code) {
  return code ? `${shareOrigin()}/p/${code}` : '';
}
