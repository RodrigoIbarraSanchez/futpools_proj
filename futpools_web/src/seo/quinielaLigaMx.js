/**
 * Single source of truth for the "quiniela liga mexicana" landing (ES-only).
 * FAQ + JSON-LD, imported by the component AND scripts/build-i18n-shells.js.
 *
 * The most product-aligned keyword in the cluster: the searcher wants to
 * PLAY a Liga MX quiniela. Volume skews to the USA (Mexican diaspora), so
 * the page leads with the binational angle — SPEI in Mexico, PayPal USD
 * from the United States. Evergreen facts only: Liga MX plays two short
 * tournaments per year (Apertura: jul-dic, Clausura: ene-may), 18 clubs.
 * Not affiliated with Liga MX, Progol or Lotería Nacional (stated).
 */

const ORIGIN = 'https://futpools.com';
const PATH = '/quiniela-liga-mexicana';

export const QLM_FAQ = [
  {
    q: '¿Dónde puedo jugar una quiniela de la liga mexicana?',
    a: 'En FutPools: pronosticas L, E o V en los partidos de la jornada de la Liga MX, compites contra otros jugadores y quien acierta más se lleva el premio. Todo desde tu teléfono, sin papelitos.',
  },
  {
    q: '¿Puedo jugar la quiniela de la Liga MX desde Estados Unidos?',
    a: 'Sí. Si estás en Estados Unidos pagas tu entrada en dólares vía PayPal y, si ganas, tu premio se envía por PayPal. En México la entrada se paga por SPEI. Es la misma quiniela para los dos lados de la frontera.',
  },
  {
    q: '¿Cuánto cuesta entrar a una quiniela de la liga mexicana?',
    a: 'Cada quiniela define su entrada; las públicas típicamente cuestan $50 MXN, o su equivalente en dólares por PayPal si juegas desde Estados Unidos.',
  },
  {
    q: '¿Cuándo hay quinielas de la Liga MX?',
    a: 'La Liga MX juega dos torneos al año: el Apertura (julio a diciembre) y el Clausura (enero a mayo), más la Liguilla de cada uno. Mientras hay jornada, hay quiniela. En las pausas de la liga también hay quinielas de otros torneos, como el Mundial.',
  },
  {
    q: '¿Esta quiniela es el Progol?',
    a: 'No. FutPools es una plataforma independiente de quinielas entre amigos y no está afiliada a la Liga MX, a Progol ni a Lotería Nacional. Tampoco es una casa de apuestas. Mayores de 18 años.',
  },
  {
    q: '¿Cómo se gana en la quiniela?',
    a: 'Cada resultado acertado suma a tu marcador y la tabla se actualiza en vivo durante la jornada. Al terminar el último partido, quien tenga más aciertos gana el premio de la quiniela.',
  },
  {
    q: '¿Dónde encuentro el formato de la quiniela de la Liga MX?',
    a: 'Ya no necesitas imprimir un formato ni llenar hojas de Excel: en FutPools creas tu quiniela de la jornada en un minuto, compartes el código con tus amigos y la plataforma cuenta los aciertos sola. Es el formato de la quiniela de la liga mexicana, pero digital y sin errores de conteo.',
  },
];

export function quinielaLigaMxFaq() {
  return QLM_FAQ;
}

export function quinielaLigaMxJsonLd() {
  const canonical = ORIGIN + PATH;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: QLM_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FutPools', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Quiniela de la Liga Mexicana', item: canonical },
        ],
      },
    ],
  };
}
