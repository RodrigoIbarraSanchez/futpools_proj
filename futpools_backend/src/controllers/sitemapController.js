/**
 * Sitemap for futpools.com. Lists ONLY pages that ship a real static shell
 * with a self-referential canonical: the homepage + the SSG landing pages.
 * SPA-only routes (/login, /register, the /agregar + /add export tools,
 * /pool/:id) are intentionally EXCLUDED — they serve the homepage SPA shell
 * (canonical=/), so submitting them makes Search Console flag them as
 * "Duplicate without user-selected canonical", and they 404'd for crawlers
 * during the routing-fix window.
 *
 * Served at GET /sitemap.xml on the backend (api.futpools.com). The web host
 * (futpools.com) serves its OWN static public/sitemap.xml; this endpoint is
 * kept IN SYNC with it so any crawler that still hits the api host (e.g. an
 * api.futpools.com/sitemap.xml left submitted in Search Console) gets the same
 * clean set, not homepage-duplicate noise. All <loc> URLs point at the WEB
 * host (WEB_APP_BASE_URL), never the API host.
 */

const webBase = () => (process.env.WEB_APP_BASE_URL || 'https://futpools.com').replace(/\/+$/, '');

// The WC26 calendar landing is bilingual: each variant declares its ES/EN/
// x-default alternates via xhtml:link.
const WC_LANDING_ALT = [['es', '/calendario-mundial-2026'], ['en', '/world-cup-2026-calendar'], ['x-default', '/calendario-mundial-2026']];
const MX_LANDING_ALT = [['es', '/mexico-mundial-2026'], ['en', '/mexico-world-cup-2026'], ['x-default', '/mexico-mundial-2026']];

// Only pages with a real SSG shell + self-referential canonical. Do NOT add
// SPA routes (pool, login, register, the export tools) — they have no shell of
// their own, so they're homepage duplicates and pollute Search Console. Keep
// this list identical to futpools_web/public/sitemap.xml.
const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  {
    path: '/calendario-mundial-2026', changefreq: 'weekly', priority: '0.9', alternates: WC_LANDING_ALT,
    images: [{ loc: '/calendario-mundial-2026-partidos.jpg', title: 'Calendario del Mundial 2026 con los 104 partidos en un teléfono' }],
  },
  {
    path: '/world-cup-2026-calendar', changefreq: 'weekly', priority: '0.9', alternates: WC_LANDING_ALT,
    images: [{ loc: '/calendario-mundial-2026-partidos.jpg', title: 'World Cup 2026 calendar with all 104 matches on a phone' }],
  },
  { path: '/mexico-mundial-2026', changefreq: 'weekly', priority: '0.8', alternates: MX_LANDING_ALT },
  { path: '/mexico-world-cup-2026', changefreq: 'weekly', priority: '0.8', alternates: MX_LANDING_ALT },
  { path: '/quiniela-de-la-semana', changefreq: 'weekly', priority: '0.7' },
  { path: '/pronosticos-de-futbol', changefreq: 'weekly', priority: '0.7' },
  { path: '/pronosticos-futbol-hoy', changefreq: 'daily', priority: '0.7' },
  { path: '/quiniela-futbol-hoy', changefreq: 'daily', priority: '0.7' },
  { path: '/quiniela-liga-mexicana', changefreq: 'weekly', priority: '0.8' },
];

let cache = { xml: null, at: 0 };
const TTL_MS = 15 * 60 * 1000;

function generate() {
  const web = webBase();
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  // Human-friendly rendering in browsers. Crawlers ignore it.
  out.push('<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>');
  out.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');

  for (const r of STATIC_ROUTES) {
    out.push('  <url>');
    out.push(`    <loc>${web}${r.path}</loc>`);
    out.push(`    <changefreq>${r.changefreq}</changefreq>`);
    out.push(`    <priority>${r.priority}</priority>`);
    for (const [lang, p] of (r.alternates || [])) {
      out.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${web}${p}" />`);
    }
    for (const img of (r.images || [])) {
      out.push('    <image:image>');
      out.push(`      <image:loc>${web}${img.loc}</image:loc>`);
      if (img.title) out.push(`      <image:title>${img.title}</image:title>`);
      out.push('    </image:image>');
    }
    out.push('  </url>');
  }

  out.push('</urlset>');
  return out.join('\n');
}

exports.getSitemap = (req, res) => {
  try {
    const now = Date.now();
    if (!cache.xml || now - cache.at > TTL_MS) {
      cache.xml = generate();
      cache.at = now;
    }
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=900');
    res.send(cache.xml);
  } catch (err) {
    console.error('[sitemap] generate error:', err.message);
    res
      .status(500)
      .type('application/xml')
      .send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
};

// Exposed for tests.
exports._generate = generate;
