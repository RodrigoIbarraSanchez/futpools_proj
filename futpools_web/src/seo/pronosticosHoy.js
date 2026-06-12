/**
 * Single source of truth for the "pronósticos fútbol hoy" landing (ES-only).
 * FAQ + JSON-LD, imported by the component AND scripts/build-i18n-shells.js.
 *
 * Cluster child of /pronosticos-de-futbol. The intent behind "hoy" demands
 * fresh content, so the page renders a DYNAMIC "Partidos de hoy" module
 * (GET /public/fixtures/today, client-side only). Everything baked here
 * (title/meta/FAQ/JSON-LD) stays evergreen — no dates, no match names.
 * Same framing rules as the pillar: the user makes their OWN pronósticos
 * and competes in quinielas; we never sell tips/picks. No "gratis" claims.
 */

const ORIGIN = 'https://futpools.com';
const PATH = '/pronosticos-futbol-hoy';

export const PFH_FAQ = [
  {
    q: '¿Dónde veo los partidos de hoy para pronosticar?',
    a: 'En esta página: la lista de partidos de hoy se actualiza sola cada día con los juegos de las ligas principales (Mundial, Liga MX, Champions y más). Elige Local, Empate o Visitante y registra tus pronósticos en una quiniela de FutPools.',
  },
  {
    q: '¿Cómo hago mi pronóstico de fútbol para hoy?',
    a: 'Igual que cualquier buen pronóstico: revisa la forma reciente de los dos equipos, la localía y las bajas confirmadas, y elige L, E o V. Hacerlo el mismo día tiene ventaja: las alineaciones y las bajas ya están confirmadas.',
  },
  {
    q: '¿Hasta qué hora puedo registrar mis pronósticos hoy?',
    a: 'Hasta que inicia el primer partido de la quiniela en la que participas. Después del silbatazo inicial ya no puedes registrar ni cambiar tus picks.',
  },
  {
    q: '¿FutPools da pronósticos o tips para los partidos de hoy?',
    a: 'No. FutPools no vende pronósticos ni tips: tú haces tus propios L/E/V y compites contra otros jugadores en quinielas. FutPools no es una casa de apuestas. Mayores de 18 años.',
  },
  {
    q: '¿Qué partidos hay hoy?',
    a: 'Depende de la jornada: durante el Mundial verás los partidos del día del torneo; el resto del año, Liga MX, Champions, Premier League y otras ligas principales. La lista de esta página se actualiza automáticamente.',
  },
];

export function pronosticosHoyFaq() {
  return PFH_FAQ;
}

export function pronosticosHoyJsonLd() {
  const canonical = ORIGIN + PATH;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: PFH_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FutPools', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Pronósticos de fútbol', item: ORIGIN + '/pronosticos-de-futbol' },
          { '@type': 'ListItem', position: 3, name: 'Pronósticos de fútbol hoy', item: canonical },
        ],
      },
    ],
  };
}
