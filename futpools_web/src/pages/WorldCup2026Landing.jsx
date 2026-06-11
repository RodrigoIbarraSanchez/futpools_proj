/**
 * /calendario-mundial-2026 (ES) · /world-cup-2026-calendar (EN)
 *
 * Bottom-of-funnel SEO landing page for the World Cup 2026 calendar. Built
 * on the "[Keyword] | keywords" template: H1 = primary keyword, an intro
 * that leads with the keyword, a primary CTA, several H2 content sections
 * (short, punchy copy + bullets), an FAQ with FAQPage/BreadcrumbList
 * JSON-LD, and a repeated CTA. The CTA navigates to the actual tool
 * (/calendario-mundial-2026/agregar) — the content here is what ranks; the
 * tool is what converts the search intent.
 *
 * Reuses the HUD styling from WorldCup2026Calendar (WC_CSS) and adds a
 * supplemental block for the prose sections.
 */

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { WC_CSS } from './WorldCup2026Calendar';

const ORIGIN = 'https://futpools.com';

export function WorldCup2026Landing() {
  const { locale, setLocale } = useLocale();
  const c = (es, en) => (locale === 'es' ? es : en);
  const location = useLocation();

  // URL-based locale: the ES slug forces es, the EN slug forces en, so users
  // from search land in the right language. Runs on route change only.
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    if (path.startsWith('/calendario-mundial-2026') && locale !== 'es') setLocale('es');
    else if (path.startsWith('/world-cup-2026-calendar') && locale !== 'en') setLocale('en');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const landingPath = locale === 'es' ? '/calendario-mundial-2026' : '/world-cup-2026-calendar';
  const toolPath = locale === 'es' ? '/calendario-mundial-2026/agregar' : '/world-cup-2026-calendar/add';
  const canonical = ORIGIN + landingPath;

  // ── SEO head (title, description, canonical) + JSON-LD ──
  useEffect(() => {
    const title = c(
      'Calendario Mundial 2026 — Partidos, horarios y fechas | FutPools',
      'World Cup 2026 Calendar — Schedule, Fixtures & Dates | FutPools'
    );
    const description = c(
      'Calendario del Mundial 2026 completo: los 104 partidos con fechas y horarios en tu zona. Añádelos a tu iPhone, Google Calendar, Android u Outlook — gratis.',
      'Complete World Cup 2026 calendar: all 104 matches with dates and kickoff times in your timezone. Add them to iPhone, Google Calendar, Android or Outlook — free.'
    );
    document.title = title;
    setMeta('description', description);
    setCanonical(canonical);

    const faq = FAQS(c).map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    }));
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'FAQPage', mainEntity: faq },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'FutPools', item: ORIGIN + '/' },
            { '@type': 'ListItem', position: 2, name: c('Calendario Mundial 2026', 'World Cup 2026 Calendar'), item: canonical },
          ],
        },
      ],
    };
    setJsonLd('wc26-landing-jsonld', ld);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const ctaTool = (label) => (
    <Link to={toolPath} className="wc-btn-primary">▶ {label}</Link>
  );

  return (
    <div className="fp-wc26">
      <style>{WC_CSS}</style>
      <style>{LANDING_CSS}</style>

      {/* ─────────── NAV ─────────── */}
      <nav className="wc-nav">
        <Link to="/" className="wc-logo">FUT<span>POOLS</span></Link>
        <div className="wc-nav-right">
          <div className="wc-lang">
            <button className={locale === 'es' ? 'active' : ''} onClick={() => setLocale('es')}>ES</button>
            <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
          </div>
          <Link to="/" className="wc-nav-home">{c('Inicio', 'Home')}</Link>
        </div>
      </nav>

      {/* ─────────── HERO (H1 = keyword) ─────────── */}
      <header className="wc-hero">
        <div className="wc-grid-bg" />
        <div className="wc-hero-inner">
          <div className="wc-kicker">◆ {c('CALENDARIO OFICIAL · MUNDIAL 2026', 'OFFICIAL SCHEDULE · WORLD CUP 2026')}</div>
          <h1>{c('Calendario del Mundial 2026', 'World Cup 2026 Calendar')}</h1>
          <p className="wc-sub wc-lead">
            {c(
              'El calendario del Mundial 2026 ya está aquí: los 104 partidos, 48 selecciones y 16 sedes en México, Estados Unidos y Canadá. Consulta las fechas y los horarios en tu zona, y añade los partidos a tu calendario en segundos. Es gratis, sin app ni registro.',
              'The World Cup 2026 calendar is here: all 104 matches, 48 teams and 16 host cities across Mexico, the USA and Canada. Check the dates and kickoff times in your timezone, and add the matches to your calendar in seconds. It’s free — no app, no sign-up.'
            )}
          </p>
          <div className="wc-cta-row">
            {ctaTool(c('Añadir partidos a mi calendario', 'Add matches to my calendar'))}
          </div>
          <div className="wc-hero-stats">
            <div className="wc-stat"><div className="wc-stat-num">104</div><div className="wc-stat-lab">{c('Partidos', 'Matches')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">48</div><div className="wc-stat-lab">{c('Selecciones', 'Teams')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">16</div><div className="wc-stat-lab">{c('Sedes', 'Host cities')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">39</div><div className="wc-stat-lab">{c('Días', 'Days')}</div></div>
          </div>
        </div>
      </header>

      {/* ─────────── CONTENT (H2 sections) ─────────── */}
      <main className="wc-main wc-content">

        <Section title={c('El calendario completo del Mundial 2026', 'The complete World Cup 2026 calendar')}>
          <p>{c(
            'El Mundial 2026 se juega del 11 de junio al 19 de julio de 2026. Es el primero con 48 selecciones y 104 partidos: el más grande de la historia.',
            'The World Cup 2026 runs from June 11 to July 19, 2026. It’s the first with 48 teams and 104 matches — the biggest in history.'
          )}</p>
          <ul className="wc-ul">
            <li>{c('104 partidos en total', '104 matches in total')}</li>
            <li>{c('48 selecciones clasificadas', '48 qualified teams')}</li>
            <li>{c('16 sedes en 3 países: México, EE.UU. y Canadá', '16 host cities across 3 countries: Mexico, USA and Canada')}</li>
            <li>{c('39 días de fútbol — del 11 de junio al 19 de julio de 2026', '39 days of football — June 11 to July 19, 2026')}</li>
          </ul>
        </Section>

        <Section title={c('Fechas y fases: de la fase de grupos a la final', 'Dates and stages: from the groups to the final')}>
          <p>{c(
            'El torneo se divide en fase de grupos y eliminatorias. Estas son las ventanas clave del calendario oficial:',
            'The tournament splits into a group stage and the knockout rounds. These are the key windows of the official schedule:'
          )}</p>
          <ul className="wc-ul">
            <li>{c('Fase de grupos: 11 – 27 de junio', 'Group stage: June 11 – 27')}</li>
            <li>{c('Dieciseisavos (ronda de 32): 28 de junio – 3 de julio', 'Round of 32: June 28 – July 3')}</li>
            <li>{c('Octavos de final: 4 – 7 de julio', 'Round of 16: July 4 – 7')}</li>
            <li>{c('Cuartos de final: 9 – 11 de julio', 'Quarter-finals: July 9 – 11')}</li>
            <li>{c('Semifinales: 14 – 15 de julio', 'Semi-finals: July 14 – 15')}</li>
            <li>{c('Tercer puesto: 18 de julio · Final: 19 de julio', 'Third place: July 18 · Final: July 19')}</li>
          </ul>
        </Section>

        <Section title={c('Sedes y estadios del Mundial 2026', 'Host cities and stadiums of the World Cup 2026')}>
          <p>{c(
            '16 ciudades sede en tres países reciben el Mundial 2026. El partido inaugural es en México y la final en Estados Unidos.',
            '16 host cities across three countries welcome the World Cup 2026. The opening match is in Mexico and the final in the USA.'
          )}</p>
          <ul className="wc-ul">
            <li>{c('México (3): Ciudad de México, Guadalajara, Monterrey', 'Mexico (3): Mexico City, Guadalajara, Monterrey')}</li>
            <li>{c('EE.UU. (11): Nueva York/Nueva Jersey, Los Ángeles, Dallas, San Francisco, Miami, Atlanta, Seattle, Houston, Filadelfia, Kansas City, Boston', 'USA (11): New York/New Jersey, Los Angeles, Dallas, San Francisco, Miami, Atlanta, Seattle, Houston, Philadelphia, Kansas City, Boston')}</li>
            <li>{c('Canadá (2): Toronto y Vancouver', 'Canada (2): Toronto and Vancouver')}</li>
          </ul>
        </Section>

        <Section title={c('Horarios del Mundial 2026 en tu país', 'World Cup 2026 kickoff times in your country')}>
          <p>{c(
            'Los partidos se juegan en horarios de América. Nuestra herramienta los muestra en TU zona horaria, y tu calendario los ajusta automáticamente.',
            'Matches kick off on American time. Our tool shows them in YOUR timezone, and your calendar adjusts them automatically.'
          )}</p>
          <ul className="wc-ul">
            <li>{c('México: CDMX, Norte y Pacífico', 'Mexico: Central, North and Pacific')}</li>
            <li>{c('EE.UU.: Este, Centro, Montaña y Pacífico', 'USA: Eastern, Central, Mountain and Pacific')}</li>
            <li>{c('Latinoamérica: Argentina, Brasil, Colombia, Perú, Chile', 'Latin America: Argentina, Brazil, Colombia, Peru, Chile')}</li>
            <li>{c('Europa: España y Reino Unido', 'Europe: Spain and the United Kingdom')}</li>
          </ul>
        </Section>

        <Section title={c('Cómo añadir el calendario del Mundial 2026 a tu teléfono', 'How to add the World Cup 2026 calendar to your phone')}>
          <p>{c('Añade todos los partidos en 3 pasos, sin instalar nada:', 'Add every match in 3 steps, with nothing to install:')}</p>
          <ul className="wc-ul">
            <li>{c('1. Elige qué partidos: los 104, sólo tus selecciones, o tus selecciones + eliminatorias.', '1. Choose which matches: all 104, only your teams, or your teams + the knockout stage.')}</li>
            <li>{c('2. Elige tu zona horaria para ver los horarios correctos.', '2. Pick your timezone to see the correct kickoff times.')}</li>
            <li>{c('3. Suscríbete en iPhone, Google Calendar o Android, o descarga el .ics para Outlook.', '3. Subscribe on iPhone, Google Calendar or Android, or download the .ics for Outlook.')}</li>
            <li>{c('Se actualiza solo: si la FIFA mueve un horario, tu calendario también.', 'It stays in sync: if FIFA shifts a kickoff, your calendar updates too.')}</li>
          </ul>
          <div className="wc-cta-row">
            {ctaTool(c('Abrir la herramienta del calendario', 'Open the calendar tool'))}
          </div>
        </Section>

        {/* ── FAQ ── */}
        <section className="wc-faq">
          <h2>{c('Preguntas frecuentes', 'Frequently asked questions')}</h2>
          <div className="wc-faq-grid">
            {FAQS(c).map(({ q, a }) => (
              <div className="wc-faq-item" key={q}>
                <div className="wc-faq-q">◆ {q}</div>
                <div className="wc-faq-a">{a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CONVERSION CTA (FutPools) ── */}
        <section className="wc-cta">
          <div className="wc-cta-inner">
            <div className="wc-cta-kicker">◆ {c('¿LISTO PARA JUGAR EL MUNDIAL?', 'READY TO PLAY THE WORLD CUP?')}</div>
            <h2 style={{ fontFamily: 'var(--ox)', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>
              {c('Ya tienes el calendario. Ahora juega.', 'You’ve got the calendar. Now play.')}
            </h2>
            <p>{c(
              'Haz tu quiniela del Mundial 2026 en FutPools — premios reales, depositados a tu cuenta.',
              'Make your World Cup 2026 pool on FutPools — real prizes, paid straight to your account.'
            )}</p>
            <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
              {ctaTool(c('Añadir partidos a mi calendario', 'Add matches to my calendar'))}
              <Link to="/onboarding" className="wc-btn-secondary">{c('Jugar la quiniela del Mundial', 'Play the World Cup pool')} →</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="wc-footer">
        <div>© 2026 FUTPOOLS · futpools.com</div>
        <div>{c('Datos de partidos: FIFA / API-Football', 'Match data: FIFA / API-Football')}</div>
      </footer>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="wc-content-section">
      <h2 className="wc-h2">{title}</h2>
      {children}
    </section>
  );
}

const FAQS = (c) => [
  {
    q: c('¿El calendario del Mundial 2026 es gratis?', 'Is the World Cup 2026 calendar free?'),
    a: c('Sí. 100% gratis. Sin cuenta, sin app, sin anuncios.', 'Yes. 100% free. No account, no app, no ads.'),
  },
  {
    q: c('¿Se actualizan los horarios automáticamente?', 'Do kickoff times update automatically?'),
    a: c('Sí. La suscripción se sincroniza con la fuente oficial de la FIFA — si cambia un horario, tu calendario también.', 'Yes. The subscription syncs with the official FIFA source — if a kickoff changes, your calendar updates too.'),
  },
  {
    q: c('¿En qué dispositivos funciona?', 'Which devices does it work on?'),
    a: c('iPhone, iPad, Mac, Android, Google Calendar y Outlook (archivo .ics estándar).', 'iPhone, iPad, Mac, Android, Google Calendar and Outlook (standard .ics file).'),
  },
  {
    q: c('¿Puedo añadir sólo mi selección?', 'Can I add only my national team?'),
    a: c('Sí. Elige tus selecciones y, si quieres, suma toda la fase de eliminatorias.', 'Yes. Pick your teams and, if you like, add the entire knockout stage too.'),
  },
  {
    q: c('¿Cómo elimino el calendario?', 'How do I remove the calendar?'),
    a: c('iPhone: Ajustes → Calendario → Cuentas → elimina la suscripción. Google: Calendar → Otros calendarios → "X".', 'iPhone: Settings → Calendar → Accounts → remove subscription. Google: Calendar → Other calendars → "X".'),
  },
  {
    q: c('¿Quién está detrás?', 'Who’s behind this?'),
    a: c('FutPools — quinielas del Mundial en línea para LATAM, con premios reales.', 'FutPools — online World Cup pools for LATAM, with real prizes.'),
  },
];

// ── tiny SEO head helpers ──
function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function setCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', href);
}
function setJsonLd(id, obj) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('script'); el.id = id; el.type = 'application/ld+json'; document.head.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}

const LANDING_CSS = `
.fp-wc26 .wc-content { gap: 14px; }
.fp-wc26 .wc-lead { max-width: 720px; }
.fp-wc26 .wc-cta-row {
  display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 4px;
}
.fp-wc26 .wc-content-section {
  background: var(--surface);
  border: 1px solid var(--stroke);
  clip-path: var(--hud-clip);
  padding: 18px 16px 20px;
}
.fp-wc26 .wc-h2 {
  font-family: var(--ox); font-weight: 800; font-size: 18px;
  letter-spacing: 0.3px; margin: 0 0 10px; color: var(--text); line-height: 1.25;
}
.fp-wc26 .wc-content-section p {
  font-size: 14px; line-height: 1.6; color: var(--text-dim); margin: 0 0 10px;
}
.fp-wc26 .wc-ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fp-wc26 .wc-ul li {
  position: relative; padding-left: 20px;
  font-size: 13.5px; line-height: 1.5; color: var(--text-dim);
}
.fp-wc26 .wc-ul li::before {
  content: '◆'; position: absolute; left: 0; top: 0;
  color: var(--primary); font-size: 10px; line-height: 1.7;
}
.fp-wc26 .wc-btn-secondary {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--ox); font-weight: 800; font-size: 13px;
  letter-spacing: 1px; text-transform: uppercase;
  color: var(--text); text-decoration: none;
  padding: 13px 18px;
  background: transparent;
  border: 1px solid var(--stroke-strong);
  clip-path: var(--hud-clip-sm);
  transition: border-color 0.15s, color 0.15s;
}
.fp-wc26 .wc-btn-secondary:hover { border-color: var(--primary); color: var(--primary); }
@media (min-width: 640px) {
  .fp-wc26 .wc-h2 { font-size: 20px; }
  .fp-wc26 .wc-content-section p { font-size: 15px; }
}
`;
