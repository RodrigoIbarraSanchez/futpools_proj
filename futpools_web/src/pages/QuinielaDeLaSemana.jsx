/**
 * /quiniela-de-la-semana — ES-only evergreen SEO landing.
 *
 * Keywords: "quiniela de la semana" (primary), "progol quiniela de la semana"
 * (secondary), "progol quiniela posible" (third). Informational/evergreen —
 * explains how the weekly Progol quiniela works (14 matches + Revancha,
 * L/E/V) and what the "quiniela posible" is, then funnels to FutPools.
 * No week-specific matches (those change every jornada). CTA → /onboarding.
 *
 * Reuses the shared landing primitives (Statement/Split/LANDING_CSS + head
 * helpers) and WC_CSS. FutPools is independent — not affiliated with Progol
 * / Lotería Nacional (stated in the FAQ + footer).
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { WC_CSS } from './WorldCup2026Calendar';
import { LANDING_CSS, Statement, Split, setMeta, setCanonical, setJsonLd } from './WorldCup2026Landing';
import { quinielaFaq, quinielaJsonLd } from '../seo/quinielaSemana';

const CANONICAL = 'https://futpools.com/quiniela-de-la-semana';

export function QuinielaDeLaSemana() {
  useEffect(() => {
    document.title = 'Quiniela de la semana: Progol y quiniela posible | FutPools';
    setMeta('description', 'Qué es la quiniela de la semana de Progol, cómo se llena (L/E/V de 14 partidos), qué es la quiniela posible, y cómo jugar tu propia quiniela en FutPools. Gratis.');
    setCanonical(CANONICAL);
    setJsonLd('landing-jsonld', quinielaJsonLd());
  }, []);

  const cta = (label) => <Link to="/onboarding" className="wc-btn-primary">▶ {label}</Link>;

  return (
    <div className="fp-wc26">
      <style>{WC_CSS}</style>
      <style>{LANDING_CSS}</style>
      <style>{QS_CSS}</style>

      <nav className="wc-nav">
        <Link to="/" className="wc-logo">FUT<span>POOLS</span></Link>
        <div className="wc-nav-right">
          <Link to="/" className="wc-nav-home">Inicio</Link>
        </div>
      </nav>

      {/* Reverb layout: copy left, visual right (above the fold). */}
      <header className="wc-hero wc-hero-split">
        <div className="wc-grid-bg" />
        <div className="wc-hero-inner">
          <div className="wc-hero-copy">
            <div className="wc-kicker">◆ PRONÓSTICOS DE FÚTBOL · MÉXICO</div>
            <h1>Quiniela de la semana</h1>
            <p className="wc-sub wc-lead">
              La quiniela de la semana es la forma más popular de pronosticar el fútbol en México. Cada jornada eliges
              el resultado (local, empate o visitante) de los 14 partidos del Progol, y la "quiniela posible" te ayuda a
              llenar tu boleto. Aquí te explicamos cómo funciona y cómo jugar tu propia quiniela con amigos en FutPools, gratis.
            </p>
            <div className="wc-cta-row">{cta('Jugar mi quiniela')}</div>
            <div className="wc-hero-stats">
              <div className="wc-stat"><div className="wc-stat-num">14</div><div className="wc-stat-lab">Partidos</div></div>
              <div className="wc-stat"><div className="wc-stat-num">L·E·V</div><div className="wc-stat-lab">Pronóstico</div></div>
              <div className="wc-stat"><div className="wc-stat-num">7</div><div className="wc-stat-lab">Revancha</div></div>
              <div className="wc-stat"><div className="wc-stat-num">Gratis</div><div className="wc-stat-lab">En FutPools</div></div>
            </div>
          </div>
          <div className="wc-hero-visual">
            <PhoneVisual />
          </div>
        </div>
      </header>

      <main className="wc-main wc-content">

        <Statement kicker="JORNADA TRAS JORNADA" title="Pronostica el fútbol, cada semana">
          La quiniela de la semana junta a millones de aficionados a adivinar los resultados de la jornada.
          Te explicamos cómo se juega el Progol, qué es la quiniela posible, y cómo armar la tuya con amigos.
        </Statement>

        <Split title="¿Qué es la quiniela de la semana (Progol)?" visual={<TicketVisual />}>
          <p>El Progol es la quiniela de la semana oficial de Lotería Nacional (Pronósticos). Funciona así:</p>
          <ul className="wc-ul">
            <li>Son 14 partidos de fútbol nacional e internacional cada jornada</li>
            <li>En cada partido pronosticas Local (L), Empate (E) o Visitante (V)</li>
            <li>Cuenta el resultado en tiempo reglamentario, sin tiempos extra ni penales</li>
            <li>Entre más resultados aciertes, mayor es el premio</li>
          </ul>
        </Split>

        <Split flip title="Cómo se llena tu quiniela: L, E o V" visual={<StepsVisual />}>
          <p>Llenar tu quiniela de la semana toma un par de minutos:</p>
          <ul className="wc-ul">
            <li>Revisa los 14 partidos de la jornada</li>
            <li>Marca L, E o V según quién creas que gana (o si hay empate)</li>
            <li>Regístrala antes de que inicie el primer partido</li>
            <li>Sigue los resultados y cuenta tus aciertos</li>
          </ul>
        </Split>

        <Statement kicker="CON AMIGOS" title="Gratis. Sin filas. Desde tu teléfono.">
          En FutPools haces tu quiniela de la semana en línea, la compartes con amigos por un código, y ves los
          aciertos en vivo. Sin papelitos, sin filas.
        </Statement>

        <Split title="¿Qué es la 'quiniela posible' de Progol?" visual={<PossibleVisual />}>
          <p>La "quiniela posible" (o "Progol posible") es la combinación de pronósticos más probable que se publica
            cada semana para orientarte al llenar tu boleto.</p>
          <ul className="wc-ul">
            <li>Reúne el pronóstico más probable de cada uno de los 14 partidos</li>
            <li>Se arma con estadísticas, momios y forma de los equipos</li>
            <li>Es una guía orientativa, no garantiza aciertos</li>
            <li>En FutPools tú decides tus L/E/V; la quiniela posible es solo apoyo</li>
          </ul>
        </Split>

        <Split flip title="Progol y Progol Revancha" visual={<RevanchaVisual />}>
          <p>La quiniela de la semana del Progol tiene dos partes:</p>
          <ul className="wc-ul">
            <li>Progol: los 14 partidos principales</li>
            <li>Progol Revancha: 7 partidos extra (juego complementario)</li>
            <li>Para jugar la Revancha necesitas participar en Progol</li>
            <li>El premio mayor se gana acertando todos los resultados</li>
          </ul>
        </Split>

        <Split title="Juega tu quiniela de la semana en FutPools" visual={<PhoneVisual />}>
          <p>Arma tu propia quiniela en minutos, sin costo:</p>
          <ul className="wc-ul">
            <li>Crea una quiniela o únete con un código de invitación</li>
            <li>Pronostica los partidos y compite con tus amigos</li>
            <li>Mira los aciertos en vivo desde tu teléfono</li>
            <li>Premios reales en las quinielas con bote</li>
          </ul>
          <div className="wc-cta-row">{cta('Jugar mi quiniela')}</div>
        </Split>

        <Statement kicker="VA QUE VA" title="Tu quiniela, tu jugada.">
          Deja de buscar dónde anotar tus pronósticos. Arma la quiniela de la semana con tu banda en FutPools.
        </Statement>

        <section className="wc-faq">
          <h2>Preguntas frecuentes</h2>
          <div className="wc-faq-grid">
            {quinielaFaq().map(({ q, a }) => (
              <div className="wc-faq-item" key={q}>
                <div className="wc-faq-q">◆ {q}</div>
                <div className="wc-faq-a">{a}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="wc-cta">
          <div className="wc-cta-inner">
            <div className="wc-cta-kicker">◆ ¿LISTO PARA JUGAR?</div>
            <h2 style={{ fontFamily: 'var(--ox)', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>
              Haz tu quiniela de la semana hoy.
            </h2>
            <p>Gratis, con amigos y desde tu teléfono. Premios reales en las quinielas con bote.</p>
            <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
              {cta('Jugar mi quiniela')}
              <Link to="/pronosticos-de-futbol" className="wc-btn-secondary">Cómo hacer pronósticos de fútbol →</Link>
              <Link to="/calendario-mundial-2026" className="wc-btn-secondary">Calendario del Mundial 2026 →</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="wc-footer">
        <div>© 2026 FUTPOOLS · futpools.com</div>
        <div>FutPools es independiente y no está afiliado a Progol ni a Lotería Nacional.</div>
      </footer>
    </div>
  );
}

// ─────────────── Visuals (evergreen, illustrative — not a real jornada) ───────────────

function TicketVisual() {
  const rows = [
    { n: 1, p: 'L' }, { n: 2, p: 'E' }, { n: 3, p: 'V' }, { n: 4, p: 'L' },
    { n: 5, p: 'L' }, { n: 6, p: 'E' }, { n: 7, p: 'V' }, { n: 8, p: 'L' },
  ];
  return (
    <div className="wc-viz" role="img" aria-label="Boleto de quiniela de ejemplo: por cada partido se marca Local, Empate o Visitante.">
      <div className="wc-viz-head"><span>◆ BOLETO · EJEMPLO</span><span className="wc-viz-sub">14 partidos</span></div>
      <div className="wc-qs-ticket">
        <div className="wc-qs-th"><span>#</span><span>L</span><span>E</span><span>V</span></div>
        {rows.map((r) => (
          <div className="wc-qs-row" key={r.n}>
            <span className="wc-qs-n">{r.n}</span>
            {['L', 'E', 'V'].map((opt) => (
              <span className={`wc-qs-cell ${r.p === opt ? 'on' : ''}`} key={opt}>{opt}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">+ 6 partidos · + Progol Revancha (7)</div>
    </div>
  );
}

function StepsVisual() {
  const steps = ['Revisa los 14 partidos de la jornada', 'Marca L, E o V en cada uno', 'Regístrala antes del primer partido'];
  return (
    <div className="wc-viz" role="img" aria-label="Tres pasos para llenar la quiniela de la semana.">
      <div className="wc-viz-head"><span>◆ EN 3 PASOS</span></div>
      <div className="wc-qs-steps">
        {steps.map((s, i) => (
          <div className="wc-qs-step" key={i} style={{ animationDelay: `${i * 90}ms` }}>
            <span className="wc-qs-step-n">{i + 1}</span>
            <span className="wc-qs-step-t">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PossibleVisual() {
  const rows = [
    { n: 1, p: 'L', pct: 68 }, { n: 2, p: 'E', pct: 41 }, { n: 3, p: 'V', pct: 57 }, { n: 4, p: 'L', pct: 73 }, { n: 5, p: 'V', pct: 49 },
  ];
  return (
    <div className="wc-viz" role="img" aria-label="Ejemplo de quiniela posible: el pronóstico más probable de cada partido con su porcentaje.">
      <div className="wc-viz-head"><span>◆ QUINIELA POSIBLE · EJEMPLO</span></div>
      <div className="wc-qs-poss">
        {rows.map((r) => (
          <div className="wc-qs-poss-row" key={r.n}>
            <span className="wc-qs-n">{r.n}</span>
            <span className={`wc-qs-cell on`}>{r.p}</span>
            <span className="wc-qs-poss-bar"><span style={{ width: `${r.pct}%` }} /></span>
            <span className="wc-qs-poss-pct">{r.pct}%</span>
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">Guía orientativa · no garantiza aciertos</div>
    </div>
  );
}

function RevanchaVisual() {
  return (
    <div className="wc-viz" role="img" aria-label="Progol tiene 14 partidos y Progol Revancha 7 partidos.">
      <div className="wc-viz-head"><span>◆ PROGOL + REVANCHA</span></div>
      <div className="wc-qs-rev">
        <div className="wc-qs-rev-card on">
          <div className="wc-qs-rev-num">14</div>
          <div className="wc-qs-rev-lab">Progol</div>
        </div>
        <div className="wc-qs-rev-plus">+</div>
        <div className="wc-qs-rev-card">
          <div className="wc-qs-rev-num">7</div>
          <div className="wc-qs-rev-lab">Revancha</div>
        </div>
      </div>
      <div className="wc-dist-foot">21 partidos para pronosticar cada jornada</div>
    </div>
  );
}

function PhoneVisual() {
  const items = [
    { t: 'Partido 1', p: 'L' }, { t: 'Partido 2', p: 'E' }, { t: 'Partido 3', p: 'V' }, { t: 'Partido 4', p: 'L' },
  ];
  return (
    <div className="wc-viz wc-viz-phone-wrap" role="img" aria-label="Un teléfono mostrando una quiniela en FutPools con pronósticos.">
      <div className="wc-phone">
        <div className="wc-phone-notch" />
        <div className="wc-phone-head">TU QUINIELA · FUTPOOLS</div>
        <div className="wc-phone-list">
          {items.map((it, i) => (
            <div className="wc-phone-row" key={i}>
              <span className="wc-phone-date">{it.t}</span>
              <span className="wc-phone-evt"><span className="wc-qs-cell on" style={{ width: 18, height: 18, fontSize: 9 }}>{it.p}</span></span>
            </div>
          ))}
        </div>
        <div className="wc-phone-foot"><span>⚽</span><span>👥</span><span>🏆</span></div>
      </div>
    </div>
  );
}

const QS_CSS = `
/* ticket */
.fp-wc26 .wc-qs-ticket { display: flex; flex-direction: column; gap: 4px; }
.fp-wc26 .wc-qs-th, .fp-wc26 .wc-qs-row { display: grid; grid-template-columns: 28px repeat(3, 1fr); gap: 5px; align-items: center; }
.fp-wc26 .wc-qs-th { font-family: var(--mono); font-size: 9px; color: var(--text-muted); letter-spacing: 1px; padding: 0 2px 2px; }
.fp-wc26 .wc-qs-th span { text-align: center; }
.fp-wc26 .wc-qs-n { font-family: var(--mono); font-size: 10px; color: var(--text-muted); text-align: center; }
.fp-wc26 .wc-qs-cell { display: flex; align-items: center; justify-content: center; height: 24px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%); font-family: var(--ox); font-weight: 800; font-size: 11px; color: var(--text-muted); }
.fp-wc26 .wc-qs-cell.on { background: var(--primary); color: var(--fp-on-primary); border-color: var(--primary); box-shadow: 0 0 8px rgba(33,226,140,0.5); }

/* steps */
.fp-wc26 .wc-qs-steps { display: flex; flex-direction: column; gap: 8px; }
.fp-wc26 .wc-qs-step { display: flex; align-items: center; gap: 10px; background: var(--bg); border: 1px solid var(--stroke); border-left: 2px solid var(--primary); clip-path: polygon(0 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%); padding: 10px 12px; opacity: 0; animation: wcRise 0.45s ease forwards; }
.fp-wc26 .wc-qs-step-n { width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; background: var(--primary); color: var(--fp-on-primary); font-family: var(--ox); font-weight: 900; font-size: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(33,226,140,0.45); }
.fp-wc26 .wc-qs-step-t { font-size: 12.5px; color: var(--text-dim); }

/* quiniela posible */
.fp-wc26 .wc-qs-poss { display: flex; flex-direction: column; gap: 7px; }
.fp-wc26 .wc-qs-poss-row { display: grid; grid-template-columns: 20px 26px 1fr 36px; gap: 8px; align-items: center; }
.fp-wc26 .wc-qs-poss-bar { height: 8px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%); }
.fp-wc26 .wc-qs-poss-bar span { display: block; height: 100%; background: var(--accent); box-shadow: 0 0 8px rgba(54,233,255,0.5); transform-origin: left; animation: wcGrow 0.7s ease forwards; }
.fp-wc26 .wc-qs-poss-pct { font-family: var(--ox); font-weight: 800; font-size: 12px; color: var(--accent); text-align: right; }

/* revancha */
.fp-wc26 .wc-qs-rev { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 6px 0; }
.fp-wc26 .wc-qs-rev-card { background: var(--bg); border: 1px solid var(--stroke); clip-path: var(--hud-clip-sm); padding: 14px 22px; text-align: center; }
.fp-wc26 .wc-qs-rev-card.on { border-color: var(--primary); background: rgba(33,226,140,0.06); }
.fp-wc26 .wc-qs-rev-num { font-family: var(--ox); font-weight: 900; font-size: 30px; color: var(--primary); }
.fp-wc26 .wc-qs-rev-card:not(.on) .wc-qs-rev-num { color: var(--accent); }
.fp-wc26 .wc-qs-rev-lab { font-family: var(--mono); font-size: 9px; letter-spacing: 1px; color: var(--text-dim); margin-top: 2px; text-transform: uppercase; }
.fp-wc26 .wc-qs-rev-plus { font-family: var(--ox); font-weight: 900; font-size: 20px; color: var(--text-muted); }
`;
