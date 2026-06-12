#!/usr/bin/env node
/**
 * Postbuild step: emit per-locale index.html shells so that crawlers
 * (WhatsApp, Facebook, Twitter, Google) see meta tags in the right
 * language for each URL, and Render serves a 200 OK at those paths
 * (rather than the 404 it returns for _redirects-rewritten routes).
 *
 *   dist/index.html                            → default (Spanish)
 *   dist/404.html                              → SPA fallback (Spanish)
 *   dist/calendario-mundial-2026/index.html    → Spanish landing shell
 *   dist/world-cup-2026-calendar/index.html    → ENGLISH landing shell
 *
 * The SPA bundle is locale-aware at runtime via the URL-based locale
 * override; this script's only job is to swap the static <title>,
 * <meta name="description">, and og:/twitter: tags so the share
 * preview reads correctly in the target language.
 *
 * Bundle script src + CSS link tags are identical across the two
 * shells — we substitute text, not assets — so they share Vite's
 * cache-busted filenames automatically.
 */

import fs from 'node:fs';
import path from 'node:path';
import { wc26JsonLd } from '../src/seo/wc26Landing.js';
import { mexicoJsonLd } from '../src/seo/mexicoWc26.js';
import { quinielaJsonLd } from '../src/seo/quinielaSemana.js';
import { pronosticosJsonLd } from '../src/seo/pronosticosFutbol.js';
import { pronosticosHoyJsonLd } from '../src/seo/pronosticosHoy.js';
import { quinielaHoyJsonLd } from '../src/seo/quinielaHoy.js';

const distDir = path.resolve(process.cwd(), 'dist');
const baseHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

// Each entry maps the EXACT ES string in the base index.html to its
// EN equivalent. We use full-line strings so the replacement is
// unambiguous; a partial match could accidentally rewrite content
// inside the React bundle.
const ES_TO_EN = [
  [
    '<html lang="en">',
    '<html lang="en">',
  ],
  [
    '<title>Calendario Mundial 2026: partidos, horarios y fechas | FutPools</title>',
    '<title>World Cup 2026 Calendar: Schedule, Fixtures & Dates | FutPools</title>',
  ],
  [
    '<meta name="description" content="Calendario del Mundial 2026 completo: los 104 partidos con fechas y horarios en tu zona. Añádelos a tu iPhone, Google Calendar, Android u Outlook, gratis." />',
    '<meta name="description" content="Complete World Cup 2026 calendar: all 104 matches with dates and kickoff times in your timezone. Add them to iPhone, Google Calendar, Android or Outlook, free." />',
  ],
  [
    '<meta property="og:title" content="Calendario Mundial 2026: partidos, horarios y fechas" />',
    '<meta property="og:title" content="World Cup 2026 Calendar: schedule, fixtures & dates" />',
  ],
  [
    '<meta property="og:description" content="Calendario del Mundial 2026: los 104 partidos con fechas y horarios en tu zona. Añádelos a iPhone, Google Calendar, Android u Outlook. Gratis." />',
    '<meta property="og:description" content="World Cup 2026 calendar: all 104 matches with dates and kickoff times in your timezone. Add them to iPhone, Google Calendar, Android or Outlook. Free." />',
  ],
  [
    '<meta property="og:url" content="https://futpools.com/calendario-mundial-2026" />',
    '<meta property="og:url" content="https://futpools.com/world-cup-2026-calendar" />',
  ],
  [
    '<meta property="og:image:alt" content="Vista de calendario con los 104 partidos del Mundial 2026, cada uno con la bandera de su selección." />',
    '<meta property="og:image:alt" content="Calendar view showing all 104 World Cup 2026 matches, each with its country flag." />',
  ],
  [
    '<meta property="og:locale" content="es_MX" />',
    '<meta property="og:locale" content="en_US" />',
  ],
  [
    '<meta property="og:locale:alternate" content="en_US" />',
    '<meta property="og:locale:alternate" content="es_MX" />',
  ],
  [
    '<meta name="twitter:title" content="Calendario Mundial 2026: partidos, horarios y fechas" />',
    '<meta name="twitter:title" content="World Cup 2026 Calendar: schedule, fixtures & dates" />',
  ],
  [
    '<meta name="twitter:description" content="Calendario del Mundial 2026: 104 partidos con fechas y horarios en tu zona. Gratis, sin app." />',
    '<meta name="twitter:description" content="World Cup 2026 calendar: 104 matches with dates and kickoff times in your timezone. Free, no app." />',
  ],
  [
    '<meta name="twitter:image:alt" content="Vista de calendario con los 104 partidos del Mundial 2026 y las banderas de cada selección." />',
    '<meta name="twitter:image:alt" content="Calendar view showing all 104 World Cup 2026 matches with each country\'s flag." />',
  ],
];

let missing = 0;
let enHtml = baseHtml;
for (const [from, to] of ES_TO_EN) {
  if (!enHtml.includes(from)) {
    console.warn('[i18n shells] missing ES string for substitution:', from.slice(0, 80));
    missing += 1;
    continue;
  }
  enHtml = enHtml.replace(from, to);
}
if (missing) {
  console.warn(`[i18n shells] ${missing} string(s) not substituted — check index.html and update build-i18n-shells.js`);
}

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

// Inject a self-referencing canonical + the FAQPage/BreadcrumbList JSON-LD
// into a landing shell. The base index.html / root keeps neither on purpose
// (it's the home, not the calendar). Baking the JSON-LD in (rather than only
// client-side) means non-JS crawlers also get the structured data.
const withSeo = (html, slug, locale) => {
  const ld = JSON.stringify(wc26JsonLd(locale));
  // The id MUST match the component's setJsonLd id so the client-side
  // injection UPDATES this element instead of adding a second one (a second
  // <script> would make Google flag "FAQPage duplicated").
  return html.replace('</head>',
    `    <link rel="canonical" href="https://futpools.com/${slug}" />\n` +
    `    <script id="landing-jsonld" type="application/ld+json">${ld}</script>\n  </head>`);
};

const ES_SLUG = 'calendario-mundial-2026';
const EN_SLUG = 'world-cup-2026-calendar';

ensureDir(path.join(distDir, ES_SLUG));
ensureDir(path.join(distDir, EN_SLUG));

// Spanish landing shell (ES strings + ES canonical + ES JSON-LD)
fs.writeFileSync(
  path.join(distDir, `${ES_SLUG}/index.html`),
  withSeo(baseHtml, ES_SLUG, 'es')
);
fs.writeFileSync(path.join(distDir, '404.html'), baseHtml);

// English landing shell (EN strings + EN canonical + EN JSON-LD)
fs.writeFileSync(
  path.join(distDir, `${EN_SLUG}/index.html`),
  withSeo(enHtml, EN_SLUG, 'en')
);

// ── Mexico team landing shells ──
// We string-swap the calendar head (present in baseHtml) → Mexico's, per
// locale, then inject canonical + JSON-LD. swap() warns if a source string
// drifts (so we notice when index.html changes and a shell silently stops
// updating). For many landings, factor this into a data table.
const MX_ES_SLUG = 'mexico-mundial-2026';
const MX_EN_SLUG = 'mexico-world-cup-2026';
const CAL = {
  title: '<title>Calendario Mundial 2026: partidos, horarios y fechas | FutPools</title>',
  desc: '<meta name="description" content="Calendario del Mundial 2026 completo: los 104 partidos con fechas y horarios en tu zona. Añádelos a tu iPhone, Google Calendar, Android u Outlook, gratis." />',
  ogTitle: '<meta property="og:title" content="Calendario Mundial 2026: partidos, horarios y fechas" />',
  ogDesc: '<meta property="og:description" content="Calendario del Mundial 2026: los 104 partidos con fechas y horarios en tu zona. Añádelos a iPhone, Google Calendar, Android u Outlook. Gratis." />',
  ogUrl: '<meta property="og:url" content="https://futpools.com/calendario-mundial-2026" />',
  twTitle: '<meta name="twitter:title" content="Calendario Mundial 2026: partidos, horarios y fechas" />',
  twDesc: '<meta name="twitter:description" content="Calendario del Mundial 2026: 104 partidos con fechas y horarios en tu zona. Gratis, sin app." />',
  hrefBlock: '<link rel="alternate" hreflang="es" href="https://futpools.com/calendario-mundial-2026" />\n    <link rel="alternate" hreflang="en" href="https://futpools.com/world-cup-2026-calendar" />\n    <link rel="alternate" hreflang="x-default" href="https://futpools.com/calendario-mundial-2026" />',
  ogLocale: '<meta property="og:locale" content="es_MX" />',
  ogLocaleAlt: '<meta property="og:locale:alternate" content="en_US" />',
};
const swap = (html, from, to, label) => {
  if (!html.includes(from)) { console.warn(`[mx shell] missing source string: ${label}`); return html; }
  return html.replace(from, to);
};
function mexicoShell(locale) {
  const es = locale === 'es';
  const slug = es ? MX_ES_SLUG : MX_EN_SLUG;
  const h = es ? {
    title: 'Partidos de México en el Mundial 2026: fechas y horarios | FutPools',
    desc: 'Todos los partidos de México en el Mundial 2026: Grupo A vs Sudáfrica, Corea del Sur y Chequia. Fechas, sedes y horarios. Añádelos a tu calendario gratis.',
    ogTitle: 'Partidos de México en el Mundial 2026: fechas y horarios',
    ogDesc: 'Los partidos de México en el Mundial 2026: Grupo A vs Sudáfrica, Corea del Sur y Chequia. Fechas, sedes y horarios. Gratis.',
    twDesc: 'México en el Mundial 2026: Grupo A, 3 partidos con fechas y sedes. Añádelos a tu calendario gratis.',
  } : {
    title: 'Mexico at the World Cup 2026: Matches, Dates & Times | FutPools',
    desc: 'All of Mexico’s World Cup 2026 matches: Group A vs South Africa, South Korea and Czechia. Dates, venues and times. Add them to your calendar free.',
    ogTitle: 'Mexico at the World Cup 2026: matches, dates & times',
    ogDesc: 'Mexico’s World Cup 2026 matches: Group A vs South Africa, South Korea and Czechia. Dates, venues and times. Free.',
    twDesc: 'Mexico at the World Cup 2026: Group A, 3 matches with dates and venues. Add them to your calendar free.',
  };
  let html = baseHtml;
  html = swap(html, CAL.title, `<title>${h.title}</title>`, 'title');
  html = swap(html, CAL.desc, `<meta name="description" content="${h.desc}" />`, 'description');
  html = swap(html, CAL.ogTitle, `<meta property="og:title" content="${h.ogTitle}" />`, 'og:title');
  html = swap(html, CAL.ogDesc, `<meta property="og:description" content="${h.ogDesc}" />`, 'og:description');
  html = swap(html, CAL.ogUrl, `<meta property="og:url" content="https://futpools.com/${slug}" />`, 'og:url');
  html = swap(html, CAL.twTitle, `<meta name="twitter:title" content="${h.ogTitle}" />`, 'twitter:title');
  html = swap(html, CAL.twDesc, `<meta name="twitter:description" content="${h.twDesc}" />`, 'twitter:description');
  html = swap(html, CAL.hrefBlock,
    `<link rel="alternate" hreflang="es" href="https://futpools.com/${MX_ES_SLUG}" />\n    <link rel="alternate" hreflang="en" href="https://futpools.com/${MX_EN_SLUG}" />\n    <link rel="alternate" hreflang="x-default" href="https://futpools.com/${MX_ES_SLUG}" />`,
    'hreflang');
  if (!es) {
    html = swap(html, CAL.ogLocale, '<meta property="og:locale" content="en_US" />', 'og:locale');
    html = swap(html, CAL.ogLocaleAlt, '<meta property="og:locale:alternate" content="es_MX" />', 'og:locale:alternate');
  }
  // id must match the component's setJsonLd id (avoids a duplicate FAQPage).
  return html.replace('</head>',
    `    <link rel="canonical" href="https://futpools.com/${slug}" />\n` +
    `    <script id="landing-jsonld" type="application/ld+json">${JSON.stringify(mexicoJsonLd(locale))}</script>\n  </head>`);
}
ensureDir(path.join(distDir, MX_ES_SLUG));
ensureDir(path.join(distDir, MX_EN_SLUG));
fs.writeFileSync(path.join(distDir, `${MX_ES_SLUG}/index.html`), mexicoShell('es'));
fs.writeFileSync(path.join(distDir, `${MX_EN_SLUG}/index.html`), mexicoShell('en'));

// ── Quiniela de la semana shell (ES-only — no hreflang/alternates) ──
const QS_SLUG = 'quiniela-de-la-semana';
function quinielaShell() {
  let html = baseHtml;
  html = swap(html, CAL.title, '<title>Quiniela de la semana: Progol y quiniela posible | FutPools</title>', 'qs:title');
  html = swap(html, CAL.desc, '<meta name="description" content="Qué es la quiniela de la semana de Progol, cómo se llena (L/E/V de 14 partidos), qué es la quiniela posible, y cómo jugar tu propia quiniela en FutPools. Gratis." />', 'qs:desc');
  html = swap(html, CAL.ogTitle, '<meta property="og:title" content="Quiniela de la semana: Progol y quiniela posible" />', 'qs:og:title');
  html = swap(html, CAL.ogDesc, '<meta property="og:description" content="Cómo funciona la quiniela de la semana de Progol (L/E/V, 14 partidos + Revancha), qué es la quiniela posible, y cómo jugar tu propia quiniela en FutPools." />', 'qs:og:description');
  html = swap(html, CAL.ogUrl, `<meta property="og:url" content="https://futpools.com/${QS_SLUG}" />`, 'qs:og:url');
  html = swap(html, CAL.twTitle, '<meta name="twitter:title" content="Quiniela de la semana: Progol y quiniela posible" />', 'qs:twitter:title');
  html = swap(html, CAL.twDesc, '<meta name="twitter:description" content="Cómo funciona la quiniela de la semana (Progol) y cómo jugar la tuya en FutPools. Gratis." />', 'qs:twitter:description');
  // ES-only page: drop the calendar's hreflang block (no alternates).
  html = swap(html, CAL.hrefBlock, '<!-- single-locale page: no hreflang -->', 'qs:hreflang');
  return html.replace('</head>',
    `    <link rel="canonical" href="https://futpools.com/${QS_SLUG}" />\n` +
    `    <script id="landing-jsonld" type="application/ld+json">${JSON.stringify(quinielaJsonLd())}</script>\n  </head>`);
}
ensureDir(path.join(distDir, QS_SLUG));
fs.writeFileSync(path.join(distDir, `${QS_SLUG}/index.html`), quinielaShell());

// ── Pronósticos de fútbol shell (ES-only — no hreflang/alternates) ──
const PF_SLUG = 'pronosticos-de-futbol';
function pronosticosShell() {
  let html = baseHtml;
  html = swap(html, CAL.title, '<title>Pronósticos de fútbol: haz tu quiniela y compite | FutPools</title>', 'pf:title');
  html = swap(html, CAL.desc, '<meta name="description" content="Aprende a hacer pronósticos de fútbol (L, E, V): cómo analizar forma, localía y bajas, y pon a prueba tus pronósticos en quinielas con amigos en FutPools." />', 'pf:desc');
  html = swap(html, CAL.ogTitle, '<meta property="og:title" content="Pronósticos de fútbol: haz tu quiniela y compite" />', 'pf:og:title');
  html = swap(html, CAL.ogDesc, '<meta property="og:description" content="Cómo hacer pronósticos de fútbol (L/E/V) con criterio: forma, localía, cara a cara y bajas. Y dónde ponerlos a prueba: las quinielas de FutPools." />', 'pf:og:description');
  html = swap(html, CAL.ogUrl, `<meta property="og:url" content="https://futpools.com/${PF_SLUG}" />`, 'pf:og:url');
  html = swap(html, CAL.twTitle, '<meta name="twitter:title" content="Pronósticos de fútbol: haz tu quiniela y compite" />', 'pf:twitter:title');
  html = swap(html, CAL.twDesc, '<meta name="twitter:description" content="Haz tus pronósticos de fútbol (L/E/V) y compite con tus aciertos en las quinielas de FutPools." />', 'pf:twitter:description');
  // ES-only page: drop the calendar's hreflang block (no alternates).
  html = swap(html, CAL.hrefBlock, '<!-- single-locale page: no hreflang -->', 'pf:hreflang');
  return html.replace('</head>',
    `    <link rel="canonical" href="https://futpools.com/${PF_SLUG}" />\n` +
    `    <script id="landing-jsonld" type="application/ld+json">${JSON.stringify(pronosticosJsonLd())}</script>\n  </head>`);
}
ensureDir(path.join(distDir, PF_SLUG));
fs.writeFileSync(path.join(distDir, `${PF_SLUG}/index.html`), pronosticosShell());

// ── Pronósticos fútbol hoy shell (ES-only — no hreflang/alternates) ──
const PFH_SLUG = 'pronosticos-futbol-hoy';
function pronosticosHoyShell() {
  let html = baseHtml;
  html = swap(html, CAL.title, '<title>Pronósticos de fútbol hoy: partidos y quinielas | FutPools</title>', 'pfh:title');
  html = swap(html, CAL.desc, '<meta name="description" content="Pronósticos de fútbol hoy: consulta los partidos de hoy, elige L, E o V y pon tus pronósticos a competir en una quiniela de FutPools antes del primer partido." />', 'pfh:desc');
  html = swap(html, CAL.ogTitle, '<meta property="og:title" content="Pronósticos de fútbol hoy: partidos y quinielas" />', 'pfh:og:title');
  html = swap(html, CAL.ogDesc, '<meta property="og:description" content="Los partidos de hoy y tus pronósticos L/E/V compitiendo en quinielas de FutPools. La inscripción cierra al primer partido." />', 'pfh:og:description');
  html = swap(html, CAL.ogUrl, `<meta property="og:url" content="https://futpools.com/${PFH_SLUG}" />`, 'pfh:og:url');
  html = swap(html, CAL.twTitle, '<meta name="twitter:title" content="Pronósticos de fútbol hoy: partidos y quinielas" />', 'pfh:twitter:title');
  html = swap(html, CAL.twDesc, '<meta name="twitter:description" content="Los partidos de hoy y tus pronósticos L/E/V compitiendo en quinielas de FutPools." />', 'pfh:twitter:description');
  // ES-only page: drop the calendar's hreflang block (no alternates).
  html = swap(html, CAL.hrefBlock, '<!-- single-locale page: no hreflang -->', 'pfh:hreflang');
  return html.replace('</head>',
    `    <link rel="canonical" href="https://futpools.com/${PFH_SLUG}" />\n` +
    `    <script id="landing-jsonld" type="application/ld+json">${JSON.stringify(pronosticosHoyJsonLd())}</script>\n  </head>`);
}
ensureDir(path.join(distDir, PFH_SLUG));
fs.writeFileSync(path.join(distDir, `${PFH_SLUG}/index.html`), pronosticosHoyShell());

// ── Quiniela fútbol hoy shell (ES-only — no hreflang/alternates) ──
const QH_SLUG = 'quiniela-futbol-hoy';
function quinielaHoyShell() {
  let html = baseHtml;
  html = swap(html, CAL.title, '<title>Quiniela de fútbol hoy: juega y gana premios | FutPools</title>', 'qh:title');
  html = swap(html, CAL.desc, '<meta name="description" content="Quiniela de fútbol hoy: entra a la quiniela con inscripción abierta, llena tus L, E o V con los partidos del día y compite por el premio antes del primer partido." />', 'qh:desc');
  html = swap(html, CAL.ogTitle, '<meta property="og:title" content="Quiniela de fútbol hoy: juega y gana premios" />', 'qh:og:title');
  html = swap(html, CAL.ogDesc, '<meta property="og:description" content="La quiniela de hoy con inscripción abierta: llena tus L/E/V con los partidos del día y compite por el premio antes del primer silbatazo." />', 'qh:og:description');
  html = swap(html, CAL.ogUrl, `<meta property="og:url" content="https://futpools.com/${QH_SLUG}" />`, 'qh:og:url');
  html = swap(html, CAL.twTitle, '<meta name="twitter:title" content="Quiniela de fútbol hoy: juega y gana premios" />', 'qh:twitter:title');
  html = swap(html, CAL.twDesc, '<meta name="twitter:description" content="Entra a la quiniela de hoy, llena tus L/E/V y compite por el premio antes del primer partido." />', 'qh:twitter:description');
  // ES-only page: drop the calendar's hreflang block (no alternates).
  html = swap(html, CAL.hrefBlock, '<!-- single-locale page: no hreflang -->', 'qh:hreflang');
  return html.replace('</head>',
    `    <link rel="canonical" href="https://futpools.com/${QH_SLUG}" />\n` +
    `    <script id="landing-jsonld" type="application/ld+json">${JSON.stringify(quinielaHoyJsonLd())}</script>\n  </head>`);
}
ensureDir(path.join(distDir, QH_SLUG));
fs.writeFileSync(path.join(distDir, `${QH_SLUG}/index.html`), quinielaHoyShell());

console.log('[i18n shells] wrote:');
console.log(`  dist/${ES_SLUG}/index.html  (es)`);
console.log(`  dist/${EN_SLUG}/index.html  (en)`);
console.log(`  dist/${MX_ES_SLUG}/index.html  (es)`);
console.log(`  dist/${MX_EN_SLUG}/index.html  (en)`);
console.log(`  dist/${QS_SLUG}/index.html  (es)`);
console.log(`  dist/${PF_SLUG}/index.html  (es)`);
console.log(`  dist/${PFH_SLUG}/index.html  (es)`);
console.log(`  dist/${QH_SLUG}/index.html  (es)`);
console.log('  dist/404.html                          (es)');
