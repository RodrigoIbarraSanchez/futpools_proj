/**
 * Web onboarding — 3 screens (welcome → prefs → account gate). Mirrors
 * the iOS pre-signup flow but with money-prize messaging since web has
 * no Apple Review constraint.
 *
 * Persistence: each step writes the captured selections to localStorage
 * under the same keys iOS uses (onboardingTeams, onboardingLeagues,
 * onboardingCustomTeamIDs, onboardingCustomLeagueIDs). AuthContext.register
 * picks them up post-signup and ships them to /users/me/onboarding —
 * same endpoint iOS calls — so the user's preferences land on the
 * backend regardless of which platform they signed up from.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLocale } from '../../context/LocaleContext';
import { t, tFormat } from '../../i18n/translations';
import { api } from '../../api/client';

const STEPS = ['welcome', 'prefs', 'gate'];

// ── Onboarding-curated popular teams + leagues. Mirrors the iOS enums
//    OnbTeam and OnboardingLeague — same api-football IDs so a user
//    who finishes onboarding on web and later installs iOS sees their
//    selections preserved (both platforms persist by enum rawValue).
const POPULAR_TEAMS = [
  { id: 541, key: 'realMadrid', name: 'Real Madrid' },
  { id: 529, key: 'barcelona',  name: 'Barcelona' },
  { id: 33,  key: 'manUnited',  name: 'Manchester United' },
  { id: 85,  key: 'psg',        name: 'PSG' },
  { id: 50,  key: 'manCity',    name: 'Manchester City' },
  { id: 40,  key: 'liverpool',  name: 'Liverpool' },
  { id: 157, key: 'bayern',     name: 'Bayern Munich' },
  { id: 496, key: 'juventus',   name: 'Juventus' },
  { id: 49,  key: 'chelsea',    name: 'Chelsea' },
];

const LEAGUES = [
  { id: 262, key: 'ligaMX',    name: 'Liga MX',          flag: '🇲🇽' },
  { id: 2,   key: 'champions', name: 'Champions League', flag: '⚽' },
  { id: 140, key: 'laLiga',    name: 'LaLiga',           flag: '🇪🇸' },
  { id: 39,  key: 'premier',   name: 'Premier League',   flag: '🇬🇧' },
  { id: 253, key: 'mls',       name: 'MLS',              flag: '🇺🇸' },
];

const WORLD_CUP = { id: 1, key: 'worldCup', name: 'World Cup', flag: '🏆' };
const teamLogo = (id) => `https://media.api-sports.io/football/teams/${id}.png`;
const leagueLogo = (id) => `https://media.api-sports.io/football/leagues/${id}.png`;

export function WebOnboarding() {
  const navigate = useNavigate();
  const { locale, setLocale } = useLocale();
  const [step, setStep] = useState(STEPS[0]);
  // Selected popular team enum keys + custom api-football team IDs +
  // selected popular league enum keys + custom league IDs. Two
  // separate lists per type matches the iOS persistence schema.
  const [teamKeys, setTeamKeys] = useState(new Set());
  const [leagueKeys, setLeagueKeys] = useState(new Set([WORLD_CUP.key]));

  const advance = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const back = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  // Persist on each step transition so localStorage is always the
  // source of truth for AuthContext.register to read after signup.
  useEffect(() => {
    persistSelections(teamKeys, leagueKeys);
  }, [teamKeys, leagueKeys]);

  return (
    <div className="onb-root">
      <style>{ONB_CSS}</style>
      <div className="onb-bg" />
      <header className="onb-topbar">
        {step !== 'welcome' && (
          <button className="onb-back" onClick={back} aria-label="back">←</button>
        )}
        <ProgressBar current={STEPS.indexOf(step) + 1} total={STEPS.length} />
        <div className="onb-lang">
          <button
            className={locale === 'en' ? 'active' : ''}
            onClick={() => setLocale('en')}
          >EN</button>
          <button
            className={locale === 'es' ? 'active' : ''}
            onClick={() => setLocale('es')}
          >ES</button>
        </div>
      </header>

      <main className="onb-main">
        {step === 'welcome' && (
          <WelcomeScreen locale={locale} onContinue={advance} />
        )}
        {step === 'prefs' && (
          <PrefsScreen
            locale={locale}
            teamKeys={teamKeys} setTeamKeys={setTeamKeys}
            leagueKeys={leagueKeys} setLeagueKeys={setLeagueKeys}
            onContinue={advance}
          />
        )}
        {step === 'gate' && (
          <GateScreen locale={locale} navigate={navigate} />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 1 — Welcome (real-money pitch)
// ─────────────────────────────────────────────────────────────────────

function WelcomeScreen({ locale, onContinue }) {
  return (
    <div className="onb-welcome">
      <div className="onb-hero">
        <div className="trophy-glow">🏆</div>
        <div className="brand">FUT<span>POOLS</span></div>
        <h1>
          {locale === 'es' ? 'GANA DINERO REAL' : 'WIN REAL CASH'}<br />
          <span className="accent">
            {locale === 'es' ? 'PREDICIENDO FÚTBOL' : 'PREDICTING FOOTBALL'}
          </span>
        </h1>
        <p className="lede">
          {locale === 'es'
            ? 'Inscríbete por $50 MXN. El ganador se lleva el 65% del bote acumulado, depositado por transferencia bancaria a tu cuenta.'
            : 'Pay $50 MXN to enter. Winner takes 65% of the prize pool, deposited by bank transfer to your account.'}
        </p>

        <div className="badges">
          <div className="badge-pill">
            {locale === 'es' ? '⚡ Pago instantáneo' : '⚡ Fast payout'}
          </div>
          <div className="badge-pill">
            {locale === 'es' ? '🔒 Stripe seguro' : '🔒 Stripe secure'}
          </div>
          <div className="badge-pill">
            {locale === 'es' ? '🏆 Mundial · Liga MX · Champions' : '🏆 World Cup · Liga MX · Champions'}
          </div>
        </div>

        <button className="onb-cta-primary" onClick={onContinue}>
          ▶ {locale === 'es' ? 'EMPEZAR' : 'GET STARTED'}
        </button>
        <Link to="/login" className="onb-cta-secondary">
          {locale === 'es' ? 'Ya tengo cuenta' : 'I already have an account'}
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2 — Teams + Leagues prefs (World Cup featured)
// ─────────────────────────────────────────────────────────────────────

function PrefsScreen({ locale, teamKeys, setTeamKeys, leagueKeys, setLeagueKeys, onContinue }) {
  const toggleTeam = (key) => {
    setTeamKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleLeague = (key) => {
    setLeagueKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const wcSelected = leagueKeys.has(WORLD_CUP.key);

  return (
    <div className="onb-prefs">
      <div className="onb-eyebrow">{locale === 'es' ? 'PASO 02' : 'STEP 02'}</div>
      <h2>{locale === 'es' ? 'ELIGE TUS EQUIPOS Y LIGAS' : 'PICK YOUR TEAMS AND LEAGUES'}</h2>
      <p className="onb-sub">
        {locale === 'es'
          ? 'Te mostraremos primero las quinielas de tus equipos y ligas favoritos.'
          : "We'll show pools from your favorite teams and leagues first."}
      </p>

      {/* World Cup featured row */}
      <div className="onb-section-label">
        ◆ {locale === 'es' ? 'DESTACADO' : 'FEATURED'}
      </div>
      <button
        type="button"
        className={'onb-wc-card' + (wcSelected ? ' active' : '')}
        onClick={() => toggleLeague(WORLD_CUP.key)}
      >
        <img src={leagueLogo(WORLD_CUP.id)} alt="" className="onb-wc-logo" />
        <div className="onb-wc-text">
          <div className="onb-wc-title">
            <span>{locale === 'es' ? 'COPA DEL MUNDO' : 'WORLD CUP'}</span>
            <span className="onb-wc-badge">{locale === 'es' ? 'EN 30 DÍAS' : 'IN 30 DAYS'}</span>
          </div>
          <div className="onb-wc-desc">
            {locale === 'es'
              ? 'Las quinielas más grandes del año. No te las pierdas.'
              : "The year's biggest pools. Don't miss out."}
          </div>
        </div>
        <div className="onb-wc-check">{wcSelected ? '✓' : '+'}</div>
      </button>

      {/* Popular teams grid */}
      <div className="onb-section-label" style={{ marginTop: 18 }}>
        ◆ {locale === 'es' ? 'EQUIPOS POPULARES' : 'POPULAR TEAMS'}
      </div>
      <div className="onb-grid">
        {POPULAR_TEAMS.map((t) => {
          const active = teamKeys.has(t.key);
          return (
            <button
              key={t.key}
              type="button"
              className={'onb-cell' + (active ? ' active' : '')}
              onClick={() => toggleTeam(t.key)}
            >
              <img src={teamLogo(t.id)} alt="" className="onb-cell-logo" />
              <div className="onb-cell-name">{t.name}</div>
            </button>
          );
        })}
      </div>

      {/* Other leagues grid */}
      <div className="onb-section-label" style={{ marginTop: 18 }}>
        ◆ {locale === 'es' ? 'OTRAS LIGAS' : 'OTHER LEAGUES'}
      </div>
      <div className="onb-grid">
        {LEAGUES.map((l) => {
          const active = leagueKeys.has(l.key);
          return (
            <button
              key={l.key}
              type="button"
              className={'onb-cell' + (active ? ' active' : '')}
              onClick={() => toggleLeague(l.key)}
            >
              <img src={leagueLogo(l.id)} alt="" className="onb-cell-logo" />
              <div className="onb-cell-name">{l.name}</div>
            </button>
          );
        })}
      </div>

      <div className="onb-footer">
        <button className="onb-cta-primary" onClick={onContinue}>
          ▶ {locale === 'es' ? 'SIGUIENTE' : 'NEXT'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 3 — Account gate (signup CTA, no register form here — defers
//          to /register which handles the full form). We mark
//          hasSeenWebOnboarding so visiting / again skips this flow.
// ─────────────────────────────────────────────────────────────────────

function GateScreen({ locale, navigate }) {
  const goSignup = () => {
    localStorage.setItem('hasSeenWebOnboarding', 'true');
    navigate('/register');
  };
  const goLogin = () => {
    localStorage.setItem('hasSeenWebOnboarding', 'true');
    navigate('/login');
  };
  return (
    <div className="onb-gate">
      <div className="onb-gate-hero">
        <div className="onb-gate-icon">👤</div>
        <h2>{locale === 'es' ? 'ÚLTIMO PASO' : 'LAST STEP'}</h2>
        <p className="onb-sub">
          {locale === 'es'
            ? 'Crea tu cuenta para guardar tus preferencias y empezar a jugar por dinero real.'
            : 'Create your account to save your preferences and start playing for real money.'}
        </p>
        <div className="onb-bullets">
          <div className="onb-bullet">
            <span className="onb-bullet-check">✓</span>
            {locale === 'es' ? 'Tus equipos y ligas favoritas guardadas' : 'Your favorite teams and leagues saved'}
          </div>
          <div className="onb-bullet">
            <span className="onb-bullet-check">✓</span>
            {locale === 'es' ? 'Inscripción a quinielas con un tap' : 'One-tap entry to any pool'}
          </div>
          <div className="onb-bullet">
            <span className="onb-bullet-check">✓</span>
            {locale === 'es' ? 'Pago seguro con Stripe + premios por transferencia' : 'Secure Stripe payments + bank transfer prizes'}
          </div>
        </div>
        <button className="onb-cta-primary" onClick={goSignup}>
          ▶ {locale === 'es' ? 'CREAR CUENTA GRATIS' : 'CREATE FREE ACCOUNT'}
        </button>
        <button className="onb-cta-secondary" onClick={goLogin}>
          {locale === 'es' ? 'Ya tengo cuenta' : 'I already have an account'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  return (
    <div className="onb-progress">
      <div className="onb-progress-step">{String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
      <div className="onb-progress-track">
        <div className="onb-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}

function persistSelections(teamKeys, leagueKeys) {
  // Mirrors iOS OnboardingState.persist():
  //   onboardingTeams       — popular team enum rawValues (e.g. "realMadrid")
  //   onboardingLeagues     — popular league enum rawValues
  //   onboardingCustomTeamIDs   — api-football ids of custom search picks (web doesn't surface
  //                                custom search yet — list stays empty for now)
  //   onboardingCustomLeagueIDs — same
  // AuthContext.register reads them back after signup.
  try {
    localStorage.setItem('onboardingTeams', JSON.stringify(Array.from(teamKeys)));
    localStorage.setItem('onboardingLeagues', JSON.stringify(Array.from(leagueKeys)));
    localStorage.setItem('onboardingCustomTeamIDs', '[]');
    localStorage.setItem('onboardingCustomLeagueIDs', '[]');
  } catch {
    // localStorage can throw on Safari private mode — non-blocking.
  }
}

// ─────────────────────────────────────────────────────────────────────
// Inline CSS — scoped to .onb-root, mirrors landing's HUD aesthetic.
// Includes tablet (≥768px) + desktop (≥1100px) breakpoints.
// ─────────────────────────────────────────────────────────────────────

const ONB_CSS = `
.onb-root {
  position: relative;
  min-height: 100vh;
  background: var(--fp-bg);
  color: var(--fp-text);
  font-family: var(--fp-body);
  overflow-x: hidden;
  padding-bottom: 40px;
}
.onb-bg {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, rgba(33,226,140,0.10) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 80% 60%, rgba(54,233,255,0.05) 0%, transparent 60%);
}
.onb-topbar {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 12px;
  padding: 16px 16px 8px;
  max-width: 720px; margin: 0 auto;
}
.onb-back {
  background: none; border: 1px solid var(--fp-stroke);
  color: var(--fp-text-muted); cursor: pointer;
  width: 36px; height: 36px;
  font-size: 16px; font-family: var(--fp-display); font-weight: 800;
  clip-path: var(--fp-clip-sm);
}
.onb-back:hover { color: var(--fp-primary); border-color: var(--fp-primary); }

.onb-progress { flex: 1; display: flex; align-items: center; gap: 10px; }
.onb-progress-step {
  font-family: var(--fp-mono); font-size: 11px; letter-spacing: 1.5px;
  color: var(--fp-text-muted); font-weight: 700;
}
.onb-progress-track {
  flex: 1; height: 4px; background: var(--fp-bg2); position: relative;
  border-radius: 2px; overflow: hidden;
}
.onb-progress-fill {
  height: 100%; background: var(--fp-primary);
  box-shadow: 0 0 8px var(--fp-primary);
  transition: width 0.3s ease;
}
.onb-lang {
  display: flex; background: rgba(255,255,255,0.04); padding: 2px;
  clip-path: var(--fp-clip-sm);
}
.onb-lang button {
  padding: 4px 8px; font-family: var(--fp-display); font-size: 10px;
  font-weight: 700; letter-spacing: 1.5px; border: none; cursor: pointer;
  background: transparent; color: var(--fp-text-muted);
}
.onb-lang button.active { background: var(--fp-primary); color: var(--fp-on-primary); }

.onb-main {
  position: relative; z-index: 1;
  padding: 16px;
  max-width: 720px; margin: 0 auto;
}

/* Welcome */
.onb-welcome { text-align: center; padding-top: 30px; }
.onb-hero { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.trophy-glow {
  font-size: 110px; line-height: 1;
  filter: drop-shadow(0 0 40px var(--fp-primary)) drop-shadow(0 0 60px var(--fp-gold));
}
.brand {
  font-family: var(--fp-brand, var(--fp-display)); font-weight: 800;
  font-size: 22px; letter-spacing: 6px;
  color: var(--fp-text-muted);
}
.brand span { color: var(--fp-primary); text-shadow: 0 0 12px var(--fp-primary); }
.onb-welcome h1 {
  font-family: var(--fp-display); font-weight: 900;
  font-size: 32px; line-height: 1.05; letter-spacing: 1.5px;
  margin: 0; color: var(--fp-text);
}
.onb-welcome h1 .accent {
  color: var(--fp-gold); text-shadow: 0 0 20px rgba(255,209,102,0.4);
}
.onb-welcome .lede {
  font-size: 14px; color: var(--fp-text-dim); max-width: 460px;
  line-height: 1.55; margin: 4px 0 8px;
}
.badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 4px 0 10px; }
.badge-pill {
  padding: 6px 12px;
  background: color-mix(in srgb, var(--fp-primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fp-primary) 30%, transparent);
  clip-path: var(--fp-clip-sm);
  font-family: var(--fp-mono); font-size: 11px; font-weight: 700;
  color: var(--fp-primary); letter-spacing: 0.6px;
}

.onb-cta-primary {
  background: var(--fp-primary); color: var(--fp-on-primary);
  font-family: var(--fp-display); font-weight: 900; font-size: 15px;
  letter-spacing: 2.5px; padding: 16px 28px; min-width: 240px;
  border: none; cursor: pointer;
  clip-path: var(--fp-clip-sm);
  box-shadow: 0 0 28px rgba(33,226,140,0.5);
  transition: transform 0.1s, box-shadow 0.2s;
}
.onb-cta-primary:hover { transform: translateY(-1px); box-shadow: 0 0 36px rgba(33,226,140,0.8); }
.onb-cta-secondary {
  background: transparent; color: var(--fp-text-dim);
  font-family: var(--fp-mono); font-size: 12px; font-weight: 700;
  letter-spacing: 1.5px; padding: 10px 16px; cursor: pointer;
  border: none; text-decoration: none;
  display: inline-block; margin-top: 4px;
}
.onb-cta-secondary:hover { color: var(--fp-primary); }

/* Prefs */
.onb-prefs h2 {
  font-family: var(--fp-display); font-weight: 900;
  font-size: 22px; letter-spacing: 1.5px; margin: 4px 0;
  text-align: center;
}
.onb-eyebrow {
  font-family: var(--fp-mono); font-size: 11px; letter-spacing: 2px;
  color: var(--fp-text-muted); text-align: center; margin-bottom: 4px;
}
.onb-sub {
  font-size: 13px; color: var(--fp-text-dim); text-align: center;
  margin: 0 0 16px; max-width: 480px; margin-inline: auto;
}
.onb-section-label {
  font-family: var(--fp-mono); font-size: 10px; font-weight: 700;
  letter-spacing: 2px; color: var(--fp-text-muted); margin: 12px 0 8px;
}

.onb-wc-card {
  display: flex; align-items: center; gap: 14px;
  width: 100%; padding: 14px;
  background: color-mix(in srgb, var(--fp-primary) 5%, var(--fp-surface));
  border: 1px solid color-mix(in srgb, var(--fp-primary) 35%, transparent);
  clip-path: var(--fp-clip-sm); cursor: pointer;
  text-align: left; color: var(--fp-text);
  transition: background 0.15s, border-color 0.15s;
}
.onb-wc-card:hover { border-color: var(--fp-primary); }
.onb-wc-card.active {
  background: var(--fp-primary); color: var(--fp-on-primary);
  border-color: var(--fp-primary);
}
.onb-wc-logo { width: 48px; height: 48px; object-fit: contain; }
.onb-wc-text { flex: 1; }
.onb-wc-title {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--fp-display); font-weight: 900;
  font-size: 15px; letter-spacing: 1.5px;
}
.onb-wc-badge {
  font-family: var(--fp-mono); font-size: 9px; font-weight: 700;
  letter-spacing: 1.2px; padding: 3px 6px;
  background: var(--fp-danger); color: var(--fp-on-primary);
  clip-path: var(--fp-clip-sm);
}
.onb-wc-desc {
  font-family: var(--fp-mono); font-size: 11px;
  color: color-mix(in srgb, currentColor 70%, transparent);
  margin-top: 4px;
}
.onb-wc-check {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 900;
  color: var(--fp-primary);
}
.onb-wc-card.active .onb-wc-check { color: var(--fp-on-primary); }

.onb-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.onb-cell {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 6px; min-height: 86px;
  background: var(--fp-surface);
  border: 1px solid var(--fp-stroke);
  clip-path: var(--fp-clip-sm); cursor: pointer;
  color: var(--fp-text);
  transition: background 0.15s, border-color 0.15s;
}
.onb-cell:hover { border-color: var(--fp-primary); }
.onb-cell.active {
  background: var(--fp-primary);
  border-color: var(--fp-primary);
  color: var(--fp-on-primary);
}
.onb-cell-logo { width: 36px; height: 36px; object-fit: contain; }
.onb-cell-name {
  font-family: var(--fp-display); font-weight: 800; font-size: 11px;
  letter-spacing: 0.4px; text-align: center; line-height: 1.15;
}

.onb-footer {
  position: sticky; bottom: 0; left: 0; right: 0;
  padding-top: 18px; padding-bottom: 4px;
  background: linear-gradient(180deg, transparent, var(--fp-bg) 30%);
  display: flex; justify-content: center;
}

/* Gate */
.onb-gate { padding-top: 30px; }
.onb-gate-hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.onb-gate-icon {
  font-size: 64px; line-height: 1;
  filter: drop-shadow(0 0 30px var(--fp-primary));
}
.onb-gate h2 {
  font-family: var(--fp-display); font-weight: 900;
  font-size: 28px; letter-spacing: 2px; margin: 0;
}
.onb-bullets { display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
.onb-bullet {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  background: var(--fp-surface);
  border: 1px solid var(--fp-stroke);
  clip-path: var(--fp-clip-sm);
  font-size: 13px; color: var(--fp-text);
  text-align: left;
}
.onb-bullet-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--fp-primary); color: var(--fp-on-primary);
  font-weight: 900; font-size: 11px; flex-shrink: 0;
}

/* Tablet (≥768) */
@media (min-width: 768px) {
  .onb-main { padding: 32px 40px; }
  .onb-welcome h1 { font-size: 44px; }
  .onb-welcome .lede { font-size: 16px; max-width: 540px; }
  .trophy-glow { font-size: 140px; }
  .onb-prefs h2 { font-size: 28px; }
  .onb-grid { grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .onb-cell { min-height: 100px; }
  .onb-cell-logo { width: 44px; height: 44px; }
  .onb-cell-name { font-size: 12px; }
  .onb-wc-card { padding: 18px; }
  .onb-wc-logo { width: 60px; height: 60px; }
  .onb-wc-title { font-size: 18px; }
  .onb-wc-desc { font-size: 12px; }
  .onb-gate h2 { font-size: 36px; }
  .onb-gate-icon { font-size: 80px; }
}

/* Desktop (≥1100) — wider container, 5-column grids */
@media (min-width: 1100px) {
  .onb-main { max-width: 880px; padding: 40px; }
  .onb-grid { grid-template-columns: repeat(5, 1fr); gap: 12px; }
  .onb-welcome { padding-top: 60px; }
  .onb-welcome h1 { font-size: 56px; line-height: 1; }
  .onb-cta-primary { font-size: 17px; padding: 18px 36px; min-width: 280px; }
}
`;
