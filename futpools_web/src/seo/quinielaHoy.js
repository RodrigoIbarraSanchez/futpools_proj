/**
 * Single source of truth for the "quiniela de futbol hoy" landing (ES-only).
 * FAQ + JSON-LD, imported by the component AND scripts/build-i18n-shells.js.
 *
 * The most transactional page of the "hoy" cluster: the searcher wants to
 * PLAY a quiniela today. Hero element = the open pool card (dynamic); the
 * today's-matches module and steps support it. Everything baked here stays
 * evergreen (no dates, no match names). SERP context (2026-06-12, MX db):
 * a PA-0 Facebook group ranked #2 and Spain's La Quiniela sites filled the
 * Mexican SERP — no dedicated Mexican page existed.
 */

const ORIGIN = 'https://futpools.com';
const PATH = '/quiniela-futbol-hoy';

export const QH_FAQ = [
  {
    q: '¿Dónde puedo jugar una quiniela de fútbol hoy?',
    a: 'En FutPools: esta página te muestra la quiniela con inscripción abierta y los partidos de hoy. Te registras, llenas tus L/E/V y compites por el premio desde tu teléfono, sin filas ni papelitos.',
  },
  {
    q: '¿Hasta qué hora puedo entrar a la quiniela de hoy?',
    a: 'Hasta que inicia el primer partido de la quiniela. En cuanto rueda el balón, la inscripción se cierra y ya no puedes registrar ni cambiar tus picks.',
  },
  {
    q: '¿Qué partidos trae la quiniela de hoy?',
    a: 'Depende de la jornada: durante el Mundial, los partidos del torneo; el resto del año, Liga MX, Champions y otras ligas principales. La lista de partidos de esta página se actualiza automáticamente cada día.',
  },
  {
    q: '¿Cuánto cuesta entrar a una quiniela?',
    a: 'Cada quiniela define su entrada; las públicas típicamente cuestan $50 MXN por SPEI. Si estás fuera de México, puedes pagar el equivalente en USD vía PayPal.',
  },
  {
    q: '¿Esta quiniela es el Progol?',
    a: 'No. FutPools es una plataforma independiente de quinielas entre amigos y no está afiliada a Progol ni a Lotería Nacional. Tampoco es una casa de apuestas. Mayores de 18 años.',
  },
];

export function quinielaHoyFaq() {
  return QH_FAQ;
}

export function quinielaHoyJsonLd() {
  const canonical = ORIGIN + PATH;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: QH_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FutPools', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Quiniela de fútbol hoy', item: canonical },
        ],
      },
    ],
  };
}
