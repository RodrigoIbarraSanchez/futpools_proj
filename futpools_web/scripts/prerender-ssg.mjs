/**
 * Bake server-rendered landing bodies into their static shells.
 *
 * Runs AFTER `vite build` + build-i18n-shells.js (which write the empty-body
 * shells) AND after the SSR bundle is built (`vite build --ssr src/ssr/landings.jsx
 * --outDir .ssr-build`). Pure Node — works in Render's build, no headless
 * browser. See src/ssr/landings.jsx for why this exists.
 *
 * If the SSR bundle is missing (e.g. the SSR build step was skipped), this exits
 * 0 without baking — shells keep their client-rendered bodies, no broken build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const ssrEntry = path.join(root, '.ssr-build', 'landings.js');

const textLen = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;

if (!fs.existsSync(ssrEntry)) {
  console.warn(`[ssg] SSR bundle not found at ${ssrEntry} — skipping (shells keep client-rendered bodies).`);
  process.exit(0);
}

const { renderLanding, SSG_SLUGS } = await import(pathToFileURL(ssrEntry).href);

let failures = 0;
for (const slug of SSG_SLUGS) {
  const shellPath = path.join(distDir, slug, 'index.html');
  if (!fs.existsSync(shellPath)) {
    console.error(`[ssg] SKIP ${slug}: no shell at dist/${slug}/index.html`);
    failures++;
    continue;
  }
  let body;
  try {
    body = renderLanding(slug);
  } catch (err) {
    console.error(`[ssg] FAIL ${slug}: render threw — ${err.message}`);
    failures++;
    continue;
  }
  if (!body || textLen(body) < 300) {
    console.error(`[ssg] FAIL ${slug}: rendered content too small (${body ? textLen(body) : 0} chars). Not baking.`);
    failures++;
    continue;
  }
  let shell = fs.readFileSync(shellPath, 'utf8');
  if (!shell.includes('<div id="root"></div>')) {
    shell = shell.replace(/<div id="root">[\s\S]*?<\/div>\s*<script/, '<div id="root"></div>\n    <script');
  }
  shell = shell.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  fs.writeFileSync(shellPath, shell);
  console.log(`[ssg] OK   ${slug}: baked ${textLen(body)} chars of server-rendered content into #root`);
}

if (failures) {
  console.error(`[ssg] ${failures} failure(s).`);
  process.exit(1);
}
