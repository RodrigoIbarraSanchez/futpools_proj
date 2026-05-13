/**
 * Public landing shown at `/` when the visitor is not authenticated.
 *
 * Design: handoff bundle from Claude Design — arcade / HUD aesthetic with
 * perspective grid, scanlines, hexagonal badges, and a floating phone
 * mockup on the hero. The waitlist email forms from the prototype were
 * replaced by direct CTAs to `/register` and `/login` since the product
 * is live, not pre-launch.
 *
 * All styles are scoped to `.fp-landing` via the component-local <style>
 * block so nothing leaks into the signed-in app.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';

export function LandingPage() {
  const { locale, setLocale } = useLocale();
  const c = (es, en) => (locale === 'es' ? es : en);

  // Smooth-scroll for in-page anchor links (#how, #features, …). React Router
  // only handles route changes, so we intercept the click ourselves.
  useEffect(() => {
    const onAnchorClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
    };
    document.addEventListener('click', onAnchorClick);
    return () => document.removeEventListener('click', onAnchorClick);
  }, []);

  return (
    <div className="fp-landing">
      <style>{LANDING_CSS}</style>

      {/* ─────────── NAV ─────────── */}
      <nav>
        <div className="logo">FUT<span className="p">POOLS</span></div>
        <div className="nav-links">
          <a href="#how">{c('Cómo funciona', 'How it works')}</a>
          <a href="#features">{c('Features', 'Features')}</a>
          <a href="#gamify">{c('Progresión', 'Progression')}</a>
          <a href="#screens">{c('App', 'App')}</a>
        </div>
        <div className="nav-right">
          <div className="lang-switch">
            <button
              className={locale === 'es' ? 'active' : ''}
              onClick={() => setLocale('es')}
            >ES</button>
            <button
              className={locale === 'en' ? 'active' : ''}
              onClick={() => setLocale('en')}
            >EN</button>
          </div>
          <Link to="/login" className="nav-login">
            {c('Entrar', 'Sign in')}
          </Link>
          <Link to="/register" className="btn btn-primary btn-nav">
            {c('Jugar', 'Play')}
          </Link>
        </div>
      </nav>

      {/* ─────────── HERO ─────────── */}
      <div className="hero">
        <div className="grid-bg" />

        <div className="hero-left">
          <div className="kicker">{c('◆ EL MUNDIAL EN 30 DÍAS · INSCRÍBETE YA', '◆ WORLD CUP IN 30 DAYS · JOIN NOW')}</div>
          <h1>
            <span>{c('QUINIELAS DE FÚTBOL.', 'FOOTBALL POOLS.')}</span><br />
            <span className="accent">{c('GANA DINERO REAL.', 'WIN REAL CASH.')}</span>
          </h1>
          <p className="hero-sub">
            {c(
              'Inscríbete por $50 MXN. El ganador se lleva el 65% del bote acumulado por transferencia bancaria. Mundial, Liga MX, Champions y más — pickea, juega, cobra.',
              "Pay $50 MXN to enter. Winner takes 65% of the prize pool, paid out by bank transfer. World Cup, Liga MX, Champions and more — pick, play, get paid."
            )}
          </p>

          <div className="hero-cta-row">
            <Link to="/onboarding" className="btn btn-primary btn-lg">
              ▶ {c('Empezar a Ganar', 'Start Winning')}
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              {c('Iniciar Sesión', 'Sign In')}
            </Link>
          </div>
          <div className="form-note">
            <span className="ok">◆</span>{' '}
            {c('Pago seguro con Stripe · Premios depositados a tu cuenta', 'Secure Stripe payments · Prizes deposited to your bank')}
          </div>

          <div className="hero-stats">
            <div className="stat">
              <div className="num">$50<span className="pct"> MXN</span></div>
              <div className="label">{c('Por inscripción', 'Per entry')}</div>
            </div>
            <div className="stat">
              <div className="num">65<span className="pct">%</span></div>
              <div className="label">{c('Para el ganador', 'To the winner')}</div>
            </div>
            <div className="stat">
              <div className="num">12<span className="pct">+</span></div>
              <div className="label">{c('Ligas cubiertas', 'Leagues covered')}</div>
            </div>
          </div>
        </div>

        {/* Right: phone mockup — the actual Home screen shape rendered inline */}
        <div className="hero-right">
          <div className="phone-wrap">
            <div className="phone">
              <div className="island" />
              <div className="phone-screen"><HomeMockup c={c} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────── HOW IT WORKS ─────────── */}
      <section id="how">
        <div className="section-header">
          <div className="section-kicker">◆ {c('CÓMO FUNCIONA', 'HOW IT WORKS')}</div>
          <h2>{c('JUGAR EN 4 PASOS', 'PLAY IN 4 STEPS')}</h2>
          <p className="section-sub">
            {c(
              'Inscríbete, haz tus picks, gana dinero real. Pago directo a tu cuenta bancaria.',
              'Sign up, lock in your picks, win real cash. Paid straight to your bank account.'
            )}
          </p>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div className="step" key={i}>
              <div className="step-corner">STEP_0{i + 1}</div>
              <div className="step-num">0{i + 1}</div>
              <div className="step-title">{c(s.t_es, s.t_en)}</div>
              <div className="step-desc">{c(s.d_es, s.d_en)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── FEATURES ─────────── */}
      <section id="features">
        <div className="section-header">
          <div className="section-kicker">◆ {c('EL ARSENAL', 'THE ARSENAL')}</div>
          <h2>{c('TODO LO QUE NECESITAS', 'EVERYTHING YOU NEED')}</h2>
          <p className="section-sub">
            {c('Construido para competir. Diseñado para no soltarlo.', 'Built to compete. Designed to never put down.')}
          </p>
        </div>

        <div className="features">
          {FEATURES.map((f, i) => (
            <div className="feature" key={i}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{c(f.t_es, f.t_en)}</h3>
              <p>{c(f.d_es, f.d_en)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── GAMIFICATION ─────────── */}
      <section id="gamify">
        <div className="gamify">
          <div className="gamify-left">
            <div className="section-kicker">◆ {c('SISTEMA DE PROGRESIÓN', 'PROGRESSION SYSTEM')}</div>
            <h2 className="gamify-title">
              {c('CADA PARTIDO', 'EVERY MATCH')}<br />{c('SUMA XP.', 'EARNS XP.')}
            </h2>
            <p className="gamify-sub">
              {c(
                'Sube de Bronce III a Legend. Mantén tu streak encendido. Desbloquea medallas que solo el 1% tiene. Compite no solo contra tus amigos — contra ti mismo.',
                'Climb from Bronze III to Legend. Keep your streak alive. Unlock medals only the 1% holds. Compete not just against friends — against yourself.'
              )}
            </p>
            <div className="streak-chip">🔥 {c('7-día racha', '7-day streak')}</div>
          </div>

          <div className="xp-preview">
            <div className="xp-header">
              <div>
                <div className="xp-kicker">{c('DIVISIÓN', 'DIVISION')}</div>
                <div className="xp-division">{c('ORO I', 'GOLD I')}</div>
              </div>
              <div className="badge gold badge-lg">I</div>
            </div>

            <div className="xp-row">
              <div className="xp-label">XP</div>
              <div className="xp-value">2,340 / 3,000</div>
            </div>
            <div className="xp-bar">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className={`seg${i < 15 ? ' on' : ''}`} />
              ))}
            </div>

            <div className="xp-kicker xp-achievements-label">
              {c('LOGROS · 18 / 50', 'ACHIEVEMENTS · 18 / 50')}
            </div>
            <div className="badges">
              <div className="badge gold">★</div>
              <div className="badge silver">II</div>
              <div className="badge bronze">III</div>
              <div className="badge gold">◆</div>
              <div className="badge silver">★</div>
              <div className="badge locked">?</div>
              <div className="badge locked">?</div>
              <div className="badge locked">?</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── SCREENS SHOWCASE ─────────── */}
      <section id="screens">
        <div className="section-header">
          <div className="section-kicker">◆ {c('VER EL ARENA', 'VIEW THE ARENA')}</div>
          <h2>{c('LA APP EN ACCIÓN', 'THE APP IN ACTION')}</h2>
          <p className="section-sub">
            {c(
              'Cada pantalla diseñada como un HUD de videojuego. Sin fricciones, sin pantallas muertas.',
              'Every screen designed like a video game HUD. No friction, no dead space.'
            )}
          </p>
        </div>

        <div className="screens">
          <div className="screen-card">
            <div className="mockup-scaler"><PickMockup c={c} /></div>
            <div className="screen-label">◆ {c('HACER PICKS', 'MAKE PICKS')}</div>
          </div>
          <div className="screen-card">
            <div className="mockup-scaler"><LiveMockup c={c} /></div>
            <div className="screen-label">◆ {c('PARTIDO EN VIVO', 'LIVE MATCH')}</div>
          </div>
          <div className="screen-card">
            <div className="mockup-scaler"><BoardMockup c={c} /></div>
            <div className="screen-label">◆ {c('CLASIFICACIÓN', 'LEADERBOARD')}</div>
          </div>
          <div className="screen-card">
            <div className="mockup-scaler"><ProfileMockup c={c} /></div>
            <div className="screen-label">◆ {c('PERFIL', 'PROFILE')}</div>
          </div>
        </div>
      </section>

      {/* ─────────── BOTTOM CTA ─────────── */}
      <section className="cta-block" id="signup">
        <div className="brackets">
          <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
        </div>
        <div className="counter">● {c('GANADORES PAGADOS ESTA SEMANA', 'WINNERS PAID THIS WEEK')}</div>
        <h2>
          <span>{c('GANA TU PRIMERA QUINIELA.', 'WIN YOUR FIRST POOL.')}</span><br />
          <span className="cta-accent">{c('COBRA EN EFECTIVO.', 'GET PAID IN CASH.')}</span>
        </h2>
        <p className="section-sub cta-sub">
          {c(
            'Inscripción $50 MXN. El ganador se lleva el 65% del bote. Pago directo a tu cuenta bancaria.',
            '$50 MXN entry. Winner takes 65% of the pot. Direct bank transfer to your account.'
          )}
        </p>

        <div className="cta-row">
          <Link to="/onboarding" className="btn btn-primary btn-lg">
            ▶ {c('Empezar a Ganar', 'Start Winning')}
          </Link>
          <Link to="/login" className="btn btn-ghost btn-lg">
            {c('Ya tengo cuenta', 'I already have an account')}
          </Link>
        </div>
        <div className="form-note cta-note">
          ◆ {c('Pago seguro con Stripe · Mayores de 18 años · México', 'Secure Stripe payments · 18+ · Mexico')}
        </div>
      </section>

      {/* ─────────── FOOTER ─────────── */}
      <footer>
        <div>© 2026 FUTPOOLS · futpools.com</div>
        <div className="links">
          <a href="#">{c('Privacidad', 'Privacy')}</a>
          <a href="#">{c('Términos', 'Terms')}</a>
          <a href="#">{c('Contacto', 'Contact')}</a>
          <a href="#">Twitter/X</a>
        </div>
        <div className="footer-version">◆ v1.0 · LIVE</div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DATA: steps + features (plain JSX for icons so no extra deps)
// ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    t_es: 'Inscríbete', t_en: 'Sign Up',
    d_es: 'Crea tu cuenta con email. Configura tus equipos y ligas favoritas en menos de un minuto.',
    d_en: 'Create your account with email. Set up your favorite teams and leagues in under a minute.',
  },
  {
    t_es: 'Elige Quiniela', t_en: 'Pick a Pool',
    d_es: 'Mundial, Liga MX, Champions, Premier — entra a la quiniela que quieras por $50 MXN.',
    d_en: 'World Cup, Liga MX, Champions, Premier — buy into any pool for $50 MXN.',
  },
  {
    t_es: 'Haz tus Picks', t_en: 'Make Your Picks',
    d_es: '1 · X · 2 en cada partido. Picks bloqueados al kickoff. Pago seguro vía Stripe.',
    d_en: '1 · X · 2 per match. Picks lock at kickoff. Secure payment via Stripe.',
  },
  {
    t_es: 'Cobra', t_en: 'Get Paid',
    d_es: 'El ganador se lleva el 65% del bote. Te depositamos por transferencia bancaria a tu cuenta.',
    d_en: 'Winner takes 65% of the pot. We send a bank transfer straight to your account.',
  },
];

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="12 2 16 8 14 14 10 14 8 8" />
      </svg>
    ),
    t_es: 'Picks Instantáneos', t_en: 'Instant Picks',
    d_es: '1 / X / 2 en un tap. Auto-advance entre partidos. Progress bar visible. 15 picks en 30 segundos.',
    d_en: '1 / X / 2 in one tap. Auto-advance between matches. Progress bar. 15 picks in 30 seconds.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <line x1="2" y1="21" x2="22" y2="21" />
      </svg>
    ),
    t_es: 'Ligas Privadas', t_en: 'Private Leagues',
    d_es: 'Código de invitación, tu grupo, tus reglas. Leaderboard en tiempo real con tus amigos.',
    d_en: 'Invite code, your crew, your rules. Real-time leaderboard with your friends.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    t_es: 'Ranking en Vivo', t_en: 'Live Ranking',
    d_es: 'Leaderboard actualizado gol a gol. Podio top-3 con medallas. Tu posición siempre visible.',
    d_en: 'Leaderboard updated goal by goal. Top-3 podium with medals. Your position always visible.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    t_es: 'Eventos Live', t_en: 'Live Events',
    d_es: 'Feed de goles, tarjetas y sustituciones en tiempo real. Ve cómo cambia tu ranking al momento.',
    d_en: 'Feed of goals, cards and subs in real time. Watch your ranking shift live.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    t_es: 'Multi-Ligas', t_en: 'Multi-League',
    d_es: 'Liga MX, La Liga, Premier, Champions, Copa Libertadores, Mundial. Todo en un solo lugar.',
    d_en: 'Liga MX, La Liga, Premier, Champions, Libertadores, World Cup. All in one place.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3-5.5-3-5.5 3 1-6.3L3 8.9 9 8z" />
      </svg>
    ),
    t_es: 'Achievements', t_en: 'Achievements',
    d_es: '50+ logros por desbloquear. Common → Rare → Epic → Legendary. Presume tu colección.',
    d_en: '50+ to unlock. Common → Rare → Epic → Legendary. Show off your collection.',
  },
];

// ─────────────────────────────────────────────────────────────
// PHONE MOCKUPS — kept inline from the design handoff. Styles are inline
// on each element because the mockups are dense and each one represents a
// different shape; extracting shared helpers would obscure intent.
// ─────────────────────────────────────────────────────────────

function HomeMockup({ c }) {
  const onBar = { flex: 1, height: 4, background: '#21E28C', boxShadow: '0 0 3px #21E28C' };
  const offBar = { flex: 1, height: 4, background: '#18202B' };
  return (
    <div style={{ background: '#07090D', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px 6px', fontFamily: '-apple-system', fontSize: 13, fontWeight: 600, color: '#fff' }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5 }}>
          <svg width="14" height="10" viewBox="0 0 14 10"><rect x="0" y="6" width="2" height="4" fill="#fff" /><rect x="4" y="4" width="2" height="6" fill="#fff" /><rect x="8" y="2" width="2" height="8" fill="#fff" /><rect x="12" y="0" width="2" height="10" fill="#fff" /></svg>
          <svg width="18" height="10" viewBox="0 0 18 10"><rect x="0.5" y="0.5" width="15" height="9" rx="2" stroke="#fff" fill="none" opacity="0.4" /><rect x="2" y="2" width="12" height="6" rx="1" fill="#fff" /></svg>
        </span>
      </div>

      <div style={{ padding: '20px 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'rgba(243,246,251,0.4)', letterSpacing: 2 }}>◆ {c('JUGADOR', 'PLAYER')}</div>
          <div style={{ fontFamily: "'Oxanium',sans-serif", fontWeight: 800, fontSize: 22, marginTop: 2 }}>CARLOS M.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,209,102,0.12)', padding: '6px 10px', clipPath: 'polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)' }}>
          <span style={{ fontFamily: "'Oxanium'", fontWeight: 800, fontSize: 13, color: '#FFD166' }}>🪙 2,340</span>
        </div>
      </div>

      <div style={{ margin: '0 14px 12px', padding: 16, background: '#11161E', clipPath: 'polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, clipPath: 'polygon(50% 0,100% 25%,100% 70%,50% 100%,0 70%,0 25%)', background: 'linear-gradient(180deg,#FFD166,#C99122)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oxanium'", fontWeight: 900, color: '#0A0F16', fontSize: 18 }}>I</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'rgba(243,246,251,0.4)', letterSpacing: 2 }}>{c('DIVISIÓN', 'DIVISION')}</div>
          <div style={{ fontFamily: "'Oxanium',sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: 1, margin: '2px 0 6px' }}>{c('ORO I', 'GOLD I')}</div>
          <div style={{ display: 'flex', gap: 1.5 }}>
            {Array.from({ length: 16 }).map((_, i) => <div key={i} style={i < 12 ? onBar : offBar} />)}
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 18px 6px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(243,246,251,0.5)', letterSpacing: 2 }}>◆ {c('POOLS ACTIVOS', 'ACTIVE POOLS')}</div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ padding: 12, background: '#11161E', clipPath: 'polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>{c('MUNDIAL 2026', 'WORLD CUP 2026')}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'rgba(243,246,251,0.5)', marginTop: 2 }}>{c('Jornada 28 · 12 picks', 'Match Day 28 · 12 picks')}</div>
            </div>
            <span style={{ background: 'rgba(255,59,92,0.15)', color: '#FF3B5C', fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 9, letterSpacing: 1, padding: '3px 7px', clipPath: 'polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)' }}>● {c('EN VIVO', 'LIVE')}</span>
          </div>
          <div style={{ display: 'flex', gap: 1.5, marginTop: 6 }}>
            {Array.from({ length: 20 }).map((_, i) => <div key={i} style={i < 15 ? { flex: 1, height: 3, background: '#21E28C' } : { flex: 1, height: 3, background: '#18202B' }} />)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>
            <span style={{ color: 'rgba(243,246,251,0.5)' }}>{c('RANGO', 'RANK')}</span>
            <span style={{ color: '#21E28C', fontWeight: 700 }}>#3 / 128</span>
          </div>
        </div>
        <div style={{ padding: 12, background: '#11161E', clipPath: 'polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>{c('LIGA MX · AMIGOS', 'LIGA MX · FRIENDS')}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'rgba(243,246,251,0.5)', marginTop: 2 }}>{c('Privado · 8 jugadores', 'Private · 8 players')}</div>
            </div>
            <span style={{ background: 'rgba(33,226,140,0.12)', color: '#21E28C', fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 9, letterSpacing: 1, padding: '3px 7px', clipPath: 'polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)' }}>{c('ABIERTO', 'OPEN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>
            <span style={{ color: 'rgba(243,246,251,0.5)' }}>{c('TUS PICKS', 'YOUR PICKS')}</span>
            <span style={{ color: '#FFD166', fontWeight: 700 }}>⚡ {c('5 pendientes', '5 pending')}</span>
          </div>
        </div>
      </div>

      <div style={{ margin: '14px 14px 0' }}>
        <button style={{ width: '100%', background: '#21E28C', color: '#061018', fontFamily: "'Oxanium'", fontWeight: 800, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', padding: 12, border: 'none', clipPath: 'polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)', boxShadow: '0 0 16px rgba(33,226,140,0.4)' }}>
          ▶ <span>{c('Jugar ya', 'Quick Play')}</span>
        </button>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-around', padding: '10px 0 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(7,9,13,0.9)' }}>
        {[
          { label: c('INICIO', 'HOME'), active: true, icon: <path d="M3 12l9-9 9 9v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" /> },
          { label: 'PICKS', active: false, icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></> },
          { label: c('TIENDA', 'SHOP'), active: false, icon: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="5" /></> },
          { label: c('YO', 'ME'), active: false, icon: <><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></> },
        ].map((tab, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: tab.active ? '#21E28C' : 'rgba(243,246,251,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={tab.active ? 'currentColor' : 'none'} stroke={tab.active ? 'none' : 'currentColor'} strokeWidth="2">{tab.icon}</svg>
            <span style={{ fontFamily: "'Oxanium'", fontSize: 8, letterSpacing: 1.5, fontWeight: 700 }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PickMockup({ c }) {
  const card = { background: '#11161E', padding: 12, clipPath: 'polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)' };
  const pill = { flex: 1, padding: '10px 0', textAlign: 'center', fontFamily: "'Oxanium'", fontWeight: 900, fontSize: 18, clipPath: 'polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)' };
  return (
    <div style={{ background: '#07090D', height: '100%', padding: '24px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#21E28C', letterSpacing: 2 }}>◆ {c('HACER PICKS · 7/15', 'MAKE PICKS · 7/15')}</div>
      <div style={{ display: 'flex', gap: 1.5 }}>
        {Array.from({ length: 15 }).map((_, i) => <div key={i} style={{ flex: 1, height: 3, background: i < 7 ? '#21E28C' : '#18202B' }} />)}
      </div>
      <div style={{ ...card, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 10, color: 'rgba(243,246,251,0.5)', letterSpacing: 1.5 }}>
          <span>REAL MADRID</span><span>BARCELONA</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <div style={{ ...pill, background: '#21E28C', color: '#061018', boxShadow: '0 0 10px rgba(33,226,140,0.5)' }}>1</div>
          <div style={{ ...pill, border: '1px solid rgba(54,233,255,0.4)', color: '#36E9FF' }}>X</div>
          <div style={{ ...pill, border: '1px solid rgba(255,43,214,0.4)', color: '#FF2BD6' }}>2</div>
        </div>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 10, color: 'rgba(243,246,251,0.5)', letterSpacing: 1.5 }}>
          <span>LIVERPOOL</span><span>ARSENAL</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <div style={{ ...pill, border: '1px solid rgba(33,226,140,0.3)', color: 'rgba(33,226,140,0.6)' }}>1</div>
          <div style={{ ...pill, border: '1px solid rgba(54,233,255,0.3)', color: 'rgba(54,233,255,0.6)' }}>X</div>
          <div style={{ ...pill, background: '#FF2BD6', color: '#0A0F16', boxShadow: '0 0 10px rgba(255,43,214,0.5)' }}>2</div>
        </div>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 10, color: 'rgba(243,246,251,0.5)', letterSpacing: 1.5 }}>
          <span>JUVENTUS</span><span>MILAN</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <div style={{ ...pill, border: '1px solid rgba(33,226,140,0.3)', color: 'rgba(33,226,140,0.6)' }}>1</div>
          <div style={{ ...pill, background: '#36E9FF', color: '#0A0F16', boxShadow: '0 0 10px rgba(54,233,255,0.5)' }}>X</div>
          <div style={{ ...pill, border: '1px solid rgba(255,43,214,0.3)', color: 'rgba(255,43,214,0.6)' }}>2</div>
        </div>
      </div>
    </div>
  );
}

function LiveMockup({ c }) {
  const evRow = (time, icon, txt, active = false) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>
      <span style={{ color: active ? '#21E28C' : 'rgba(243,246,251,0.5)', fontWeight: 700 }}>{time}</span>
      <span style={{ color: icon === '🟨' ? '#FFD166' : '#21E28C' }}>{icon}</span>
      <span style={{ color: active ? '#F3F6FB' : 'rgba(243,246,251,0.7)', flex: 1 }}>{txt}</span>
    </div>
  );
  return (
    <div style={{ background: '#07090D', height: '100%', padding: '24px 14px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: '#FF3B5C', color: '#FF3B5C', animation: 'fpPulseDot 1.4s infinite' }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#FF3B5C', letterSpacing: 2 }}>{c("EN VIVO · 68'", "LIVE · 68'")}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 4px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 44, margin: '0 auto', clipPath: 'polygon(50% 0,100% 22%,100% 75%,50% 100%,0 75%,0 22%)', background: 'linear-gradient(180deg,#E3E3F3,#8B8BA7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oxanium'", fontWeight: 800, color: '#fff' }}>RM</div>
          <div style={{ fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 10, marginTop: 6 }}>REAL MADRID</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Oxanium'", fontWeight: 900, fontSize: 36, color: '#21E28C', textShadow: '0 0 16px rgba(33,226,140,0.5)' }}>2 - 1</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: 'rgba(243,246,251,0.4)', letterSpacing: 2, marginTop: 2 }}>{c('2DO TIEMPO', '2ND HALF')}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 44, margin: '0 auto', clipPath: 'polygon(50% 0,100% 22%,100% 75%,50% 100%,0 75%,0 22%)', background: 'linear-gradient(180deg,#A52A2A,#6E1414)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oxanium'", fontWeight: 800, color: '#fff' }}>FC</div>
          <div style={{ fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 10, marginTop: 6 }}>BARCELONA</div>
        </div>
      </div>
      <div style={{ background: '#0B2219', marginTop: 10, height: 100, position: 'relative', clipPath: 'polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)', border: '1px solid rgba(33,226,140,0.28)' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(33,226,140,0.28)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(33,226,140,0.28)' }} />
        <div style={{ position: 'absolute', left: '20%', top: '40%', width: 8, height: 8, borderRadius: '50%', background: '#21E28C', boxShadow: '0 0 12px #21E28C', color: '#21E28C', animation: 'fpPulseDot 1.4s infinite' }} />
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {evRow("67'", '⚽', c('Bellingham · Gol', 'Bellingham · Goal'), true)}
        {evRow("54'", '🟨', c('Gavi · Amarilla', 'Gavi · Yellow'))}
        {evRow("42'", '⚽', c('Vinicius Jr. · Gol', 'Vinicius Jr. · Goal'))}
        {evRow("28'", '⚽', c('Lewandowski · Gol', 'Lewandowski · Goal'))}
      </div>
    </div>
  );
}

function BoardMockup({ c }) {
  const row = (rank, name, pts) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', background: '#11161E', clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}>
      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: 'rgba(243,246,251,0.5)', width: 24 }}>{rank}</span>
      <span style={{ fontFamily: "'Oxanium'", fontWeight: 600, fontSize: 11, flex: 1 }}>{name}</span>
      <span style={{ fontFamily: "'Oxanium'", fontWeight: 800, fontSize: 12, color: '#21E28C' }}>{pts}</span>
    </div>
  );
  return (
    <div style={{ background: '#07090D', height: '100%', padding: '24px 14px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#21E28C', letterSpacing: 2 }}>◆ {c('CLASIFICACIÓN · J28', 'LEADERBOARD · MD28')}</div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, margin: '0 auto', clipPath: 'polygon(50% 0,100% 25%,100% 70%,50% 100%,0 70%,0 25%)', background: 'linear-gradient(180deg,#E6EAF0,#8A92A0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oxanium'", fontWeight: 900, color: '#0A0F16', fontSize: 14 }}>2</div>
          <div style={{ fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 10, marginTop: 4 }}>ANA R.</div>
          <div style={{ width: 32, height: 40, background: 'linear-gradient(180deg,#8A92A0,#4A5060)', margin: '6px auto 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4, fontFamily: "'JetBrains Mono'", fontSize: 9, color: '#fff', fontWeight: 700 }}>228</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, margin: '0 auto', clipPath: 'polygon(50% 0,100% 25%,100% 70%,50% 100%,0 70%,0 25%)', background: 'linear-gradient(180deg,#FFD166,#C99122)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oxanium'", fontWeight: 900, color: '#0A0F16', fontSize: 18, boxShadow: '0 0 14px rgba(255,209,102,0.5)' }}>1</div>
          <div style={{ fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 11, marginTop: 4, color: '#FFD166' }}>LUIS G.</div>
          <div style={{ width: 38, height: 56, background: 'linear-gradient(180deg,#FFD166,#8F6A15)', margin: '6px auto 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4, fontFamily: "'JetBrains Mono'", fontSize: 10, color: '#0A0F16', fontWeight: 700 }}>241</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, margin: '0 auto', clipPath: 'polygon(50% 0,100% 25%,100% 70%,50% 100%,0 70%,0 25%)', background: 'linear-gradient(180deg,#E08855,#9C5234)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oxanium'", fontWeight: 900, color: '#0A0F16', fontSize: 13 }}>3</div>
          <div style={{ fontFamily: "'Oxanium'", fontWeight: 700, fontSize: 10, marginTop: 4 }}>CARLOS M.</div>
          <div style={{ width: 30, height: 30, background: 'linear-gradient(180deg,#9C5234,#5A2F1E)', margin: '6px auto 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4, fontFamily: "'JetBrains Mono'", fontSize: 9, color: '#fff', fontWeight: 700 }}>215</div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {row('#4', 'JORGE D.', 198)}
        {row('#5', 'MARIA V.', 187)}
        {row('#6', 'DIEGO R.', 174)}
      </div>
    </div>
  );
}

function ProfileMockup({ c }) {
  const statCell = (label, value, color) => (
    <div style={{ padding: '10px 12px', background: '#11161E', clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}>
      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: 'rgba(243,246,251,0.5)', letterSpacing: 2 }}>{label}</div>
      <div style={{ fontFamily: "'Oxanium'", fontWeight: 800, fontSize: 18, color, marginTop: 3 }}>{value}</div>
    </div>
  );
  const hexGold = 'linear-gradient(180deg,#FFD166,rgba(0,0,0,0.3))';
  const hexSilver = 'linear-gradient(180deg,#E6EAF0,rgba(0,0,0,0.3))';
  const hexBronze = 'linear-gradient(180deg,#E08855,rgba(0,0,0,0.3))';
  const hexLocked = 'linear-gradient(180deg,#2A3340,#111)';
  const hexBase = { width: '100%', aspectRatio: '1', clipPath: 'polygon(50% 0,100% 25%,100% 70%,50% 100%,0 70%,0 25%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oxanium'", fontWeight: 900, fontSize: 12 };
  return (
    <div style={{ background: '#07090D', height: '100%', padding: '24px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ width: 72, height: 72, margin: '0 auto', background: 'linear-gradient(135deg,#21E28C,#1078B0)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oxanium'", fontWeight: 900, fontSize: 28, color: '#061018', boxShadow: '0 0 20px rgba(33,226,140,0.5)' }}>CM</div>
        <div style={{ fontFamily: "'Oxanium'", fontWeight: 800, fontSize: 18, marginTop: 10, letterSpacing: 1 }}>CARLOS M.</div>
        <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: 'rgba(243,246,251,0.5)', letterSpacing: 2 }}>◆ {c('ID JUGADOR · 4829', 'PLAYER ID · 4829')}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {statCell(c('GANADAS', 'WINS'), '47', '#21E28C')}
        {statCell(c('RACHA', 'STREAK'), '7', '#FF2BD6')}
        {statCell('PICKS', '312', '#36E9FF')}
        {statCell('XP', '2,340', '#FFD166')}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: 'rgba(243,246,251,0.5)', letterSpacing: 2, marginTop: 6 }}>{c('LOGROS · 18 / 50', 'ACHIEVEMENTS · 18 / 50')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
        {[
          { bg: hexGold, glyph: '★', color: '#0A0F16' },
          { bg: hexSilver, glyph: '★', color: '#0A0F16' },
          { bg: hexBronze, glyph: '★', color: '#0A0F16' },
          { bg: hexGold, glyph: '★', color: '#0A0F16' },
          { bg: hexSilver, glyph: '★', color: '#0A0F16' },
          { bg: hexLocked, glyph: '?', color: 'rgba(243,246,251,0.2)' },
          { bg: hexLocked, glyph: '?', color: 'rgba(243,246,251,0.2)' },
          { bg: hexLocked, glyph: '?', color: 'rgba(243,246,251,0.2)' },
          { bg: hexLocked, glyph: '?', color: 'rgba(243,246,251,0.2)' },
          { bg: hexLocked, glyph: '?', color: 'rgba(243,246,251,0.2)' },
        ].map((h, i) => (
          <div key={i} style={{ ...hexBase, background: h.bg, color: h.color }}>{h.glyph}</div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCOPED CSS — everything below lives inside `.fp-landing`. Keep the
// existing --fp-* design tokens from the app; only add landing-specific
// atoms here (phone shell, scanlines, perspective grid, etc.).
// ─────────────────────────────────────────────────────────────

const LANDING_CSS = `
.fp-landing {
  --bg: var(--fp-bg);
  --surface: var(--fp-surface);
  --surface-alt: var(--fp-surface-alt);
  --stroke: var(--fp-stroke);
  --stroke-strong: var(--fp-stroke-strong);
  --text: var(--fp-text);
  --text-dim: var(--fp-text-dim);
  --text-muted: var(--fp-text-muted);
  --text-faint: var(--fp-text-faint);
  --primary: var(--fp-primary);
  --primary-soft: var(--fp-primary-soft);
  --accent: var(--fp-accent);
  --hot: var(--fp-hot);
  --gold: var(--fp-gold);
  --ox: var(--fp-display);
  --mono: var(--fp-mono);
  --body: var(--fp-body);
  --hud-clip: var(--fp-clip);
  --hud-clip-sm: var(--fp-clip-sm);

  font-family: var(--body);
  color: var(--text);
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, rgba(33,226,140,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 80% 40%, rgba(255,43,214,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 20% 70%, rgba(54,233,255,0.06) 0%, transparent 60%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}
.fp-landing a { color: inherit; text-decoration: none; }
.fp-landing button { font-family: inherit; }

/* Scanline overlay (global, subtle) */
.fp-landing::before {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none; z-index: 3;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 3px);
  mix-blend-mode: overlay;
}
/* Vignette */
.fp-landing::after {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none; z-index: 2;
  background: radial-gradient(ellipse 110% 90% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%);
}

.fp-landing .grid-bg {
  position: absolute; left: 0; right: 0; bottom: 0; height: 45%;
  background:
    repeating-linear-gradient(0deg, transparent 0, transparent 39px, rgba(33,226,140,0.25) 39px, rgba(33,226,140,0.25) 40px),
    repeating-linear-gradient(90deg, transparent 0, transparent 39px, rgba(33,226,140,0.25) 39px, rgba(33,226,140,0.25) 40px);
  transform: perspective(400px) rotateX(60deg);
  transform-origin: bottom;
  mask-image: linear-gradient(0deg, black 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(0deg, black 0%, transparent 100%);
  opacity: 0.7;
  pointer-events: none;
}

/* NAV */
.fp-landing nav {
  position: fixed; top: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 32px;
  backdrop-filter: blur(12px);
  background: rgba(7, 9, 13, 0.55);
  border-bottom: 1px solid var(--stroke);
  z-index: 100;
}
.fp-landing .logo {
  font-family: var(--ox); font-weight: 800; font-size: 20px;
  letter-spacing: 3px; color: var(--text);
}
.fp-landing .logo .p { color: var(--primary); text-shadow: 0 0 16px var(--primary); }
.fp-landing .nav-links { display: flex; gap: 28px; align-items: center; font-family: var(--ox); font-weight: 600; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
.fp-landing .nav-links a { color: var(--text-dim); transition: color 0.15s; cursor: pointer; }
.fp-landing .nav-links a:hover { color: var(--primary); }
.fp-landing .nav-right { display: flex; gap: 16px; align-items: center; }
.fp-landing .nav-login {
  font-family: var(--ox); font-weight: 700; font-size: 12px;
  letter-spacing: 2px; text-transform: uppercase;
  color: var(--text-dim);
}
.fp-landing .nav-login:hover { color: var(--primary); }
.fp-landing .btn-nav { padding: 10px 18px; font-size: 12px; }

.fp-landing .lang-switch {
  display: flex; background: rgba(255,255,255,0.04); padding: 3px;
  clip-path: var(--hud-clip-sm);
}
.fp-landing .lang-switch button {
  padding: 6px 10px; font-family: var(--ox); font-size: 11px;
  font-weight: 700; letter-spacing: 1.5px; border: none; cursor: pointer;
  background: transparent; color: var(--text-muted);
  clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
}
.fp-landing .lang-switch button.active { background: var(--primary); color: #061018; }

/* BUTTONS */
.fp-landing .btn {
  font-family: var(--ox); font-weight: 800; letter-spacing: 2px;
  text-transform: uppercase; padding: 14px 24px;
  font-size: 14px; border: none; cursor: pointer;
  clip-path: var(--hud-clip-sm);
  transition: transform 0.1s, box-shadow 0.2s;
  display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none;
}
.fp-landing .btn-primary { background: var(--primary); color: #061018; box-shadow: 0 0 24px rgba(33,226,140,0.5); }
.fp-landing .btn-primary:hover { box-shadow: 0 0 32px rgba(33,226,140,0.75); transform: translateY(-1px); }
.fp-landing .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--stroke-strong); }
.fp-landing .btn-ghost:hover { background: rgba(255,255,255,0.04); border-color: var(--primary); color: var(--primary); }
.fp-landing .btn-lg { padding: 18px 32px; font-size: 16px; }

/* HERO */
.fp-landing .hero {
  position: relative; min-height: 100vh;
  padding: 140px 32px 80px;
  display: grid; grid-template-columns: 1.1fr 1fr; gap: 60px;
  max-width: 1440px; margin: 0 auto; align-items: center;
}
.fp-landing .hero-left { position: relative; z-index: 5; }
.fp-landing .kicker {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 12px;
  color: var(--primary); letter-spacing: 3px; font-weight: 700;
  padding: 6px 12px;
  background: rgba(33,226,140,0.08);
  clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
  margin-bottom: 24px;
}
.fp-landing h1 {
  font-family: var(--ox); font-weight: 900;
  font-size: clamp(44px, 6vw, 84px); line-height: 0.98;
  letter-spacing: -1px; margin: 0 0 24px;
}
.fp-landing h1 .accent { color: var(--primary); text-shadow: 0 0 32px rgba(33,226,140,0.6); }
.fp-landing .hero-sub {
  font-size: 19px; line-height: 1.5; color: var(--text-dim);
  max-width: 520px; margin: 0 0 36px;
}
.fp-landing .hero-cta-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }

.fp-landing .form-note {
  font-family: var(--mono); font-size: 11px; color: var(--text-muted);
  letter-spacing: 1px; text-transform: uppercase;
}
.fp-landing .form-note .ok { color: var(--primary); }

.fp-landing .hero-stats { display: flex; gap: 32px; margin-top: 32px; }
.fp-landing .stat .num {
  font-family: var(--ox); font-weight: 800; font-size: 28px;
  color: var(--text); text-shadow: 0 0 12px rgba(33,226,140,0.3);
}
.fp-landing .stat .num .pct { color: var(--primary); }
.fp-landing .stat .label {
  font-family: var(--mono); font-size: 10px;
  color: var(--text-muted); letter-spacing: 2px; text-transform: uppercase;
  margin-top: 2px;
}

/* Hero phone mockup */
.fp-landing .hero-right { position: relative; display: flex; align-items: center; justify-content: center; z-index: 5; }
.fp-landing .phone-wrap { position: relative; animation: fpFloatPhone 6s ease-in-out infinite; }
.fp-landing .phone-wrap::before {
  content: ''; position: absolute; inset: -60px;
  background: radial-gradient(ellipse 55% 55% at 50% 50%, rgba(33,226,140,0.25) 0%, transparent 65%);
  z-index: -1; pointer-events: none;
}
.fp-landing .phone {
  width: 340px; height: 700px;
  background: #000; border-radius: 48px;
  padding: 12px; position: relative;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 30px 80px rgba(0,0,0,0.6), 0 0 80px rgba(33,226,140,0.25);
}
.fp-landing .phone-screen { width: 100%; height: 100%; background: var(--bg); border-radius: 38px; overflow: hidden; position: relative; }
.fp-landing .island {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  width: 110px; height: 32px; background: #000; border-radius: 20px; z-index: 10;
}

@keyframes fpFloatPhone {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-14px) rotate(-1deg); }
}
@keyframes fpBlink {
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0.3; }
}
@keyframes fpPulseDot {
  0% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  70% { box-shadow: 0 0 0 8px transparent; opacity: 0.6; }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
}
.fp-landing .kicker::before { content: '◆'; animation: fpBlink 1.4s infinite; }

/* SECTIONS */
.fp-landing section { position: relative; padding: 100px 32px; max-width: 1440px; margin: 0 auto; }
.fp-landing .section-header { text-align: center; margin-bottom: 64px; }
.fp-landing .section-kicker {
  font-family: var(--mono); font-size: 12px;
  color: var(--primary); letter-spacing: 4px; text-transform: uppercase;
  margin-bottom: 14px;
}
.fp-landing h2 {
  font-family: var(--ox); font-weight: 900;
  font-size: clamp(32px, 4.5vw, 56px); line-height: 1;
  letter-spacing: -0.5px; margin: 0 0 16px;
}
.fp-landing .section-sub { color: var(--text-dim); max-width: 640px; margin: 0 auto; font-size: 17px; line-height: 1.5; }

/* STEPS */
.fp-landing .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; position: relative; }
.fp-landing .step {
  position: relative; padding: 32px 24px;
  background: var(--surface);
  clip-path: var(--hud-clip);
  transition: transform 0.2s;
}
.fp-landing .step:hover { transform: translateY(-4px); }
.fp-landing .step::before {
  content: ''; position: absolute; inset: 0;
  clip-path: var(--hud-clip);
  background: linear-gradient(135deg, rgba(33,226,140,0.25) 0%, transparent 40%, transparent 60%, rgba(33,226,140,0.15) 100%);
  padding: 1px;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none;
}
.fp-landing .step-num {
  font-family: var(--ox); font-weight: 900; font-size: 48px; color: var(--primary);
  text-shadow: 0 0 18px rgba(33,226,140,0.6); line-height: 1; margin-bottom: 16px; opacity: 0.85;
}
.fp-landing .step-title {
  font-family: var(--ox); font-weight: 700; font-size: 18px;
  letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;
}
.fp-landing .step-desc { color: var(--text-dim); font-size: 14px; line-height: 1.5; }
.fp-landing .step-corner {
  position: absolute; top: 10px; right: 14px;
  font-family: var(--mono); font-size: 9px;
  color: var(--text-muted); letter-spacing: 2px;
}

/* FEATURES */
.fp-landing .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.fp-landing .feature {
  padding: 32px 28px; position: relative;
  background: var(--surface);
  clip-path: var(--hud-clip);
  min-height: 240px;
  overflow: hidden;
}
.fp-landing .feature::before {
  content: ''; position: absolute; inset: 0;
  clip-path: var(--hud-clip);
  background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.08) 100%);
  padding: 1px;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none;
}
.fp-landing .feature-icon {
  width: 52px; height: 52px; margin-bottom: 20px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(33,226,140,0.1);
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  color: var(--primary);
}
.fp-landing .feature h3 {
  font-family: var(--ox); font-weight: 700;
  font-size: 20px; letter-spacing: 1px; text-transform: uppercase;
  margin: 0 0 12px;
}
.fp-landing .feature p { color: var(--text-dim); font-size: 14px; line-height: 1.55; margin: 0; }

/* GAMIFICATION */
.fp-landing .gamify {
  display: grid; grid-template-columns: 1fr 1fr; gap: 48px;
  align-items: center; padding: 80px 32px;
}
.fp-landing .gamify-title { text-align: left; font-size: clamp(32px, 4vw, 48px); }
.fp-landing .gamify-sub { text-align: left; max-width: none; margin-bottom: 24px; color: var(--text-dim); font-size: 17px; line-height: 1.5; }
.fp-landing .xp-preview { padding: 32px; background: var(--surface); clip-path: var(--hud-clip); max-width: 400px; }
.fp-landing .xp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.fp-landing .xp-kicker { font-family: var(--mono); font-size: 10px; color: var(--text-muted); letter-spacing: 2px; }
.fp-landing .xp-division { font-family: var(--ox); font-weight: 800; font-size: 22px; letter-spacing: 1.5px; }
.fp-landing .xp-achievements-label { margin-bottom: 10px; }
.fp-landing .xp-row { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
.fp-landing .xp-label { font-family: var(--mono); font-size: 11px; color: var(--text-muted); letter-spacing: 2px; text-transform: uppercase; flex: 0 0 80px; }
.fp-landing .xp-value { font-family: var(--ox); font-weight: 700; font-size: 14px; letter-spacing: 1px; color: var(--text); margin-left: auto; }
.fp-landing .xp-bar { display: flex; gap: 2px; height: 10px; margin: 8px 0 24px; }
.fp-landing .xp-bar .seg { flex: 1; background: var(--surface-alt); }
.fp-landing .xp-bar .seg.on { background: var(--primary); box-shadow: 0 0 6px rgba(33,226,140,0.7); }
.fp-landing .badges { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
.fp-landing .badge {
  width: 48px; height: 48px;
  clip-path: polygon(50% 0, 100% 25%, 100% 70%, 50% 100%, 0 70%, 0 25%);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--ox); font-weight: 900; color: #0A0F16;
}
.fp-landing .badge-lg { width: 56px; height: 56px; font-size: 22px; }
.fp-landing .badge.gold { background: linear-gradient(180deg, #FFD166, #C99122); }
.fp-landing .badge.silver { background: linear-gradient(180deg, #E6EAF0, #8A92A0); }
.fp-landing .badge.bronze { background: linear-gradient(180deg, #E08855, #9C5234); }
.fp-landing .badge.locked { background: linear-gradient(180deg, #2A3340, #1A2130); color: var(--text-faint); font-size: 20px; }
.fp-landing .streak-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  background: rgba(255,43,214,0.15);
  color: var(--hot);
  font-family: var(--ox); font-weight: 700; font-size: 12px;
  letter-spacing: 1.5px; text-transform: uppercase;
  clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
  margin-top: 8px;
}

/* SCREENS */
.fp-landing .screens { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.fp-landing .screen-card {
  position: relative;
  background: var(--surface);
  clip-path: var(--hud-clip);
  aspect-ratio: 9/19.5;
  overflow: hidden;
  transition: transform 0.3s;
  container-type: inline-size;
}
.fp-landing .screen-card:hover { transform: translateY(-6px); }
.fp-landing .screen-card::after {
  content: ''; position: absolute; inset: 0;
  clip-path: var(--hud-clip);
  background: linear-gradient(135deg, rgba(33,226,140,0.18) 0%, transparent 50%);
  padding: 1px;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
}
/* Mockups were designed for a ~300x650 phone screen. The screen-card can
   be as narrow as ~180px on mobile, so we render each mockup at its native
   design size inside this scaler and scale uniformly to fill the card.
   The cqw unit (container query width) reads the card's current inline
   size, so the factor recalculates on resize without JS. */
.fp-landing .mockup-scaler {
  position: absolute;
  top: 0; left: 0;
  width: 300px;
  height: 650px;
  transform-origin: top left;
  transform: scale(calc(100cqw / 300px));
  pointer-events: none;
}
.fp-landing .mockup-scaler > div { width: 100%; height: 100%; }
.fp-landing .screen-label {
  position: absolute; bottom: 12px; left: 14px; right: 14px;
  font-family: var(--mono); font-size: 10px;
  color: var(--primary); letter-spacing: 2px;
  background: rgba(0,0,0,0.75); padding: 4px 8px;
  text-transform: uppercase; z-index: 3;
}

/* BOTTOM CTA */
.fp-landing .cta-block {
  text-align: center; padding: 100px 32px; position: relative;
}
.fp-landing .cta-block h2 { font-size: clamp(36px, 5.5vw, 72px); }
.fp-landing .cta-accent { color: var(--primary); text-shadow: 0 0 32px rgba(33,226,140,0.6); }
.fp-landing .cta-sub { margin-top: 20px; }
.fp-landing .cta-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin: 32px 0 16px; }
.fp-landing .cta-note { display: inline-block; margin-top: 4px; }
.fp-landing .counter {
  display: inline-flex; gap: 8px; margin-bottom: 32px;
  font-family: var(--ox); font-weight: 700; font-size: 13px;
  letter-spacing: 2px; text-transform: uppercase;
  padding: 8px 16px; background: rgba(255,43,214,0.1);
  color: var(--hot);
  clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
}
.fp-landing .counter::before { content: '●'; animation: fpBlink 1.2s infinite; }

/* FOOTER */
.fp-landing footer {
  border-top: 1px solid var(--stroke);
  padding: 40px 32px;
  max-width: 1440px; margin: 0 auto;
  display: flex; justify-content: space-between; align-items: center;
  font-family: var(--mono); font-size: 11px;
  color: var(--text-muted); letter-spacing: 1.5px;
  flex-wrap: wrap; gap: 16px;
}
.fp-landing footer .links { display: flex; gap: 24px; }
.fp-landing footer a:hover { color: var(--primary); }
.fp-landing .footer-version { color: var(--primary); }

/* Decorative corner brackets */
.fp-landing .brackets { position: absolute; inset: 0; pointer-events: none; }
.fp-landing .brackets span { position: absolute; width: 18px; height: 18px; }
.fp-landing .brackets .tl { top: 10px; left: 10px; border-top: 2px solid var(--primary); border-left: 2px solid var(--primary); }
.fp-landing .brackets .tr { top: 10px; right: 10px; border-top: 2px solid var(--primary); border-right: 2px solid var(--primary); }
.fp-landing .brackets .bl { bottom: 10px; left: 10px; border-bottom: 2px solid var(--primary); border-left: 2px solid var(--primary); }
.fp-landing .brackets .br { bottom: 10px; right: 10px; border-bottom: 2px solid var(--primary); border-right: 2px solid var(--primary); }

/* ─────────── Responsive ───────────
   Tiers:
     · Desktop        > 1100px   2-col hero, 4-col steps, 3-col features
     · Small desktop  ≤ 1100px   tighter gaps, 2-col features
     · Tablet / phone ≤ 960px    single column, smaller phone mockup
     · Phone          ≤ 640px    stacked CTAs, 1-col features, tuned type
     · Small phone    ≤ 380px    hide lang switch, single-col screens */
@media (max-width: 1100px) {
  .fp-landing nav { padding: 16px 24px; }
  .fp-landing .hero { gap: 40px; padding: 130px 24px 70px; }
  .fp-landing section { padding: 80px 24px; }
  .fp-landing .features { grid-template-columns: repeat(2, 1fr); }
  .fp-landing .nav-links { gap: 20px; font-size: 12px; }
}
@media (max-width: 960px) {
  .fp-landing nav { padding: 14px 20px; }
  .fp-landing .nav-links { display: none; }
  .fp-landing .hero {
    grid-template-columns: 1fr;
    padding: 110px 20px 60px;
    gap: 40px;
    text-align: center;
  }
  .fp-landing .hero-left { text-align: center; }
  .fp-landing .hero-sub { margin-left: auto; margin-right: auto; }
  .fp-landing .hero-cta-row { justify-content: center; }
  .fp-landing .hero-stats { justify-content: center; flex-wrap: wrap; gap: 24px; }
  .fp-landing .phone { width: 300px; height: 620px; }
  .fp-landing .steps { grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .fp-landing .gamify { grid-template-columns: 1fr; padding: 60px 20px; gap: 32px; }
  .fp-landing .xp-preview { max-width: 100%; margin: 0 auto; }
  .fp-landing .gamify-title, .fp-landing .gamify-sub { text-align: center; }
  .fp-landing .streak-chip { display: inline-flex; }
  .fp-landing .gamify-left { text-align: center; }
  .fp-landing .screens { grid-template-columns: repeat(2, 1fr); }
  .fp-landing section { padding: 70px 20px; }
  .fp-landing .section-header { margin-bottom: 48px; }
}
@media (max-width: 640px) {
  .fp-landing nav { padding: 12px 16px; gap: 8px; }
  .fp-landing .nav-right { gap: 10px; }
  .fp-landing .logo { font-size: 17px; letter-spacing: 2px; }
  .fp-landing .nav-login { display: none; }
  .fp-landing .btn-nav { padding: 9px 14px; font-size: 11px; letter-spacing: 1.5px; }

  .fp-landing .hero { padding: 100px 16px 40px; gap: 28px; }
  .fp-landing .kicker { font-size: 10px; letter-spacing: 2px; padding: 5px 10px; margin-bottom: 18px; }
  .fp-landing h1 { font-size: clamp(34px, 9vw, 52px); margin-bottom: 18px; }
  .fp-landing .hero-sub { font-size: 15px; margin-bottom: 24px; }
  .fp-landing .hero-cta-row { flex-direction: column; align-items: stretch; gap: 10px; width: 100%; }
  .fp-landing .btn-lg { padding: 15px 22px; font-size: 14px; justify-content: center; width: 100%; }
  .fp-landing .form-note { font-size: 10px; }
  .fp-landing .hero-stats { gap: 18px; margin-top: 24px; }
  .fp-landing .stat .num { font-size: 22px; }
  .fp-landing .stat .label { font-size: 9px; }

  .fp-landing .phone { width: 240px; height: 500px; border-radius: 40px; padding: 10px; }
  .fp-landing .phone-screen { border-radius: 32px; }
  .fp-landing .island { width: 82px; height: 24px; }
  .fp-landing .phone-wrap::before { inset: -40px; }

  .fp-landing section { padding: 56px 16px; }
  .fp-landing .section-header { margin-bottom: 36px; }
  .fp-landing h2 { font-size: clamp(26px, 8vw, 40px); }
  .fp-landing .section-sub { font-size: 14px; }
  .fp-landing .section-kicker { font-size: 10px; letter-spacing: 3px; }

  .fp-landing .steps { grid-template-columns: 1fr; gap: 12px; }
  .fp-landing .step { padding: 22px 18px; }
  .fp-landing .step-num { font-size: 36px; margin-bottom: 10px; }
  .fp-landing .step-title { font-size: 16px; }

  .fp-landing .features { grid-template-columns: 1fr; gap: 12px; }
  .fp-landing .feature { padding: 22px 18px; min-height: auto; }

  .fp-landing .xp-preview { padding: 22px; }
  .fp-landing .badge { width: 40px; height: 40px; font-size: 13px; }
  .fp-landing .badge-lg { width: 48px; height: 48px; font-size: 18px; }

  .fp-landing .screens { grid-template-columns: 1fr 1fr; gap: 12px; }

  .fp-landing .cta-block { padding: 72px 16px; }
  .fp-landing .counter { font-size: 11px; letter-spacing: 1.5px; padding: 6px 12px; margin-bottom: 22px; }
  .fp-landing .cta-row { flex-direction: column; align-items: stretch; gap: 10px; margin: 26px auto 14px; max-width: 360px; }
  .fp-landing .cta-row .btn { width: 100%; justify-content: center; }
  .fp-landing .cta-sub { margin-top: 16px; }

  .fp-landing footer { flex-direction: column; text-align: center; padding: 28px 16px; gap: 12px; }
  .fp-landing footer .links { flex-wrap: wrap; justify-content: center; gap: 16px; }
}
@media (max-width: 380px) {
  .fp-landing nav { gap: 6px; }
  .fp-landing .nav-right { gap: 6px; }
  .fp-landing .lang-switch { display: none; }
  .fp-landing .logo { font-size: 15px; letter-spacing: 1.5px; }
  .fp-landing .btn-nav { padding: 8px 12px; font-size: 10px; }
  .fp-landing .phone { width: 220px; height: 460px; }
  .fp-landing .screens { grid-template-columns: 1fr; }
  .fp-landing .hero-stats { gap: 14px; }
  .fp-landing h1 { font-size: clamp(30px, 9.5vw, 44px); }
}
`;
