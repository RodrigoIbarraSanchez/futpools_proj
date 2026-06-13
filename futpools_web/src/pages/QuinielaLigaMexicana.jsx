/**
 * /quiniela-liga-mexicana — ES-only SEO landing for the most product-aligned
 * keyword in the cluster: playing a Liga MX quiniela.
 *
 * SERP context (2026-06-12, US db): a PA-0 Facebook group at #1, an
 * Instagram profile, a Scribd PDF twice and two DAS-8 microsites — no
 * dedicated page existed. Volume skews to the USA (Mexican diaspora), so
 * the page leads with the binational angle: SPEI in Mexico / PayPal USD
 * from the US (the channel shipped for exactly this audience).
 *
 * Visuals: a clásicos quiniela ticket (real Liga MX rivalries, marked
 * EJEMPLO — illustrative, not a real jornada), a binational payment
 * module, the Apertura/Clausura season strip, and the live open-pool
 * card. Evergreen copy only (no specific jornada/dates).
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { WC_CSS } from './WorldCup2026Calendar';
import { LANDING_CSS, Statement, Split, setMeta, setCanonical, setJsonLd, useRevealOnScroll } from './WorldCup2026Landing';
import { useNextOpenPool, formatKickoff } from '../hooks/publicData';
import { quinielaLigaMxFaq, quinielaLigaMxJsonLd } from '../seo/quinielaLigaMx';
import { trackEvent } from '../lib/analytics';

const CANONICAL = 'https://futpools.com/quiniela-liga-mexicana';
const PAGE = 'quiniela-liga-mexicana';

export function QuinielaLigaMexicana() {
  useEffect(() => {
    document.title = 'Quiniela Liga Mexicana: juega la Liga MX y gana | FutPools';
    setMeta('description', 'Quiniela de la liga mexicana en línea: pronostica los partidos de la Liga MX, compite con amigos y gana premios. Juega desde México (SPEI) o Estados Unidos (PayPal).');
    setCanonical(CANONICAL);
    setJsonLd('landing-jsonld', quinielaLigaMxJsonLd());
  }, []);

  const pool = useNextOpenPool();
  useRevealOnScroll([pool]);

  const ctaTo = pool ? `/pool/${pool.id}` : '/onboarding';
  const ctaLabel = pool ? 'Entrar a la quiniela abierta' : 'Jugar mi quiniela';
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
      <style>{QLM_CSS}</style>

      <nav className="wc-nav">
        <Link to="/" className="wc-logo">FUT<span>POOLS</span></Link>
        <div className="wc-nav-right">
          <Link to="/" className="wc-nav-home">Inicio</Link>
        </div>
      </nav>

      {/* Reverb layout: copy left, clásicos ticket right. */}
      <header className="wc-hero wc-hero-split">
        <div className="wc-grid-bg" />
        <div className="wc-hero-inner">
          <div className="wc-hero-copy">
            <div className="wc-kicker">◆ LIGA MX · MÉXICO Y ESTADOS UNIDOS</div>
            <h1>Quiniela de la Liga Mexicana</h1>
            <p className="wc-sub wc-lead">
              La quiniela de la liga mexicana de toda la vida, en línea: pronostica los partidos de
              la jornada de la Liga MX, compite contra tus amigos y gana premios reales. Juega desde
              México o desde Estados Unidos, con tus mismos equipos de siempre.
            </p>
            <div className="wc-cta-row">{cta()}</div>
            <div className="wc-hero-stats">
              <div className="wc-stat"><div className="wc-stat-num">18</div><div className="wc-stat-lab">Clubes Liga MX</div></div>
              <div className="wc-stat"><div className="wc-stat-num">L·E·V</div><div className="wc-stat-lab">Tu pronóstico</div></div>
              <div className="wc-stat"><div className="wc-stat-num">🇲🇽 🇺🇸</div><div className="wc-stat-lab">Juega donde estés</div></div>
              <div className="wc-stat"><div className="wc-stat-num">18+</div><div className="wc-stat-lab">Premios reales</div></div>
            </div>
          </div>
          <div className="wc-hero-visual">
            <ClasicosTicketVisual />
          </div>
        </div>
      </header>

      <main className="wc-main wc-content">

        <Statement kicker="LA LIGA DE TODOS" title="La Liga MX se vive mejor con quiniela.">
          El sábado de jornada sabe distinto cuando cada partido vale aciertos. La quiniela de la
          liga mexicana convierte la fecha completa en un duelo contra tu banda: tus L/E/V contra los suyos.
        </Statement>

        <Split title="¿Cómo funciona la quiniela de la liga mexicana?" visual={<PoolLiveCard pool={pool} />}>
          <p>Igual que la quiniela de papel, pero sin papel:</p>
          <ul className="wc-ul">
            <li>Cada quiniela trae los partidos de la jornada de la Liga MX</li>
            <li>Pronosticas L (local), E (empate) o V (visitante) en cada uno</li>
            <li>Registras tus picks antes del primer partido</li>
            <li>Tus aciertos suman en vivo y quien acierta más gana el premio</li>
          </ul>
        </Split>

        <Statement kicker="DE AQUÍ Y DE ALLÁ" title="La misma quiniela en los dos lados de la frontera.">
          Millones siguen la Liga MX desde Estados Unidos. Esta quiniela se juega igual en Guadalajara
          que en Houston: solo cambia cómo pagas tu entrada.
        </Statement>

        <Split flip title="Juega desde México o desde Estados Unidos" visual={<BinationalVisual />}>
          <p>Tu entrada, en tu moneda:</p>
          <ul className="wc-ul">
            <li>🇲🇽 En México: transferencia SPEI en pesos, desde tu banco</li>
            <li>🇺🇸 En Estados Unidos: PayPal en dólares, en dos clics</li>
            <li>Si ganas desde EE.UU., tu premio se envía por PayPal</li>
            <li>Misma quiniela, misma tabla, mismos premios para todos</li>
          </ul>
          <div className="wc-cta-row">{cta()}</div>
        </Split>

        <Split title="Apertura, Clausura y Liguilla: quiniela todo el año" visual={<SeasonVisual />}>
          <p>La Liga MX nunca te deja sin jornada por mucho tiempo:</p>
          <ul className="wc-ul">
            <li>Apertura: de julio a diciembre, 17 jornadas + Liguilla</li>
            <li>Clausura: de enero a mayo, 17 jornadas + Liguilla</li>
            <li>En las pausas de la liga, quinielas de otros torneos (como el Mundial)</li>
            <li>Cada jornada es una quiniela nueva: nadie arrastra ventaja</li>
          </ul>
        </Split>

        <Statement kicker="ADIÓS AL PAPELITO" title="El formato de la quiniela, sin formato.">
          ¿Buscabas el formato de la quiniela de la Liga MX para imprimir? Ya no hace falta: creas tu
          quiniela en un minuto, compartes el código con tu banda y los aciertos se cuentan solos, en vivo.
        </Statement>

        <section className="wc-faq">
          <h2>Preguntas frecuentes</h2>
          <div className="wc-faq-grid">
            {quinielaLigaMxFaq().map(({ q, a }) => (
              <div className="wc-faq-item" key={q}>
                <div className="wc-faq-q">◆ {q}</div>
                <div className="wc-faq-a">{a}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="wc-cta">
          <div className="wc-cta-inner">
            <div className="wc-cta-kicker">◆ ¿VA LA JORNADA?</div>
            <h2 style={{ fontFamily: 'var(--ox)', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>
              Arma tu quiniela de la Liga MX.
            </h2>
            <p>Pronostica la jornada, reta a tu banda y sigue tus aciertos en vivo, estés donde estés.</p>
            <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
              {cta()}
              <Link to="/quiniela-futbol-hoy" className="wc-btn-secondary">Quiniela de fútbol hoy →</Link>
              <Link to="/quiniela-de-la-semana" className="wc-btn-secondary">¿Qué es una quiniela? →</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="wc-footer">
        <div>© 2026 FUTPOOLS · futpools.com</div>
        <div>FutPools es una plataforma independiente de quinielas entre amigos. No está afiliada a la Liga MX, a Progol ni a Lotería Nacional. No es una casa de apuestas. Mayores de 18 años.</div>
      </footer>
    </div>
  );
}

// ─────────────── Visuals ───────────────

/**
 * Hero "product shot": a quiniela ticket of Liga MX clásicos. Real
 * rivalries (they happen every season), clearly marked EJEMPLO — this is
 * NOT a real jornada. Each row carries the clubs' colors.
 */
function ClasicosTicketVisual() {
  const rows = [
    { h: 'AME', a: 'CHI', hc: '#FFD25F', ac: '#E03A45', p: 'L', tag: 'Clásico Nacional' },
    { h: 'TIG', a: 'MTY', hc: '#FDB913', ac: '#4A90D9', p: 'E', tag: 'Clásico Regio' },
    { h: 'CAZ', a: 'PUM', hc: '#3D6DCC', ac: '#C8A24B', p: 'V', tag: '' },
    { h: 'TOL', a: 'LEO', hc: '#E03A45', ac: '#1FA65A', p: 'L', tag: '' },
    { h: 'ATL', a: 'GDL', hc: '#D43F3F', ac: '#E03A45', p: 'E', tag: 'Clásico Tapatío' },
  ];
  return (
    <figure className="wc-viz wc-qlm-ticket" role="img" aria-label="Boleto de quiniela de ejemplo con clásicos de la Liga MX: por cada partido se pronostica Local, Empate o Visitante.">
      <div className="wc-viz-head"><span>◆ TU QUINIELA · LIGA MX</span><span className="wc-viz-sub">EJEMPLO</span></div>
      <div className="wc-qlm-rows">
        {rows.map((r, i) => (
          <div className="wc-qlm-row" key={i} style={{ animationDelay: `${i * 120}ms` }}>
            <span className="wc-qlm-match">
              <i className="wc-qlm-dot" style={{ background: r.hc }} />
              <b>{r.h}</b>
              <span className="wc-qlm-vs">vs</span>
              <b>{r.a}</b>
              <i className="wc-qlm-dot" style={{ background: r.ac }} />
            </span>
            <span className="wc-qlm-tag">{r.tag}</span>
            <span className="wc-qlm-cells">
              {['L', 'E', 'V'].map((opt) => (
                <span className={`wc-qlm-cell ${r.p === opt ? 'on' : ''}`} key={opt}>{opt}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="wc-dist-foot">Quiniela ilustrativa con clásicos de la Liga MX · no es una jornada real</figcaption>
    </figure>
  );
}

/** Live open-pool card (evergreen fallback when nothing is open). */
function PoolLiveCard({ pool }) {
  const to = pool ? `/pool/${pool.id}` : '/onboarding';
  return (
    <div className="wc-viz wc-pf-next-card wc-qlm-pool">
      {pool ? (
        <>
          <div className="wc-viz-head"><span>◆ QUINIELA ABIERTA</span><span className="wc-viz-sub">● Inscripción abierta</span></div>
          <div className="wc-pf-next-name">{pool.name}</div>
          <div className="wc-pf-next-meta">
            <span>Primer partido: {formatKickoff(pool.firstKickoff)}</span>
            {pool.entriesCount > 0 && <span>{pool.entriesCount} {pool.entriesCount === 1 ? 'participante' : 'participantes'}</span>}
            {pool.entryFeeMXN > 0 && <span>${pool.entryFeeMXN} {pool.currency || 'MXN'} / entrada (o USD vía PayPal)</span>}
          </div>
        </>
      ) : (
        <>
          <div className="wc-viz-head"><span>◆ QUINIELAS PÚBLICAS</span></div>
          <div className="wc-pf-next-name">Cada jornada abre una quiniela nueva</div>
          <div className="wc-pf-next-meta">
            <span>Crea tu cuenta y entérate cuando abra la siguiente, o arma una con tus amigos.</span>
          </div>
        </>
      )}
      <div className="wc-cta-row" style={{ justifyContent: 'center' }}>
        <Link
          to={to}
          className="wc-btn-primary"
          onClick={() => trackEvent('cta_click', { page: PAGE, cta: 'pool_card', destination: to })}
        >▶ {pool ? 'Entrar a la quiniela' : 'Jugar mi quiniela'}</Link>
      </div>
      <div className="wc-dist-foot">La inscripción cierra cuando inicia el primer partido</div>
    </div>
  );
}

/** Binational payments: same pool, two currencies. */
function BinationalVisual() {
  return (
    <figure className="wc-viz wc-qlm-bi" role="img" aria-label="La misma quiniela se paga con SPEI en pesos desde México o con PayPal en dólares desde Estados Unidos.">
      <div className="wc-viz-head"><span>◆ UNA QUINIELA · DOS MONEDAS</span></div>
      <div className="wc-qlm-bi-grid">
        <div className="wc-qlm-bi-card">
          <div className="wc-qlm-bi-flag">🇲🇽</div>
          <div className="wc-qlm-bi-title">México</div>
          <div className="wc-qlm-bi-pay">SPEI · $ MXN</div>
          <div className="wc-qlm-bi-sub">Desde tu banco, sin comisión</div>
        </div>
        <div className="wc-qlm-bi-link">⇄</div>
        <div className="wc-qlm-bi-card">
          <div className="wc-qlm-bi-flag">🇺🇸</div>
          <div className="wc-qlm-bi-title">Estados Unidos</div>
          <div className="wc-qlm-bi-pay">PayPal · $ USD</div>
          <div className="wc-qlm-bi-sub">Premios también por PayPal</div>
        </div>
      </div>
      <figcaption className="wc-dist-foot">Misma quiniela de la Liga MX, misma tabla, mismos premios</figcaption>
    </figure>
  );
}

/** Apertura / Clausura season strip. */
function SeasonVisual() {
  const blocks = [
    { t: 'APERTURA', d: 'JUL → DIC', on: true },
    { t: 'LIGUILLA', d: 'DIC', on: false },
    { t: 'CLAUSURA', d: 'ENE → MAY', on: true },
    { t: 'LIGUILLA', d: 'MAY', on: false },
  ];
  return (
    <figure className="wc-viz" role="img" aria-label="Temporada de la Liga MX: torneo Apertura de julio a diciembre y Clausura de enero a mayo, cada uno con su Liguilla.">
      <div className="wc-viz-head"><span>◆ TEMPORADA LIGA MX</span><span className="wc-viz-sub">Todo el año</span></div>
      <div className="wc-qlm-season">
        {blocks.map((b, i) => (
          <div className={`wc-qlm-season-block ${b.on ? 'on' : ''}`} key={i} style={{ animationDelay: `${i * 130}ms` }}>
            <div className="wc-qlm-season-t">{b.t}</div>
            <div className="wc-qlm-season-d">{b.d}</div>
          </div>
        ))}
      </div>
      <figcaption className="wc-dist-foot">Dos torneos al año: cada jornada es una quiniela nueva</figcaption>
    </figure>
  );
}

const QLM_CSS = `
/* clásicos ticket (hero) */
.fp-wc26 .wc-qlm-ticket { padding: 18px 18px 16px; }
.fp-wc26 .wc-qlm-rows { display: flex; flex-direction: column; gap: 7px; }
.fp-wc26 .wc-qlm-row { display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'match cells' 'tag cells'; column-gap: 10px; align-items: center; background: var(--bg); border: 1px solid var(--stroke); border-left: 2px solid var(--primary); clip-path: polygon(0 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); padding: 9px 12px; opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-qlm-match { grid-area: match; display: flex; align-items: center; gap: 7px; font-family: var(--ox); font-weight: 800; font-size: 13px; color: var(--text); }
.fp-wc26 .wc-qlm-vs { font-family: var(--mono); font-size: 9px; color: var(--text-muted); }
.fp-wc26 .wc-qlm-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 8px currentColor; }
.fp-wc26 .wc-qlm-tag { grid-area: tag; font-family: var(--mono); font-size: 8.5px; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; min-height: 12px; }
.fp-wc26 .wc-qlm-cells { grid-area: cells; display: flex; gap: 5px; }
.fp-wc26 .wc-qlm-cell { display: flex; align-items: center; justify-content: center; width: 30px; height: 28px; background: var(--surface); border: 1px solid var(--stroke); clip-path: polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%); font-family: var(--ox); font-weight: 800; font-size: 12px; color: var(--text-muted); }
.fp-wc26 .wc-qlm-cell.on { background: var(--primary); color: var(--fp-on-primary); border-color: var(--primary); box-shadow: 0 0 8px rgba(33,226,140,0.5); }

/* binational module */
.fp-wc26 .wc-qlm-bi-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: stretch; padding: 4px 0; }
.fp-wc26 .wc-qlm-bi-card { background: var(--bg); border: 1px solid var(--stroke); clip-path: var(--hud-clip-sm); padding: 16px 10px; text-align: center; opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-qlm-bi-card:last-child { animation-delay: 160ms; }
.fp-wc26 .wc-qlm-bi-flag { font-size: 26px; line-height: 1.2; }
.fp-wc26 .wc-qlm-bi-title { font-family: var(--ox); font-weight: 800; font-size: 13px; color: var(--text); margin-top: 4px; }
.fp-wc26 .wc-qlm-bi-pay { font-family: var(--mono); font-size: 11px; color: var(--primary); margin-top: 4px; letter-spacing: 0.5px; }
.fp-wc26 .wc-qlm-bi-sub { font-family: var(--mono); font-size: 9px; color: var(--text-muted); margin-top: 4px; line-height: 1.5; }
.fp-wc26 .wc-qlm-bi-link { display: flex; align-items: center; font-family: var(--ox); font-weight: 900; font-size: 18px; color: var(--accent); }

/* season strip */
.fp-wc26 .wc-qlm-season { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 4px 0; }
.fp-wc26 .wc-qlm-season-block { background: var(--bg); border: 1px solid var(--stroke); clip-path: var(--hud-clip-sm); padding: 12px 6px; text-align: center; opacity: 0; animation: wcRise 0.8s ease both; }
.fp-wc26 .wc-qlm-season-block.on { border-color: var(--primary); background: rgba(33,226,140,0.06); }
.fp-wc26 .wc-qlm-season-t { font-family: var(--ox); font-weight: 900; font-size: 11px; color: var(--text); letter-spacing: 0.5px; }
.fp-wc26 .wc-qlm-season-block.on .wc-qlm-season-t { color: var(--primary); }
.fp-wc26 .wc-qlm-season-d { font-family: var(--mono); font-size: 8.5px; letter-spacing: 1px; color: var(--text-muted); margin-top: 3px; }

/* open-pool card spacing within Split */
.fp-wc26 .wc-qlm-pool { text-align: center; }
@media (max-width: 420px) {
  .fp-wc26 .wc-qlm-cell { width: 26px; height: 26px; font-size: 11px; }
  .fp-wc26 .wc-qlm-match { font-size: 12px; }
}
`;
