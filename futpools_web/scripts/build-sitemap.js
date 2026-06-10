#!/usr/bin/env node
/**
 * Postbuild: snapshot the backend's dynamic sitemap into dist/sitemap.xml
 * so https://futpools.com/sitemap.xml is same-host AND deploy-fresh
 * (Render Static can't proxy to the API). If the backend is unreachable,
 * the static public/sitemap.xml that Vite already copied stays as the
 * fallback — the build never fails over this.
 *
 * Override the source with SITEMAP_API_URL (defaults to VITE_API_URL, then
 * https://api.futpools.com).
 */
import fs from 'node:fs';
import path from 'node:path';

const API = (process.env.SITEMAP_API_URL || process.env.VITE_API_URL || 'https://api.futpools.com').replace(/\/+$/, '');
const distFile = path.resolve(process.cwd(), 'dist', 'sitemap.xml');

try {
  const res = await fetch(`${API}/sitemap.xml`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  if (!xml.includes('<urlset')) throw new Error('unexpected response (not a <urlset>)');
  fs.writeFileSync(distFile, xml);
  const urls = (xml.match(/<loc>/g) || []).length;
  console.log(`[sitemap] wrote dist/sitemap.xml from ${API}/sitemap.xml — ${urls} URLs`);
} catch (e) {
  console.warn(`[sitemap] could not fetch dynamic sitemap (${e.message}); keeping static fallback public/sitemap.xml`);
}
