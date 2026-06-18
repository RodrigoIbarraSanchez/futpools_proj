/**
 * Single source of truth for the "pronósticos de fútbol" landing (ES-only).
 * FAQ + JSON-LD, imported by the component AND scripts/build-i18n-shells.js.
 *
 * Evergreen / informational: explains what football pronósticos are (L/E/V),
 * how to make a good one, and funnels into competing in FutPools quinielas.
 * Framing rules: pronósticos = the user's OWN predictions competing in
 * quinielas — never betting tips, odds or guaranteed picks. No invented
 * statistics. The product charges a real-money entry (no "gratis" claims).
 */

const ORIGIN = 'https://futpools.com';
const PATH = '/pronosticos-de-futbol';

export const PF_FAQ = [
  {
    q: '¿Qué son los pronósticos de fútbol?',
    a: 'Es predecir el resultado de un partido: gana el local (L), empate (E) o gana el visitante (V), en tiempo reglamentario. Los pronósticos son la base de las quinielas: quien acierta más resultados que sus rivales, gana.',
  },
  {
    q: '¿Cómo hacer un buen pronóstico de fútbol?',
    a: 'Revisa la forma reciente de ambos equipos, la localía, los enfrentamientos directos y las bajas confirmadas. Ningún análisis garantiza el resultado: un buen pronóstico reduce la incertidumbre, no la elimina.',
  },
  {
    q: '¿Qué significan L, E y V en un pronóstico?',
    a: 'L = gana el equipo local, E = empate (sin ganador) y V = gana el equipo visitante. Cuenta el resultado en tiempo reglamentario, sin tiempos extra ni penales.',
  },
  {
    q: '¿Los pronósticos de fútbol son apuestas?',
    a: 'No necesariamente. En FutPools tus pronósticos compiten en quinielas: pagas una entrada, llenas tus L/E/V y quien acierte más se lleva el premio. FutPools no es una casa de apuestas ni vende pronósticos. Mayores de 18 años.',
  },
  {
    q: '¿Dónde puedo poner a prueba mis pronósticos de fútbol?',
    a: 'En FutPools: únete a una quiniela pública o crea una con tus amigos, registra tus pronósticos antes del primer partido y sigue tus aciertos en vivo desde tu teléfono.',
  },
  {
    q: '¿Hasta cuándo puedo registrar mis pronósticos en una quiniela?',
    a: 'Hasta que inicia el primer partido de la quiniela. Después de esa hora ya no puedes registrar ni cambiar tus picks.',
  },
];

export function pronosticosFaq() {
  return PF_FAQ;
}

export function pronosticosJsonLd() {
  const canonical = ORIGIN + PATH;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: PF_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FutPools', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Pronósticos de fútbol', item: canonical },
        ],
      },
    ],
  };
}
