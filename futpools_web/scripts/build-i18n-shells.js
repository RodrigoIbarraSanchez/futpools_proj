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
    '<title>Calendario Mundial 2026 — Partidos, horarios y fechas | FutPools</title>',
    '<title>World Cup 2026 Calendar — Schedule, Fixtures & Dates | FutPools</title>',
  ],
  [
    '<meta name="description" content="Calendario del Mundial 2026 completo: los 104 partidos con fechas y horarios en tu zona. Añádelos a tu iPhone, Google Calendar, Android u Outlook — gratis." />',
    '<meta name="description" content="Complete World Cup 2026 calendar: all 104 matches with dates and kickoff times in your timezone. Add them to iPhone, Google Calendar, Android or Outlook — free." />',
  ],
  [
    '<meta property="og:title" content="Calendario Mundial 2026 — partidos, horarios y fechas" />',
    '<meta property="og:title" content="World Cup 2026 Calendar — schedule, fixtures & dates" />',
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
    '<meta name="twitter:title" content="Calendario Mundial 2026 — partidos, horarios y fechas" />',
    '<meta name="twitter:title" content="World Cup 2026 Calendar — schedule, fixtures & dates" />',
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
  return html.replace('</head>',
    `    <link rel="canonical" href="https://futpools.com/${slug}" />\n` +
    `    <script type="application/ld+json">${ld}</script>\n  </head>`);
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

console.log('[i18n shells] wrote:');
console.log(`  dist/${ES_SLUG}/index.html  (es)`);
console.log(`  dist/${EN_SLUG}/index.html  (en)`);
console.log('  dist/404.html                          (es)');
