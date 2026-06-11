/**
 * Single source of truth for the "Mexico at the World Cup 2026" landing —
 * verified Group A fixtures + FAQ + JSON-LD. Imported by the component AND
 * scripts/build-i18n-shells.js (bakes JSON-LD into the static shell).
 *
 * Data verified (FIFA / ESPN, June 2026): Mexico is in Group A with South
 * Africa, South Korea and Czechia. Mexico plays the opening match vs South
 * Africa on June 11 at Estadio Azteca; vs South Korea on June 18 at Estadio
 * Akron (Guadalajara); vs Czechia on June 24 at Estadio Azteca. Local times
 * are Central Mexico (GMT−6).
 */

const ORIGIN = 'https://futpools.com';
const PATH = { es: '/mexico-mundial-2026', en: '/mexico-world-cup-2026' };
const CRUMB = { es: 'Partidos de México en el Mundial 2026', en: 'Mexico at the World Cup 2026' };

// Mexico's three Group A matches (verified). timeLocal = Central Mexico.
export const MX_MATCHES = [
  { date: { es: '11 jun', en: 'Jun 11' }, opp: { es: 'Sudáfrica', en: 'South Africa' }, flag: '🇿🇦', venue: { es: 'Estadio Azteca · CDMX', en: 'Estadio Azteca · Mexico City' }, timeLocal: '13:00', tag: { es: 'INAUGURAL', en: 'OPENER' } },
  { date: { es: '18 jun', en: 'Jun 18' }, opp: { es: 'Corea del Sur', en: 'South Korea' }, flag: '🇰🇷', venue: { es: 'Estadio Akron · Guadalajara', en: 'Estadio Akron · Guadalajara' }, timeLocal: '19:00', tag: { es: 'GRUPO A', en: 'GROUP A' } },
  { date: { es: '24 jun', en: 'Jun 24' }, opp: { es: 'Chequia', en: 'Czechia' }, flag: '🇨🇿', venue: { es: 'Estadio Azteca · CDMX', en: 'Estadio Azteca · Mexico City' }, timeLocal: '19:00', tag: { es: 'GRUPO A', en: 'GROUP A' } },
];

// Group A (Mexico + rivals).
export const MX_GROUP = [
  { name: { es: 'México', en: 'Mexico' }, flag: '🇲🇽', host: true },
  { name: { es: 'Sudáfrica', en: 'South Africa' }, flag: '🇿🇦' },
  { name: { es: 'Corea del Sur', en: 'South Korea' }, flag: '🇰🇷' },
  { name: { es: 'Chequia', en: 'Czechia' }, flag: '🇨🇿' },
];

export const MX_FAQ = [
  {
    q: { es: '¿Cuántos partidos juega México en el Mundial 2026?', en: 'How many matches does Mexico play at the World Cup 2026?' },
    a: { es: 'México juega 3 partidos en la fase de grupos (Grupo A): vs Sudáfrica, Corea del Sur y Chequia. Si avanza, jugará la fase de eliminatorias.', en: 'Mexico plays 3 group-stage matches (Group A): vs South Africa, South Korea and Czechia. If it advances, it plays the knockout rounds.' },
  },
  {
    q: { es: '¿México inaugura el Mundial 2026?', en: 'Does Mexico play the World Cup 2026 opening match?' },
    a: { es: 'Sí. El partido inaugural es México vs Sudáfrica el 11 de junio de 2026 en el Estadio Azteca.', en: 'Yes. The opening match is Mexico vs South Africa on June 11, 2026 at Estadio Azteca.' },
  },
  {
    q: { es: '¿En qué grupo está México en el Mundial 2026?', en: 'Which group is Mexico in at the World Cup 2026?' },
    a: { es: 'México está en el Grupo A, junto a Sudáfrica, Corea del Sur y Chequia.', en: 'Mexico is in Group A, with South Africa, South Korea and Czechia.' },
  },
  {
    q: { es: '¿En qué estadios juega México?', en: 'Which stadiums does Mexico play in?' },
    a: { es: 'Estadio Azteca (Ciudad de México) y Estadio Akron (Guadalajara). El Azteca será el primer estadio en albergar 3 Mundiales (1970, 1986 y 2026).', en: 'Estadio Azteca (Mexico City) and Estadio Akron (Guadalajara). The Azteca will be the first stadium to host 3 World Cups (1970, 1986 and 2026).' },
  },
  {
    q: { es: '¿Cuándo juega México sus partidos de grupos?', en: 'When does Mexico play its group matches?' },
    a: { es: '11 de junio vs Sudáfrica (Azteca), 18 de junio vs Corea del Sur (Akron) y 24 de junio vs Chequia (Azteca).', en: 'June 11 vs South Africa (Azteca), June 18 vs South Korea (Akron) and June 24 vs Czechia (Azteca).' },
  },
  {
    q: { es: '¿Es gratis añadir los partidos de México al calendario?', en: 'Is adding Mexico’s matches to my calendar free?' },
    a: { es: 'Sí. 100% gratis, sin cuenta ni app. Funciona en iPhone, Google Calendar, Android y Outlook.', en: 'Yes. 100% free, no account or app. Works on iPhone, Google Calendar, Android and Outlook.' },
  },
];

const L = (locale) => (locale === 'en' ? 'en' : 'es');

export function mexicoFaq(locale) {
  const l = L(locale);
  return MX_FAQ.map((f) => ({ q: f.q[l], a: f.a[l] }));
}

export function mexicoJsonLd(locale) {
  const l = L(locale);
  const canonical = ORIGIN + PATH[l];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: MX_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q[l],
          acceptedAnswer: { '@type': 'Answer', text: f.a[l] },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FutPools', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: l === 'es' ? 'Calendario Mundial 2026' : 'World Cup 2026 Calendar', item: ORIGIN + (l === 'es' ? '/calendario-mundial-2026' : '/world-cup-2026-calendar') },
          { '@type': 'ListItem', position: 3, name: CRUMB[l], item: canonical },
        ],
      },
    ],
  };
}
