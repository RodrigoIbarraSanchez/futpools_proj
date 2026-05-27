#!/usr/bin/env node
/**
 * Postbuild step: emit per-locale index.html shells so that crawlers
 * (WhatsApp, Facebook, Twitter, Google) see meta tags in the right
 * language for each URL, and Render serves a 200 OK at those paths
 * (rather than the 404 it returns for _redirects-rewritten routes).
 *
 *   dist/index.html                          → default (Spanish)
 *   dist/404.html                            → SPA fallback (Spanish)
 *   dist/calendariomundial2026/index.html    → Spanish shell
 *   dist/worldcup2026calendar/index.html     → ENGLISH shell
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
    '<title>FutPools — Calendario Mundial 2026</title>',
    '<title>FutPools — World Cup 2026 Calendar</title>',
  ],
  [
    '<meta name="description" content="Añade los 104 partidos del Mundial 2026 a tu calendario en 3 pasos. Gratis. iPhone, Google Calendar, Android, Outlook." />',
    '<meta name="description" content="Add all 104 FIFA World Cup 2026 matches to your calendar in 3 steps. Free. iPhone, Google Calendar, Android, Outlook." />',
  ],
  [
    '<meta property="og:title" content="Calendario Mundial 2026 — añade todos los partidos a tu calendario" />',
    '<meta property="og:title" content="World Cup 2026 Calendar — add every match to your calendar" />',
  ],
  [
    '<meta property="og:description" content="Sincroniza los 104 partidos del Mundial FIFA 2026 con iPhone, Google Calendar, Android u Outlook en 3 pasos. Gratis." />',
    '<meta property="og:description" content="Sync all 104 FIFA World Cup 2026 matches to iPhone, Google Calendar, Android, or Outlook in 3 steps. Free." />',
  ],
  [
    '<meta property="og:url" content="https://futpools.com/calendariomundial2026" />',
    '<meta property="og:url" content="https://futpools.com/worldcup2026calendar" />',
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
    '<meta name="twitter:title" content="Calendario Mundial 2026 — añade todos los partidos a tu calendario" />',
    '<meta name="twitter:title" content="World Cup 2026 Calendar — add every match to your calendar" />',
  ],
  [
    '<meta name="twitter:description" content="Sincroniza los 104 partidos del Mundial 2026 con tu calendario en 3 pasos. Gratis, sin app." />',
    '<meta name="twitter:description" content="Sync all 104 World Cup 2026 matches to your calendar in 3 steps. Free, no app needed." />',
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

ensureDir(path.join(distDir, 'calendariomundial2026'));
ensureDir(path.join(distDir, 'worldcup2026calendar'));

// Spanish shells (identical to base)
fs.writeFileSync(path.join(distDir, 'calendariomundial2026/index.html'), baseHtml);
fs.writeFileSync(path.join(distDir, '404.html'), baseHtml);

// English shell
fs.writeFileSync(path.join(distDir, 'worldcup2026calendar/index.html'), enHtml);

console.log('[i18n shells] wrote:');
console.log('  dist/calendariomundial2026/index.html  (es)');
console.log('  dist/worldcup2026calendar/index.html   (en)');
console.log('  dist/404.html                          (es)');
