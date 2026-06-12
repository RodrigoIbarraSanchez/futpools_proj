/**
 * /pronosticos-de-futbol — ES-only evergreen SEO landing.
 *
 * Keywords: "pronósticos de fútbol" (primary), "cómo hacer pronósticos de
 * fútbol", "pronósticos para quinielas", "pronósticos deportivos de fútbol"
 * (secondary). Informational/evergreen — explains what a pronóstico is
 * (L/E/V), how to make a good one, and funnels into FutPools quinielas.
 *
 * Dynamic CTA: on mount it asks the backend for the next public pool that
 * is still open for registration (GET /public/pools/next-open). Pool open →
 * CTA deep-links to /pool/:id and the "Próxima quiniela" card fills in;
 * nothing open / fetch fails / pre-fetch render → CTA falls back to
 * /onboarding and the card shows evergreen copy. The baked static shell is
 * head-only, so the dynamic content never affects what gets indexed.
 *
 * Framing rules (playbook): pronósticos = YOUR predictions competing in
 * quinielas — never betting tips, odds or guaranteed picks. No invented
 * stats. No "gratis" claims (entry is paid). 18+ disclaimer in footer.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WC_CSS } from './WorldCup2026Calendar';
import { LANDING_CSS, Statement, Split, setMeta, setCanonical, setJsonLd, useRevealOnScroll } from './WorldCup2026Landing';
import { pronosticosFaq, pronosticosJsonLd } from '../seo/pronosticosFutbol';
import { api } from '../api/client';

const CANONICAL = 'https://futpools.com/pronosticos-de-futbol';

function useNextOpenPool() {
  const [pool, setPool] = useState(null);
  useEffect(() => {
    let on = true;
    api.get('/public/pools/next-open')
      .then((d) => { if (on) setPool(d?.pool || null); })
      .catch(() => {}); // fetch failure → pool stays null → /onboarding
    return () => { on = false; };
  }, []);
  return pool;
}

function formatKickoff(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function PronosticosFutbol() {
  useEffect(() => {
    document.title = 'Pronósticos de fútbol: haz tu quiniela y compite | FutPools';
    setMeta('description', 'Aprende a hacer pronósticos de fútbol (L, E, V): cómo analizar forma, localía y bajas, y pon a prueba tus pronósticos en quinielas con amigos en FutPools.');
    setCanonical(CANONICAL);
    setJsonLd('landing-jsonld', pronosticosJsonLd());
  }, []);

  useRevealOnScroll();

  const pool = useNextOpenPool();
  const ctaTo = pool ? `/pool/${pool.id}` : '/onboarding';
  const ctaLabel = pool ? 'Jugar la próxima quiniela' : 'Jugar mi quiniela';
  const cta = () => <Link to={ctaTo} className="wc-btn-primary">▶ {ctaLabel}</Link>;

  return (
    <div className="fp-wc26">
      <style>{WC_CSS}</style>
      <style>{LANDING_CSS}</style>
      <style>{PF_CSS}</style>

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
            <div className="wc-kicker">◆ QUINIELAS DE FÚTBOL · MÉXICO</div>
            <h1>Pronósticos de fútbol</h1>
            <p className="wc-sub wc-lead">
              Los pronósticos de fútbol son tu opinión sobre cada partido: gana el local, empate o gana el
              visitante. La quiniela es donde se ponen a prueba. Aquí te explicamos cómo hacer pronósticos
              de fútbol con criterio y cómo competir con tus aciertos en las quinielas de FutPools.
            </p>
            <div className="wc-cta-row">{cta()}</div>
            <div className="wc-hero-stats">
              <div className="wc-stat"><div className="wc-stat-num">L·E·V</div><div className="wc-stat-lab">Pronóstico</div></div>
              <div className="wc-stat"><div className="wc-stat-num">90'</div><div className="wc-stat-lab">Tiempo reglamentario</div></div>
              <div className="wc-stat"><div className="wc-stat-num">En vivo</div><div className="wc-stat-lab">Aciertos</div></div>
              <div className="wc-stat"><div className="wc-stat-num">18+</div><div className="wc-stat-lab">México</div></div>
            </div>
          </div>
          <div className="wc-hero-visual">
            <HeroPicksVisual />
          </div>
        </div>
      </header>

      <main className="wc-main wc-content">

        <Statement kicker="ASÍ SE JUEGA" title="Pronosticar es fácil. Acertar, no tanto.">
          Cualquiera tiene una opinión del partido del fin de semana. Los pronósticos de fútbol convierten esa
          opinión en un juego: registras tus L/E/V, los comparas contra tus rivales, y los resultados deciden.
        </Statement>

        <Split title="¿Qué son los pronósticos de fútbol?" visual={<PickVisual />}>
          <p>Un pronóstico de fútbol es tu predicción del resultado de un partido:</p>
          <ul className="wc-ul">
            <li>L: gana el equipo local</li>
            <li>E: empate, sin ganador</li>
            <li>V: gana el equipo visitante</li>
            <li>Cuenta el resultado en tiempo reglamentario, sin tiempos extra ni penales</li>
          </ul>
        </Split>

        <Split flip title="Cómo hacer pronósticos de fútbol: 4 claves" visual={<FormVisual />}>
          <p>Un buen pronóstico se construye con información, no con corazonadas:</p>
          <ul className="wc-ul">
            <li>Forma reciente: cómo llegan los dos equipos a la jornada</li>
            <li>Localía: jugar en casa pesa, pero no decide solo</li>
            <li>Cara a cara: el historial entre ambos equipos</li>
            <li>Bajas: lesiones y suspensiones confirmadas</li>
          </ul>
          <p>Ningún análisis garantiza el resultado: un buen pronóstico reduce la incertidumbre, no la elimina.</p>
        </Split>

        <NextPoolCard pool={pool} />

        <Statement kicker="QUE CUENTEN" title="Un pronóstico sin quiniela es solo una opinión.">
          La gracia de los pronósticos deportivos de fútbol es competir: en una quiniela tus aciertos valen
          contra los de tus rivales, jornada tras jornada.
        </Statement>

        <Split title="Pronósticos para quinielas: compite con tus aciertos" visual={<LeaderboardVisual />}>
          <p>En una quiniela de FutPools tus pronósticos compiten así:</p>
          <ul className="wc-ul">
            <li>Pagas tu entrada y registras tus L/E/V antes del primer partido</li>
            <li>Cada resultado acertado suma a tu marcador</li>
            <li>La tabla de posiciones se actualiza partido a partido</li>
            <li>Quien acierta más se lleva el premio</li>
          </ul>
        </Split>

        <Split flip title="Sigue tus pronósticos en vivo en FutPools" visual={<PhonePicksVisual />}>
          <p>Tus pronósticos de la jornada, en tu teléfono:</p>
          <ul className="wc-ul">
            <li>Únete a una quiniela pública o crea una con tus amigos</li>
            <li>Mira tus aciertos en vivo mientras ruedan los partidos</li>
            <li>Compara tu quiniela contra la de tu banda</li>
            <li>Premios reales en las quinielas con bote</li>
          </ul>
          <div className="wc-cta-row">{cta()}</div>
        </Split>

        <section className="wc-faq">
          <h2>Preguntas frecuentes</h2>
          <div className="wc-faq-grid">
            {pronosticosFaq().map(({ q, a }) => (
              <div className="wc-faq-item" key={q}>
                <div className="wc-faq-q">◆ {q}</div>
                <div className="wc-faq-a">{a}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="wc-cta">
          <div className="wc-cta-inner">
            <div className="wc-cta-kicker">◆ ¿LISTO PARA PRONOSTICAR?</div>
            <h2 style={{ fontFamily: 'var(--ox)', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>
              Pon a prueba tus pronósticos de fútbol.
            </h2>
            <p>Llena tus L/E/V, compite con amigos y sigue tus aciertos en vivo.</p>
            <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
              {cta()}
              <Link to="/quiniela-de-la-semana" className="wc-btn-secondary">¿Nuevo en quinielas? Cómo funciona →</Link>
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

// ─────────────── Dynamic "Próxima quiniela" card ───────────────
// Enhancement-only: the evergreen fallback is the default render state, so
// crawlers and the pre-fetch paint always see valid, undated content.

function NextPoolCard({ pool }) {
  return (
    <section className="wc-pf-next">
      {pool ? (
        <div className="wc-viz wc-pf-next-card">
          <div className="wc-viz-head"><span>◆ PRÓXIMA QUINIELA ABIERTA</span><span className="wc-viz-sub">Inscripción abierta</span></div>
          <div className="wc-pf-next-name">{pool.name}</div>
          <div className="wc-pf-next-meta">
            <span>Primer partido: {formatKickoff(pool.firstKickoff)}</span>
            {pool.entriesCount > 0 && <span>{pool.entriesCount} {pool.entriesCount === 1 ? 'participante' : 'participantes'}</span>}
            {pool.entryFeeMXN > 0 && <span>${pool.entryFeeMXN} {pool.currency || 'MXN'} / entrada</span>}
          </div>
          <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
            <Link to={`/pool/${pool.id}`} className="wc-btn-primary">▶ Entrar a la quiniela</Link>
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
            <Link to="/onboarding" className="wc-btn-primary">▶ Jugar mi quiniela</Link>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────── Visuals (evergreen, illustrative) ───────────────

/**
 * Hero "product shot" (Reverb-style): a quiniela mid-fill, large enough to
 * own the right column. Represents the primary keyword literally — making
 * football pronósticos (L/E/V) and tracking aciertos live.
 */
function HeroPicksVisual() {
  const rows = [
    { n: 1, p: 'L', live: '✓' },
    { n: 2, p: 'E', live: '✓' },
    { n: 3, p: 'V', live: '·' },
    { n: 4, p: 'L', live: '✓' },
    { n: 5, p: 'E', live: '·' },
    { n: 6, p: 'V', live: '·' },
  ];
  return (
    <div className="wc-viz wc-pf-hero" role="img" aria-label="Una quiniela de ejemplo llenándose: pronóstico Local, Empate o Visitante por partido, con los aciertos marcándose en vivo.">
      <div className="wc-viz-head"><span>◆ TUS PRONÓSTICOS · EJEMPLO</span><span className="wc-viz-sub">● EN VIVO</span></div>
      <div className="wc-pf-hero-th"><span>Partido</span><span>L</span><span>E</span><span>V</span><span>✓</span></div>
      <div className="wc-pf-hero-list">
        {rows.map((r, i) => (
          <div className="wc-pf-hero-row" key={r.n} style={{ animationDelay: `${i * 120}ms` }}>
            <span className="wc-pf-hero-match">
              <span className="wc-pf-dot" /><span className="wc-pf-dot alt" />Partido {r.n}
            </span>
            {['L', 'E', 'V'].map((opt) => (
              <span className={`wc-pf-cell wc-pf-cell-lg ${r.p === opt ? 'on' : ''}`} key={opt}>{opt}</span>
            ))}
            <span className={`wc-pf-live ${r.live === '✓' ? 'ok' : ''}`}>{r.live}</span>
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">3 aciertos de 6 · gana quien acierta más</div>
    </div>
  );
}

function PickVisual() {
  const rows = [
    { n: 1, p: 'L' }, { n: 2, p: 'E' }, { n: 3, p: 'V' }, { n: 4, p: 'L' }, { n: 5, p: 'V' }, { n: 6, p: 'E' },
  ];
  return (
    <div className="wc-viz" role="img" aria-label="Pronósticos de ejemplo: por cada partido se elige Local, Empate o Visitante.">
      <div className="wc-viz-head"><span>◆ TUS PRONÓSTICOS · EJEMPLO</span><span className="wc-viz-sub">L · E · V</span></div>
      <div className="wc-pf-ticket">
        <div className="wc-pf-th"><span>#</span><span>L</span><span>E</span><span>V</span></div>
        {rows.map((r) => (
          <div className="wc-pf-row" key={r.n} style={{ animationDelay: `${(r.n - 1) * 90}ms` }}>
            <span className="wc-pf-n">{r.n}</span>
            {['L', 'E', 'V'].map((opt) => (
              <span className={`wc-pf-cell ${r.p === opt ? 'on' : ''}`} key={opt}>{opt}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">Un pronóstico por partido · tiempo reglamentario</div>
    </div>
  );
}

function FormVisual() {
  // Bar widths are decorative rhythm, NOT data — labeled as criteria.
  const rows = [
    { t: 'Forma reciente', w: 86 },
    { t: 'Localía', w: 64 },
    { t: 'Cara a cara', w: 52 },
    { t: 'Bajas confirmadas', w: 74 },
  ];
  return (
    <div className="wc-viz" role="img" aria-label="Cuatro criterios para analizar un pronóstico: forma reciente, localía, cara a cara y bajas.">
      <div className="wc-viz-head"><span>◆ ANÁLISIS · 4 CLAVES</span></div>
      <div className="wc-pf-form">
        {rows.map((r, i) => (
          <div className="wc-pf-form-row" key={r.t}>
            <span className="wc-pf-form-lab">{r.t}</span>
            <span className="wc-pf-form-bar"><span style={{ width: `${r.w}%`, animationDelay: `${i * 130}ms` }} /></span>
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">Criterios de análisis · ningún pronóstico está garantizado</div>
    </div>
  );
}

function LeaderboardVisual() {
  const rows = [
    { pos: 1, name: 'Jugador 1', hits: 5 },
    { pos: 2, name: 'Jugador 2', hits: 4 },
    { pos: 3, name: 'Jugador 3', hits: 2 },
  ];
  return (
    <div className="wc-viz" role="img" aria-label="Tabla de posiciones de ejemplo de una quiniela: cada acierto suma al marcador.">
      <div className="wc-viz-head"><span>◆ TABLA · EJEMPLO ILUSTRATIVO</span><span className="wc-viz-sub">Aciertos</span></div>
      <div className="wc-pf-board">
        {rows.map((r) => (
          <div className={`wc-pf-board-row ${r.pos === 1 ? 'on' : ''}`} key={r.pos} style={{ animationDelay: `${(r.pos - 1) * 140}ms` }}>
            <span className="wc-pf-board-pos">{r.pos}</span>
            <span className="wc-pf-board-name">{r.name}</span>
            <span className="wc-pf-board-hits">
              {Array.from({ length: 6 }, (_, i) => (
                <span className={`wc-pf-tick ${i < r.hits ? 'on' : ''}`} key={i} />
              ))}
            </span>
            <span className="wc-pf-board-num">{r.hits}</span>
          </div>
        ))}
      </div>
      <div className="wc-dist-foot">Cada resultado acertado suma · gana quien acierta más</div>
    </div>
  );
}

function PhonePicksVisual() {
  const items = [
    { t: 'Partido 1', p: 'L', ok: true },
    { t: 'Partido 2', p: 'E', ok: false },
    { t: 'Partido 3', p: 'V', ok: true },
    { t: 'Partido 4', p: 'L', ok: true },
  ];
  return (
    <div className="wc-viz wc-viz-phone-wrap" role="img" aria-label="Un teléfono mostrando pronósticos en FutPools con aciertos en vivo.">
      <div className="wc-phone">
        <div className="wc-phone-notch" />
        <div className="wc-phone-head">MIS PRONÓSTICOS · EN VIVO</div>
        <div className="wc-phone-list">
          {items.map((it, i) => (
            <div className="wc-phone-row" key={i} style={{ animationDelay: `${i * 130}ms` }}>
              <span className="wc-phone-date">{it.t}</span>
              <span className="wc-phone-evt">
                <span className={`wc-pf-cell on`} style={{ width: 18, height: 18, fontSize: 9 }}>{it.p}</span>
                <span className={`wc-pf-live ${it.ok ? 'ok' : ''}`}>{it.ok ? '✓' : '·'}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="wc-phone-foot"><span>⚽</span><span>👥</span><span>🏆</span></div>
      </div>
    </div>
  );
}

const PF_CSS = `
/* hero product shot (large quiniela) */
.fp-wc26 .wc-pf-hero { padding: 18px 18px 16px; }
.fp-wc26 .wc-pf-hero-th, .fp-wc26 .wc-pf-hero-row { display: grid; grid-template-columns: 1fr repeat(3, 46px) 28px; gap: 7px; align-items: center; }
.fp-wc26 .wc-pf-hero-th { font-family: var(--mono); font-size: 9px; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase; padding: 2px 12px 8px; }
.fp-wc26 .wc-pf-hero-th span:not(:first-child) { text-align: center; }
.fp-wc26 .wc-pf-hero-list { display: flex; flex-direction: column; gap: 7px; }
.fp-wc26 .wc-pf-hero-row { background: var(--bg); border: 1px solid var(--stroke); border-left: 2px solid var(--primary); clip-path: polygon(0 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); padding: 8px 12px; opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-pf-hero-match { display: flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 11px; color: var(--text-dim); white-space: nowrap; overflow: hidden; }
.fp-wc26 .wc-pf-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--primary); opacity: 0.85; flex-shrink: 0; }
.fp-wc26 .wc-pf-dot.alt { background: var(--accent); margin-left: -3px; }
.fp-wc26 .wc-pf-cell-lg { height: 32px; font-size: 13px; }
.fp-wc26 .wc-pf-hero .wc-pf-live { text-align: center; margin: 0; font-size: 13px; }
.fp-wc26 .wc-pf-hero .wc-viz-sub { color: var(--primary); }
@media (max-width: 420px) {
  .fp-wc26 .wc-pf-hero-th, .fp-wc26 .wc-pf-hero-row { grid-template-columns: 1fr repeat(3, 38px) 22px; gap: 5px; }
  .fp-wc26 .wc-pf-cell-lg { height: 28px; font-size: 12px; }
}

/* picks ticket */
.fp-wc26 .wc-pf-ticket { display: flex; flex-direction: column; gap: 4px; }
.fp-wc26 .wc-pf-th, .fp-wc26 .wc-pf-row { display: grid; grid-template-columns: 28px repeat(3, 1fr); gap: 5px; align-items: center; }
.fp-wc26 .wc-pf-th { font-family: var(--mono); font-size: 9px; color: var(--text-muted); letter-spacing: 1px; padding: 0 2px 2px; }
.fp-wc26 .wc-pf-th span { text-align: center; }
.fp-wc26 .wc-pf-n { font-family: var(--mono); font-size: 10px; color: var(--text-muted); text-align: center; }
.fp-wc26 .wc-pf-cell { display: flex; align-items: center; justify-content: center; height: 24px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%); font-family: var(--ox); font-weight: 800; font-size: 11px; color: var(--text-muted); }
.fp-wc26 .wc-pf-cell.on { background: var(--primary); color: var(--fp-on-primary); border-color: var(--primary); box-shadow: 0 0 8px rgba(33,226,140,0.5); }

/* analysis criteria bars (decorative, not data) */
.fp-wc26 .wc-pf-form { display: flex; flex-direction: column; gap: 10px; }
.fp-wc26 .wc-pf-form-row { display: grid; grid-template-columns: 120px 1fr; gap: 10px; align-items: center; }
.fp-wc26 .wc-pf-form-lab { font-family: var(--mono); font-size: 10px; letter-spacing: 0.5px; color: var(--text-dim); text-transform: uppercase; }
.fp-wc26 .wc-pf-form-bar { height: 8px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%); }
.fp-wc26 .wc-pf-form-bar span { display: block; height: 100%; background: var(--accent); box-shadow: 0 0 8px rgba(54,233,255,0.5); transform-origin: left; animation: wcGrow 1.1s ease both; }

/* leaderboard */
.fp-wc26 .wc-pf-board { display: flex; flex-direction: column; gap: 7px; }
.fp-wc26 .wc-pf-board-row { display: grid; grid-template-columns: 22px 1fr auto 24px; gap: 9px; align-items: center; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(0 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%); padding: 8px 10px; }
.fp-wc26 .wc-pf-board-row.on { border-color: var(--primary); background: rgba(33,226,140,0.06); }
.fp-wc26 .wc-pf-board-pos { font-family: var(--ox); font-weight: 900; font-size: 13px; color: var(--primary); text-align: center; }
.fp-wc26 .wc-pf-board-name { font-size: 12.5px; color: var(--text-dim); }
.fp-wc26 .wc-pf-board-hits { display: flex; gap: 3px; }
.fp-wc26 .wc-pf-tick { width: 9px; height: 9px; background: var(--bg); border: 1px solid var(--stroke); clip-path: polygon(2px 0,100% 0,calc(100% - 2px) 100%,0 100%); }
.fp-wc26 .wc-pf-tick.on { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 6px rgba(33,226,140,0.5); }
.fp-wc26 .wc-pf-board-num { font-family: var(--ox); font-weight: 800; font-size: 13px; color: var(--accent); text-align: right; }

/* reveal: every visual element animates in (scroll-triggered) */
.fp-wc26 .wc-pf-row, .fp-wc26 .wc-pf-board-row { opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-pf-form-row { opacity: 0; animation: wcRise 0.8s ease both; }

/* live check in phone */
.fp-wc26 .wc-pf-live { font-family: var(--ox); font-weight: 900; font-size: 11px; color: var(--text-muted); margin-left: 6px; }
.fp-wc26 .wc-pf-live.ok { color: var(--primary); text-shadow: 0 0 6px rgba(33,226,140,0.6); }

/* next-pool dynamic card */
.fp-wc26 .wc-pf-next { margin: 34px 0; display: flex; justify-content: center; }
.fp-wc26 .wc-pf-next-card { max-width: 520px; width: 100%; text-align: center; }
.fp-wc26 .wc-pf-next-name { font-family: var(--ox); font-weight: 800; font-size: 19px; color: var(--text); margin: 10px 0 6px; }
.fp-wc26 .wc-pf-next-meta { display: flex; flex-direction: column; gap: 3px; font-family: var(--mono); font-size: 11px; color: var(--text-dim); margin-bottom: 12px; }
`;
