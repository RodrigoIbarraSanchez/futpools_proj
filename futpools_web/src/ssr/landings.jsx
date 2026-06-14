/**
 * Server-side render entry for the SEO landings.
 *
 * The site is a client-rendered SPA, so the shells that Render builds ship an
 * empty <body><div id="root"></div></body> — crawlers/graders that don't run
 * JS (Moz, Google's first wave) see no content, so every body signal (keyword
 * in text, word/char count, header tags, body-level external links) fails. This
 * module renders each landing component to a static HTML string at BUILD TIME
 * with react-dom/server (pure Node — runs in Render's existing build, no
 * headless browser). scripts/prerender-ssg.mjs bakes that string into #root.
 * React (createRoot) replaces it on mount, so the markup matches and the swap
 * is invisible; crawlers now get the full text.
 *
 * Data hooks (useNextOpenPool, useTodayFixtures) fetch inside useEffect, which
 * does NOT run during renderToStaticMarkup — they return their initial state, so
 * components render their evergreen fallback. That is exactly what we bake.
 *
 * Locale: bilingual components (calendar, mexico) call useLocale(), and the real
 * LocaleProvider reads localStorage/navigator (crashes in Node). They also set
 * locale from the path inside a useEffect that does NOT run server-side. So here
 * we supply a fixed locale per slug via the LocaleContext directly.
 *
 * To add a landing: import it and add a {C, locale} entry. The component must be
 * SSR-safe (no window/document access during render — only in effects/handlers).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { LocaleContext } from '../context/LocaleContext';
import { WorldCup2026Landing } from '../pages/WorldCup2026Landing';
import { MexicoWorldCup2026 } from '../pages/MexicoWorldCup2026';
import { QuinielaDeLaSemana } from '../pages/QuinielaDeLaSemana';
import { PronosticosFutbol } from '../pages/PronosticosFutbol';
import { PronosticosFutbolHoy } from '../pages/PronosticosFutbolHoy';
import { QuinielaFutbolHoy } from '../pages/QuinielaFutbolHoy';
import { QuinielaLigaMexicana } from '../pages/QuinielaLigaMexicana';

const REGISTRY = {
  'quiniela-liga-mexicana': { C: QuinielaLigaMexicana, locale: 'es' },
  'calendario-mundial-2026': { C: WorldCup2026Landing, locale: 'es' },
  'world-cup-2026-calendar': { C: WorldCup2026Landing, locale: 'en' },
  'mexico-mundial-2026': { C: MexicoWorldCup2026, locale: 'es' },
  'mexico-world-cup-2026': { C: MexicoWorldCup2026, locale: 'en' },
  'quiniela-de-la-semana': { C: QuinielaDeLaSemana, locale: 'es' },
  'pronosticos-de-futbol': { C: PronosticosFutbol, locale: 'es' },
  'pronosticos-futbol-hoy': { C: PronosticosFutbolHoy, locale: 'es' },
  'quiniela-futbol-hoy': { C: QuinielaFutbolHoy, locale: 'es' },
};

export const SSG_SLUGS = Object.keys(REGISTRY);

export function renderLanding(slug) {
  const entry = REGISTRY[slug];
  if (!entry) return null;
  const { C, locale } = entry;
  const localeValue = { locale, setLocale() {}, rawLocale: '' };
  return renderToStaticMarkup(
    <StaticRouter location={`/${slug}`}>
      <LocaleContext.Provider value={localeValue}>
        <C />
      </LocaleContext.Provider>
    </StaticRouter>,
  );
}
