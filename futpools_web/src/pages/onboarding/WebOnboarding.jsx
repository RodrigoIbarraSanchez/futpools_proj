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
  // Selected popular team enum keys + popular league enum keys.
  const [teamKeys, setTeamKeys] = useState(new Set());
  const [leagueKeys, setLeagueKeys] = useState(new Set([WORLD_CUP.key]));
  // Custom picks from the API search — keyed by api-football id so the
  // chip metadata (name, logo, country) sticks even after the user
  // clears the search bar. Mirrors iOS's customTeams / customLeagues.
  const [customTeams, setCustomTeams] = useState(new Map());
  const [customLeagues, setCustomLeagues] = useState(new Map());

  const advance = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const back = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  // Persist on each state change so localStorage is the source of truth
  // for AuthContext.register/login to read after signup.
  useEffect(() => {
    persistSelections(teamKeys, leagueKeys, customTeams, customLeagues);
  }, [teamKeys, leagueKeys, customTeams, customLeagues]);

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
            customTeams={customTeams} setCustomTeams={setCustomTeams}
            customLeagues={customLeagues} setCustomLeagues={setCustomLeagues}
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
      {/* Desktop 2-column layout: hero/copy on left, mock pool card on
          right. Below ~1100px the right column hides and the hero
          centers as a single column. */}
      <div className="onb-welcome-left">
        <div className="brand">FUT<span>POOLS</span></div>
        <h1>
          {locale === 'es' ? 'GANA DINERO REAL' : 'WIN REAL CASH'}<br />
          <span className="accent">
            {locale === 'es' ? 'PREDICIENDO FÚTBOL' : 'PREDICTING FOOTBALL'}
          </span>
        </h1>
        <p className="lede">
          {locale === 'es'
            ? 'Inscríbete por $50 MXN. El ganador se lleva el 65% del premio acumulado, depositado por transferencia bancaria a tu cuenta.'
            : 'Pay $50 MXN to enter. Winner takes 65% of the prize pool, deposited by bank transfer to your account.'}
        </p>

        <div className="badges">
          <div className="badge-pill">
            {locale === 'es' ? '⚡ Pago seguro' : '⚡ Secure payment'}
          </div>
          <div className="badge-pill">
            {locale === 'es' ? '🔒 Stripe' : '🔒 Stripe'}
          </div>
          <div className="badge-pill">
            {locale === 'es' ? '🏆 Mundial · Liga MX' : '🏆 World Cup · Liga MX'}
          </div>
        </div>

        <div className="onb-cta-row">
          <button className="onb-cta-primary" onClick={onContinue}>
            ▶ {locale === 'es' ? 'EMPEZAR' : 'GET STARTED'}
          </button>
          <Link to="/login" className="onb-cta-secondary">
            {locale === 'es' ? 'Ya tengo cuenta' : 'I already have an account'}
          </Link>
        </div>
      </div>

      <div className="onb-welcome-right" aria-hidden="true">
        <div className="onb-mock-card">
          <div className="onb-mock-header">
            <div className="onb-mock-status">
              <span className="onb-mock-dot" /> {locale === 'es' ? 'EN VIVO' : 'LIVE'}
            </div>
            <div className="onb-mock-id">{locale === 'es' ? 'QUINIELA MUNDIAL · 0014' : 'WORLD CUP POOL · 0014'}</div>
          </div>
          <div className="onb-mock-prize">
            <div className="onb-mock-label">{locale === 'es' ? 'PREMIO ACUMULADO' : 'PRIZE POOL'}</div>
            <div className="onb-mock-amount">$2,925 MXN</div>
            <div className="onb-mock-meta">90 {locale === 'es' ? 'JUGADORES' : 'PLAYERS'} · 65% {locale === 'es' ? 'AL GANADOR' : 'TO WINNER'}</div>
          </div>
          <div className="onb-mock-fixture">
            <span className="onb-mock-team">MEX</span>
            <span className="onb-mock-score">2 – 1</span>
            <span className="onb-mock-team">USA</span>
          </div>
          <div className="onb-mock-fixture">
            <span className="onb-mock-team">BRA</span>
            <span className="onb-mock-score">3 – 0</span>
            <span className="onb-mock-team">ARG</span>
          </div>
          <div className="onb-mock-fixture">
            <span className="onb-mock-team">ESP</span>
            <span className="onb-mock-score">— —</span>
            <span className="onb-mock-team">FRA</span>
          </div>
          <div className="onb-mock-pick">
            <span className="onb-mock-pick-label">{locale === 'es' ? 'TU PICK' : 'YOUR PICK'}</span>
            <span className="onb-mock-pick-value">1 · MEX</span>
          </div>
        </div>
        <div className="onb-mock-trophy">🏆</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2 — Teams + Leagues prefs (World Cup featured)
// ─────────────────────────────────────────────────────────────────────

function PrefsScreen({
  locale, teamKeys, setTeamKeys, leagueKeys, setLeagueKeys,
  customTeams, setCustomTeams, customLeagues, setCustomLeagues,
  onContinue,
}) {
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
  const toggleCustomTeam = (team) => {
    // If the API returned a team whose id matches a popular enum,
    // mirror the iOS logic and flip the enum key instead — keeps the
    // visual selection state in sync with whichever cell rendered the
    // pick. Otherwise add/remove from the custom map.
    const popular = POPULAR_TEAMS.find((p) => p.id === team.id);
    if (popular) { toggleTeam(popular.key); return; }
    setCustomTeams((prev) => {
      const next = new Map(prev);
      if (next.has(team.id)) next.delete(team.id);
      else next.set(team.id, team);
      return next;
    });
  };
  const toggleCustomLeague = (league) => {
    const popular = [...LEAGUES, WORLD_CUP].find((p) => p.id === league.id);
    if (popular) { toggleLeague(popular.key); return; }
    setCustomLeagues((prev) => {
      const next = new Map(prev);
      if (next.has(league.id)) next.delete(league.id);
      else next.set(league.id, league);
      return next;
    });
  };
  const removeCustomTeam = (id) => {
    setCustomTeams((prev) => { const next = new Map(prev); next.delete(id); return next; });
  };
  const removeCustomLeague = (id) => {
    setCustomLeagues((prev) => { const next = new Map(prev); next.delete(id); return next; });
  };
  const wcSelected = leagueKeys.has(WORLD_CUP.key);

  // ── Search state + debounced API calls ────────────────────────────
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [teamResults, setTeamResults] = useState([]);
  const [leagueResults, setLeagueResults] = useState([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setTeamResults([]); setLeagueResults([]); setIsSearching(false);
      return undefined;
    }
    setIsSearching(true);
    // 350ms debounce mirrors the iOS OnbPrefsSearchVM cancellation
    // window — fires the request only once the user pauses typing.
    const handle = setTimeout(async () => {
      try {
        const [teams, leagues] = await Promise.all([
          api.get(`/football/teams/search?query=${encodeURIComponent(trimmed)}`),
          api.get(`/football/leagues/search?query=${encodeURIComponent(trimmed)}`),
        ]);
        setTeamResults(Array.isArray(teams) ? teams : []);
        setLeagueResults(Array.isArray(leagues) ? leagues : []);
      } catch {
        // Network/API failure → empty results, no banner. The user can
        // still pick from popular sections + retry by editing the query.
        setTeamResults([]); setLeagueResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  const hasQuery = query.trim().length >= 2;
  const hasAnySelection = teamKeys.size > 0 || leagueKeys.size > 0
    || customTeams.size > 0 || customLeagues.size > 0;

  return (
    <div className="onb-prefs">
      <div className="onb-eyebrow">{locale === 'es' ? 'PASO 02' : 'STEP 02'}</div>
      <h2>{locale === 'es' ? 'ELIGE TUS EQUIPOS Y LIGAS' : 'PICK YOUR TEAMS AND LEAGUES'}</h2>
      <p className="onb-sub">
        {locale === 'es'
          ? 'Te mostraremos primero las quinielas de tus equipos y ligas favoritos.'
          : "We'll show pools from your favorite teams and leagues first."}
      </p>

      {/* Search bar — pinned above the sections so it's the first thing
          the user sees on the screen. Mirrors iOS OnbPrefsScreen. */}
      <SearchBar
        locale={locale}
        value={query}
        onChange={setQuery}
        isSearching={isSearching}
      />

      {/* "TUS SELECCIONES" pill row — survives across search clears so
          the user never loses sight of what they've picked. Identical
          rule as iOS: every active selection (popular + custom) shown
          as a removable chip. */}
      {hasAnySelection && (
        <SelectionsRow
          locale={locale}
          teamKeys={teamKeys}
          leagueKeys={leagueKeys}
          customTeams={customTeams}
          customLeagues={customLeagues}
          onRemoveTeam={(key) => toggleTeam(key)}
          onRemoveLeague={(key) => toggleLeague(key)}
          onRemoveCustomTeam={removeCustomTeam}
          onRemoveCustomLeague={removeCustomLeague}
        />
      )}

      {hasQuery ? (
        // Search results — teams + leagues sections, each hidden when empty.
        <>
          {isSearching && teamResults.length === 0 && leagueResults.length === 0 && (
            <div className="onb-search-loading">
              {locale === 'es' ? 'Buscando…' : 'Searching…'}
            </div>
          )}
          {!isSearching && teamResults.length === 0 && leagueResults.length === 0 && (
            <div className="onb-search-empty">
              <div>{locale === 'es' ? 'Sin resultados' : 'No matches'}</div>
              <div className="onb-search-empty-sub">
                {locale === 'es'
                  ? 'Intenta con otro nombre de equipo o liga.'
                  : 'Try a different team or league name.'}
              </div>
            </div>
          )}
          {teamResults.length > 0 && (
            <>
              <div className="onb-section-label">
                ◆ {locale === 'es' ? 'EQUIPOS' : 'TEAMS'}
              </div>
              <div className="onb-grid">
                {teamResults.map((t) => {
                  const popular = POPULAR_TEAMS.find((p) => p.id === t.id);
                  const active = popular ? teamKeys.has(popular.key) : customTeams.has(t.id);
                  return (
                    <button
                      key={`team-${t.id}`}
                      type="button"
                      className={'onb-cell' + (active ? ' active' : '')}
                      onClick={() => toggleCustomTeam(t)}
                    >
                      {t.logo
                        ? <img src={t.logo} alt="" className="onb-cell-logo" />
                        : <span className="onb-cell-fallback">⚽</span>}
                      <div className="onb-cell-name">{t.name}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {leagueResults.length > 0 && (
            <>
              <div className="onb-section-label" style={{ marginTop: 18 }}>
                ◆ {locale === 'es' ? 'LIGAS' : 'LEAGUES'}
              </div>
              <div className="onb-grid">
                {leagueResults.map((l) => {
                  const popular = [...LEAGUES, WORLD_CUP].find((p) => p.id === l.id);
                  const active = popular ? leagueKeys.has(popular.key) : customLeagues.has(l.id);
                  return (
                    <button
                      key={`league-${l.id}`}
                      type="button"
                      className={'onb-cell' + (active ? ' active' : '')}
                      onClick={() => toggleCustomLeague(l)}
                    >
                      {l.logo
                        ? <img src={l.logo} alt="" className="onb-cell-logo" />
                        : <span className="onb-cell-fallback">🏆</span>}
                      <div className="onb-cell-name">{l.name}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        // No query → curated popular sections (World Cup featured + grid).
        <>
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
        </>
      )}

      <div className="onb-footer">
        <button className="onb-cta-primary" onClick={onContinue}>
          ▶ {locale === 'es' ? 'SIGUIENTE' : 'NEXT'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Search bar — controlled input with a clear (×) button on the right
// and a small spinner-style label when the API is in flight.
// ─────────────────────────────────────────────────────────────────────

function SearchBar({ locale, value, onChange, isSearching }) {
  return (
    <div className="onb-search">
      <span className="onb-search-icon">⌕</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={locale === 'es' ? 'Busca equipos o ligas' : 'Search teams or leagues'}
        className="onb-search-input"
      />
      {isSearching && <span className="onb-search-spinner">…</span>}
      {value && (
        <button
          type="button"
          className="onb-search-clear"
          onClick={() => onChange('')}
          aria-label="clear"
        >×</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Horizontal pill row of every currently-selected team/league. Always
// visible whenever the user has any pick, so search-and-clear doesn't
// visually erase their previous choices.
// ─────────────────────────────────────────────────────────────────────

function SelectionsRow({
  locale, teamKeys, leagueKeys, customTeams, customLeagues,
  onRemoveTeam, onRemoveLeague, onRemoveCustomTeam, onRemoveCustomLeague,
}) {
  const teamPills = POPULAR_TEAMS.filter((t) => teamKeys.has(t.key));
  // Include World Cup in the leagues list since it lives separately
  // from the LEAGUES array but the user does select it as a league.
  const leaguePills = [WORLD_CUP, ...LEAGUES].filter((l) => leagueKeys.has(l.key));
  const customTeamList = Array.from(customTeams.values());
  const customLeagueList = Array.from(customLeagues.values());
  return (
    <>
      <div className="onb-section-label">
        ◆ {locale === 'es' ? 'TUS SELECCIONES' : 'YOUR SELECTIONS'}
      </div>
      <div className="onb-selections">
        {teamPills.map((t) => (
          <SelectionPill
            key={`pop-team-${t.key}`}
            label={t.name}
            logo={teamLogo(t.id)}
            onRemove={() => onRemoveTeam(t.key)}
          />
        ))}
        {leaguePills.map((l) => (
          <SelectionPill
            key={`pop-league-${l.key}`}
            label={l.name}
            logo={leagueLogo(l.id)}
            onRemove={() => onRemoveLeague(l.key)}
          />
        ))}
        {customTeamList.map((t) => (
          <SelectionPill
            key={`custom-team-${t.id}`}
            label={t.name}
            logo={t.logo}
            onRemove={() => onRemoveCustomTeam(t.id)}
          />
        ))}
        {customLeagueList.map((l) => (
          <SelectionPill
            key={`custom-league-${l.id}`}
            label={l.name}
            logo={l.logo}
            onRemove={() => onRemoveCustomLeague(l.id)}
          />
        ))}
      </div>
    </>
  );
}

function SelectionPill({ label, logo, onRemove }) {
  return (
    <button type="button" className="onb-selection-pill" onClick={onRemove}>
      {logo && <img src={logo} alt="" className="onb-selection-logo" />}
      <span className="onb-selection-name">{label}</span>
      <span className="onb-selection-x">×</span>
    </button>
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

function persistSelections(teamKeys, leagueKeys, customTeams, customLeagues) {
  // Mirrors iOS OnboardingState.persist():
  //   onboardingTeams           — popular team enum rawValues
  //   onboardingLeagues         — popular league enum rawValues
  //   onboardingCustomTeamIDs   — api-football ids of custom search picks
  //   onboardingCustomLeagueIDs — same for leagues
  // AuthContext.register reads them back after signup and ships to
  // /users/me/onboarding with the 'api:<id>' prefix for customs.
  try {
    localStorage.setItem('onboardingTeams', JSON.stringify(Array.from(teamKeys)));
    localStorage.setItem('onboardingLeagues', JSON.stringify(Array.from(leagueKeys)));
    localStorage.setItem('onboardingCustomTeamIDs',
      JSON.stringify(customTeams ? Array.from(customTeams.keys()) : []));
    localStorage.setItem('onboardingCustomLeagueIDs',
      JSON.stringify(customLeagues ? Array.from(customLeagues.keys()) : []));
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
    radial-gradient(ellipse 60% 50% at 30% 0%, rgba(33,226,140,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 50% 50% at 80% 80%, rgba(255,209,102,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 80% 30%, rgba(54,233,255,0.05) 0%, transparent 60%);
}
/* Subtle scanlines + vignette so empty desktop space doesn't feel flat */
.onb-root::before {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none; z-index: 0;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px);
  mix-blend-mode: overlay;
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
.onb-welcome {
  display: flex; flex-direction: column; align-items: center;
  gap: 24px; padding-top: 24px; text-align: center;
}
.onb-welcome-left {
  display: flex; flex-direction: column; align-items: center; gap: 18px;
  width: 100%;
}
.onb-welcome-right { display: none; }  /* hidden under tablet breakpoint */
.brand {
  font-family: var(--fp-brand, var(--fp-display)); font-weight: 800;
  font-size: 22px; letter-spacing: 6px;
  color: var(--fp-text-muted);
}
.brand span { color: var(--fp-primary); text-shadow: 0 0 12px var(--fp-primary); }
.onb-welcome h1 {
  font-family: var(--fp-display); font-weight: 900;
  font-size: 34px; line-height: 1.05; letter-spacing: 1.5px;
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
.onb-cta-row {
  display: flex; flex-direction: column; align-items: center;
  gap: 4px; margin-top: 8px;
}

/* Welcome mock card — visible from tablet up. Stylized 'live pool'
   preview that mirrors the in-app pool detail layout. */
.onb-mock-card {
  position: relative;
  width: 100%; max-width: 360px;
  padding: 20px; padding-top: 24px;
  background: linear-gradient(180deg, var(--fp-surface-alt), var(--fp-surface));
  border: 1px solid var(--fp-stroke-strong);
  clip-path: var(--fp-clip);
  box-shadow: 0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(33,226,140,0.18);
}
.onb-mock-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.onb-mock-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--fp-mono); font-size: 10px; font-weight: 800;
  color: var(--fp-danger); letter-spacing: 1.5px;
}
.onb-mock-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--fp-danger);
  box-shadow: 0 0 6px var(--fp-danger);
}
.onb-mock-id {
  font-family: var(--fp-mono); font-size: 9px; letter-spacing: 1.3px;
  color: var(--fp-text-muted);
}
.onb-mock-prize {
  padding: 16px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--fp-gold) 18%, transparent), transparent);
  border: 1px solid color-mix(in srgb, var(--fp-gold) 35%, transparent);
  clip-path: var(--fp-clip-sm);
  margin-bottom: 14px;
}
.onb-mock-label {
  font-family: var(--fp-mono); font-size: 9px; font-weight: 700;
  letter-spacing: 1.5px; color: var(--fp-text-muted);
}
.onb-mock-amount {
  font-family: var(--fp-display); font-weight: 900;
  font-size: 28px; letter-spacing: 1px; color: var(--fp-gold);
  margin-top: 4px; text-shadow: 0 0 20px rgba(255,209,102,0.4);
}
.onb-mock-meta {
  font-family: var(--fp-mono); font-size: 9px; letter-spacing: 1.2px;
  color: var(--fp-text-dim); margin-top: 6px;
}
.onb-mock-fixture {
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center; padding: 10px 12px; margin-bottom: 6px;
  background: var(--fp-bg2); clip-path: var(--fp-clip-sm);
  font-family: var(--fp-display); font-weight: 800;
  font-size: 13px; letter-spacing: 1.5px;
}
.onb-mock-team:first-child { text-align: left; }
.onb-mock-team:last-child { text-align: right; }
.onb-mock-score {
  color: var(--fp-primary);
  font-family: var(--fp-mono); font-weight: 800; font-size: 14px;
  padding: 0 14px;
}
.onb-mock-pick {
  display: flex; align-items: center; gap: 8px;
  margin-top: 10px;
}
.onb-mock-pick-label {
  font-family: var(--fp-mono); font-size: 9px; font-weight: 700;
  letter-spacing: 1.4px; color: var(--fp-text-muted);
}
.onb-mock-pick-value {
  font-family: var(--fp-display); font-weight: 900; font-size: 12px;
  letter-spacing: 1.5px;
  padding: 4px 10px; clip-path: var(--fp-clip-sm);
  background: var(--fp-primary); color: var(--fp-on-primary);
}
.onb-mock-trophy {
  display: none;
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

/* Search bar */
.onb-search {
  display: flex; align-items: center; gap: 8px;
  padding: 0 12px;
  background: var(--fp-surface);
  border: 1px solid var(--fp-stroke);
  clip-path: var(--fp-clip-sm);
  margin-bottom: 14px;
  transition: border-color 0.15s;
}
.onb-search:focus-within { border-color: var(--fp-primary); }
.onb-search-icon {
  font-size: 16px; color: var(--fp-text-dim); flex-shrink: 0;
}
.onb-search-input {
  flex: 1; height: 44px;
  background: transparent; border: none; outline: none;
  color: var(--fp-text); font-family: var(--fp-body); font-size: 14px;
}
.onb-search-input::placeholder { color: var(--fp-text-faint); }
.onb-search-spinner {
  font-family: var(--fp-mono); font-size: 16px; font-weight: 800;
  color: var(--fp-primary); animation: onb-spin 1s ease-in-out infinite;
}
@keyframes onb-spin {
  0%, 100% { opacity: 0.4; } 50% { opacity: 1; }
}
.onb-search-clear {
  width: 22px; height: 22px;
  background: var(--fp-bg2); border: 1px solid var(--fp-stroke);
  border-radius: 50%; cursor: pointer;
  color: var(--fp-text-muted); font-size: 14px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.onb-search-clear:hover { color: var(--fp-text); border-color: var(--fp-text-muted); }
.onb-search-loading, .onb-search-empty {
  text-align: center; padding: 28px 16px;
  font-family: var(--fp-mono); font-size: 12px;
  color: var(--fp-text-dim);
}
.onb-search-empty > div:first-child {
  font-family: var(--fp-display); font-weight: 800; font-size: 14px;
  color: var(--fp-text); margin-bottom: 4px;
}
.onb-search-empty-sub {
  font-family: var(--fp-mono); font-size: 11px; color: var(--fp-text-faint);
}

/* Selections pill row — horizontal scroll on mobile, wraps on desktop */
.onb-selections {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-bottom: 8px;
}
.onb-selection-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: var(--fp-primary); color: var(--fp-on-primary);
  border: none; cursor: pointer;
  clip-path: var(--fp-clip-sm);
  font-family: var(--fp-mono); font-size: 11px; font-weight: 700;
  letter-spacing: 0.4px;
  max-width: 200px;
}
.onb-selection-pill:hover { filter: brightness(1.05); }
.onb-selection-logo {
  width: 16px; height: 16px; object-fit: contain; flex-shrink: 0;
}
.onb-selection-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.onb-selection-x {
  font-size: 14px; font-weight: 900; opacity: 0.85; flex-shrink: 0;
}

/* Cell fallback when a search result has no logo URL */
.onb-cell-fallback {
  font-size: 28px; opacity: 0.55; line-height: 1;
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

/* ─────────────────────────────────────────────────────────────
 * Tablet (≥768) — wider container, 4-col team grid, mock card
 * shows up at end of welcome flow as a stacked preview below.
 * ───────────────────────────────────────────────────────────── */
@media (min-width: 768px) {
  .onb-topbar { padding: 24px 32px 8px; max-width: 920px; }
  .onb-main { padding: 24px 32px; max-width: 920px; }

  .onb-welcome { padding-top: 36px; gap: 36px; }
  .onb-welcome h1 { font-size: 48px; }
  .onb-welcome .lede { font-size: 16px; max-width: 560px; }
  .onb-welcome-right { display: flex; justify-content: center; }

  .onb-prefs h2 { font-size: 30px; }
  .onb-sub { font-size: 14px; max-width: 580px; }
  .onb-grid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .onb-cell { min-height: 104px; }
  .onb-cell-logo { width: 44px; height: 44px; }
  .onb-cell-name { font-size: 12px; }

  .onb-wc-card { padding: 20px 24px; }
  .onb-wc-logo { width: 64px; height: 64px; }
  .onb-wc-title { font-size: 20px; }
  .onb-wc-desc { font-size: 12px; }

  .onb-gate h2 { font-size: 40px; }
  .onb-gate-icon { font-size: 88px; }
  .onb-bullet { font-size: 14px; padding: 14px 18px; }
}

/* ─────────────────────────────────────────────────────────────
 * Desktop (≥1100) — welcome becomes a 2-column hero (copy left,
 * mock pool card right). Prefs container widens, 6-col grids.
 * ───────────────────────────────────────────────────────────── */
@media (min-width: 1100px) {
  .onb-topbar { max-width: 1100px; padding: 28px 48px 12px; }
  .onb-main { max-width: 1100px; padding: 40px 48px; }

  /* Welcome — split layout */
  .onb-welcome {
    flex-direction: row; align-items: center; justify-content: space-between;
    gap: 56px; padding-top: 40px; text-align: left;
  }
  .onb-welcome-left {
    align-items: flex-start; max-width: 520px; flex: 1;
  }
  .onb-welcome-right { flex-shrink: 0; }
  .brand { font-size: 24px; }
  .onb-welcome h1 { font-size: 60px; line-height: 1; letter-spacing: 1px; }
  .onb-welcome .lede {
    font-size: 17px; max-width: 460px;
    margin: 8px 0 12px;
  }
  .badges { justify-content: flex-start; }
  .onb-cta-row {
    flex-direction: row; align-items: center; gap: 16px;
    margin-top: 14px;
  }
  .onb-cta-primary { font-size: 16px; padding: 18px 32px; min-width: 220px; }

  /* Prefs — wider grids + bigger featured card */
  .onb-prefs { max-width: 980px; margin: 0 auto; }
  .onb-grid { grid-template-columns: repeat(6, 1fr); gap: 14px; }
  .onb-cell { min-height: 116px; }
  .onb-cell-logo { width: 48px; height: 48px; }
  .onb-wc-card { padding: 24px 28px; gap: 20px; }
  .onb-wc-logo { width: 78px; height: 78px; }
  .onb-wc-title { font-size: 22px; }
  .onb-wc-desc { font-size: 13px; }

  /* Gate stays centered but a bit roomier */
  .onb-gate { padding-top: 50px; }
  .onb-gate h2 { font-size: 44px; }
  .onb-gate-icon { font-size: 100px; }
  .onb-bullets { max-width: 480px; }
}

/* Extra wide (≥1440) — push container limit so very large displays
   don't strand the hero in a narrow column. */
@media (min-width: 1440px) {
  .onb-topbar, .onb-main { max-width: 1240px; }
  .onb-welcome h1 { font-size: 68px; }
  .onb-mock-card { max-width: 400px; }
}
`;
