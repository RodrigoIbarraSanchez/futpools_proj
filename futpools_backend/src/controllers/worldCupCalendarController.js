/**
 * /calendariomundial2026 controllers.
 *
 *   GET /world-cup-2026/teams          → JSON team list (48 teams)
 *   GET /world-cup-2026/fixtures       → JSON fixtures list (debug / preview)
 *   GET /world-cup-2026/calendar.ics   → iCalendar feed, optionally filtered
 *     query: scope=all|teams|teams+ko, teams=33,44, lang=en|es
 *
 * The .ics file is generated inline so we don't pull a dependency for
 * RFC-5545. The format is forgiving: Google Calendar, Apple Calendar,
 * and Outlook all accept the minimal shape used here (VCALENDAR with
 * VEVENT children, UTC DTSTART/DTEND, escaped TEXT fields).
 */

const {
  fetchAllFixtures,
  getTeams,
  filterFixtures,
} = require('../services/worldCup2026');
const { teamFlag } = require('../services/countryFlags');

// Bracket-stage labels in Spanish for the DESCRIPTION. SUMMARY stays
// English-only since that's the FIFA-canonical form most calendar
// users recognize ("Round of 16", "Final").
const ROUND_ES = {
  'Group Stage': 'Fase de Grupos',
  'Round of 32': 'Treintaidosavos de Final',
  'Round of 16': 'Octavos de Final',
  'Quarter-Final': 'Cuartos de Final',
  'Semi-Final': 'Semifinal',
  'Third-Place Play-off': 'Tercer Lugar',
  'Final': 'Final',
};
const translateRound = (raw, lang) => {
  if (lang !== 'es' || !raw) return raw;
  // api-football includes the matchday ("Group Stage - 1"); split,
  // translate the prefix, rejoin.
  const [prefix, rest] = String(raw).split(' - ');
  const translated = ROUND_ES[prefix] || prefix;
  return rest ? `${translated} — ${rest}` : translated;
};

// Country flag if known, else a soccer-ball emoji for placeholder /
// knockout slots ("W73", "1A", "3D/E/F").
const withFlag = (name) => {
  const flag = teamFlag(name);
  if (flag) return `${flag} ${name}`;
  return `⚽ ${name}`;
};

// When BOTH sides are placeholders (e.g. R32 with "1A vs 2C"), one ⚽
// at the front reads cleaner than two; matches the user's Apple Cal
// reference. Real-vs-real and mixed cases keep per-team icons.
const matchupTitle = ({ home, away }) => {
  const homeFlag = teamFlag(home);
  const awayFlag = teamFlag(away);
  if (!homeFlag && !awayFlag) return `⚽ ${home} vs ${away}`;
  return `${withFlag(home)} vs ${withFlag(away)}`;
};

const COPY = {
  en: {
    summary: matchupTitle,
    description: ({ round, venue, home, away }) => {
      const matchup = matchupTitle({ home, away });
      // Real newlines here; icsEscape() converts them to RFC-5545 "\n"
      // literal so the calendar client renders multi-line bodies.
      return [matchup, round, venue, 'FIFA World Cup 2026']
        .filter(Boolean)
        .join('\n');
    },
    calName: 'FIFA World Cup 2026',
    calDesc: 'FIFA World Cup 2026 schedule — by FutPools',
  },
  es: {
    summary: matchupTitle,
    description: ({ round, venue, home, away }) => {
      const matchup = matchupTitle({ home, away });
      return [matchup, translateRound(round, 'es'), venue, 'Mundial FIFA 2026']
        .filter(Boolean)
        .join('\n');
    },
    calName: 'Mundial FIFA 2026',
    calDesc: 'Calendario Mundial FIFA 2026 — por FutPools',
  },
};

// RFC-5545 TEXT escape: backslash, semicolon, comma, newline.
const icsEscape = (s) =>
  String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// RFC-5545 line folding: 75 octets per line, continuation lines begin
// with a single space. We approximate with character count which is
// safe for ASCII; non-ASCII content (team names with accents) is
// already escaped through icsEscape, but multibyte chars could in
// theory push a line over — calendar clients tolerate it.
const foldLine = (line) => {
  if (line.length <= 75) return line;
  const out = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) out.push(' ' + rest);
  return out.join('\r\n');
};

const toIcsDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // YYYYMMDDTHHmmssZ in UTC
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
};

const buildIcs = (fixtures, lang = 'en', { tz = 'UTC', color = '' } = {}) => {
  const copy = COPY[lang] || COPY.en;
  const nowStamp = toIcsDate(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FutPools//WorldCup2026//' + lang.toUpperCase(),
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(copy.calName)}`,
    `X-WR-CALDESC:${icsEscape(copy.calDesc)}`,
    // X-WR-TIMEZONE drives the "default timezone" label Google/Apple
    // show when you inspect the subscribed calendar. Event DTSTARTs
    // remain in UTC (with the Z suffix) so display still localizes
    // per-user automatically — this is just metadata.
    `X-WR-TIMEZONE:${tz}`,
  ];
  // RFC 7986 COLOR + Apple's X- variant. Google Calendar honors COLOR
  // only on first add (subsequent refreshes don't overwrite the user's
  // pick). Apple respects X-APPLE-CALENDAR-COLOR similarly. Accepts
  // CSS color keywords ("green") or hex strings ("#21E28C").
  if (color) {
    lines.push(`COLOR:${color}`);
    if (color.startsWith('#')) lines.push(`X-APPLE-CALENDAR-COLOR:${color}`);
  }

  for (const f of fixtures) {
    const start = toIcsDate(f.date);
    if (!start) continue;
    // 2-hour default block — matches FIFA broadcast window with stoppage time.
    const endDate = new Date(new Date(f.date).getTime() + 2 * 60 * 60 * 1000);
    const end = toIcsDate(endDate.toISOString());
    const uid = `wc2026-${f.fixtureId}@futpools.com`;
    const home = f.teams.home.name;
    const away = f.teams.away.name;
    const summary = copy.summary({ home, away });
    const venue = [f.venue?.name, f.venue?.city].filter(Boolean).join(', ');
    const description = copy.description({ round: f.round, venue, home, away });
    const event = [
      'BEGIN:VEVENT',
      foldLine(`UID:${uid}`),
      foldLine(`DTSTAMP:${nowStamp}`),
      foldLine(`DTSTART:${start}`),
      foldLine(`DTEND:${end}`),
      foldLine(`SUMMARY:${icsEscape(summary)}`),
      foldLine(`DESCRIPTION:${icsEscape(description)}`),
    ];
    if (venue) event.push(foldLine(`LOCATION:${icsEscape(venue)}`));
    event.push('END:VEVENT');
    lines.push(...event);
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
};

const parseTeams = (raw) =>
  String(raw || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

const parseScope = (raw) => {
  const v = String(raw || 'all').toLowerCase();
  if (v === 'teams' || v === 'mine') return 'teams';
  if (v === 'teams+ko' || v === 'mine+ko' || v === 'teams-ko') return 'teams+ko';
  return 'all';
};

const parseLang = (raw) => (String(raw || '').toLowerCase() === 'es' ? 'es' : 'en');

// Whitelist of valid IANA timezones we accept from query params. Avoids
// passing arbitrary strings into X-WR-TIMEZONE (which calendar clients
// just display verbatim — no harm but also no value).
const parseTz = (raw) => {
  const v = String(raw || 'UTC').trim();
  // Loose validation — IANA zones are "Region/City" or single tokens
  // like UTC. We don't need a full lookup, just stop obvious junk.
  if (!/^[A-Za-z]+(?:\/[A-Za-z_]+){0,2}$/.test(v)) return 'UTC';
  return v;
};

// Accept CSS color keywords ("green", "blue") or 3/6-digit hex colors.
// Anything else falls back to no color (calendar client picks default).
const parseColor = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^[a-z]+$/.test(v) && v.length <= 20) return v;
  return '';
};

// Soft-failure: the upstream provider (api-football) is third-party and
// can return 403 / 429 (key rotation, rate limit, free-tier without WC
// access). Returning 200 with empty data + a `dataSourceAvailable: false`
// flag lets the page render gracefully — visitors see the UI explaining
// the temporary state instead of a broken error toast.
const handleUpstream = (err) => {
  const msg = err?.message || '';
  const upstream = msg.includes('API-Football error') || msg.includes('not configured');
  return { upstream, message: msg };
};

exports.getTeams = async (req, res) => {
  try {
    const teams = await getTeams();
    res.json({ teams, season: 2026, dataSourceAvailable: true });
  } catch (err) {
    const { upstream } = handleUpstream(err);
    console.error('[WC2026] teams error:', err.message);
    if (upstream) {
      return res.json({ teams: [], season: 2026, dataSourceAvailable: false });
    }
    res.status(500).json({ message: 'Failed to load teams' });
  }
};

exports.getFixtures = async (req, res) => {
  try {
    const scope = parseScope(req.query.scope);
    const teams = parseTeams(req.query.teams);
    const all = await fetchAllFixtures();
    const fixtures = filterFixtures(all, { scope, teamIds: teams });
    res.json({ count: fixtures.length, fixtures, dataSourceAvailable: true });
  } catch (err) {
    const { upstream } = handleUpstream(err);
    console.error('[WC2026] fixtures error:', err.message);
    if (upstream) {
      return res.json({ count: 0, fixtures: [], dataSourceAvailable: false });
    }
    res.status(500).json({ message: 'Failed to load fixtures' });
  }
};

exports.getCalendar = async (req, res) => {
  try {
    const scope = parseScope(req.query.scope);
    const teams = parseTeams(req.query.teams);
    const lang = parseLang(req.query.lang);
    const tz = parseTz(req.query.tz);
    const color = parseColor(req.query.color);

    let fixtures = [];
    try {
      const all = await fetchAllFixtures();
      fixtures = filterFixtures(all, { scope, teamIds: teams });
    } catch (err) {
      const { upstream } = handleUpstream(err);
      console.error('[WC2026] calendar fetch error:', err.message);
      if (!upstream) throw err;
      // Upstream unavailable: still return a valid empty .ics so calendar
      // clients receive a 200 + sync gracefully. Once the data source
      // recovers, the same subscription URL starts returning events.
    }

    const ics = buildIcs(fixtures, lang, { tz, color });

    const filename = lang === 'es' ? 'mundial-2026.ics' : 'world-cup-2026.ics';
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    // Only force attachment when the caller is the explicit "Download .ics"
    // button (?download=1). Google Calendar's `cid=` subscriber and
    // webcal:// clients refuse to add a feed served with
    // `Content-Disposition: attachment` — they treat it as a one-time
    // download and bail out with the redirect loop the user saw. Serving
    // inline by default lets all calendar apps subscribe correctly; the
    // frontend's <a download="…"> attribute still forces the file save
    // for the Outlook button.
    if (String(req.query.download || '') === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }
    // CDN-friendly: 1h browser, 6h CDN. Schedule is essentially static.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=21600');
    res.send(ics);
  } catch (err) {
    console.error('[WC2026] calendar error:', err.message);
    res.status(500).type('text/plain').send('Failed to build calendar');
  }
};
