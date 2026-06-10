/**
 * Dynamic sitemap for futpools.com. Lists the static public routes plus
 * every public, non-cancelled pool, generated from the DB and cached in
 * memory (15 min) so crawlers don't hammer Mongo.
 *
 * Served at GET /sitemap.xml on the backend (api.futpools.com). Because
 * futpools.com is a static host that can't proxy, the web build
 * (futpools_web → scripts/build-sitemap.js, postbuild) fetches THIS and
 * writes it to dist/sitemap.xml, so https://futpools.com/sitemap.xml is a
 * same-host, deploy-fresh copy. All <loc> URLs therefore point at the WEB
 * host (WEB_APP_BASE_URL), never the API host.
 */

const Quiniela = require('../models/Quiniela');

const webBase = () => (process.env.WEB_APP_BASE_URL || 'https://futpools.com').replace(/\/+$/, '');

// Public, indexable static routes. The WC26 calendar is bilingual, so each
// variant declares its ES/EN/x-default alternates via xhtml:link.
const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  {
    path: '/calendariomundial2026', changefreq: 'weekly', priority: '0.9',
    alternates: [['es', '/calendariomundial2026'], ['en', '/worldcup2026calendar'], ['x-default', '/calendariomundial2026']],
  },
  {
    path: '/worldcup2026calendar', changefreq: 'weekly', priority: '0.9',
    alternates: [['es', '/calendariomundial2026'], ['en', '/worldcup2026calendar'], ['x-default', '/calendariomundial2026']],
  },
  { path: '/register', changefreq: 'monthly', priority: '0.4' },
  { path: '/login', changefreq: 'monthly', priority: '0.3' },
];

function isoDay(d) {
  const date = d ? new Date(d) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

let cache = { xml: null, at: 0 };
const TTL_MS = 15 * 60 * 1000;
const MAX_POOLS = 45000; // well under the 50k sitemap URL limit

async function generate() {
  const web = webBase();
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">');

  for (const r of STATIC_ROUTES) {
    out.push('  <url>');
    out.push(`    <loc>${web}${r.path}</loc>`);
    out.push(`    <changefreq>${r.changefreq}</changefreq>`);
    out.push(`    <priority>${r.priority}</priority>`);
    for (const [lang, p] of (r.alternates || [])) {
      out.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${web}${p}" />`);
    }
    out.push('  </url>');
  }

  // Public pools — anonymous visitors can land on these via share links, so
  // they're legitimately indexable. Private/invite-only pools are excluded.
  const pools = await Quiniela.find({ visibility: 'public', cancelledAt: null })
    .select('_id updatedAt')
    .sort({ updatedAt: -1 })
    .limit(MAX_POOLS)
    .lean();

  for (const p of pools) {
    out.push('  <url>');
    out.push(`    <loc>${web}/pool/${p._id}</loc>`);
    out.push(`    <lastmod>${isoDay(p.updatedAt)}</lastmod>`);
    out.push('    <changefreq>weekly</changefreq>');
    out.push('    <priority>0.6</priority>');
    out.push('  </url>');
  }

  out.push('</urlset>');
  return out.join('\n');
}

exports.getSitemap = async (req, res) => {
  try {
    const now = Date.now();
    if (!cache.xml || now - cache.at > TTL_MS) {
      cache.xml = await generate();
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

// Exposed for tests / the build-time fetch fallback.
exports._generate = generate;
