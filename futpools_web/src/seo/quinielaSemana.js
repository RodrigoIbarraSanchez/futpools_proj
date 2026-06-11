/**
 * Single source of truth for the "quiniela de la semana" landing (ES-only).
 * FAQ + JSON-LD, imported by the component AND scripts/build-i18n-shells.js.
 *
 * Evergreen / informational: explains what the weekly Progol quiniela is and
 * how it works — it does NOT list a specific week's matches (those change
 * every jornada). Verified vs Lotería Nacional (Progol): 14 matches + Progol
 * Revancha (7), pick L/E/V in regular time. FutPools is independent and not
 * affiliated with Progol / Lotería Nacional (stated in the FAQ).
 */

const ORIGIN = 'https://futpools.com';
const PATH = '/quiniela-de-la-semana';

export const QS_FAQ = [
  {
    q: '¿Qué es la quiniela de la semana?',
    a: 'Es el pronóstico de fútbol más popular en México: cada jornada eliges el resultado (local, empate o visitante) de una lista de partidos. La más conocida es el Progol de Lotería Nacional.',
  },
  {
    q: '¿Qué es Progol?',
    a: 'Progol es la quiniela oficial de Lotería Nacional (Pronósticos) en México: 14 partidos de fútbol nacional e internacional en los que pronosticas Local (L), Empate (E) o Visitante (V).',
  },
  {
    q: '¿Cuántos partidos tiene el Progol?',
    a: '14 partidos en Progol, más 7 partidos en Progol Revancha, un juego complementario. Para jugar la Revancha necesitas participar en Progol.',
  },
  {
    q: '¿Qué significan L, E y V en la quiniela?',
    a: 'L = gana el equipo local, E = empate (sin ganador) y V = gana el equipo visitante. Cuenta el resultado en tiempo reglamentario, sin tiempos extra ni penales.',
  },
  {
    q: '¿Qué es la "quiniela posible" de Progol?',
    a: 'Es la combinación de pronósticos más probable que se publica cada semana para ayudarte a llenar tu boleto. Es una guía orientativa: no garantiza aciertos.',
  },
  {
    q: '¿Cuándo se cierra la quiniela de la semana?',
    a: 'Antes de que inicie el primer partido de la jornada. Después de esa hora ya no puedes registrar ni cambiar tus pronósticos.',
  },
  {
    q: '¿Puedo jugar la quiniela de la semana en FutPools?',
    a: 'Sí. En FutPools creas o te unes a quinielas de fútbol con tus amigos, gratis y desde tu teléfono. FutPools es independiente y no está afiliado a Progol ni a Lotería Nacional.',
  },
];

export function quinielaFaq() {
  return QS_FAQ;
}

export function quinielaJsonLd() {
  const canonical = ORIGIN + PATH;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: QS_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FutPools', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Quiniela de la semana', item: canonical },
        ],
      },
    ],
  };
}
