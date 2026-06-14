/**
 * /quiniela-futbol-hoy — ES-only SEO landing, the TRANSACTIONAL page of the
 * "hoy" cluster (siblings: /pronosticos-futbol-hoy = predictions intent,
 * /quiniela-de-la-semana = informational/Progol intent).
 *
 * Keyword: "quiniela de futbol hoy". The searcher wants to PLAY today, so
 * the hero element is the OPEN POOL itself (dynamic next-open card front
 * and center), supported by today's matches (shared module) and the steps.
 * Everything baked (title/meta/H1/FAQ/JSON-LD) stays evergreen.
 *
 * Framing rules (playbook): no "gratis" claims (entry is paid), Progol
 * non-affiliation, 18+ disclaimer.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { WC_CSS } from './WorldCup2026Calendar';
import { LANDING_CSS, Statement, Split, setMeta, setCanonical, setJsonLd, useRevealOnScroll } from './WorldCup2026Landing';
import { useNextOpenPool } from './PronosticosFutbol';
import { useTodayFixtures, TodayMatchesVisual, PFH_CSS } from './PronosticosFutbolHoy';
import { quinielaHoyFaq, quinielaHoyJsonLd } from '../seo/quinielaHoy';
import { trackEvent } from '../lib/analytics';

const CANONICAL = 'https://futpools.com/quiniela-futbol-hoy';
const PAGE = 'quiniela-futbol-hoy';

function formatKickoff(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function QuinielaFutbolHoy() {
  useEffect(() => {
    document.title = 'Quiniela de fútbol hoy: juega y gana premios | FutPools';
    setMeta('description', 'Quiniela de fútbol hoy: entra a la quiniela con inscripción abierta, llena tus L, E o V con los partidos del día y compite por el premio antes del primer partido.');
    setCanonical(CANONICAL);
    setJsonLd('landing-jsonld', quinielaHoyJsonLd());
  }, []);

  const fixtures = useTodayFixtures();
  const pool = useNextOpenPool();
  useRevealOnScroll([fixtures, pool]);

  const ctaTo = pool ? `/pool/${pool.id}` : '/onboarding';
  const ctaLabel = pool ? 'Entrar a la quiniela de hoy' : 'Jugar mi quiniela';
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
      <style>{QH_CSS}</style>

      <nav className="wc-nav">
        <Link to="/" className="wc-logo">FUT<span>POOLS</span></Link>
        <div className="wc-nav-right">
          <Link to="/" className="wc-nav-home">Inicio</Link>
        </div>
      </nav>

      {/* Reverb layout: copy left, the OPEN POOL itself as the hero visual —
          this page's searcher wants to play TODAY, not read. */}
      <header className="wc-hero wc-hero-split">
        <div className="wc-grid-bg" />
        <div className="wc-hero-inner">
          <div className="wc-hero-copy">
            <div className="wc-kicker">◆ INSCRIPCIÓN ABIERTA · MÉXICO</div>
            <h1>Quiniela fútbol hoy</h1>
            <p className="wc-sub wc-lead">
              ¿Buscas una quiniela de fútbol hoy? Aquí está la quiniela con inscripción abierta:
              llena tus L/E/V con los partidos del día, paga tu entrada y compite por el premio.
              La inscripción cierra cuando inicia el primer partido.
            </p>
            <div className="wc-cta-row">{cta()}</div>
            <div className="wc-hero-stats">
              <div className="wc-stat"><div className="wc-stat-num">Hoy</div><div className="wc-stat-lab">Juega ya</div></div>
              <div className="wc-stat"><div className="wc-stat-num">L·E·V</div><div className="wc-stat-lab">Tus picks</div></div>
              <div className="wc-stat"><div className="wc-stat-num">En vivo</div><div className="wc-stat-lab">Aciertos</div></div>
              <div className="wc-stat"><div className="wc-stat-num">18+</div><div className="wc-stat-lab">México</div></div>
            </div>
          </div>
          <div className="wc-hero-visual">
            <HeroPoolVisual pool={pool} />
          </div>
        </div>
      </header>

      <main className="wc-main wc-content">

        <Statement kicker="ASÍ DE DIRECTO" title="Hoy hay fútbol. Hoy hay quiniela.">
          Una quiniela de fútbol hoy no necesita explicación: eliges quién gana en cada partido del
          día y compites contra los demás. El que más le atine se lleva el premio.
        </Statement>

        <Split title="Los partidos de hoy para tu quiniela" visual={<TodayMatchesVisual fixtures={fixtures} />}>
          <p>La lista se actualiza sola cada día con las ligas principales:</p>
          <ul className="wc-ul">
            <li>Revisa los partidos de hoy y sus horarios (hora de CDMX)</li>
            <li>Piensa tus L/E/V: forma reciente, localía y bajas confirmadas</li>
            <li>Entra a la quiniela abierta y registra tus picks</li>
          </ul>
          <p>
            ¿Quieres ver las probabilidades de cada partido? Revisa los{' '}
            <Link to="/pronosticos-futbol-hoy">pronósticos de fútbol de hoy</Link>.
          </p>
        </Split>

        <Statement kicker="ANTES DEL SILBATAZO" title="La inscripción cierra cuando rueda el balón.">
          Puedes entrar a la quiniela de hoy hasta que inicia su primer partido. Después, solo
          queda ver los aciertos sumar en vivo.
        </Statement>

        <Split flip title="Cómo jugar la quiniela de hoy" visual={<JoinStepsVisual />}>
          <p>De cero a competir, en minutos:</p>
          <ul className="wc-ul">
            <li>Crea tu cuenta (toma 1 minuto)</li>
            <li>Entra a la quiniela abierta y llena tus L/E/V</li>
            <li>Paga tu entrada: SPEI en México o PayPal en USD desde el extranjero</li>
            <li>Sigue tus aciertos en vivo y compite por el premio</li>
          </ul>
          <div className="wc-cta-row">{cta()}</div>
        </Split>

        <section className="wc-faq">
          <h2>Preguntas frecuentes</h2>
          <div className="wc-faq-grid">
            {quinielaHoyFaq().map(({ q, a }) => (
              <div className="wc-faq-item" key={q}>
                <div className="wc-faq-q">◆ {q}</div>
                <div className="wc-faq-a">{a}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="wc-cta">
          <div className="wc-cta-inner">
            <div className="wc-cta-kicker">◆ ¿HOY SÍ?</div>
            <h2 style={{ fontFamily: 'var(--ox)', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>
              Juega tu quiniela de fútbol hoy.
            </h2>
            <p>Llena tus L/E/V del día y compite antes del primer silbatazo.</p>
            <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
              {cta()}
              <Link to="/quiniela-liga-mexicana" className="wc-btn-secondary">Quiniela de la Liga MX →</Link>
              <Link to="/pronosticos-futbol-hoy" className="wc-btn-secondary">Pronósticos de hoy →</Link>
              <Link to="/quiniela-de-la-semana" className="wc-btn-secondary">¿Qué es una quiniela? →</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="wc-footer">
        <div>© 2026 FUTPOOLS · futpools.com</div>
        <div>FutPools es una plataforma de quinielas entre amigos. No está afiliada a Progol ni a Lotería Nacional. No es una casa de apuestas. Mayores de 18 años.</div>
        <div>Resultados oficiales en <a href="https://www.ligamx.net" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>el sitio de la Liga MX</a>.</div>
      </footer>
    </div>
  );
}

// ─────────────── Hero visual: the open pool itself ───────────────
// pool === null covers loading / no open pool / fetch error — the evergreen
// fallback keeps the hero valid for crawlers and quiet weeks.

function HeroPoolVisual({ pool }) {
  return (
    <div className="wc-viz wc-qh-hero" role="img" aria-label="La quiniela de hoy con inscripción abierta en FutPools.">
      {pool ? (
        <>
          <div className="wc-viz-head"><span>◆ QUINIELA DE HOY</span><span className="wc-viz-sub">● INSCRIPCIÓN ABIERTA</span></div>
          <div className="wc-qh-name">{pool.name}</div>
          <div className="wc-qh-meta">
            <div className="wc-qh-meta-row"><span>Primer partido</span><b>{formatKickoff(pool.firstKickoff)}</b></div>
            {pool.entriesCount > 0 && (
              <div className="wc-qh-meta-row"><span>Participantes</span><b>{pool.entriesCount}</b></div>
            )}
            {pool.entryFeeMXN > 0 && (
              <div className="wc-qh-meta-row"><span>Entrada</span><b>${pool.entryFeeMXN} {pool.currency || 'MXN'}</b></div>
            )}
          </div>
          <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
            <Link
              to={`/pool/${pool.id}`}
              className="wc-btn-primary"
              onClick={() => trackEvent('cta_click', { page: PAGE, cta: 'Entrar a la quiniela (hero)', destination: `/pool/${pool.id}` })}
            >▶ Entrar a la quiniela</Link>
          </div>
          <div className="wc-dist-foot">La inscripción cierra cuando inicia el primer partido</div>
        </>
      ) : (
        <>
          <div className="wc-viz-head"><span>◆ QUINIELAS PÚBLICAS</span></div>
          <div className="wc-qh-name">Cada semana se abren quinielas en FutPools</div>
          <div className="wc-qh-meta">
            <div className="wc-qh-meta-row"><span>Pronóstico</span><b>L · E · V por partido</b></div>
            <div className="wc-qh-meta-row"><span>Cierre</span><b>Al primer partido</b></div>
            <div className="wc-qh-meta-row"><span>Aciertos</span><b>En vivo</b></div>
          </div>
          <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
            <Link
              to="/onboarding"
              className="wc-btn-primary"
              onClick={() => trackEvent('cta_click', { page: PAGE, cta: 'Jugar mi quiniela (hero)', destination: '/onboarding' })}
            >▶ Jugar mi quiniela</Link>
          </div>
          <div className="wc-dist-foot">Crea tu cuenta y entérate cuando abra la siguiente</div>
        </>
      )}
    </div>
  );
}

// ─────────────── Steps visual (evergreen) ───────────────

function JoinStepsVisual() {
  const steps = ['Crea tu cuenta', 'Llena tus L · E · V', 'Paga tu entrada (SPEI o PayPal)', 'Compite por el premio'];
  return (
    <div className="wc-viz" role="img" aria-label="Cuatro pasos para jugar la quiniela de hoy en FutPools.">
      <div className="wc-viz-head"><span>◆ EN 4 PASOS</span></div>
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

const QH_CSS = `
/* hero pool card */
.fp-wc26 .wc-qh-hero { padding: 20px 20px 16px; text-align: center; }
.fp-wc26 .wc-qh-hero .wc-viz-sub { color: var(--primary); }
.fp-wc26 .wc-qh-name { font-family: var(--ox); font-weight: 900; font-size: clamp(18px, 3vw, 24px); color: var(--text); margin: 14px 0 12px; line-height: 1.2; }
.fp-wc26 .wc-qh-meta { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
.fp-wc26 .wc-qh-meta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; background: var(--bg); border: 1px solid var(--stroke); border-left: 2px solid var(--primary); clip-path: polygon(0 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%); padding: 9px 12px; opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-qh-meta-row:nth-child(2) { animation-delay: 120ms; }
.fp-wc26 .wc-qh-meta-row:nth-child(3) { animation-delay: 240ms; }
.fp-wc26 .wc-qh-meta-row span { font-family: var(--mono); font-size: 10px; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; }
.fp-wc26 .wc-qh-meta-row b { font-family: var(--ox); font-weight: 800; font-size: 13px; color: var(--text); text-align: right; }
`;
