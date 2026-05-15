/**
 * OG share routes — serve WhatsApp/social preview HTML and fixture card images.
 *
 * GET /p/:code           → Quiniela invite landing (HTML + og: meta + redirect)
 * GET /p/:code/image.png → 1200×630 fixture-card PNG (resvg-js) or SVG fallback
 * GET /c/:code           → Challenge invite landing (HTML + og: meta + redirect)
 * GET /c/:code/image.png → 1200×630 challenge-card PNG (same Resvg pipeline)
 */

const express = require('express');
const Quiniela = require('../models/Quiniela');
const Challenge = require('../models/Challenge');

const router = express.Router();

// Try to load resvg-js; fall back to SVG if it's unavailable.
let Resvg = null;
try { ({ Resvg } = require('@resvg/resvg-js')); } catch {}

// ── Helpers ────────────────────────────────────────────────────────────────

const INVITE_ALPHABET_RE = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;

function sanitizeCode(raw) {
  if (!raw) return '';
  const upper = decodeURIComponent(String(raw)).toUpperCase();
  return (upper.match(INVITE_ALPHABET_RE) || []).slice(0, 8).join('');
}

function escXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shortKickoff(date) {
  if (!date) return '';
  return new Date(date)
    .toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
    .toUpperCase();
}

// ── SVG fixture-card template ──────────────────────────────────────────────

function buildSvg(pool) {
  const W = 1200, H = 630;
  const fixtures = (pool.fixtures || []).slice(0, 5);

  const fixtureRows = fixtures.map((f, i) => {
    const y0 = 288 + i * 60;
    const home = escXml(String(f.homeTeam || '').slice(0, 14));
    const away = escXml(String(f.awayTeam || '').slice(0, 14));
    const time = escXml(shortKickoff(f.kickoff));
    return `
    <rect x="64" y="${y0}" width="1072" height="50" rx="6" fill="#0B1018"/>
    <text x="84"  y="${y0 + 32}" font-size="16" fill="#4B5563" font-family="sans-serif">${time}</text>
    <text x="530" y="${y0 + 33}" font-size="24" fill="#F1F5F9" font-weight="bold" font-family="sans-serif" text-anchor="end">${home}</text>
    <text x="600" y="${y0 + 33}" font-size="18" fill="#21E28C" font-family="sans-serif" text-anchor="middle">VS</text>
    <text x="670" y="${y0 + 33}" font-size="24" fill="#F1F5F9" font-weight="bold" font-family="sans-serif">${away}</text>`;
  }).join('\n');

  const prizeInfo = escXml(pool.prizeLabel || pool.prize || '');
  const prizeRow = prizeInfo
    ? `<text x="84" y="206" font-size="20" fill="#9CA3AF" font-family="sans-serif">Prize: ${prizeInfo}</text>`
    : '';

  const entryCoins = parseFloat(String(pool.entryCostCoins || pool.cost || '0').replace(/[^0-9.]/g, ''));
  const entryText = entryCoins > 0
    ? `Entry: ${escXml(String(pool.entryCostCoins || pool.cost))}`
    : 'Free entry';
  const metaY = prizeInfo ? 248 : 208;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#07090D"/>
  <rect x="0" y="0" width="8" height="${H}" fill="#21E28C"/>
  <line x1="64" y1="262" x2="1136" y2="262" stroke="#1A2535" stroke-width="1"/>
  <text x="84" y="88"  font-size="48" fill="#21E28C" font-weight="bold" font-family="sans-serif" letter-spacing="6">FUTPOOLS</text>
  <text x="84" y="150" font-size="36" fill="#F9FAFB" font-weight="bold" font-family="sans-serif">${escXml(pool.name)}</text>
  ${prizeRow}
  <text x="84" y="${metaY}" font-size="14" fill="#374151" font-family="sans-serif" letter-spacing="3">${fixtures.length} FIXTURE${fixtures.length !== 1 ? 'S' : ''} · ${entryText}</text>
  ${fixtureRows}
  <text x="84" y="618" font-size="15" fill="#21E28C" font-family="sans-serif" opacity="0.5">futpools.com</text>
</svg>`;
}

// ── Challenge card ─────────────────────────────────────────────────────────

/**
 * Spanish-friendly phrasing of a challenge pick. Used both in the OG
 * description (read by WhatsApp on share) and in the SVG card. We bind
 * 1/X/2 to the actual team names so the preview reads naturally instead
 * of leaking internal codes ("1" → "Real Madrid wins").
 */
function challengePickPhrase(c) {
  const fx = c.fixture || {};
  const home = fx.homeTeam || 'Local';
  const away = fx.awayTeam || 'Visita';
  switch (c.marketType) {
    case '1X2':
      if (c.challengerPick === '1') return `gana ${home}`;
      if (c.challengerPick === '2') return `gana ${away}`;
      return 'empate';
    case 'OU25':
      return c.challengerPick === 'OVER' ? 'más de 2.5 goles' : 'menos de 2.5 goles';
    case 'BTTS':
      return c.challengerPick === 'YES' ? 'ambos equipos anotan' : 'al menos uno no anota';
    default:
      return c.challengerPick || '';
  }
}

/**
 * Compact pick badge for the SVG card. Shorter than the full phrase since
 * it sits inside a fixed-width pill — keep it readable at a glance.
 */
function challengePickBadge(c) {
  switch (c.marketType) {
    case '1X2':
      if (c.challengerPick === '1') return 'LOCAL';
      if (c.challengerPick === '2') return 'VISITA';
      return 'EMPATE';
    case 'OU25':
      return c.challengerPick === 'OVER' ? 'OVER 2.5' : 'UNDER 2.5';
    case 'BTTS':
      return c.challengerPick === 'YES' ? 'BTTS · SÍ' : 'BTTS · NO';
    default:
      return c.challengerPick || '';
  }
}

function buildChallengeSvg(c) {
  const W = 1200, H = 630;
  const fx = c.fixture || {};
  const home = escXml(String(fx.homeTeam || '').slice(0, 18));
  const away = escXml(String(fx.awayTeam || '').slice(0, 18));
  const league = escXml(String(fx.leagueName || '').slice(0, 30));
  const time = escXml(shortKickoff(fx.kickoff));

  const challengerName = c.challenger?.username
    ? `@${String(c.challenger.username).toUpperCase()}`
    : '@RIVAL';
  const opponentLabel = c.opponent?.username
    ? `VS @${String(c.opponent.username).toUpperCase()}`
    : 'RETO ABIERTO · ALGUIEN PUEDE TOMARLO';
  const opponentColor = c.opponent ? '#9CA3AF' : '#21E28C';

  const pickBadge = escXml(challengePickBadge(c));
  const stake = `${c.stakeCoins || 0} 🪙`;

  // Pick badge pill — sized to the text length so the rectangle frames
  // the label without giant whitespace on short picks ("LOCAL").
  const badgeWidth = Math.max(220, pickBadge.length * 26);
  const badgeX = (W - badgeWidth) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#07090D"/>
  <rect x="0" y="0" width="8" height="${H}" fill="#21E28C"/>
  <line x1="64" y1="262" x2="1136" y2="262" stroke="#1A2535" stroke-width="1"/>
  <text x="84" y="88"  font-size="48" fill="#21E28C" font-weight="bold" font-family="sans-serif" letter-spacing="6">FUTPOOLS</text>
  <text x="84" y="150" font-size="32" fill="#F9FAFB" font-weight="bold" font-family="sans-serif">⚔ ${challengerName} TE RETA</text>
  <text x="84" y="200" font-size="20" fill="#9CA3AF" font-family="sans-serif">${time}${league ? ` · ${league}` : ''}</text>
  <text x="84" y="232" font-size="14" fill="#374151" font-family="sans-serif" letter-spacing="3">APUESTA · ${escXml(stake)}</text>

  <text x="${W / 2}" y="370" font-size="56" fill="#F1F5F9" font-weight="bold" font-family="sans-serif" text-anchor="middle">${home}  vs  ${away}</text>

  <rect x="${badgeX}" y="410" width="${badgeWidth}" height="64" rx="8" fill="#0B1018" stroke="#21E28C" stroke-width="2"/>
  <text x="${W / 2}" y="453" font-size="28" fill="#21E28C" font-weight="bold" font-family="sans-serif" text-anchor="middle" letter-spacing="2">PICK · ${pickBadge}</text>

  <text x="${W / 2}" y="540" font-size="22" fill="${opponentColor}" font-family="sans-serif" text-anchor="middle" letter-spacing="3">${escXml(opponentLabel)}</text>

  <text x="84" y="618" font-size="15" fill="#21E28C" font-family="sans-serif" opacity="0.5">futpools.com</text>
</svg>`;
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Fixture-card image
router.get('/p/:code/image.png', async (req, res) => {
  const code = sanitizeCode(req.params.code);
  let pool;
  try { pool = await Quiniela.findOne({ inviteCode: code }).lean(); } catch {}
  if (!pool) return res.status(404).end();

  const svg = buildSvg(pool);

  if (Resvg) {
    try {
      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
      const pngBuffer = Buffer.from(resvg.render().asPng());
      return res
        .set('Content-Type', 'image/png')
        .set('Cache-Control', 'public, max-age=3600')
        .send(pngBuffer);
    } catch { /* fall through to SVG */ }
  }

  // SVG fallback (works on iOS WhatsApp / modern clients)
  res
    .set('Content-Type', 'image/svg+xml')
    .set('Cache-Control', 'public, max-age=3600')
    .send(svg);
});

// OG share landing page (redirects to SPA after meta tags are read by crawlers)
router.get('/p/:code', async (req, res) => {
  const code = sanitizeCode(req.params.code);
  let pool;
  try { pool = await Quiniela.findOne({ inviteCode: code }).lean(); } catch {}

  const frontendUrl = (process.env.FRONTEND_URL || 'https://futpools.com').replace(/\/$/, '');

  if (!pool) return res.redirect(302, frontendUrl);

  // Description starts with the localized invite-friend prompt so the
  // share-card preview (WhatsApp/Telegram/iMessage) leads with the
  // emotional hook before the dry fixture list. Backend OG can't read
  // the visitor's locale reliably (the viewer who clicks the share
  // link is not the sharer), so default to Spanish — Mexico is the
  // primary audience and ES is the project default per simple_version.
  const inviteHook = '¡Invita a tus amigos a jugar!';
  const fixtures = (pool.fixtures || []).slice(0, 6);
  const fixtureLine = fixtures.length
    ? fixtures.map(f => `${f.homeTeam} vs ${f.awayTeam}`).join(' · ')
    : '';
  const description = fixtureLine
    ? `${inviteHook} ${fixtureLine}`
    : inviteHook;

  const title = `${pool.name} — FutPools`;
  const host = `${req.protocol}://${req.get('host')}`;
  const ogImage   = `${host}/p/${code}/image.png`;
  const canonical = `${frontendUrl}/p/${code}`;
  const spaUrl    = `${frontendUrl}/pool/${pool._id}`;

  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escXml(title)}</title>
  <meta property="og:type"        content="website">
  <meta property="og:site_name"   content="FutPools">
  <meta property="og:title"       content="${escXml(title)}">
  <meta property="og:description" content="${escXml(description)}">
  <meta property="og:image"       content="${escXml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url"         content="${escXml(canonical)}">
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${escXml(title)}">
  <meta name="twitter:description" content="${escXml(description)}">
  <meta name="twitter:image"       content="${escXml(ogImage)}">
  <meta http-equiv="refresh" content="0;url=${escXml(spaUrl)}">
</head>
<body>
  <script>window.location.replace(${JSON.stringify(spaUrl)})</script>
  <p>Redirecting… <a href="${escXml(spaUrl)}">Click here to open ${escXml(pool.name)}</a></p>
</body>
</html>`);
});

// Challenge card image
router.get('/c/:code/image.png', async (req, res) => {
  const code = sanitizeCode(req.params.code);
  let challenge;
  try {
    challenge = await Challenge.findOne({ code })
      .populate('challenger', 'username displayName')
      .populate('opponent', 'username displayName')
      .lean();
  } catch {}
  if (!challenge) return res.status(404).end();

  const svg = buildChallengeSvg(challenge);

  if (Resvg) {
    try {
      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
      const pngBuffer = Buffer.from(resvg.render().asPng());
      return res
        .set('Content-Type', 'image/png')
        .set('Cache-Control', 'public, max-age=3600')
        .send(pngBuffer);
    } catch { /* fall through to SVG */ }
  }

  res
    .set('Content-Type', 'image/svg+xml')
    .set('Cache-Control', 'public, max-age=3600')
    .send(svg);
});

// Challenge OG share landing page
router.get('/c/:code', async (req, res) => {
  const code = sanitizeCode(req.params.code);
  let challenge;
  try {
    challenge = await Challenge.findOne({ code })
      .populate('challenger', 'username displayName')
      .populate('opponent', 'username displayName')
      .lean();
  } catch {}

  const frontendUrl = (process.env.FRONTEND_URL || 'https://futpools.com').replace(/\/$/, '');

  if (!challenge) return res.redirect(302, frontendUrl);

  const fx = challenge.fixture || {};
  const matchLine = `${fx.homeTeam || '?'} vs ${fx.awayTeam || '?'}`;
  const challengerHandle = challenge.challenger?.username
    ? `@${challenge.challenger.username}`
    : 'Alguien';
  const stake = challenge.stakeCoins || 0;
  const phrase = challengePickPhrase(challenge);
  const isOpen = !challenge.opponent && challenge.status === 'pending';

  // Title is the headline that shows above the preview card on most chat
  // apps — keep it short and punchy. Description is a second line that
  // varies by mode (open vs directed) so the recipient knows what they
  // can do with the link.
  const title = `${matchLine} · ${stake}🪙 · FutPools`;
  const description = isOpen
    ? `${challengerHandle} apuesta a que ${phrase}. Toma el lado contrario por ${stake} monedas.`
    : `${challengerHandle} te reta: apuesta a que ${phrase}. Acepta y juégate ${stake} monedas.`;

  const host = `${req.protocol}://${req.get('host')}`;
  const ogImage   = `${host}/c/${code}/image.png`;
  const canonical = `${frontendUrl}/c/${code}`;
  // Web SPA route is /challenges/:id (plural). The /c/:code resolver in
  // the SPA also redirects there, but going direct skips an extra hop.
  const spaUrl    = `${frontendUrl}/challenges/${challenge._id}`;

  res
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600')
    .send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escXml(title)}</title>
  <meta property="og:type"        content="website">
  <meta property="og:site_name"   content="FutPools">
  <meta property="og:title"       content="${escXml(title)}">
  <meta property="og:description" content="${escXml(description)}">
  <meta property="og:image"       content="${escXml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url"         content="${escXml(canonical)}">
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${escXml(title)}">
  <meta name="twitter:description" content="${escXml(description)}">
  <meta name="twitter:image"       content="${escXml(ogImage)}">
  <meta http-equiv="refresh" content="0;url=${escXml(spaUrl)}">
</head>
<body>
  <script>window.location.replace(${JSON.stringify(spaUrl)})</script>
  <p>Redirecting… <a href="${escXml(spaUrl)}">Click here to open the challenge</a></p>
</body>
</html>`);
});

module.exports = router;
