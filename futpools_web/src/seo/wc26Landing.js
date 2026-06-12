/**
 * Single source of truth for the World Cup 2026 landing's FAQ + JSON-LD.
 *
 * Imported by BOTH the React component (WorldCup2026Landing.jsx, for
 * rendering + client-side structured data) AND the build-time shell
 * generator (scripts/build-i18n-shells.js, which bakes the JSON-LD into the
 * static per-locale HTML so non-JS crawlers see it too). Plain ESM, no JSX,
 * so Node can import it at build time.
 *
 * Bilingual by design — both /calendario-mundial-2026 (es) and
 * /world-cup-2026-calendar (en) are submitted to Search Console.
 */

const ORIGIN = 'https://futpools.com';
const PATH = { es: '/calendario-mundial-2026', en: '/world-cup-2026-calendar' };
const CRUMB = { es: 'Calendario Mundial 2026', en: 'World Cup 2026 Calendar' };

export const WC26_FAQ = [
  {
    q: { es: '¿El calendario del Mundial 2026 es gratis?', en: 'Is the World Cup 2026 calendar free?' },
    a: { es: 'Sí. 100% gratis. Sin cuenta, sin app, sin anuncios.', en: 'Yes. 100% free. No account, no app, no ads.' },
  },
  {
    q: { es: '¿Cuántos partidos tiene el Mundial 2026?', en: 'How many matches does the World Cup 2026 have?' },
    a: { es: '104 partidos: 78 en Estados Unidos, 13 en México y 13 en Canadá. Es el primer Mundial con 48 selecciones.', en: '104 matches: 78 in the USA, 13 in Mexico and 13 in Canada. It’s the first World Cup with 48 teams.' },
  },
  {
    q: { es: '¿Se actualizan los horarios automáticamente?', en: 'Do kickoff times update automatically?' },
    a: { es: 'Sí. La suscripción se sincroniza con la fuente oficial de la FIFA: si cambia un horario, tu calendario también.', en: 'Yes. The subscription syncs with the official FIFA source: if a kickoff changes, your calendar updates too.' },
  },
  {
    q: { es: '¿En qué dispositivos funciona?', en: 'Which devices does it work on?' },
    a: { es: 'iPhone, iPad, Mac, Android, Google Calendar y Outlook (archivo .ics estándar).', en: 'iPhone, iPad, Mac, Android, Google Calendar and Outlook (standard .ics file).' },
  },
  {
    q: { es: '¿Puedo añadir sólo mi selección?', en: 'Can I add only my national team?' },
    a: { es: 'Sí. Elige tus selecciones y, si quieres, suma toda la fase de eliminatorias.', en: 'Yes. Pick your teams and, if you like, add the entire knockout stage too.' },
  },
  {
    q: { es: '¿Cuándo y dónde es la final del Mundial 2026?', en: 'When and where is the World Cup 2026 final?' },
    a: { es: 'El 19 de julio de 2026 en el MetLife Stadium, Nueva York/Nueva Jersey.', en: 'On July 19, 2026 at MetLife Stadium, New York/New Jersey.' },
  },
];

const L = (locale) => (locale === 'en' ? 'en' : 'es');

/** FAQ rows resolved to one locale: [{ q, a }]. */
export function wc26Faq(locale) {
  const l = L(locale);
  return WC26_FAQ.map((f) => ({ q: f.q[l], a: f.a[l] }));
}

/** schema.org @graph (FAQPage + BreadcrumbList) for one locale. */
export function wc26JsonLd(locale) {
  const l = L(locale);
  const canonical = ORIGIN + PATH[l];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: WC26_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q[l],
          acceptedAnswer: { '@type': 'Answer', text: f.a[l] },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FutPools', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: CRUMB[l], item: canonical },
        ],
      },
    ],
  };
}
