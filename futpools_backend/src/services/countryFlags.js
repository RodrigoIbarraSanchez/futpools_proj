/**
 * Country-name → flag-emoji helper for the World Cup 2026 calendar.
 *
 * api-football returns national-team names as plain country strings
 * ("Mexico", "South Korea", "Czech Republic"). To prefix each side of
 * a match's SUMMARY with its flag emoji — the way Apple Calendar's
 * month view renders the schedule in our reference — we need to map
 * those names to ISO 3166-1 alpha-2 codes and then to flag emoji.
 *
 * Regional Indicator Symbols (A → 🇦, B → 🇧, …) are at codepoint
 * 0x1F1E6 + (letter - 'A'). Pairing two of them produces a country
 * flag emoji (e.g. 'MX' → 🇲🇽). UK subdivisions (England, Scotland,
 * Wales) use the special "tag sequence" emojis instead.
 */

// Hardcoded subdivision flags — these aren't representable with a
// 2-letter ISO code. Built from black-flag emoji + tag-sequence chars.
const ENGLAND  = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
const SCOTLAND = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}';
const WALES    = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}';

// Name → ISO 3166-1 alpha-2. Covers every realistic WC 2026 qualifier
// plus close aliases api-football uses. Lowercased + trimmed before
// lookup so 'South Korea', 'south korea', 'Korea Republic' all match.
const NAME_TO_ISO = {
  // CONCACAF
  'mexico': 'MX',
  'canada': 'CA',
  'united states': 'US',
  'usa': 'US',
  'panama': 'PA',
  'costa rica': 'CR',
  'honduras': 'HN',
  'jamaica': 'JM',
  'trinidad and tobago': 'TT',
  'el salvador': 'SV',
  'guatemala': 'GT',
  'haiti': 'HT',
  'curacao': 'CW',
  'curaçao': 'CW',
  // CONMEBOL
  'argentina': 'AR',
  'brazil': 'BR',
  'uruguay': 'UY',
  'colombia': 'CO',
  'ecuador': 'EC',
  'paraguay': 'PY',
  'chile': 'CL',
  'peru': 'PE',
  'venezuela': 'VE',
  'bolivia': 'BO',
  // UEFA
  'spain': 'ES',
  'portugal': 'PT',
  'france': 'FR',
  'germany': 'DE',
  'italy': 'IT',
  'netherlands': 'NL',
  'belgium': 'BE',
  'switzerland': 'CH',
  'austria': 'AT',
  'croatia': 'HR',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'denmark': 'DK',
  'norway': 'NO',
  'poland': 'PL',
  'sweden': 'SE',
  'hungary': 'HU',
  'greece': 'GR',
  'turkey': 'TR',
  'türkiye': 'TR',
  'serbia': 'RS',
  'slovakia': 'SK',
  'slovenia': 'SI',
  'romania': 'RO',
  'bulgaria': 'BG',
  'ukraine': 'UA',
  'russia': 'RU',
  'iceland': 'IS',
  'albania': 'AL',
  'north macedonia': 'MK',
  'kosovo': 'XK',
  'bosnia & herzegovina': 'BA',
  'bosnia and herzegovina': 'BA',
  'republic of ireland': 'IE',
  'ireland': 'IE',
  'northern ireland': 'GB-NIR',
  'finland': 'FI',
  // AFC
  'australia': 'AU',
  'japan': 'JP',
  'south korea': 'KR',
  'korea republic': 'KR',
  'korea south': 'KR',
  'iran': 'IR',
  'ir iran': 'IR',
  'saudi arabia': 'SA',
  'qatar': 'QA',
  'uae': 'AE',
  'united arab emirates': 'AE',
  'uzbekistan': 'UZ',
  'iraq': 'IQ',
  'jordan': 'JO',
  'china': 'CN',
  'china pr': 'CN',
  'india': 'IN',
  // CAF
  'morocco': 'MA',
  'egypt': 'EG',
  'algeria': 'DZ',
  'tunisia': 'TN',
  'libya': 'LY',
  'senegal': 'SN',
  'nigeria': 'NG',
  'ghana': 'GH',
  'cameroon': 'CM',
  'ivory coast': 'CI',
  "côte d'ivoire": 'CI',
  "cote d'ivoire": 'CI',
  'south africa': 'ZA',
  'cape verde': 'CV',
  'mali': 'ML',
  'mozambique': 'MZ',
  'angola': 'AO',
  'ethiopia': 'ET',
  'congo dr': 'CD',
  'dr congo': 'CD',
  'democratic republic of congo': 'CD',
  'congo': 'CG',
  'gabon': 'GA',
  'burkina faso': 'BF',
  'kenya': 'KE',
  'uganda': 'UG',
  'tanzania': 'TZ',
  'zimbabwe': 'ZW',
  'zambia': 'ZM',
  'sudan': 'SD',
  'guinea': 'GN',
  'benin': 'BJ',
  'togo': 'TG',
  'sierra leone': 'SL',
  'liberia': 'LR',
  'madagascar': 'MG',
  // OFC
  'new zealand': 'NZ',
};

const normalize = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const isoToEmoji = (code) => {
  if (!code) return '';
  if (code === 'GB-NIR') return '\u{1F1EC}\u{1F1E7}'; // 🇬🇧 (no proper subdivision flag)
  if (code.length !== 2) return '';
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0)))
    .join('');
};

/**
 * Returns the flag emoji for a country/team name, or '' if unknown.
 * Falls back to a generic globe ('🌐') only when caller asks for it.
 */
function teamFlag(name, { fallback = '' } = {}) {
  const key = normalize(name);
  // Special-case the UK subdivisions before the ISO lookup so api-football
  // strings like "England" don't accidentally hit a 2-letter code.
  if (key === 'england') return ENGLAND;
  if (key === 'scotland') return SCOTLAND;
  if (key === 'wales') return WALES;
  const code = NAME_TO_ISO[key];
  return code ? isoToEmoji(code) : fallback;
}

module.exports = { teamFlag, isoToEmoji };
