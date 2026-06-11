/**
 * /calendario-mundial-2026 (ES) · /world-cup-2026-calendar (EN)
 *
 * Bottom-of-funnel SEO landing page for the World Cup 2026 calendar. Built
 * on the "[Keyword] | keywords" template: H1 = primary keyword, an intro
 * that leads with the keyword, a primary CTA, several H2 content sections
 * (short, punchy copy + bullets, each paired with an on-brand HUD visual),
 * an FAQ with FAQPage/BreadcrumbList JSON-LD, and a repeated CTA. The CTA
 * navigates to the actual tool (/calendario-mundial-2026/agregar) — the
 * content here is what ranks; the tool converts the search intent.
 *
 * Section visuals are hand-built SVG/CSS (no raster assets) so they match
 * the WC26 HUD aesthetic, stay crisp on any DPI, and add zero image weight.
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
    document.title = c(
      'Calendario Mundial 2026 — Partidos, horarios y fechas | FutPools',
      'World Cup 2026 Calendar — Schedule, Fixtures & Dates | FutPools'
    );
    setMeta('description', c(
      'Calendario del Mundial 2026 completo: los 104 partidos con fechas y horarios en tu zona. Añádelos a tu iPhone, Google Calendar, Android u Outlook — gratis.',
      'Complete World Cup 2026 calendar: all 104 matches with dates and kickoff times in your timezone. Add them to iPhone, Google Calendar, Android or Outlook — free.'
    ));
    setCanonical(canonical);

    const faq = FAQS(c).map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }));
    setJsonLd('wc26-landing-jsonld', {
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
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const ctaTool = (label) => <Link to={toolPath} className="wc-btn-primary">▶ {label}</Link>;

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
          <div className="wc-cta-row">{ctaTool(c('Añadir partidos a mi calendario', 'Add matches to my calendar'))}</div>
          <div className="wc-hero-stats">
            <div className="wc-stat"><div className="wc-stat-num">104</div><div className="wc-stat-lab">{c('Partidos', 'Matches')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">48</div><div className="wc-stat-lab">{c('Selecciones', 'Teams')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">16</div><div className="wc-stat-lab">{c('Sedes', 'Host cities')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">39</div><div className="wc-stat-lab">{c('Días', 'Days')}</div></div>
          </div>
        </div>
      </header>

      {/* ─────────── CONTENT (H2 sections, copy + visual) ─────────── */}
      <main className="wc-main wc-content">

        <SplitSection title={c('El calendario completo del Mundial 2026', 'The complete World Cup 2026 calendar')} visual={<FixturesVisual c={c} />}>
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
        </SplitSection>

        <SplitSection flip title={c('Fechas y fases: de la fase de grupos a la final', 'Dates and stages: from the groups to the final')} visual={<PhasesVisual c={c} />}>
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
        </SplitSection>

        <SplitSection title={c('Sedes y estadios del Mundial 2026', 'Host cities and stadiums of the World Cup 2026')} visual={<HostMapVisual c={c} />}>
          <p>{c(
            '16 ciudades sede en tres países reciben el Mundial 2026. El partido inaugural es en México y la final en Estados Unidos.',
            '16 host cities across three countries welcome the World Cup 2026. The opening match is in Mexico and the final in the USA.'
          )}</p>
          <ul className="wc-ul">
            <li>{c('México (3): Ciudad de México, Guadalajara, Monterrey', 'Mexico (3): Mexico City, Guadalajara, Monterrey')}</li>
            <li>{c('EE.UU. (11): Nueva York/Nueva Jersey, Los Ángeles, Dallas, San Francisco, Miami, Atlanta, Seattle, Houston, Filadelfia, Kansas City, Boston', 'USA (11): New York/New Jersey, Los Angeles, Dallas, San Francisco, Miami, Atlanta, Seattle, Houston, Philadelphia, Kansas City, Boston')}</li>
            <li>{c('Canadá (2): Toronto y Vancouver', 'Canada (2): Toronto and Vancouver')}</li>
          </ul>
        </SplitSection>

        <SplitSection flip title={c('Horarios del Mundial 2026 en tu país', 'World Cup 2026 kickoff times in your country')} visual={<TimezoneVisual c={c} />}>
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
        </SplitSection>

        <SplitSection title={c('Cómo añadir el calendario del Mundial 2026 a tu teléfono', 'How to add the World Cup 2026 calendar to your phone')} visual={<PhoneCalendarVisual c={c} />}>
          <p>{c('Añade todos los partidos en 3 pasos, sin instalar nada:', 'Add every match in 3 steps, with nothing to install:')}</p>
          <ul className="wc-ul">
            <li>{c('1. Elige qué partidos: los 104, sólo tus selecciones, o tus selecciones + eliminatorias.', '1. Choose which matches: all 104, only your teams, or your teams + the knockout stage.')}</li>
            <li>{c('2. Elige tu zona horaria para ver los horarios correctos.', '2. Pick your timezone to see the correct kickoff times.')}</li>
            <li>{c('3. Suscríbete en iPhone, Google Calendar o Android, o descarga el .ics para Outlook.', '3. Subscribe on iPhone, Google Calendar or Android, or download the .ics for Outlook.')}</li>
            <li>{c('Se actualiza solo: si la FIFA mueve un horario, tu calendario también.', 'It stays in sync: if FIFA shifts a kickoff, your calendar updates too.')}</li>
          </ul>
          <div className="wc-cta-row">{ctaTool(c('Abrir la herramienta del calendario', 'Open the calendar tool'))}</div>
        </SplitSection>

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

// ── Section shell: copy on one side, visual on the other (alternates). ──
function SplitSection({ title, visual, flip, children }) {
  return (
    <section className="wc-content-section">
      <div className={`wc-split ${flip ? 'flip' : ''}`}>
        <div className="wc-split-copy">
          <h2 className="wc-h2">{title}</h2>
          {children}
        </div>
        <div className="wc-split-visual">{visual}</div>
      </div>
    </section>
  );
}

// ─────────────── On-brand HUD visuals (SVG/CSS, no raster) ───────────────

function FixturesVisual({ c }) {
  const rows = [
    { d: '11 JUN', t: '20:00', h: 'MEX', a: 'CAN', hf: '🇲🇽', af: '🇨🇦', tag: c('INAUGURAL', 'OPENER'), tone: 'green' },
    { d: '13 JUN', t: '18:00', h: 'ARG', a: 'ESP', hf: '🇦🇷', af: '🇪🇸', tag: 'A' },
    { d: '16 JUN', t: '14:00', h: 'BRA', a: 'GER', hf: '🇧🇷', af: '🇩🇪', tag: 'C' },
    { d: '21 JUN', t: '11:00', h: 'FRA', a: 'ENG', hf: '🇫🇷', af: '🏴', tag: 'F' },
    { d: '19 JUL', t: '15:00', h: '1°', a: '2°', hf: '🏆', af: '🏆', tag: c('FINAL', 'FINAL'), tone: 'gold' },
  ];
  return (
    <div className="wc-viz">
      <div className="wc-viz-head"><span>◆ 104 {c('PARTIDOS', 'MATCHES')}</span><span className="wc-viz-live"><i /> {c('EN VIVO', 'LIVE')}</span></div>
      <div className="wc-fx">
        {rows.map((r, i) => (
          <div className={`wc-fx-row ${r.tone || ''}`} key={i}>
            <div className="wc-fx-date">{r.d}<span>{r.t}</span></div>
            <div className="wc-fx-team"><span className="wc-fx-flag">{r.hf}</span>{r.h}</div>
            <div className="wc-fx-vs">–</div>
            <div className="wc-fx-team r">{r.a}<span className="wc-fx-flag">{r.af}</span></div>
            <div className="wc-fx-tag">{r.tag}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhasesVisual({ c }) {
  const steps = [c('GRUPOS', 'GROUPS'), '1/16', '1/8', '1/4', c('SEMIS', 'SEMIS'), c('FINAL', 'FINAL')];
  return (
    <div className="wc-viz">
      <div className="wc-viz-head"><span>◆ {c('FASES', 'STAGES')}</span><span className="wc-viz-sub">{c('11 jun → 19 jul', 'Jun 11 → Jul 19')}</span></div>
      <div className="wc-ph">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div className="wc-ph-node" key={i} style={{ animationDelay: `${i * 90}ms` }}>
              <div className={`wc-ph-dot ${last ? 'final' : ''}`}>{last ? '🏆' : i + 1}</div>
              <div className="wc-ph-lbl">{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HostMapVisual({ c }) {
  // Dots positioned to suggest North-American geography (viewBox 0..320 x 0..230).
  const cities = [
    { x: 70, y: 38, k: 'ca' }, { x: 205, y: 30, k: 'ca' },                      // Vancouver, Toronto
    { x: 52, y: 92, k: 'us' }, { x: 60, y: 70, k: 'us' }, { x: 44, y: 110, k: 'us' }, // SF, Seattle, LA
    { x: 120, y: 96, k: 'us' }, { x: 150, y: 110, k: 'us' }, { x: 150, y: 130, k: 'us' }, // Denver/KC, Dallas, Houston
    { x: 205, y: 120, k: 'us' }, { x: 235, y: 96, k: 'us' }, { x: 250, y: 78, k: 'us' }, // Atlanta, NY, Boston
    { x: 240, y: 110, k: 'us' }, { x: 230, y: 150, k: 'us' },                    // Philly, Miami
    { x: 95, y: 165, k: 'mx' }, { x: 110, y: 185, k: 'mx' }, { x: 130, y: 158, k: 'mx' }, // GDL, CDMX, MTY
  ];
  const tone = { ca: '#36E9FF', us: '#21E28C', mx: '#FF2BD6' };
  return (
    <div className="wc-viz wc-viz-map">
      <div className="wc-viz-head"><span>◆ {c('16 SEDES · 3 PAÍSES', '16 HOST CITIES · 3 COUNTRIES')}</span></div>
      <svg viewBox="0 0 320 230" className="wc-map-svg" role="img" aria-label={c('Mapa de sedes', 'Host map')}>
        <defs>
          <pattern id="wcgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="rgba(33,226,140,0.12)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="320" height="230" fill="url(#wcgrid)" />
        {/* abstract country regions */}
        <ellipse cx="150" cy="40" rx="140" ry="34" fill="rgba(54,233,255,0.06)" stroke="rgba(54,233,255,0.25)" strokeWidth="0.7" />
        <ellipse cx="150" cy="105" rx="135" ry="46" fill="rgba(33,226,140,0.06)" stroke="rgba(33,226,140,0.28)" strokeWidth="0.7" />
        <ellipse cx="115" cy="175" rx="58" ry="30" fill="rgba(255,43,214,0.06)" stroke="rgba(255,43,214,0.28)" strokeWidth="0.7" />
        {cities.map((p, i) => (
          <g key={i} style={{ animationDelay: `${i * 60}ms` }} className="wc-map-dot">
            <circle cx={p.x} cy={p.y} r="6" fill={tone[p.k]} opacity="0.18" />
            <circle cx={p.x} cy={p.y} r="2.6" fill={tone[p.k]} />
          </g>
        ))}
      </svg>
      <div className="wc-map-legend">
        <span><i style={{ background: tone.mx }} /> {c('México 3', 'Mexico 3')}</span>
        <span><i style={{ background: tone.us }} /> {c('EE.UU. 11', 'USA 11')}</span>
        <span><i style={{ background: tone.ca }} /> {c('Canadá 2', 'Canada 2')}</span>
      </div>
    </div>
  );
}

function TimezoneVisual({ c }) {
  const zs = [
    { z: 'CDMX', t: '19:00' }, { z: 'Bogotá', t: '20:00' },
    { z: 'Nueva York', t: '21:00' }, { z: 'Buenos Aires', t: '22:00' },
    { z: 'Los Ángeles', t: '18:00' }, { z: 'Madrid', t: '03:00' },
  ];
  return (
    <div className="wc-viz">
      <div className="wc-viz-head"><span>◆ {c('MISMO PARTIDO · TU HORA', 'SAME MATCH · YOUR TIME')}</span></div>
      <div className="wc-tz-match"><span className="wc-fx-flag">🇲🇽</span> MEX <b>–</b> CAN <span className="wc-fx-flag">🇨🇦</span></div>
      <div className="wc-tz-grid">
        {zs.map((z, i) => (
          <div className="wc-tz-chip" key={i}>
            <span className="wc-tz-z">{z.z}</span>
            <span className="wc-tz-t">{z.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneCalendarVisual({ c }) {
  const items = [
    { d: 'JUN 11', m: 'MEX vs CAN', f: '🇲🇽' },
    { d: 'JUN 13', m: 'ARG vs ESP', f: '🇦🇷' },
    { d: 'JUN 16', m: 'BRA vs GER', f: '🇧🇷' },
    { d: 'JUN 21', m: 'FRA vs ENG', f: '🇫🇷' },
  ];
  return (
    <div className="wc-viz wc-viz-phone-wrap">
      <div className="wc-phone">
        <div className="wc-phone-notch" />
        <div className="wc-phone-head">{c('JUNIO 2026', 'JUNE 2026')} · {c('MUNDIAL', 'WORLD CUP')}</div>
        <div className="wc-phone-list">
          {items.map((it, i) => (
            <div className="wc-phone-row" key={i}>
              <span className="wc-phone-date">{it.d}</span>
              <span className="wc-phone-evt"><span className="wc-fx-flag">{it.f}</span>{it.m}</span>
            </div>
          ))}
        </div>
        <div className="wc-phone-foot"><span>📱</span><span>📅</span><span>🤖</span><span>💻</span></div>
      </div>
    </div>
  );
}

const FAQS = (c) => [
  { q: c('¿El calendario del Mundial 2026 es gratis?', 'Is the World Cup 2026 calendar free?'), a: c('Sí. 100% gratis. Sin cuenta, sin app, sin anuncios.', 'Yes. 100% free. No account, no app, no ads.') },
  { q: c('¿Se actualizan los horarios automáticamente?', 'Do kickoff times update automatically?'), a: c('Sí. La suscripción se sincroniza con la fuente oficial de la FIFA — si cambia un horario, tu calendario también.', 'Yes. The subscription syncs with the official FIFA source — if a kickoff changes, your calendar updates too.') },
  { q: c('¿En qué dispositivos funciona?', 'Which devices does it work on?'), a: c('iPhone, iPad, Mac, Android, Google Calendar y Outlook (archivo .ics estándar).', 'iPhone, iPad, Mac, Android, Google Calendar and Outlook (standard .ics file).') },
  { q: c('¿Puedo añadir sólo mi selección?', 'Can I add only my national team?'), a: c('Sí. Elige tus selecciones y, si quieres, suma toda la fase de eliminatorias.', 'Yes. Pick your teams and, if you like, add the entire knockout stage too.') },
  { q: c('¿Cómo elimino el calendario?', 'How do I remove the calendar?'), a: c('iPhone: Ajustes → Calendario → Cuentas → elimina la suscripción. Google: Calendar → Otros calendarios → "X".', 'iPhone: Settings → Calendar → Accounts → remove subscription. Google: Calendar → Other calendars → "X".') },
  { q: c('¿Quién está detrás?', 'Who’s behind this?'), a: c('FutPools — quinielas del Mundial en línea para LATAM, con premios reales.', 'FutPools — online World Cup pools for LATAM, with real prizes.') },
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
.fp-wc26 .wc-cta-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 4px; }
.fp-wc26 .wc-content-section { background: var(--surface); border: 1px solid var(--stroke); clip-path: var(--hud-clip); padding: 18px 16px 20px; }
.fp-wc26 .wc-h2 { font-family: var(--ox); font-weight: 800; font-size: 18px; letter-spacing: 0.3px; margin: 0 0 10px; color: var(--text); line-height: 1.25; }
.fp-wc26 .wc-content-section p { font-size: 14px; line-height: 1.6; color: var(--text-dim); margin: 0 0 10px; }
.fp-wc26 .wc-ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fp-wc26 .wc-ul li { position: relative; padding-left: 20px; font-size: 13.5px; line-height: 1.5; color: var(--text-dim); }
.fp-wc26 .wc-ul li::before { content: '◆'; position: absolute; left: 0; top: 0; color: var(--primary); font-size: 10px; line-height: 1.7; }
.fp-wc26 .wc-btn-secondary { display: inline-flex; align-items: center; gap: 6px; font-family: var(--ox); font-weight: 800; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: var(--text); text-decoration: none; padding: 13px 18px; background: transparent; border: 1px solid var(--stroke-strong); clip-path: var(--hud-clip-sm); transition: border-color 0.15s, color 0.15s; }
.fp-wc26 .wc-btn-secondary:hover { border-color: var(--primary); color: var(--primary); }

/* ── split layout (copy + visual) ── */
.fp-wc26 .wc-split { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: center; }
.fp-wc26 .wc-split-copy { min-width: 0; }

/* ── visual frame ── */
.fp-wc26 .wc-viz { background: linear-gradient(180deg, rgba(33,226,140,0.04), transparent 60%), var(--surface-alt); border: 1px solid var(--stroke); clip-path: var(--hud-clip-sm); padding: 12px 12px 14px; position: relative; overflow: hidden; }
.fp-wc26 .wc-viz::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px); }
.fp-wc26 .wc-viz-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: var(--mono); font-size: 9px; letter-spacing: 1.5px; color: var(--text-muted); font-weight: 700; margin-bottom: 10px; }
.fp-wc26 .wc-viz-sub { color: var(--accent); }
.fp-wc26 .wc-viz-live { display: inline-flex; align-items: center; gap: 5px; color: var(--fp-danger, #FF3B5C); }
.fp-wc26 .wc-viz-live i { width: 6px; height: 6px; border-radius: 50%; background: var(--fp-danger, #FF3B5C); box-shadow: 0 0 8px var(--fp-danger, #FF3B5C); animation: wcPulse 1.4s infinite; }
@keyframes wcPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

/* fixtures */
.fp-wc26 .wc-fx { display: flex; flex-direction: column; gap: 6px; }
.fp-wc26 .wc-fx-row { display: grid; grid-template-columns: 52px 1fr 14px 1fr 34px; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%); padding: 7px 8px; }
.fp-wc26 .wc-fx-row.green { border-color: rgba(33,226,140,0.4); }
.fp-wc26 .wc-fx-row.gold { border-color: rgba(255,209,102,0.45); }
.fp-wc26 .wc-fx-date { font-family: var(--mono); font-size: 8.5px; line-height: 1.2; color: var(--text-muted); letter-spacing: 0.5px; }
.fp-wc26 .wc-fx-date span { display: block; color: var(--accent); }
.fp-wc26 .wc-fx-team { display: flex; align-items: center; gap: 5px; font-family: var(--ox); font-weight: 800; font-size: 12px; color: var(--text); }
.fp-wc26 .wc-fx-team.r { justify-content: flex-end; }
.fp-wc26 .wc-fx-flag { font-size: 13px; line-height: 1; }
.fp-wc26 .wc-fx-vs { text-align: center; color: var(--text-muted); font-size: 11px; }
.fp-wc26 .wc-fx-tag { font-family: var(--mono); font-size: 7.5px; font-weight: 800; letter-spacing: 0.5px; color: var(--primary); text-align: right; }

/* phases */
.fp-wc26 .wc-ph { display: flex; flex-wrap: wrap; gap: 4px 0; align-items: flex-start; }
.fp-wc26 .wc-ph-node { flex: 1 1 0; min-width: 44px; display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; opacity: 0; animation: wcRise 0.5s ease forwards; }
.fp-wc26 .wc-ph-node:not(:last-child)::after { content: ''; position: absolute; top: 13px; left: 60%; right: -40%; height: 2px; background: linear-gradient(90deg, var(--primary), rgba(33,226,140,0.15)); }
.fp-wc26 .wc-ph-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--ox); font-weight: 900; font-size: 11px; color: var(--fp-on-primary); background: var(--primary); box-shadow: 0 0 12px rgba(33,226,140,0.5); position: relative; z-index: 1; }
.fp-wc26 .wc-ph-dot.final { background: var(--gold); box-shadow: 0 0 16px rgba(255,209,102,0.7); font-size: 13px; }
.fp-wc26 .wc-ph-lbl { font-family: var(--mono); font-size: 8px; letter-spacing: 0.5px; color: var(--text-dim); text-align: center; }
@keyframes wcRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* map */
.fp-wc26 .wc-map-svg { width: 100%; height: auto; display: block; }
.fp-wc26 .wc-map-dot { opacity: 0; animation: wcRise 0.5s ease forwards; }
.fp-wc26 .wc-map-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-family: var(--mono); font-size: 10px; color: var(--text-dim); }
.fp-wc26 .wc-map-legend span { display: inline-flex; align-items: center; gap: 5px; }
.fp-wc26 .wc-map-legend i { width: 8px; height: 8px; border-radius: 50%; }

/* timezone */
.fp-wc26 .wc-tz-match { font-family: var(--ox); font-weight: 800; font-size: 16px; color: var(--text); text-align: center; margin: 4px 0 12px; display: flex; align-items: center; justify-content: center; gap: 6px; }
.fp-wc26 .wc-tz-match b { color: var(--text-muted); font-weight: 700; }
.fp-wc26 .wc-tz-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.fp-wc26 .wc-tz-chip { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%); padding: 8px 10px; }
.fp-wc26 .wc-tz-z { font-family: var(--mono); font-size: 10px; color: var(--text-dim); }
.fp-wc26 .wc-tz-t { font-family: var(--ox); font-weight: 800; font-size: 14px; color: var(--accent); }

/* phone */
.fp-wc26 .wc-viz-phone-wrap { display: flex; justify-content: center; background: none; border: none; clip-path: none; padding: 6px 0; }
.fp-wc26 .wc-viz-phone-wrap::after { display: none; }
.fp-wc26 .wc-phone { width: 200px; background: var(--bg); border: 2px solid var(--stroke-strong); border-radius: 22px; padding: 16px 12px 12px; position: relative; box-shadow: 0 0 30px rgba(33,226,140,0.18); }
.fp-wc26 .wc-phone-notch { position: absolute; top: 7px; left: 50%; transform: translateX(-50%); width: 56px; height: 5px; border-radius: 3px; background: var(--stroke-strong); }
.fp-wc26 .wc-phone-head { font-family: var(--ox); font-weight: 800; font-size: 10px; letter-spacing: 1px; color: var(--primary); text-align: center; margin: 6px 0 10px; }
.fp-wc26 .wc-phone-list { display: flex; flex-direction: column; gap: 6px; }
.fp-wc26 .wc-phone-row { display: flex; align-items: center; gap: 8px; background: var(--surface); border-left: 2px solid var(--primary); padding: 7px 9px; clip-path: polygon(0 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%); }
.fp-wc26 .wc-phone-date { font-family: var(--mono); font-size: 8.5px; color: var(--text-muted); white-space: nowrap; }
.fp-wc26 .wc-phone-evt { display: flex; align-items: center; gap: 5px; font-family: var(--ox); font-weight: 700; font-size: 11px; color: var(--text); }
.fp-wc26 .wc-phone-foot { display: flex; justify-content: center; gap: 12px; margin-top: 12px; font-size: 16px; filter: grayscale(0.2); }

@media (min-width: 860px) {
  .fp-wc26 .wc-split { grid-template-columns: 1.05fr 0.95fr; gap: 28px; }
  .fp-wc26 .wc-split.flip .wc-split-copy { order: 2; }
  .fp-wc26 .wc-split.flip .wc-split-visual { order: 1; }
  .fp-wc26 .wc-content-section { padding: 26px 26px 28px; }
  .fp-wc26 .wc-h2 { font-size: 21px; }
  .fp-wc26 .wc-content-section p { font-size: 15px; }
}
`;
