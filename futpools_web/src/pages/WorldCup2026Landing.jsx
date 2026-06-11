/**
 * /calendario-mundial-2026 (ES) · /world-cup-2026-calendar (EN)
 *
 * Bottom-of-funnel SEO landing page for the World Cup 2026 calendar, built
 * on the Reverb-style template: H1 = primary keyword, an intro that leads
 * with the keyword, a primary CTA, then a RHYTHM of centered "statement"
 * sections interleaved with two-column copy+visual sections, an FAQ with
 * FAQPage/BreadcrumbList JSON-LD, and a repeated CTA. The CTA navigates to
 * the actual tool (/calendario-mundial-2026/agregar).
 *
 * All tournament data is factual (FIFA World Cup 2026): 104 matches split
 * USA 78 / Mexico 13 / Canada 13, 16 host cities (11 US, 3 MX, 2 CA),
 * opener at Estadio Azteca (Jun 11), final at NY/NJ MetLife (Jul 19). No
 * specific group matchups are shown (those depend on the draw) — only real
 * dates, stages, venues and distribution.
 *
 * Section visuals are hand-built SVG/CSS (no raster assets) so they match
 * the WC26 HUD aesthetic, stay crisp on any DPI, and add zero image weight.
 */

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { WC_CSS } from './WorldCup2026Calendar';
import { wc26Faq, wc26JsonLd } from '../seo/wc26Landing';

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
    // Client-side structured data (the static shell also bakes this in for
    // non-JS crawlers — see scripts/build-i18n-shells.js).
    setJsonLd('wc26-landing-jsonld', wc26JsonLd(locale));
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
              'El calendario del Mundial 2026 ya está aquí: los 104 partidos, 48 selecciones y 16 sedes en Estados Unidos, México y Canadá. Consulta las fechas y los horarios en tu zona, y añade los partidos a tu calendario en segundos. Es gratis, sin app ni registro.',
              'The World Cup 2026 calendar is here: all 104 matches, 48 teams and 16 host cities across the USA, Mexico and Canada. Check the dates and kickoff times in your timezone, and add the matches to your calendar in seconds. It’s free — no app, no sign-up.'
            )}
          </p>
          <div className="wc-cta-row" style={{ justifyContent: 'center' }}>{ctaTool(c('Añadir partidos a mi calendario', 'Add matches to my calendar'))}</div>
          <div className="wc-hero-stats">
            <div className="wc-stat"><div className="wc-stat-num">104</div><div className="wc-stat-lab">{c('Partidos', 'Matches')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">48</div><div className="wc-stat-lab">{c('Selecciones', 'Teams')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">16</div><div className="wc-stat-lab">{c('Sedes', 'Host cities')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">39</div><div className="wc-stat-lab">{c('Días', 'Days')}</div></div>
          </div>
        </div>
      </header>

      <main className="wc-main wc-content">

        {/* statement */}
        <Statement
          kicker={c('11 JUNIO – 19 JULIO 2026', 'JUNE 11 – JULY 19, 2026')}
          title={c('El Mundial más grande de la historia', 'The biggest World Cup in history')}
        >
          {c(
            'Por primera vez, 48 selecciones y 104 partidos repartidos en tres países anfitriones. Aquí tienes todo el calendario, y lo añades a tu teléfono en segundos.',
            'For the first time, 48 teams and 104 matches across three host countries. Here’s the full calendar — and you add it to your phone in seconds.'
          )}
        </Statement>

        {/* two-column: complete calendar + match distribution */}
        <Split title={c('El calendario completo del Mundial 2026', 'The complete World Cup 2026 calendar')} visual={<DistributionVisual c={c} />}>
          <p>{c(
            'El Mundial 2026 se juega del 11 de junio al 19 de julio de 2026. Los 104 partidos se reparten entre los tres anfitriones:',
            'The World Cup 2026 runs from June 11 to July 19, 2026. The 104 matches are split across the three hosts:'
          )}</p>
          <ul className="wc-ul">
            <li>{c('Estados Unidos: 78 partidos', 'United States: 78 matches')}</li>
            <li>{c('México: 13 partidos · Canadá: 13 partidos', 'Mexico: 13 matches · Canada: 13 matches')}</li>
            <li>{c('48 selecciones en 12 grupos de 4', '48 teams in 12 groups of 4')}</li>
            <li>{c('La inauguración es en el Estadio Azteca (CDMX) el 11 de junio', 'The opening match is at Estadio Azteca (Mexico City) on June 11')}</li>
          </ul>
        </Split>

        {/* two-column flip: stages */}
        <Split flip title={c('Fechas y fases: de la fase de grupos a la final', 'Dates and stages: from the groups to the final')} visual={<PhasesVisual c={c} />}>
          <p>{c(
            'El torneo se divide en fase de grupos y eliminatorias. Estas son las ventanas del calendario oficial:',
            'The tournament splits into a group stage and the knockout rounds. These are the windows of the official schedule:'
          )}</p>
          <ul className="wc-ul">
            <li>{c('Fase de grupos: 11 – 27 de junio', 'Group stage: June 11 – 27')}</li>
            <li>{c('Dieciseisavos (ronda de 32): 28 de junio – 3 de julio', 'Round of 32: June 28 – July 3')}</li>
            <li>{c('Octavos: 4 – 7 de julio · Cuartos: 9 – 11 de julio', 'Round of 16: July 4 – 7 · Quarter-finals: July 9 – 11')}</li>
            <li>{c('Semifinales: 14 – 15 de julio', 'Semi-finals: July 14 – 15')}</li>
            <li>{c('Tercer puesto: 18 de julio · Final: 19 de julio (Nueva York/NJ)', 'Third place: July 18 · Final: July 19 (New York/NJ)')}</li>
          </ul>
        </Split>

        {/* statement */}
        <Statement
          kicker={c('SIN COSTO', 'NO COST')}
          title={c('Gratis. Sin app. Sin registro.', 'Free. No app. No sign-up.')}
        >
          {c(
            'Añade el calendario oficial a tu calendario y olvídate de buscar horarios. Si la FIFA mueve un partido, el tuyo se actualiza solo.',
            'Add the official schedule to your calendar and stop hunting for kickoff times. If FIFA moves a match, yours updates automatically.'
          )}
        </Statement>

        {/* two-column: host cities + map */}
        <Split title={c('Sedes y estadios del Mundial 2026', 'Host cities and stadiums of the World Cup 2026')} visual={<HostMapVisual c={c} />}>
          <p>{c(
            '16 ciudades sede en tres países reciben el Mundial 2026. La inauguración es en México y la final en Estados Unidos.',
            '16 host cities across three countries welcome the World Cup 2026. The opener is in Mexico and the final in the USA.'
          )}</p>
          <ul className="wc-ul">
            <li>{c('EE.UU. (11): Atlanta, Boston, Dallas, Houston, Kansas City, Los Ángeles, Miami, Nueva York/NJ, Filadelfia, San Francisco y Seattle', 'USA (11): Atlanta, Boston, Dallas, Houston, Kansas City, Los Angeles, Miami, New York/NJ, Philadelphia, San Francisco and Seattle')}</li>
            <li>{c('México (3): Ciudad de México, Guadalajara y Monterrey', 'Mexico (3): Mexico City, Guadalajara and Monterrey')}</li>
            <li>{c('Canadá (2): Toronto y Vancouver', 'Canada (2): Toronto and Vancouver')}</li>
          </ul>
        </Split>

        {/* two-column flip: timezones */}
        <Split flip title={c('Horarios del Mundial 2026 en tu país', 'World Cup 2026 kickoff times in your country')} visual={<TimezoneVisual c={c} />}>
          <p>{c(
            'Los partidos se juegan en horarios de América. La herramienta los muestra en TU zona horaria, y tu calendario los ajusta automáticamente.',
            'Matches kick off on American time. The tool shows them in YOUR timezone, and your calendar adjusts them automatically.'
          )}</p>
          <ul className="wc-ul">
            <li>{c('México: CDMX, Norte y Pacífico', 'Mexico: Central, North and Pacific')}</li>
            <li>{c('EE.UU.: Este, Centro, Montaña y Pacífico', 'USA: Eastern, Central, Mountain and Pacific')}</li>
            <li>{c('Latinoamérica: Argentina, Brasil, Colombia, Perú, Chile', 'Latin America: Argentina, Brazil, Colombia, Peru, Chile')}</li>
            <li>{c('Europa: España y Reino Unido', 'Europe: Spain and the United Kingdom')}</li>
          </ul>
        </Split>

        {/* two-column: how to add + phone */}
        <Split title={c('Cómo añadir el calendario del Mundial 2026 a tu teléfono', 'How to add the World Cup 2026 calendar to your phone')} visual={<PhoneCalendarVisual c={c} />}>
          <p>{c('Añade todos los partidos en 3 pasos, sin instalar nada:', 'Add every match in 3 steps, with nothing to install:')}</p>
          <ul className="wc-ul">
            <li>{c('1. Elige qué partidos: los 104, sólo tus selecciones, o tus selecciones + eliminatorias.', '1. Choose which matches: all 104, only your teams, or your teams + the knockout stage.')}</li>
            <li>{c('2. Elige tu zona horaria para ver los horarios correctos.', '2. Pick your timezone to see the correct kickoff times.')}</li>
            <li>{c('3. Suscríbete en iPhone, Google Calendar o Android, o descarga el .ics para Outlook.', '3. Subscribe on iPhone, Google Calendar or Android, or download the .ics for Outlook.')}</li>
          </ul>
          <div className="wc-cta-row">{ctaTool(c('Abrir la herramienta del calendario', 'Open the calendar tool'))}</div>
        </Split>

        {/* statement */}
        <Statement
          kicker={c('VÍVELO COMPLETO', 'LIVE IT ALL')}
          title={c('Tu compañero para el Mundial 2026', 'Your companion for the World Cup 2026')}
        >
          {c(
            'No te pierdas un solo partido de tu selección — desde el primer silbatazo en el Azteca hasta la final.',
            'Don’t miss a single match of your team — from the first whistle at the Azteca to the final.'
          )}
        </Statement>

        {/* ── FAQ ── */}
        <section className="wc-faq">
          <h2>{c('Preguntas frecuentes', 'Frequently asked questions')}</h2>
          <div className="wc-faq-grid">
            {wc26Faq(locale).map(({ q, a }) => (
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

// ── Centered "statement" section (Reverb rhythm: divides the two-column ones). ──
function Statement({ kicker, title, children }) {
  return (
    <section className="wc-statement">
      {kicker && <div className="wc-st-kicker">{kicker}</div>}
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

// ── Two-column section: copy on one side, visual on the other (alternates). ──
function Split({ title, visual, flip, children }) {
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

// ─────────────── On-brand HUD visuals (SVG/CSS, factual data) ───────────────

function DistributionVisual({ c }) {
  const rows = [
    { f: '🇺🇸', n: c('Estados Unidos', 'United States'), v: 78, w: 100, tone: '#21E28C' },
    { f: '🇲🇽', n: c('México', 'Mexico'), v: 13, w: 18, tone: '#FF2BD6' },
    { f: '🇨🇦', n: c('Canadá', 'Canada'), v: 13, w: 18, tone: '#36E9FF' },
  ];
  return (
    <div className="wc-viz" role="img" aria-label={c('Distribución de los 104 partidos del Mundial 2026 por país: 78 en Estados Unidos, 13 en México y 13 en Canadá.', 'Distribution of the 104 World Cup 2026 matches by country: 78 in the United States, 13 in Mexico and 13 in Canada.')}>
      <div className="wc-viz-head"><span>◆ 104 {c('PARTIDOS · 3 PAÍSES', 'MATCHES · 3 COUNTRIES')}</span></div>
      <div className="wc-dist">
        {rows.map((r, i) => (
          <div className="wc-dist-row" key={i}>
            <div className="wc-dist-lbl"><span className="wc-fx-flag">{r.f}</span>{r.n}</div>
            <div className="wc-dist-bar"><span style={{ width: `${r.w}%`, background: r.tone, boxShadow: `0 0 12px ${r.tone}88`, animationDelay: `${i * 120}ms` }} /></div>
            <div className="wc-dist-val">{r.v}</div>
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">{c('Total: 104 partidos · 48 selecciones', 'Total: 104 matches · 48 teams')}</div>
    </div>
  );
}

function PhasesVisual({ c }) {
  const steps = [c('GRUPOS', 'GROUPS'), '1/16', '1/8', '1/4', c('SEMIS', 'SEMIS'), c('FINAL', 'FINAL')];
  return (
    <div className="wc-viz" role="img" aria-label={c('Fases del Mundial 2026: fase de grupos, dieciseisavos, octavos, cuartos, semifinales y final.', 'World Cup 2026 stages: group stage, round of 32, round of 16, quarter-finals, semi-finals and final.')}>
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
  // 16 dots positioned to suggest North-American geography (11 US, 3 MX, 2 CA).
  const cities = [
    { x: 70, y: 38, k: 'ca' }, { x: 205, y: 30, k: 'ca' },                          // Vancouver, Toronto
    { x: 60, y: 70, k: 'us' }, { x: 52, y: 92, k: 'us' }, { x: 44, y: 110, k: 'us' }, // Seattle, SF, LA
    { x: 120, y: 96, k: 'us' }, { x: 150, y: 112, k: 'us' }, { x: 150, y: 132, k: 'us' }, // KC, Dallas, Houston
    { x: 205, y: 120, k: 'us' }, { x: 235, y: 96, k: 'us' }, { x: 252, y: 78, k: 'us' }, // Atlanta, NY/NJ, Boston
    { x: 242, y: 110, k: 'us' }, { x: 230, y: 150, k: 'us' },                        // Philadelphia, Miami
    { x: 95, y: 165, k: 'mx' }, { x: 112, y: 186, k: 'mx' }, { x: 132, y: 158, k: 'mx' }, // GDL, CDMX, MTY
  ];
  const tone = { ca: '#36E9FF', us: '#21E28C', mx: '#FF2BD6' };
  return (
    <div className="wc-viz wc-viz-map" role="img" aria-label={c('Mapa de las 16 sedes del Mundial 2026: 11 en Estados Unidos, 3 en México y 2 en Canadá.', 'Map of the 16 World Cup 2026 host cities: 11 in the United States, 3 in Mexico and 2 in Canada.')}>
      <div className="wc-viz-head"><span>◆ {c('16 SEDES · 3 PAÍSES', '16 HOST CITIES · 3 COUNTRIES')}</span></div>
      <svg viewBox="0 0 320 230" className="wc-map-svg" aria-hidden="true">
        <defs>
          <pattern id="wcgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="rgba(33,226,140,0.12)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="320" height="230" fill="url(#wcgrid)" />
        <ellipse cx="150" cy="40" rx="140" ry="34" fill="rgba(54,233,255,0.06)" stroke="rgba(54,233,255,0.25)" strokeWidth="0.7" />
        <ellipse cx="150" cy="105" rx="135" ry="46" fill="rgba(33,226,140,0.06)" stroke="rgba(33,226,140,0.28)" strokeWidth="0.7" />
        <ellipse cx="115" cy="175" rx="58" ry="30" fill="rgba(255,43,214,0.06)" stroke="rgba(255,43,214,0.28)" strokeWidth="0.7" />
        {cities.map((p, i) => (
          <g key={i} style={{ animationDelay: `${i * 55}ms` }} className="wc-map-dot">
            <circle cx={p.x} cy={p.y} r="6" fill={tone[p.k]} opacity="0.18" />
            <circle cx={p.x} cy={p.y} r="2.6" fill={tone[p.k]} />
          </g>
        ))}
      </svg>
      <div className="wc-map-legend">
        <span><i style={{ background: tone.us }} /> {c('EE.UU. 11', 'USA 11')}</span>
        <span><i style={{ background: tone.mx }} /> {c('México 3', 'Mexico 3')}</span>
        <span><i style={{ background: tone.ca }} /> {c('Canadá 2', 'Canada 2')}</span>
      </div>
    </div>
  );
}

function TimezoneVisual({ c }) {
  const zs = [
    c('México — CDMX, Norte y Pacífico', 'Mexico — Central, North & Pacific'),
    c('EE.UU. — Este, Centro, Montaña, Pacífico', 'USA — Eastern, Central, Mountain, Pacific'),
    c('Latinoamérica — ARG · BRA · COL · PER · CHI', 'Latin America — ARG · BRA · COL · PER · CHI'),
    c('Europa — España y Reino Unido', 'Europe — Spain & UK'),
  ];
  return (
    <div className="wc-viz" role="img" aria-label={c('El calendario del Mundial 2026 se ajusta a tu zona horaria: México, Estados Unidos, Latinoamérica y Europa.', 'The World Cup 2026 calendar adjusts to your timezone: Mexico, the United States, Latin America and Europe.')}>
      <div className="wc-viz-head"><span>◆ {c('TU ZONA · AUTOMÁTICO', 'YOUR ZONE · AUTOMATIC')}</span></div>
      <div className="wc-tz-note2">{c('Cada partido se muestra en tu hora local — sin convertir nada a mano.', 'Every match shows in your local time — no manual conversion.')}</div>
      <div className="wc-tz-list">
        {zs.map((z, i) => (
          <div className="wc-tz-item" key={i} style={{ animationDelay: `${i * 80}ms` }}><span className="wc-tz-clock">◷</span>{z}</div>
        ))}
      </div>
    </div>
  );
}

function PhoneCalendarVisual({ c }) {
  const items = [
    { d: 'JUN 11', m: c('Inauguración · Azteca', 'Opening · Azteca'), f: '🇲🇽' },
    { d: 'JUN 11–27', m: c('Fase de grupos', 'Group stage'), f: '⚽' },
    { d: 'JUL 4–7', m: c('Octavos de final', 'Round of 16'), f: '🔥' },
    { d: 'JUL 19', m: c('Final · Nueva York', 'Final · New York'), f: '🏆' },
  ];
  return (
    <div className="wc-viz wc-viz-phone-wrap" role="img" aria-label={c('Un teléfono con el calendario del Mundial 2026 añadido: inauguración en el Azteca, fase de grupos, octavos y final.', 'A phone showing the World Cup 2026 calendar added: opening match at the Azteca, group stage, round of 16 and final.')}>
      <div className="wc-phone">
        <div className="wc-phone-notch" />
        <div className="wc-phone-head">{c('MUNDIAL 2026', 'WORLD CUP 2026')}</div>
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
.fp-wc26 .wc-content { gap: 0; padding-top: 8px; }
.fp-wc26 .wc-lead { max-width: 720px; }
.fp-wc26 .wc-cta-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 4px; }
.fp-wc26 .wc-ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fp-wc26 .wc-ul li { position: relative; padding-left: 20px; font-size: 13.5px; line-height: 1.5; color: var(--text-dim); }
.fp-wc26 .wc-ul li::before { content: '◆'; position: absolute; left: 0; top: 0; color: var(--primary); font-size: 10px; line-height: 1.7; }
.fp-wc26 .wc-btn-secondary { display: inline-flex; align-items: center; gap: 6px; font-family: var(--ox); font-weight: 800; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: var(--text); text-decoration: none; padding: 13px 18px; background: transparent; border: 1px solid var(--stroke-strong); clip-path: var(--hud-clip-sm); transition: border-color 0.15s, color 0.15s; }
.fp-wc26 .wc-btn-secondary:hover { border-color: var(--primary); color: var(--primary); }

/* ── centered statement section (open, no card) ── */
.fp-wc26 .wc-statement { text-align: center; max-width: 680px; margin: 0 auto; padding: 40px 16px 36px; }
.fp-wc26 .wc-st-kicker { font-family: var(--mono); font-size: 10px; letter-spacing: 2.5px; color: var(--primary); font-weight: 700; margin-bottom: 12px; }
.fp-wc26 .wc-statement h2 { font-family: var(--ox); font-weight: 900; font-size: clamp(22px, 5.5vw, 30px); line-height: 1.12; letter-spacing: -0.3px; margin: 0 0 12px; color: var(--text); }
.fp-wc26 .wc-statement p { font-size: 15px; line-height: 1.6; color: var(--text-dim); margin: 0; }

/* ── two-column section (open, divider above; visual carries the frame) ── */
.fp-wc26 .wc-content-section { padding: 40px 0; border-top: 1px solid var(--stroke); }
.fp-wc26 .wc-split { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: center; }
.fp-wc26 .wc-split-copy { min-width: 0; }
.fp-wc26 .wc-h2 { font-family: var(--ox); font-weight: 800; font-size: 19px; letter-spacing: 0.2px; margin: 0 0 12px; color: var(--text); line-height: 1.22; }
.fp-wc26 .wc-split-copy p { font-size: 14px; line-height: 1.6; color: var(--text-dim); margin: 0 0 12px; }

/* ── visual frame ── */
.fp-wc26 .wc-viz { background: linear-gradient(180deg, rgba(33,226,140,0.04), transparent 60%), var(--surface-alt); border: 1px solid var(--stroke); clip-path: var(--hud-clip-sm); padding: 14px; position: relative; overflow: hidden; }
.fp-wc26 .wc-viz::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px); }
.fp-wc26 .wc-viz-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: var(--mono); font-size: 9px; letter-spacing: 1.5px; color: var(--text-muted); font-weight: 700; margin-bottom: 12px; }
.fp-wc26 .wc-viz-sub { color: var(--accent); }
.fp-wc26 .wc-fx-flag { font-size: 13px; line-height: 1; }

/* distribution bars */
.fp-wc26 .wc-dist { display: flex; flex-direction: column; gap: 12px; }
.fp-wc26 .wc-dist-row { display: grid; grid-template-columns: 110px 1fr 28px; align-items: center; gap: 8px; }
.fp-wc26 .wc-dist-lbl { display: flex; align-items: center; gap: 7px; font-family: var(--ox); font-weight: 700; font-size: 12px; color: var(--text); }
.fp-wc26 .wc-dist-bar { position: relative; height: 14px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%); display: flex; align-items: center; }
.fp-wc26 .wc-dist-bar span { display: block; height: 100%; clip-path: polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%); transform-origin: left; animation: wcGrow 0.7s ease forwards; }
.fp-wc26 .wc-dist-val { font-family: var(--ox); font-weight: 900; font-size: 16px; color: var(--primary); text-align: right; }
.fp-wc26 .wc-dist-foot { margin-top: 12px; font-family: var(--mono); font-size: 9.5px; letter-spacing: 1px; color: var(--text-muted); text-align: center; }
@keyframes wcGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

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
.fp-wc26 .wc-tz-note2 { font-size: 12px; line-height: 1.5; color: var(--text-dim); margin-bottom: 12px; }
.fp-wc26 .wc-tz-list { display: flex; flex-direction: column; gap: 7px; }
.fp-wc26 .wc-tz-item { display: flex; align-items: center; gap: 8px; background: var(--bg); border: 1px solid var(--stroke); border-left: 2px solid var(--accent); clip-path: polygon(0 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%); padding: 9px 10px; font-family: var(--mono); font-size: 10.5px; color: var(--text-dim); opacity: 0; animation: wcRise 0.45s ease forwards; }
.fp-wc26 .wc-tz-clock { color: var(--accent); font-size: 13px; }

/* phone */
.fp-wc26 .wc-viz-phone-wrap { display: flex; justify-content: center; background: none; border: none; clip-path: none; padding: 6px 0; }
.fp-wc26 .wc-viz-phone-wrap::after { display: none; }
.fp-wc26 .wc-phone { width: 200px; background: var(--bg); border: 2px solid var(--stroke-strong); border-radius: 22px; padding: 16px 12px 12px; position: relative; box-shadow: 0 0 30px rgba(33,226,140,0.18); }
.fp-wc26 .wc-phone-notch { position: absolute; top: 7px; left: 50%; transform: translateX(-50%); width: 56px; height: 5px; border-radius: 3px; background: var(--stroke-strong); }
.fp-wc26 .wc-phone-head { font-family: var(--ox); font-weight: 800; font-size: 10px; letter-spacing: 1px; color: var(--primary); text-align: center; margin: 6px 0 10px; }
.fp-wc26 .wc-phone-list { display: flex; flex-direction: column; gap: 6px; }
.fp-wc26 .wc-phone-row { display: flex; align-items: center; gap: 8px; background: var(--surface); border-left: 2px solid var(--primary); padding: 7px 9px; clip-path: polygon(0 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%); }
.fp-wc26 .wc-phone-date { font-family: var(--mono); font-size: 8px; color: var(--text-muted); white-space: nowrap; }
.fp-wc26 .wc-phone-evt { display: flex; align-items: center; gap: 5px; font-family: var(--ox); font-weight: 700; font-size: 10.5px; color: var(--text); }
.fp-wc26 .wc-phone-foot { display: flex; justify-content: center; gap: 12px; margin-top: 12px; font-size: 16px; }

@media (min-width: 860px) {
  .fp-wc26 .wc-split { grid-template-columns: 1.05fr 0.95fr; gap: 36px; }
  .fp-wc26 .wc-split.flip .wc-split-copy { order: 2; }
  .fp-wc26 .wc-split.flip .wc-split-visual { order: 1; }
  .fp-wc26 .wc-content-section { padding: 52px 0; }
  .fp-wc26 .wc-statement { padding: 56px 16px 48px; }
  .fp-wc26 .wc-h2 { font-size: 23px; }
  .fp-wc26 .wc-split-copy p { font-size: 15px; }
  .fp-wc26 .wc-viz { padding: 18px; }
}
`;
