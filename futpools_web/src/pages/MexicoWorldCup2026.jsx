/**
 * /mexico-mundial-2026 (ES) · /mexico-world-cup-2026 (EN)
 *
 * Team landing (topic-cluster child of the WC26 calendar landing) targeting
 * "partidos de México en el Mundial 2026" / "Mexico at the World Cup 2026".
 * Same playbook as WorldCup2026Landing — reuses its shared primitives
 * (Statement/Split/LANDING_CSS/head helpers + WC_CSS) and adds Mexico-only
 * visuals. CTA deep-links to the calendar tool pre-filtered to Mexico.
 *
 * All data verified (FIFA/ESPN) — see src/seo/mexicoWc26.js. No invented
 * fixtures. Bilingual ES/EN (both URLs indexed in Search Console).
 */

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { WC_CSS } from './WorldCup2026Calendar';
import { LANDING_CSS, Statement, Split, setMeta, setCanonical, setJsonLd, useRevealOnScroll } from './WorldCup2026Landing';
import { mexicoFaq, mexicoJsonLd, MX_MATCHES, MX_GROUP } from '../seo/mexicoWc26';
import { trackEvent } from '../lib/analytics';

const ORIGIN = 'https://futpools.com';

export function MexicoWorldCup2026() {
  const { locale, setLocale } = useLocale();
  const c = (es, en) => (locale === 'es' ? es : en);
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname.toLowerCase();
    if (path.startsWith('/mexico-mundial-2026') && locale !== 'es') setLocale('es');
    else if (path.startsWith('/mexico-world-cup-2026') && locale !== 'en') setLocale('en');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const landingPath = locale === 'es' ? '/mexico-mundial-2026' : '/mexico-world-cup-2026';
  const calendarPath = locale === 'es' ? '/calendario-mundial-2026' : '/world-cup-2026-calendar';
  // CTA → the shared calendar tool, pre-filtered to Mexico.
  const toolPath = (locale === 'es' ? '/calendario-mundial-2026/agregar' : '/world-cup-2026-calendar/add') + '?team=mexico';
  const canonical = ORIGIN + landingPath;

  useEffect(() => {
    document.title = c(
      'Partidos de México en el Mundial 2026: fechas y horarios | FutPools',
      'Mexico at the World Cup 2026: Matches, Dates & Times | FutPools'
    );
    setMeta('description', c(
      'Todos los partidos de México en el Mundial 2026: Grupo A vs Sudáfrica, Corea del Sur y Chequia. Fechas, sedes y horarios. Añádelos a tu calendario gratis.',
      'All of Mexico’s World Cup 2026 matches: Group A vs South Africa, South Korea and Czechia. Dates, venues and times. Add them to your calendar free.'
    ));
    setCanonical(canonical);
    setJsonLd('landing-jsonld', mexicoJsonLd(locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Resolve bilingual data to the active locale.
  const matches = MX_MATCHES.map((m) => ({ date: c(m.date.es, m.date.en), opp: c(m.opp.es, m.opp.en), flag: m.flag, venue: c(m.venue.es, m.venue.en), timeLocal: m.timeLocal, tag: c(m.tag.es, m.tag.en) }));
  const group = MX_GROUP.map((t) => ({ name: c(t.name.es, t.name.en), flag: t.flag, host: !!t.host }));

  useRevealOnScroll();

  const ctaTool = (label) => (
    <Link
      to={toolPath}
      className="wc-btn-primary"
      onClick={() => trackEvent('cta_click', { page: landingPath, cta: label, destination: toolPath })}
    >▶ {label}</Link>
  );

  return (
    <div className="fp-wc26">
      <style>{WC_CSS}</style>
      <style>{LANDING_CSS}</style>
      <style>{MX_CSS}</style>

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

      {/* Reverb layout: copy left, visual right (above the fold). */}
      <header className="wc-hero wc-hero-split">
        <div className="wc-grid-bg" />
        <div className="wc-hero-inner">
          <div className="wc-hero-copy">
            <div className="wc-kicker">◆ {c('EL TRI · MUNDIAL 2026', 'EL TRI · WORLD CUP 2026')}</div>
            <h1>{c('Partidos de México en el Mundial 2026', 'Mexico at the World Cup 2026')}</h1>
            <p className="wc-sub wc-lead">
              {c(
                'México Mundial 2026: estos son los partidos de la Selección. El Tri inaugura el torneo en el Estadio Azteca el 11 de junio y juega su fase de grupos (Grupo A) en Ciudad de México y Guadalajara. Añade los 3 partidos de México a tu calendario en segundos, gratis.',
                'Mexico World Cup 2026: these are El Tri’s matches. Mexico opens the tournament at Estadio Azteca on June 11 and plays its group stage (Group A) in Mexico City and Guadalajara. Add Mexico’s 3 matches to your calendar in seconds, free.'
              )}
            </p>
            <div className="wc-cta-row">{ctaTool(c('Añadir los partidos de México', 'Add Mexico’s matches'))}</div>
            <div className="wc-hero-stats">
              <div className="wc-stat"><div className="wc-stat-num">3</div><div className="wc-stat-lab">{c('Partidos', 'Matches')}</div></div>
              <div className="wc-stat"><div className="wc-stat-num">A</div><div className="wc-stat-lab">{c('Grupo', 'Group')}</div></div>
              <div className="wc-stat"><div className="wc-stat-num">2</div><div className="wc-stat-lab">{c('Sedes', 'Venues')}</div></div>
              <div className="wc-stat"><div className="wc-stat-num">11</div><div className="wc-stat-lab">{c('Jun · inaugura', 'Jun · opener')}</div></div>
            </div>
          </div>
          <div className="wc-hero-visual">
            <MexPhoneVisual c={c} matches={matches} />
          </div>
        </div>
      </header>

      <main className="wc-main wc-content">

        <Statement kicker={c('GRUPO A · 11–24 JUNIO 2026', 'GROUP A · JUNE 11–24, 2026')} title={c('El Tri juega en casa', 'El Tri plays at home')}>
          {c(
            'México inaugura el Mundial 2026 en el Estadio Azteca y disputa su fase de grupos en territorio mexicano. Estos son sus 3 partidos y cómo no perderte ninguno.',
            'Mexico opens the World Cup 2026 at Estadio Azteca and plays its group stage on home soil. Here are its 3 matches and how not to miss a single one.'
          )}
        </Statement>

        <Split title={c('El calendario de México en el Mundial 2026', 'Mexico’s World Cup 2026 schedule')} visual={<MatchesVisual c={c} matches={matches} />}>
          <p>{c('México juega 3 partidos en la fase de grupos del Grupo A:', 'Mexico plays 3 matches in the Group A stage:')}</p>
          <ul className="wc-ul">
            <li>{c('11 jun · México vs Sudáfrica · Estadio Azteca (CDMX) · partido inaugural', 'Jun 11 · Mexico vs South Africa · Estadio Azteca (Mexico City) · opening match')}</li>
            <li>{c('18 jun · México vs Corea del Sur · Estadio Akron (Guadalajara)', 'Jun 18 · Mexico vs South Korea · Estadio Akron (Guadalajara)')}</li>
            <li>{c('24 jun · México vs Chequia · Estadio Azteca (CDMX)', 'Jun 24 · Mexico vs Czechia · Estadio Azteca (Mexico City)')}</li>
          </ul>
        </Split>

        <Split flip title={c('El Grupo A de México', 'Mexico’s Group A')} visual={<GroupVisual c={c} group={group} />}>
          <p>{c('México comparte el Grupo A con tres selecciones. Los dos mejores avanzan a la ronda de 32.', 'Mexico shares Group A with three teams. The top two advance to the round of 32.')}</p>
          <ul className="wc-ul">
            <li>🇲🇽 {c('México (anfitrión)', 'Mexico (host)')}</li>
            <li>🇿🇦 {c('Sudáfrica', 'South Africa')}</li>
            <li>🇰🇷 {c('Corea del Sur', 'South Korea')}</li>
            <li>🇨🇿 {c('Chequia', 'Czechia')}</li>
          </ul>
        </Split>

        <Statement kicker={c('SIN COSTO', 'NO COST')} title={c('Gratis. Sin app. Sin registro.', 'Free. No app. No sign-up.')}>
          {c(
            'Añade los partidos del Tri a tu iPhone, Google Calendar, Android u Outlook. Si la FIFA mueve un horario, tu calendario se actualiza solo.',
            'Add El Tri’s matches to iPhone, Google Calendar, Android or Outlook. If FIFA moves a kickoff, your calendar updates automatically.'
          )}
        </Statement>

        <Split title={c('Dónde juega México: Azteca y Akron', 'Where Mexico plays: Azteca and Akron')} visual={<VenuesVisual c={c} />}>
          <p>{c('México juega sus partidos de grupos en dos estadios:', 'Mexico plays its group matches in two stadiums:')}</p>
          <ul className="wc-ul">
            <li>{c('Estadio Azteca (Ciudad de México): inauguración y el partido vs Chequia', 'Estadio Azteca (Mexico City): the opener and the match vs Czechia')}</li>
            <li>{c('Estadio Akron (Guadalajara): el partido vs Corea del Sur', 'Estadio Akron (Guadalajara): the match vs South Korea')}</li>
            <li>{c('El Azteca será el primer estadio en albergar 3 Mundiales (1970, 1986 y 2026)', 'The Azteca will be the first stadium to host 3 World Cups (1970, 1986 and 2026)')}</li>
          </ul>
        </Split>

        <Split flip title={c('Horarios de México en tu país', 'Mexico’s kickoff times in your country')} visual={<TimezoneVisual c={c} />}>
          <p>{c('La herramienta muestra cada partido de México en TU zona horaria, y tu calendario lo ajusta automáticamente.', 'The tool shows each Mexico match in YOUR timezone, and your calendar adjusts it automatically.')}</p>
          <ul className="wc-ul">
            <li>{c('México: CDMX, Norte y Pacífico', 'Mexico: Central, North and Pacific')}</li>
            <li>{c('EE.UU.: Este, Centro, Montaña y Pacífico', 'USA: Eastern, Central, Mountain and Pacific')}</li>
            <li>{c('Latinoamérica y Europa (España y Reino Unido)', 'Latin America and Europe (Spain and the UK)')}</li>
          </ul>
        </Split>

        <Split title={c('Cómo añadir los partidos de México a tu calendario', 'How to add Mexico’s matches to your calendar')} visual={<MexPhoneVisual c={c} matches={matches} />}>
          <p>{c('En 3 pasos, sin instalar nada:', 'In 3 steps, with nothing to install:')}</p>
          <ul className="wc-ul">
            <li>{c('1. Toca el botón: la herramienta abre con México ya seleccionado.', '1. Tap the button: the tool opens with Mexico already selected.')}</li>
            <li>{c('2. Elige tu zona horaria.', '2. Pick your timezone.')}</li>
            <li>{c('3. Suscríbete en iPhone, Google Calendar o Android, o descarga el .ics.', '3. Subscribe on iPhone, Google Calendar or Android, or download the .ics.')}</li>
          </ul>
          <div className="wc-cta-row">{ctaTool(c('Añadir los partidos de México', 'Add Mexico’s matches'))}</div>
        </Split>

        <Statement kicker={c('VAMOS MÉXICO', 'GO MEXICO')} title={c('Sigue al Tri en cada partido', 'Follow El Tri in every match')}>
          {c('Desde el silbatazo inicial en el Azteca hasta donde llegue el sueño mundialista.', 'From the opening whistle at the Azteca to wherever the World Cup dream goes.')}
        </Statement>

        <section className="wc-faq">
          <h2>{c('Preguntas frecuentes', 'Frequently asked questions')}</h2>
          <div className="wc-faq-grid">
            {mexicoFaq(locale).map(({ q, a }) => (
              <div className="wc-faq-item" key={q}>
                <div className="wc-faq-q">◆ {q}</div>
                <div className="wc-faq-a">{a}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="wc-cta">
          <div className="wc-cta-inner">
            <div className="wc-cta-kicker">◆ {c('¿LISTO PARA EL MUNDIAL?', 'READY FOR THE WORLD CUP?')}</div>
            <h2 style={{ fontFamily: 'var(--ox)', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>
              {c('No te pierdas un partido de México.', 'Don’t miss a Mexico match.')}
            </h2>
            <p>{c(
              '¿Quieres TODOS los partidos del Mundial, no sólo los de México? Mira el calendario completo.',
              'Want EVERY World Cup match, not just Mexico’s? See the full calendar.'
            )}</p>
            <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
              {ctaTool(c('Añadir los partidos de México', 'Add Mexico’s matches'))}
              <Link to={calendarPath} className="wc-btn-secondary">{c('Calendario completo del Mundial', 'Full World Cup calendar')} →</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="wc-footer">
        <div>© 2026 FUTPOOLS · futpools.com</div>
        <div>{c('Calendario oficial en ', 'Official schedule on ')}<a href="https://www.fifa.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>FIFA.com</a>{c(' · datos vía API-Football', ' · data via API-Football')}</div>
      </footer>
    </div>
  );
}

// ─────────────── Mexico-only visuals ───────────────

function MatchesVisual({ c, matches }) {
  return (
    <div className="wc-viz" role="img" aria-label={c('Los 3 partidos de México en el Mundial 2026: vs Sudáfrica (11 jun, Azteca), vs Corea del Sur (18 jun, Akron) y vs Chequia (24 jun, Azteca).', 'Mexico’s 3 World Cup 2026 matches: vs South Africa (Jun 11, Azteca), vs South Korea (Jun 18, Akron) and vs Czechia (Jun 24, Azteca).')}>
      <div className="wc-viz-head"><span>◆ {c('PARTIDOS DE MÉXICO', 'MEXICO MATCHES')}</span><span className="wc-viz-sub">{c('Grupo A', 'Group A')}</span></div>
      <div className="wc-mx-fx">
        {matches.map((m, i) => (
          <div className="wc-mx-fx-row" key={i} style={{ animationDelay: `${i * 140}ms` }}>
            <div className="wc-mx-fx-top">
              <span className="wc-mx-fx-date">{m.date} · {m.timeLocal}</span>
              <span className="wc-mx-fx-tag">{m.tag}</span>
            </div>
            <div className="wc-mx-fx-match"><span className="wc-fx-flag">🇲🇽</span> México <b>vs</b> {m.opp} <span className="wc-fx-flag">{m.flag}</span></div>
            <div className="wc-mx-fx-venue">📍 {m.venue}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupVisual({ c, group }) {
  return (
    <div className="wc-viz" role="img" aria-label={c('Grupo A del Mundial 2026: México (anfitrión), Sudáfrica, Corea del Sur y Chequia.', 'World Cup 2026 Group A: Mexico (host), South Africa, South Korea and Czechia.')}>
      <div className="wc-viz-head"><span>◆ {c('GRUPO A', 'GROUP A')}</span></div>
      <div className="wc-mx-group">
        {group.map((t, i) => (
          <div className={`wc-mx-group-row ${t.host ? 'host' : ''}`} key={i} style={{ animationDelay: `${i * 120}ms` }}>
            <span className="wc-mx-group-pos">{i + 1}</span>
            <span className="wc-fx-flag">{t.flag}</span>
            <span className="wc-mx-group-name">{t.name}</span>
            {t.host && <span className="wc-mx-group-host">{c('ANFITRIÓN', 'HOST')}</span>}
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">{c('Los 2 mejores avanzan a la ronda de 32', 'Top 2 advance to the round of 32')}</div>
    </div>
  );
}

function VenuesVisual({ c }) {
  return (
    <div className="wc-viz" role="img" aria-label={c('Sedes de México: Estadio Azteca (Ciudad de México) y Estadio Akron (Guadalajara).', 'Mexico venues: Estadio Azteca (Mexico City) and Estadio Akron (Guadalajara).')}>
      <div className="wc-viz-head"><span>◆ {c('SEDES DE MÉXICO', 'MEXICO VENUES')}</span></div>
      <div className="wc-mx-venues">
        <div className="wc-mx-venue">
          <div className="wc-mx-venue-name">🏟️ Estadio Azteca</div>
          <div className="wc-mx-venue-city">{c('Ciudad de México', 'Mexico City')}</div>
          <div className="wc-mx-venue-note">{c('Inauguración + vs Chequia', 'Opener + vs Czechia')}</div>
        </div>
        <div className="wc-mx-venue">
          <div className="wc-mx-venue-name">🏟️ Estadio Akron</div>
          <div className="wc-mx-venue-city">{c('Guadalajara', 'Guadalajara')}</div>
          <div className="wc-mx-venue-note">{c('vs Corea del Sur', 'vs South Korea')}</div>
        </div>
      </div>
      <div className="wc-dist-foot">{c('El Azteca: 1er estadio en 3 Mundiales · 1970 · 1986 · 2026', 'The Azteca: 1st stadium at 3 World Cups · 1970 · 1986 · 2026')}</div>
    </div>
  );
}

function TimezoneVisual({ c }) {
  const zs = [
    c('México · CDMX, Norte y Pacífico', 'Mexico · Central, North & Pacific'),
    c('EE.UU. · Este, Centro, Montaña, Pacífico', 'USA · Eastern, Central, Mountain, Pacific'),
    c('Latinoamérica · ARG · BRA · COL · PER · CHI', 'Latin America · ARG · BRA · COL · PER · CHI'),
    c('Europa · España y Reino Unido', 'Europe · Spain & UK'),
  ];
  return (
    <div className="wc-viz" role="img" aria-label={c('Los partidos de México se muestran en tu zona horaria automáticamente.', 'Mexico’s matches show in your timezone automatically.')}>
      <div className="wc-viz-head"><span>◆ {c('TU ZONA · AUTOMÁTICO', 'YOUR ZONE · AUTOMATIC')}</span></div>
      <div className="wc-tz-note2">{c('Cada partido de México se muestra en tu hora local, sin convertir nada.', 'Every Mexico match shows in your local time, with no manual conversion.')}</div>
      <div className="wc-tz-list">
        {zs.map((z, i) => (
          <div className="wc-tz-item" key={i} style={{ animationDelay: `${i * 120}ms` }}><span className="wc-tz-clock">◷</span>{z}</div>
        ))}
      </div>
    </div>
  );
}

function MexPhoneVisual({ c, matches }) {
  const short = { 'Sudáfrica': 'RSA', 'South Africa': 'RSA', 'Corea del Sur': 'KOR', 'South Korea': 'KOR', 'Chequia': 'CZE', 'Czechia': 'CZE' };
  return (
    <div className="wc-viz wc-viz-phone-wrap" role="img" aria-label={c('Un teléfono con los partidos de México añadidos al calendario.', 'A phone with Mexico’s matches added to the calendar.')}>
      <div className="wc-phone">
        <div className="wc-phone-notch" />
        <div className="wc-phone-head">{c('MÉXICO · MUNDIAL 2026', 'MEXICO · WORLD CUP 2026')}</div>
        <div className="wc-phone-list">
          {matches.map((m, i) => (
            <div className="wc-phone-row" key={i} style={{ animationDelay: `${i * 130}ms` }}>
              <span className="wc-phone-date">{m.date}</span>
              <span className="wc-phone-evt"><span className="wc-fx-flag">🇲🇽</span>MEX – {short[m.opp] || m.opp}</span>
            </div>
          ))}
        </div>
        <div className="wc-phone-foot"><span>📱</span><span>📅</span><span>🤖</span><span>💻</span></div>
      </div>
    </div>
  );
}

const MX_CSS = `
/* Mexico matches */
.fp-wc26 .wc-mx-fx { display: flex; flex-direction: column; gap: 8px; }
.fp-wc26 .wc-mx-fx-row { background: var(--bg); border: 1px solid var(--stroke); border-left: 2px solid var(--primary); clip-path: polygon(0 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); padding: 9px 11px; }
.fp-wc26 .wc-mx-fx-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.fp-wc26 .wc-mx-fx-date { font-family: var(--mono); font-size: 9px; letter-spacing: 0.5px; color: var(--accent); }
.fp-wc26 .wc-mx-fx-tag { font-family: var(--mono); font-size: 7.5px; font-weight: 800; letter-spacing: 0.5px; color: var(--primary); }
.fp-wc26 .wc-mx-fx-match { font-family: var(--ox); font-weight: 800; font-size: 13px; color: var(--text); display: flex; align-items: center; gap: 5px; }
.fp-wc26 .wc-mx-fx-match b { color: var(--text-muted); font-weight: 700; font-size: 10px; }
.fp-wc26 .wc-mx-fx-venue { font-family: var(--mono); font-size: 9px; color: var(--text-muted); margin-top: 4px; }

/* Mexico group */
.fp-wc26 .wc-mx-group { display: flex; flex-direction: column; gap: 6px; }
.fp-wc26 .wc-mx-group-row { display: flex; align-items: center; gap: 9px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%); padding: 9px 11px; }
.fp-wc26 .wc-mx-group-row.host { border-color: var(--primary); background: rgba(33,226,140,0.06); }
.fp-wc26 .wc-mx-group-pos { font-family: var(--ox); font-weight: 900; font-size: 12px; color: var(--text-muted); width: 14px; }
.fp-wc26 .wc-mx-group-name { font-family: var(--ox); font-weight: 700; font-size: 13px; color: var(--text); flex: 1; }
.fp-wc26 .wc-mx-group-host { font-family: var(--mono); font-size: 7.5px; font-weight: 800; letter-spacing: 0.5px; color: var(--fp-on-primary); background: var(--primary); padding: 3px 6px; clip-path: polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%); }

/* Mexico venues */
.fp-wc26 .wc-mx-venues { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.fp-wc26 .wc-mx-venue { background: var(--bg); border: 1px solid var(--stroke); clip-path: var(--hud-clip-sm); padding: 11px 10px; }
.fp-wc26 .wc-mx-venue-name { font-family: var(--ox); font-weight: 800; font-size: 12px; color: var(--text); }
.fp-wc26 .wc-mx-venue-city { font-family: var(--mono); font-size: 9px; color: var(--accent); margin: 3px 0; }
.fp-wc26 .wc-mx-venue-note { font-size: 10px; color: var(--text-dim); line-height: 1.3; }

/* reveal: every visual element animates in (scroll-triggered) */
.fp-wc26 .wc-mx-fx-row, .fp-wc26 .wc-mx-group-row, .fp-wc26 .wc-mx-venue { opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-mx-venue:nth-child(2) { animation-delay: 160ms; }
`;
