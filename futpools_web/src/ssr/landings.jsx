/**
 * Server-side render entry for the SEO landings.
 *
 * The site is a client-rendered SPA, so the shells that Render builds ship an
 * empty <body><div id="root"></div></body> — crawlers/graders that don't run
 * JS (Moz, Google's first wave) see no content. This module renders each
 * landing component to a static HTML string at BUILD TIME with react-dom/server
 * (pure Node — runs in Render's existing build, no headless browser needed).
 * scripts/prerender-ssg.mjs bakes that string into #root. React (createRoot)
 * replaces it on mount, so the markup matches and the swap is invisible.
 *
 * Data hooks (useNextOpenPool, etc.) fetch inside useEffect, which does NOT run
 * during renderToStaticMarkup — they return their initial state, so components
 * render their evergreen fallback. That is exactly what we want baked.
 *
 * To add a landing to the rollout: import it and add it to REGISTRY. The
 * component must be SSR-safe (no window/document access during render — only
 * inside effects/handlers).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QuinielaLigaMexicana } from '../pages/QuinielaLigaMexicana';

const REGISTRY = {
  'quiniela-liga-mexicana': QuinielaLigaMexicana,
};

export const SSG_SLUGS = Object.keys(REGISTRY);

export function renderLanding(slug) {
  const Component = REGISTRY[slug];
  if (!Component) return null;
  return renderToStaticMarkup(
    <StaticRouter location={`/${slug}`}>
      <Component />
    </StaticRouter>,
  );
}
