/**
 * Prerender landing bodies into their static shells.
 *
 * WHY: the site is a client-rendered React SPA. Render serves
 * `<body><div id="root"></div></body>` — an EMPTY body. Crawlers/graders that
 * don't execute JS (Moz On-Page Grader, and Google's first crawl wave) see no
 * content, so every content signal (keyword in body, word/char count, header
 * tags) fails. This step runs the built app in the system Chrome, captures the
 * real rendered content of #root, and bakes it into the static shell. React
 * (createRoot) replaces #root on mount, so users get the same interactive app;
 * crawlers now get the full text in the served HTML.
 *
 * Runs AFTER `vite build` AND `build-i18n-shells.js` (which write the heads).
 * Re-running the shell builder resets #root to empty, so this MUST be last.
 *
 * Usage:  node scripts/prerender.mjs [slug ...]
 * No args → pilot set (Liga MX only). Pass slugs to extend the rollout.
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const PORT = 5099;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Pilot: Liga MX only. Extend by passing slugs as args, or grow this default.
const SLUGS = process.argv.slice(2).length ? process.argv.slice(2) : ['quiniela-liga-mexicana'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.join(distDir, urlPath);
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!fs.existsSync(filePath)) filePath = path.join(distDir, 'index.html'); // SPA fallback
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// IMPORTANT: async spawn (not spawnSync). The static server runs in THIS Node
// process; spawnSync would block the event loop so the server could never
// answer Chrome's requests (→ empty page). spawn keeps the loop free.
function dumpDomOnce(url) {
  return new Promise((resolve) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-prerender-'));
    // Minimal proven flag set. Extra flags (--disable-background-networking,
    // --disable-component-update, --hide-scrollbars, --virtual-time-budget) make
    // this Chrome build fail to launch ("Trying to load the allocator multiple
    // times") or hang — do not add them back.
    const args = [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions',
      `--user-data-dir=${userDataDir}`,
      // The app fetches the live pool on mount. Point the API host at a dead port
      // so that call fails instantly (the evergreen SEO content renders anyway,
      // the live pool card just falls back) — otherwise dump-dom waits on it.
      '--host-resolver-rules=MAP api.futpools.com 127.0.0.1:9',
      '--dump-dom', url,
    ];
    const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    let settled = false;
    const cleanup = () => { try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ } };
    const finish = (val) => { if (settled) return; settled = true; clearTimeout(timer); cleanup(); resolve(val); };
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } finish(out); }, 40000);
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', () => finish(out));
    child.on('error', () => finish(''));
  });
}

async function dumpDom(url) {
  // The system Chrome occasionally loses a launch race to GoogleUpdater
  // ("Trying to load the allocator multiple times"); a short settle + retry clears it.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const dom = await dumpDomOnce(url);
    if (dom.length >= 1000 && dom.includes('id="root"')) return dom;
    console.warn(`[prerender] attempt ${attempt} for ${url} returned ${dom.length} bytes; settling + retrying...`);
    await wait(3000);
  }
  throw new Error(`Chrome produced no usable DOM for ${url} after 3 attempts.`);
}

/** Return the innerHTML of <div id="root"> by matching div depth. */
function extractRootInner(html) {
  const marker = '<div id="root">';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const contentStart = start + marker.length;
  const re = /<\/?div\b/gi;
  re.lastIndex = contentStart;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0].toLowerCase() === '<div' ? 1 : -1;
    if (depth === 0) return html.slice(contentStart, m.index);
  }
  return null;
}

const textLen = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;

async function run() {
  // dist/ is built locally and committed; Render just serves it. So prerender
  // only needs to run on the machine that builds before committing. If Chrome
  // isn't present (CI, a Linux box, a teammate without Chrome), skip cleanly
  // rather than fail the build — the shells stay valid, just not body-baked.
  if (!fs.existsSync(CHROME)) {
    console.warn(`[prerender] Chrome not found at ${CHROME} — skipping prerender (shells keep client-rendered bodies).`);
    return;
  }
  const server = await startServer();
  console.log(`[prerender] serving dist on http://localhost:${PORT}`);
  let failures = 0;
  for (const slug of SLUGS) {
    const shellPath = path.join(distDir, slug, 'index.html');
    if (!fs.existsSync(shellPath)) {
      console.error(`[prerender] SKIP ${slug}: no shell at ${shellPath}`);
      failures++;
      continue;
    }
    const dom = await dumpDom(`http://localhost:${PORT}/${slug}/`);
    const inner = extractRootInner(dom);
    if (!inner || textLen(inner) < 300) {
      console.error(`[prerender] FAIL ${slug}: rendered content too small (${inner ? textLen(inner) : 0} chars). Not baking.`);
      failures++;
      continue;
    }
    // Bake the rendered DOM AS-IS (do NOT force reveal classes visible). The
    // baked content exists only for no-JS crawlers, which read text regardless
    // of CSS opacity; leaving the reveal state natural means that when React
    // (createRoot) replaces #root on mount there is no "flash then re-animate".
    let shell = fs.readFileSync(shellPath, 'utf8');
    if (!shell.includes('<div id="root"></div>')) {
      console.error(`[prerender] WARN ${slug}: shell #root not empty (already baked?). Overwriting.`);
      shell = shell.replace(/<div id="root">[\s\S]*?<\/div>\s*<script/, '<div id="root"></div>\n    <script');
    }
    shell = shell.replace('<div id="root"></div>', `<div id="root">${inner}</div>`);
    fs.writeFileSync(shellPath, shell);
    console.log(`[prerender] OK   ${slug}: baked ${textLen(inner)} chars of content into #root`);
  }
  server.close();
  if (failures) {
    console.error(`[prerender] ${failures} failure(s).`);
    process.exit(1);
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
