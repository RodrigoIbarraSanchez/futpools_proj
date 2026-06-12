/**
 * /pronosticos-futbol-hoy — ES-only SEO landing (cluster child of
 * /pronosticos-de-futbol).
 *
 * Keyword: "pronosticos futbol hoy" (the "hoy" intent demands freshness).
 * The page stays evergreen in everything baked (title/meta/H1/FAQ/JSON-LD)
 * and satisfies the daily intent with a DYNAMIC "Partidos de hoy" module:
 * GET /public/fixtures/today (CDMX calendar day, priority leagues, 10-min
 * server cache). Crawlers that execute JS see fresh matches every visit;
 * if the fetch fails the module falls back to illustrative "ejemplo" rows,
 * so the page is never broken or empty.
 *
 * CTA: same dynamic next-open-pool logic as the pillar (deep link to the
 * pool still open for registration, fallback /onboarding).
 *
 * Framing rules (playbook): we never sell tips/picks — the visitor makes
 * their OWN pronósticos and competes. No "gratis" claims. 18+ disclaimer.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WC_CSS } from './WorldCup2026Calendar';
import { LANDING_CSS, Statement, Split, setMeta, setCanonical, setJsonLd, useRevealOnScroll } from './WorldCup2026Landing';
import { useNextOpenPool } from './PronosticosFutbol';
import { pronosticosHoyFaq, pronosticosHoyJsonLd } from '../seo/pronosticosHoy';
import { api } from '../api/client';
import { trackEvent } from '../lib/analytics';

const CANONICAL = 'https://futpools.com/pronosticos-futbol-hoy';
const PAGE = 'pronosticos-futbol-hoy';

function useTodayFixtures() {
  // null = loading/failed (render the evergreen fallback); [] = no matches
  // today; [...] = real fixtures.
  const [fixtures, setFixtures] = useState(null);
  useEffect(() => {
    let on = true;
    api.get('/public/fixtures/today?limit=6')
      .then((d) => { if (on) setFixtures(Array.isArray(d) ? d : null); })
      .catch(() => {});
    return () => { on = false; };
  }, []);
  return fixtures;
}

function kickoffTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function PronosticosFutbolHoy() {
  useEffect(() => {
    document.title = 'Pronósticos de fútbol hoy: partidos y quinielas | FutPools';
    setMeta('description', 'Pronósticos de fútbol hoy: consulta los partidos de hoy, elige L, E o V y pon tus pronósticos a competir en una quiniela de FutPools antes del primer partido.');
    setCanonical(CANONICAL);
    setJsonLd('landing-jsonld', pronosticosHoyJsonLd());
  }, []);

  const fixtures = useTodayFixtures();
  // Re-scan after the fixtures arrive: the prediction cards are .wc-viz
  // elements that don't exist on first mount.
  useRevealOnScroll([fixtures]);
  const pool = useNextOpenPool();
  const ctaTo = pool ? `/pool/${pool.id}` : '/onboarding';
  const ctaLabel = pool ? 'Jugar la quiniela de hoy' : 'Jugar mi quiniela';
  const cta = () => (
    <Link
      to={ctaTo}
      className="wc-btn-primary"
      onClick={() => trackEvent('cta_click', { page: PAGE, cta: ctaLabel, destination: ctaTo })}
    >▶ {ctaLabel}</Link>
  );

  return (
    <div className="fp-wc26">
      <style>{WC_CSS}</style>
      <style>{LANDING_CSS}</style>
      <style>{PFH_CSS}</style>

      <nav className="wc-nav">
        <Link to="/" className="wc-logo">FUT<span>POOLS</span></Link>
        <div className="wc-nav-right">
          <Link to="/" className="wc-nav-home">Inicio</Link>
        </div>
      </nav>

      {/* Reverb layout: copy left, dynamic today's-matches visual right. */}
      <header className="wc-hero wc-hero-split">
        <div className="wc-grid-bg" />
        <div className="wc-hero-inner">
          <div className="wc-hero-copy">
            <div className="wc-kicker">◆ PARTIDOS DE HOY · MÉXICO</div>
            <h1>Pronósticos de fútbol hoy</h1>
            <p className="wc-sub wc-lead">
              ¿Buscas pronósticos de fútbol hoy? Aquí tienes los partidos del día, actualizados
              automáticamente. Elige local, empate o visitante en cada uno, registra tus pronósticos
              en una quiniela de FutPools y compite con tus aciertos antes de que ruede el balón.
            </p>
            <div className="wc-cta-row">{cta()}</div>
            <div className="wc-hero-stats">
              <div className="wc-stat"><div className="wc-stat-num">Hoy</div><div className="wc-stat-lab">Partidos del día</div></div>
              <div className="wc-stat"><div className="wc-stat-num">L·E·V</div><div className="wc-stat-lab">Tu pronóstico</div></div>
              <div className="wc-stat"><div className="wc-stat-num">En vivo</div><div className="wc-stat-lab">Aciertos</div></div>
              <div className="wc-stat"><div className="wc-stat-num">18+</div><div className="wc-stat-lab">México</div></div>
            </div>
          </div>
          <div className="wc-hero-visual">
            <TodayMatchesVisual fixtures={fixtures} />
          </div>
        </div>
      </header>

      <main className="wc-main wc-content">

        <Statement kicker="LO DE HOY" title="Los partidos de hoy. Tus pronósticos.">
          Los pronósticos de fútbol de hoy tienen una ventaja sobre los de la semana: las alineaciones
          y las bajas ya están confirmadas. Revisa la lista, decide tus L/E/V y ponlos a competir.
        </Statement>

        <Split title="Cómo pronosticar los partidos de hoy" visual={<TodayStepsVisual />}>
          <p>Tres pasos antes del primer silbatazo del día:</p>
          <ul className="wc-ul">
            <li>Revisa los partidos de hoy en la lista de arriba</li>
            <li>Elige L, E o V en cada uno: forma reciente, localía y bajas confirmadas</li>
            <li>Registra tus pronósticos en una quiniela antes de que inicie el primer partido</li>
          </ul>
          <p>
            ¿Quieres afinar el criterio? Lee la <Link to="/pronosticos-de-futbol">guía completa de
            pronósticos de fútbol</Link>.
          </p>
        </Split>

        <TodayPredictionsSection fixtures={fixtures} />

        <TodayPoolCard pool={pool} />

        <Statement kicker="ANTES DEL SILBATAZO" title="La inscripción cierra cuando rueda el balón.">
          En FutPools puedes registrar tus pronósticos hasta que inicia el primer partido de la
          quiniela. Después, solo queda ver tus aciertos sumar en vivo.
        </Statement>

        <Split flip title="Pronósticos de hoy que sí compiten" visual={<DeadlineVisual />}>
          <p>Un pronóstico de hoy vale más cuando hay algo en juego:</p>
          <ul className="wc-ul">
            <li>Pagas tu entrada y registras tus L/E/V del día</li>
            <li>Cada acierto suma a tu marcador en vivo</li>
            <li>Comparas tu quiniela contra la de tus rivales</li>
            <li>Quien acierta más se lleva el premio</li>
          </ul>
          <div className="wc-cta-row">{cta()}</div>
        </Split>

        <section className="wc-faq">
          <h2>Preguntas frecuentes</h2>
          <div className="wc-faq-grid">
            {pronosticosHoyFaq().map(({ q, a }) => (
              <div className="wc-faq-item" key={q}>
                <div className="wc-faq-q">◆ {q}</div>
                <div className="wc-faq-a">{a}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="wc-cta">
          <div className="wc-cta-inner">
            <div className="wc-cta-kicker">◆ ¿LISTO PARA HOY?</div>
            <h2 style={{ fontFamily: 'var(--ox)', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>
              Haz tus pronósticos de hoy y compite.
            </h2>
            <p>Llena tus L/E/V del día y sigue tus aciertos en vivo.</p>
            <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
              {cta()}
              <Link to="/pronosticos-de-futbol" className="wc-btn-secondary">Guía de pronósticos de fútbol →</Link>
              <Link to="/quiniela-de-la-semana" className="wc-btn-secondary">Quiniela de la semana →</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="wc-footer">
        <div>© 2026 FUTPOOLS · futpools.com</div>
        <div>FutPools es una plataforma de quinielas entre amigos. No es una casa de apuestas ni vende pronósticos. Mayores de 18 años.</div>
      </footer>
    </div>
  );
}

// ─────────────── Dynamic today's matches (hero visual) ───────────────
// Real fixtures from /public/fixtures/today; the evergreen "ejemplo"
// fallback renders while loading / on error so the hero never looks broken.

function TodayMatchesVisual({ fixtures }) {
  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const live = (s) => s && s !== 'NS' && s !== 'TBD' && !['FT', 'AET', 'PEN'].includes(s);
  const finished = (s) => ['FT', 'AET', 'PEN'].includes(s);

  return (
    <div className="wc-viz wc-pfh-today" role="img" aria-label="Lista de los partidos de fútbol de hoy con hora local, lista para hacer tus pronósticos.">
      <div className="wc-viz-head"><span>◆ PARTIDOS DE HOY</span><span className="wc-viz-sub">{today}</span></div>

      {fixtures === null && (
        <>
          <div className="wc-pfh-list">
            {[
              { t: '13:00', m: 'Partido 1' }, { t: '17:00', m: 'Partido 2' }, { t: '19:00', m: 'Partido 3' },
            ].map((r, i) => (
              <div className="wc-pfh-row" key={i} style={{ animationDelay: `${i * 120}ms` }}>
                <span className="wc-pfh-time">{r.t}</span>
                <span className="wc-pfh-match">{r.m}</span>
                <span className="wc-pfh-league">EJEMPLO</span>
              </div>
            ))}
          </div>
          <div className="wc-dist-foot">Cargando los partidos de hoy…</div>
        </>
      )}

      {Array.isArray(fixtures) && fixtures.length > 0 && (
        <>
          <div className="wc-pfh-list">
            {fixtures.map((f, i) => (
              <div className="wc-pfh-row" key={f.fixtureId || i} style={{ animationDelay: `${i * 120}ms` }}>
                <span className="wc-pfh-time">
                  {live(f.status) ? <span className="wc-pfh-live">● VIVO</span>
                    : finished(f.status) ? 'FINAL'
                    : kickoffTime(f.date)}
                </span>
                <span className="wc-pfh-match">{f.teams?.home?.name} <b>vs</b> {f.teams?.away?.name}</span>
                <span className="wc-pfh-league">{f.league?.name}</span>
              </div>
            ))}
          </div>
          <div className="wc-dist-foot">Hora de Ciudad de México · se actualiza cada día</div>
        </>
      )}

      {Array.isArray(fixtures) && fixtures.length === 0 && (
        <>
          <div className="wc-pfh-empty">
            Hoy no hay partidos en las ligas principales. Aprovecha para armar tu quiniela
            de la próxima jornada.
          </div>
          <div className="wc-dist-foot">La lista se actualiza cada día</div>
        </>
      )}
    </div>
  );
}

// ─────────────── Dynamic statistical predictions ───────────────
// Real probabilities from the provider's /predictions model (via the same
// /public/fixtures/today payload). Renders NOTHING when no prediction is
// available, so the evergreen page is never broken. Always framed as
// orientative — never betting advice (see the disclaimer + FAQ).

function TodayPredictionsSection({ fixtures }) {
  const rows = Array.isArray(fixtures) ? fixtures.filter((f) => f.prediction) : [];
  if (rows.length === 0) return null;
  const cells = (p) => ([
    { k: 'L', pct: p.home },
    { k: 'E', pct: p.draw },
    { k: 'V', pct: p.away },
  ]);
  return (
    <section className="wc-pfh-pred">
      <h2>Pronóstico estadístico de los partidos de hoy</h2>
      <p className="wc-pfh-pred-sub">
        Probabilidades generadas automáticamente a partir de datos históricos del proveedor
        deportivo. Son orientativas: no son una recomendación ni asesoría de apuestas, y no
        garantizan ningún resultado. Tus picks los decides tú.
      </p>
      <div className="wc-pfh-pred-grid">
        {rows.map((f) => (
          <div className="wc-viz wc-pfh-pred-card" key={f.fixtureId}>
            <div className="wc-pfh-pred-match">
              {f.teams?.home?.name} <b>vs</b> {f.teams?.away?.name}
            </div>
            <div className="wc-pfh-pred-bars">
              {cells(f.prediction).map(({ k, pct }) => (
                <div className={`wc-pfh-pred-row ${f.prediction.pick === k ? 'on' : ''}`} key={k}>
                  <span className="wc-pfh-pred-k">{k}</span>
                  <span className="wc-pfh-pred-bar"><span style={{ width: `${Math.min(pct, 100)}%` }} /></span>
                  <span className="wc-pfh-pred-pct">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="wc-pfh-pred-foot">◆ Pronóstico estadístico orientativo · no garantiza aciertos · 18+</div>
    </section>
  );
}

// ─────────────── Dynamic "quiniela de hoy" card ───────────────

function TodayPoolCard({ pool }) {
  return (
    <section className="wc-pf-next">
      {pool ? (
        <div className="wc-viz wc-pf-next-card">
          <div className="wc-viz-head"><span>◆ QUINIELA ABIERTA HOY</span><span className="wc-viz-sub">Inscripción abierta</span></div>
          <div className="wc-pf-next-name">{pool.name}</div>
          <div className="wc-pf-next-meta">
            {pool.entriesCount > 0 && <span>{pool.entriesCount} {pool.entriesCount === 1 ? 'participante' : 'participantes'}</span>}
            {pool.entryFeeMXN > 0 && <span>${pool.entryFeeMXN} {pool.currency || 'MXN'} / entrada</span>}
          </div>
          <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
            <Link
              to={`/pool/${pool.id}`}
              className="wc-btn-primary"
              onClick={() => trackEvent('cta_click', { page: PAGE, cta: 'Entrar a la quiniela (tarjeta)', destination: `/pool/${pool.id}` })}
            >▶ Entrar a la quiniela</Link>
          </div>
          <div className="wc-dist-foot">La inscripción cierra cuando inicia el primer partido</div>
        </div>
      ) : (
        <div className="wc-viz wc-pf-next-card">
          <div className="wc-viz-head"><span>◆ QUINIELAS PÚBLICAS</span></div>
          <div className="wc-pf-next-name">Cada semana se abren quinielas en FutPools</div>
          <div className="wc-pf-next-meta">
            <span>Crea tu cuenta y entérate cuando abra la siguiente, o arma una quiniela con tus amigos.</span>
          </div>
          <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
            <Link
              to="/onboarding"
              className="wc-btn-primary"
              onClick={() => trackEvent('cta_click', { page: PAGE, cta: 'Jugar mi quiniela (tarjeta)', destination: '/onboarding' })}
            >▶ Jugar mi quiniela</Link>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────── Static visuals (evergreen, illustrative) ───────────────

function TodayStepsVisual() {
  const steps = ['Revisa los partidos de hoy', 'Elige L, E o V en cada uno', 'Regístralos antes del primer partido'];
  return (
    <div className="wc-viz" role="img" aria-label="Tres pasos para hacer tus pronósticos de los partidos de hoy.">
      <div className="wc-viz-head"><span>◆ HOY, EN 3 PASOS</span></div>
      <div className="wc-pfh-steps">
        {steps.map((s, i) => (
          <div className="wc-pfh-step" key={i} style={{ animationDelay: `${i * 130}ms` }}>
            <span className="wc-pfh-step-n">{i + 1}</span>
            <span className="wc-pfh-step-t">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeadlineVisual() {
  const nodes = [
    { t: 'AHORA', d: 'Eliges tus L·E·V', on: true },
    { t: 'ANTES DEL PARTIDO', d: 'Registras tu quiniela', on: true },
    { t: 'PRIMER SILBATAZO', d: 'Cierra la inscripción', on: false },
  ];
  return (
    <div className="wc-viz" role="img" aria-label="Línea de tiempo: eliges tus pronósticos y los registras antes del primer partido, cuando cierra la inscripción.">
      <div className="wc-viz-head"><span>◆ EL RELOJ DE HOY</span></div>
      <div className="wc-pfh-steps">
        {nodes.map((n, i) => (
          <div className={`wc-pfh-step ${n.on ? '' : 'off'}`} key={i} style={{ animationDelay: `${i * 130}ms` }}>
            <span className="wc-pfh-step-n">{i + 1}</span>
            <span className="wc-pfh-step-t"><b>{n.t}</b> · {n.d}</span>
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">Después del silbatazo ya no puedes cambiar tus picks</div>
    </div>
  );
}

const PFH_CSS = `
/* today's matches list (hero visual) */
.fp-wc26 .wc-pfh-today { padding: 18px 18px 16px; }
.fp-wc26 .wc-pfh-list { display: flex; flex-direction: column; gap: 7px; }
.fp-wc26 .wc-pfh-row { display: grid; grid-template-columns: 64px 1fr auto; gap: 10px; align-items: center; background: var(--bg); border: 1px solid var(--stroke); border-left: 2px solid var(--primary); clip-path: polygon(0 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); padding: 10px 12px; opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-pfh-time { font-family: var(--ox); font-weight: 800; font-size: 12px; color: var(--accent); white-space: nowrap; }
.fp-wc26 .wc-pfh-live { color: var(--primary); font-size: 10px; letter-spacing: 1px; text-shadow: 0 0 8px rgba(33,226,140,0.6); }
.fp-wc26 .wc-pfh-match { font-size: 12.5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-wc26 .wc-pfh-match b { color: var(--primary); font-family: var(--ox); font-size: 10px; }
.fp-wc26 .wc-pfh-league { font-family: var(--mono); font-size: 8.5px; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; white-space: nowrap; }
.fp-wc26 .wc-pfh-empty { font-size: 13px; color: var(--text-dim); line-height: 1.6; padding: 14px 4px; }
.fp-wc26 .wc-pfh-today .wc-viz-sub { color: var(--primary); text-transform: capitalize; }

/* steps / timeline */
.fp-wc26 .wc-pfh-steps { display: flex; flex-direction: column; gap: 8px; }
.fp-wc26 .wc-pfh-step { display: flex; align-items: center; gap: 10px; background: var(--bg); border: 1px solid var(--stroke); border-left: 2px solid var(--primary); clip-path: polygon(0 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%); padding: 10px 12px; opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-pfh-step.off { border-left-color: var(--stroke-strong); }
.fp-wc26 .wc-pfh-step.off .wc-pfh-step-n { background: var(--stroke-strong); box-shadow: none; }
.fp-wc26 .wc-pfh-step-n { width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; background: var(--primary); color: var(--fp-on-primary); font-family: var(--ox); font-weight: 900; font-size: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(33,226,140,0.45); }
.fp-wc26 .wc-pfh-step-t { font-size: 12.5px; color: var(--text-dim); }
.fp-wc26 .wc-pfh-step-t b { color: var(--text); font-family: var(--mono); font-size: 10px; letter-spacing: 1px; }

/* statistical predictions section */
.fp-wc26 .wc-pfh-pred { margin: 34px auto; max-width: 880px; text-align: center; padding: 0 16px; }
.fp-wc26 .wc-pfh-pred h2 { font-family: var(--ox); font-weight: 900; font-size: clamp(20px, 4.5vw, 26px); margin: 0 0 10px; color: var(--text); }
.fp-wc26 .wc-pfh-pred-sub { font-size: 13px; line-height: 1.6; color: var(--text-muted); max-width: 640px; margin: 0 auto 22px; }
.fp-wc26 .wc-pfh-pred-grid { display: grid; grid-template-columns: 1fr; gap: 14px; text-align: left; }
@media (min-width: 720px) { .fp-wc26 .wc-pfh-pred-grid { grid-template-columns: repeat(2, 1fr); } }
.fp-wc26 .wc-pfh-pred-card { padding: 16px; }
.fp-wc26 .wc-pfh-pred-match { font-family: var(--ox); font-weight: 800; font-size: 14px; color: var(--text); margin-bottom: 10px; }
.fp-wc26 .wc-pfh-pred-match b { color: var(--primary); font-size: 11px; }
.fp-wc26 .wc-pfh-pred-bars { display: flex; flex-direction: column; gap: 7px; }
.fp-wc26 .wc-pfh-pred-row { display: grid; grid-template-columns: 22px 1fr 42px; gap: 9px; align-items: center; }
.fp-wc26 .wc-pfh-pred-k { font-family: var(--ox); font-weight: 800; font-size: 12px; color: var(--text-muted); text-align: center; }
.fp-wc26 .wc-pfh-pred-row.on .wc-pfh-pred-k { color: var(--primary); }
.fp-wc26 .wc-pfh-pred-bar { height: 8px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%); }
.fp-wc26 .wc-pfh-pred-bar span { display: block; height: 100%; background: var(--accent); transform-origin: left; animation: wcGrow 1.1s ease both; }
.fp-wc26 .wc-pfh-pred-row.on .wc-pfh-pred-bar span { background: var(--primary); box-shadow: 0 0 8px rgba(33,226,140,0.5); }
.fp-wc26 .wc-pfh-pred-pct { font-family: var(--ox); font-weight: 800; font-size: 12px; color: var(--text-dim); text-align: right; }
.fp-wc26 .wc-pfh-pred-row.on .wc-pfh-pred-pct { color: var(--primary); }
.fp-wc26 .wc-pfh-pred-foot { font-family: var(--mono); font-size: 10px; letter-spacing: 1px; color: var(--text-muted); margin-top: 16px; }

/* next-pool card styles are shared with the pillar page (wc-pf-next-*) */
.fp-wc26 .wc-pf-next { margin: 34px 0; display: flex; justify-content: center; }
.fp-wc26 .wc-pf-next-card { max-width: 520px; width: 100%; text-align: center; }
.fp-wc26 .wc-pf-next-name { font-family: var(--ox); font-weight: 800; font-size: 19px; color: var(--text); margin: 10px 0 6px; }
.fp-wc26 .wc-pf-next-meta { display: flex; flex-direction: column; gap: 3px; font-family: var(--mono); font-size: 11px; color: var(--text-dim); margin-bottom: 12px; }
`;
