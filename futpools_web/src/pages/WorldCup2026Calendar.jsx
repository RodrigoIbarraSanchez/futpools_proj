/**
 * /calendariomundial2026 — public, no-auth page that lets visitors export
 * every FIFA World Cup 2026 match to their calendar of choice in three
 * steps:
 *
 *   1. Pick scope (all 104 matches / my teams / my teams + knockout)
 *   2. Pick teams + preview timezone
 *   3. Subscribe (iPhone, Google Calendar, Android) or download .ics
 *
 * The backend serves the .ics from /world-cup-2026/calendar.ics with the
 * same filter query params so the same URL works for both download AND
 * webcal:// subscription. The page replicates the flow of
 * calendariomundial2026.com but is styled with FutPools' arcade/HUD
 * design language (Oxanium display, neon green primary, clip-path
 * corner-cuts, scanlines).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { api } from '../api/client';

// Where the API lives. In production we hit the same origin via the
// reverse proxy; in dev Vite proxies `/api` → :3000. Some flows (webcal:
// subscription URLs, Google Calendar's `cid` param) need an ABSOLUTE
// URL, so derive that from window.location.
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const absoluteApiBase = () => {
  if (typeof window === 'undefined') return API_BASE;
  if (API_BASE.startsWith('http')) return API_BASE;
  return window.location.origin + API_BASE;
};

const TIMEZONES = [
  { value: 'America/Mexico_City',    label_es: 'México (CDMX)',        label_en: 'Mexico (CDMX)' },
  { value: 'America/Monterrey',      label_es: 'México (Norte)',       label_en: 'Mexico (North)' },
  { value: 'America/Tijuana',        label_es: 'México (Pacífico)',    label_en: 'Mexico (Pacific)' },
  { value: 'America/New_York',       label_es: 'EE.UU. — Este (EDT)',  label_en: 'USA — East (EDT)' },
  { value: 'America/Chicago',        label_es: 'EE.UU. — Centro',      label_en: 'USA — Central' },
  { value: 'America/Denver',         label_es: 'EE.UU. — Montaña',     label_en: 'USA — Mountain' },
  { value: 'America/Los_Angeles',    label_es: 'EE.UU. — Pacífico',    label_en: 'USA — Pacific' },
  { value: 'America/Toronto',        label_es: 'Canadá (Toronto)',     label_en: 'Canada (Toronto)' },
  { value: 'America/Vancouver',      label_es: 'Canadá (Vancouver)',   label_en: 'Canada (Vancouver)' },
  { value: 'America/Argentina/Buenos_Aires', label_es: 'Argentina',    label_en: 'Argentina' },
  { value: 'America/Sao_Paulo',      label_es: 'Brasil (BRT)',         label_en: 'Brazil (BRT)' },
  { value: 'America/Bogota',         label_es: 'Colombia',             label_en: 'Colombia' },
  { value: 'America/Lima',           label_es: 'Perú',                 label_en: 'Peru' },
  { value: 'America/Santiago',       label_es: 'Chile',                label_en: 'Chile' },
  { value: 'Europe/Madrid',          label_es: 'España (CEST)',        label_en: 'Spain (CEST)' },
  { value: 'Europe/London',          label_es: 'Reino Unido',          label_en: 'United Kingdom' },
  { value: 'Asia/Tokyo',             label_es: 'Japón (JST)',          label_en: 'Japan (JST)' },
  { value: 'Australia/Sydney',       label_es: 'Australia (AEST)',     label_en: 'Australia (AEST)' },
];

const detectDefaultTz = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONES.some((t) => t.value === tz)) return tz;
  } catch {}
  return 'America/Mexico_City';
};

// Color palette offered to the user — these get baked into the .ics
// COLOR / X-APPLE-CALENDAR-COLOR header. Google Calendar respects the
// color only on FIRST add; if the user already subscribed they have
// to change it manually in Google (we tell them in the helper text).
const CALENDAR_COLORS = [
  { value: '#21E28C', label_es: 'Verde',    label_en: 'Green',  cssKey: 'green' },
  { value: '#36E9FF', label_es: 'Cian',     label_en: 'Cyan',   cssKey: 'cyan' },
  { value: '#3B82F6', label_es: 'Azul',     label_en: 'Blue',   cssKey: 'blue' },
  { value: '#A855F7', label_es: 'Morado',   label_en: 'Purple', cssKey: 'purple' },
  { value: '#FF2BD6', label_es: 'Rosa',     label_en: 'Pink',   cssKey: 'magenta' },
  { value: '#FF6B35', label_es: 'Naranja',  label_en: 'Orange', cssKey: 'orange' },
  { value: '#FFD166', label_es: 'Amarillo', label_en: 'Yellow', cssKey: 'yellow' },
];

export function WorldCup2026Calendar() {
  const { locale, setLocale } = useLocale();
  const c = (es, en) => (locale === 'es' ? es : en);

  const [teams, setTeams] = useState([]);
  const [fixturesCount, setFixturesCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dataAvailable, setDataAvailable] = useState(true);

  const [scope, setScope] = useState('all'); // all | teams | teams+ko
  const [selectedTeams, setSelectedTeams] = useState(new Set());
  const [teamSearch, setTeamSearch] = useState('');
  const [tz, setTz] = useState(detectDefaultTz);
  const [color, setColor] = useState(CALENDAR_COLORS[0].value); // default: green
  const [copied, setCopied] = useState(false);
  // Toast shown after Google/Android click: "URL copied — paste with Cmd+V".
  // Google Calendar's addbyurl page doesn't auto-fill the input from
  // ?cid=, so we copy + open + tell the user to paste.
  const [pasteToast, setPasteToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/world-cup-2026/teams');
        if (cancelled) return;
        setTeams(data.teams || []);
        if (data.dataSourceAvailable === false) setDataAvailable(false);
        // Fixtures count is needed for the "All matches" subtitle. The
        // teams endpoint also pulls fixtures internally, so a second
        // round-trip is cheap (same in-process cache).
        const fx = await api.get('/world-cup-2026/fixtures?scope=all');
        if (cancelled) return;
        setFixturesCount(fx.count || 0);
        if (fx.dataSourceAvailable === false) setDataAvailable(false);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'load_error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, teamSearch]);

  const toggleTeam = (id) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const needsTeams = scope === 'teams' || scope === 'teams+ko';
  const teamsReady = !needsTeams || selectedTeams.size > 0;

  // Build the calendar URL (relative + absolute). The absolute version is
  // required by webcal:// and Google Calendar's `cid=` param because both
  // need a publicly resolvable URL — the user's calendar client makes
  // the HTTP request, not the browser.
  const calendarPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    if (needsTeams && selectedTeams.size) {
      params.set('teams', Array.from(selectedTeams).join(','));
    }
    params.set('lang', locale === 'es' ? 'es' : 'en');
    if (tz && tz !== 'UTC') params.set('tz', tz);
    if (color) params.set('color', color);
    return `/world-cup-2026/calendar.ics?${params.toString()}`;
  }, [scope, selectedTeams, needsTeams, locale, tz, color]);

  // Two flavors of the .ics URL:
  //   - subscribeHttp: served inline (Content-Disposition: inline). Used
  //     by webcal://, Google Calendar `cid=`, and Android — all three are
  //     subscription flows that refuse `attachment` (Google loops on the
  //     redirect when it sees `attachment`).
  //   - downloadHref: same URL with ?download=1 → server adds the
  //     attachment disposition so the Outlook button saves a real file.
  const absoluteHttp = `${absoluteApiBase()}${calendarPath}`;
  const downloadHref = `${API_BASE}${calendarPath}${calendarPath.includes('?') ? '&' : '?'}download=1`;
  const webcalHref = absoluteHttp.replace(/^https?:\/\//, 'webcal://');
  // Google Calendar's `cid=` "add subscription" endpoint has become
  // increasingly restrictive — it now rejects arbitrary HTTPS feeds
  // with "No se puede agregar el calendario. Verifica la URL." even
  // when the .ics is RFC-5545 valid. The reliably-working alternative
  // is `/r/settings/addbyurl?cid=…` which opens the Calendar settings
  // panel with the URL pre-filled, requiring one extra click but
  // working 100% of the time. The `cid` here is the same HTTPS URL
  // (Google's settings page parses it the same way).
  const googleHref = `https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=${encodeURIComponent(absoluteHttp)}`;
  // Single helper used by both the dedicated "Copy" button and the
  // Google/Android click handlers. Returns true on success.
  const writeToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Older Safari + insecure-context fallback.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      return ok;
    }
  };

  const copyUrl = async () => {
    if (await writeToClipboard(absoluteHttp)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // Click handler for Google/Android: copies the URL, opens Google
  // Calendar's addbyurl page in a new tab, and shows a toast telling
  // the user to paste. Google's settings page does NOT prefill the
  // input from the cid= param (confirmed in user testing), so the
  // paste is mandatory.
  const handleGoogleClick = async (e) => {
    e.preventDefault();
    if (!teamsReady) return;
    await writeToClipboard(absoluteHttp);
    window.open(googleHref, '_blank', 'noopener,noreferrer');
    setPasteToast(true);
    // Toast stays up long enough for the user to switch tabs, see the
    // empty field, and paste. 8s is plenty.
    setTimeout(() => setPasteToast(false), 8000);
  };

  return (
    <div className="fp-wc26">
      <style>{WC_CSS}</style>

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

      {/* ─────────── HERO ─────────── */}
      <header className="wc-hero">
        <div className="wc-grid-bg" />
        <div className="wc-hero-inner">
          <div className="wc-kicker">◆ {c('CALENDARIO OFICIAL · MUNDIAL 2026', 'OFFICIAL SCHEDULE · WORLD CUP 2026')}</div>
          <h1>
            <span>{c('AÑADE TODOS LOS PARTIDOS', 'ADD EVERY MATCH')}</span><br />
            <span className="wc-accent">{c('A TU CALENDARIO.', 'TO YOUR CALENDAR.')}</span>
          </h1>
          <p className="wc-sub">
            {c(
              'Sincroniza los 104 partidos del Mundial 2026 con iPhone, Google Calendar, Android u Outlook en 3 pasos. Gratis, sin app.',
              'Sync all 104 World Cup 2026 matches to iPhone, Google Calendar, Android, or Outlook in 3 steps. Free, no app needed.'
            )}
          </p>
          <div className="wc-hero-stats">
            <div className="wc-stat"><div className="wc-stat-num">104</div><div className="wc-stat-lab">{c('Partidos', 'Matches')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">48</div><div className="wc-stat-lab">{c('Selecciones', 'Teams')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">3</div><div className="wc-stat-lab">{c('Países', 'Countries')}</div></div>
            <div className="wc-stat"><div className="wc-stat-num">39</div><div className="wc-stat-lab">{c('Días', 'Days')}</div></div>
          </div>
        </div>
      </header>

      {/* ─────────── STEPPER ─────────── */}
      <main className="wc-main">

        {loadError && (
          <div className="wc-error">
            <strong>{c('No pudimos cargar el calendario.', 'Could not load the calendar.')}</strong>
            <div>{c('Vuelve a intentarlo en un momento.', 'Please try again in a moment.')}</div>
          </div>
        )}

        {!loading && !loadError && !dataAvailable && (
          <div className="wc-notice">
            <strong>◆ {c('Datos del Mundial llegando pronto', 'World Cup data arriving soon')}</strong>
            <div>{c(
              'Estamos actualizando la conexión con el proveedor oficial. La página está lista — el calendario estará disponible en cuanto la FIFA confirme el sorteo final.',
              "We're refreshing the connection with our official data provider. The page is ready — the calendar will go live as soon as the FIFA final draw is confirmed."
            )}</div>
          </div>
        )}

        {/* ── STEP 1 ── */}
        <section className="wc-step">
          <div className="wc-step-head">
            <span className="wc-step-num">01</span>
            <div>
              <div className="wc-step-kicker">{c('PASO 01', 'STEP 01')}</div>
              <h2 className="wc-step-title">{c('¿Qué partidos quieres añadir?', 'Which matches do you want?')}</h2>
            </div>
          </div>

          <div className="wc-scope-grid">
            <ScopeCard
              active={scope === 'all'}
              onClick={() => setScope('all')}
              badge={c('RECOMENDADO', 'RECOMMENDED')}
              icon="◆"
              title={c('Los 104 partidos', 'All 104 matches')}
              desc={c('Mundial completo: fase de grupos + eliminatorias.', 'The full World Cup: group stage + knockout rounds.')}
            />
            <ScopeCard
              active={scope === 'teams'}
              onClick={() => setScope('teams')}
              icon="★"
              title={c('Sólo mis selecciones', 'My teams only')}
              desc={c('Filtra por las selecciones que escojas en el Paso 2.', 'Filter by the teams you pick in Step 2.')}
            />
            <ScopeCard
              active={scope === 'teams+ko'}
              onClick={() => setScope('teams+ko')}
              icon="⚡"
              title={c('Mis selecciones + eliminatorias', 'My teams + knockout')}
              desc={c('Tus selecciones en grupos + TODA la fase final.', 'Your teams in groups + ALL the knockout stage.')}
            />
          </div>
        </section>

        {/* ── STEP 2 ── */}
        <section className={`wc-step ${needsTeams ? '' : 'wc-step-dim'}`}>
          <div className="wc-step-head">
            <span className="wc-step-num">02</span>
            <div>
              <div className="wc-step-kicker">{c('PASO 02', 'STEP 02')}</div>
              <h2 className="wc-step-title">
                {needsTeams
                  ? c('Elige tus selecciones', 'Pick your teams')
                  : c('Zona horaria', 'Time zone')}
              </h2>
            </div>
          </div>

          {needsTeams && (
            <div className="wc-teams-wrap">
              <div className="wc-teams-bar">
                <input
                  type="text"
                  className="wc-search"
                  placeholder={c('Buscar selección…', 'Search a team…')}
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                />
                <div className="wc-teams-meta">
                  <span className="wc-pill">{selectedTeams.size} {c('seleccionadas', 'selected')}</span>
                  {selectedTeams.size > 0 && (
                    <button className="wc-link" onClick={() => setSelectedTeams(new Set())}>
                      {c('Limpiar', 'Clear')}
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="wc-loading">{c('Cargando selecciones…', 'Loading teams…')}</div>
              ) : (
                <div className="wc-teams-grid">
                  {filteredTeams.map((t) => {
                    const active = selectedTeams.has(t.id);
                    return (
                      <button
                        key={t.id}
                        className={`wc-team ${active ? 'on' : ''}`}
                        onClick={() => toggleTeam(t.id)}
                      >
                        <div className="wc-team-logo">
                          {t.logo ? <img src={t.logo} alt="" loading="lazy" /> : <span>{t.name.slice(0, 2).toUpperCase()}</span>}
                        </div>
                        <div className="wc-team-name">{t.name}</div>
                        <div className={`wc-team-check ${active ? 'on' : ''}`}>{active ? '✓' : ''}</div>
                      </button>
                    );
                  })}
                  {!filteredTeams.length && (
                    <div className="wc-loading">{c('Sin resultados.', 'No matches.')}</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="wc-tz-wrap">
            <div className="wc-step-kicker wc-tz-label">
              {needsTeams
                ? c('◆ ZONA HORARIA PARA VER LOS HORARIOS', '◆ TIMEZONE FOR PREVIEW')
                : c('Selecciona tu zona horaria para ver los horarios correctos.', 'Select your timezone to see the correct kickoff times.')}
            </div>
            <select className="wc-select" value={tz} onChange={(e) => setTz(e.target.value)}>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>{c(t.label_es, t.label_en)}</option>
              ))}
            </select>
            <div className="wc-tz-note">
              {c(
                'Tu calendario mostrará los horarios automáticamente en tu zona local — esta selección es sólo para el preview.',
                "Your calendar will display kickoff times in your local zone automatically — this picker is just for the preview below."
              )}
            </div>

            {/* Color picker — embedded in the .ics so Google/Apple
                Calendar pick this hue on first subscription. Google
                ignores updates after the initial add, so we hint that
                in the helper text. */}
            <div className="wc-color-block">
              <div className="wc-step-kicker wc-color-label">
                ◆ {c('COLOR DEL CALENDARIO', 'CALENDAR COLOR')}
              </div>
              <div className="wc-color-grid" role="radiogroup">
                {CALENDAR_COLORS.map((opt) => (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={color === opt.value}
                    title={c(opt.label_es, opt.label_en)}
                    className={`wc-color-swatch ${color === opt.value ? 'on' : ''}`}
                    style={{ background: opt.value }}
                    onClick={() => setColor(opt.value)}
                  >
                    {color === opt.value && <span className="wc-color-check">✓</span>}
                  </button>
                ))}
              </div>
              <div className="wc-tz-note">
                {c(
                  'Tip: si ya tienes el calendario suscrito, Google Calendar conserva el color anterior — cámbialo manualmente en "Otros calendarios" (3 puntos → Color).',
                  'Heads-up: if you\'re already subscribed, Google Calendar keeps your old color — change it manually in "Other calendars" (3-dot menu → Color).'
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── STEP 3 ── */}
        <section className={`wc-step ${teamsReady ? '' : 'wc-step-dim'}`}>
          <div className="wc-step-head">
            <span className="wc-step-num">03</span>
            <div>
              <div className="wc-step-kicker">{c('PASO 03', 'STEP 03')}</div>
              <h2 className="wc-step-title">{c('Añade a tu calendario', 'Add to your calendar')}</h2>
            </div>
          </div>

          {needsTeams && !selectedTeams.size && (
            <div className="wc-step-blocked">
              {c('Elige al menos una selección en el Paso 2 para continuar.', 'Pick at least one team in Step 2 to continue.')}
            </div>
          )}

          <div className="wc-export-grid">
            <ExportCard
              disabled={!teamsReady}
              href={teamsReady ? webcalHref : undefined}
              icon="📱"
              brand="apple"
              title={c('iPhone · iPad · Mac', 'iPhone · iPad · Mac')}
              desc={c('Abre la app Calendario y suscríbete con un clic.', 'Opens the Calendar app to subscribe with one click.')}
              cta={c('Suscribirse', 'Subscribe')}
            />
            <ExportCard
              disabled={!teamsReady}
              href={teamsReady ? googleHref : undefined}
              onClick={teamsReady ? handleGoogleClick : undefined}
              icon="📅"
              brand="google"
              title="Google Calendar"
              desc={c('Copiamos la URL y abrimos Google. Solo pega y guarda.', 'We copy the URL and open Google. Just paste and save.')}
              cta={c('Añadir', 'Add')}
              target="_blank"
            />
            <ExportCard
              disabled={!teamsReady}
              href={teamsReady ? googleHref : undefined}
              onClick={teamsReady ? handleGoogleClick : undefined}
              icon="🤖"
              brand="android"
              title="Android"
              desc={c('Usa Google Calendar — copiamos la URL automáticamente.', 'Uses Google Calendar — we copy the URL automatically.')}
              cta={c('Suscribirse', 'Subscribe')}
              target="_blank"
            />
            <ExportCard
              disabled={!teamsReady}
              href={teamsReady ? downloadHref : undefined}
              icon="💻"
              brand="outlook"
              title={c('Outlook · Descarga .ics', 'Outlook · Download .ics')}
              desc={c('Archivo estándar compatible con Outlook, Yahoo, Proton…', 'Standard .ics file — works with Outlook, Yahoo, Proton…')}
              cta={c('Descargar', 'Download')}
              download
            />
          </div>

          <div className="wc-stat-bar">
            <div>
              <div className="wc-stat-bar-num">
                {loading ? '…' : (fixturesCount ?? '—')}
              </div>
              <div className="wc-stat-bar-lab">{c('Partidos en tu calendario', 'Matches in your calendar')}</div>
            </div>
            <div className="wc-stat-bar-pipe" />
            <div>
              <div className="wc-stat-bar-num">{scopeCount(scope, selectedTeams.size, fixturesCount)}</div>
              <div className="wc-stat-bar-lab">{c('Con tu selección actual', 'With your current selection')}</div>
            </div>
          </div>

          {/* Manual subscribe URL — Google Calendar's `cid=` flow has
              become unreliable in 2026 (rejects HTTPS feeds even when
              RFC-valid). The visible URL + copy button gives users a
              guaranteed path: paste into Calendar → Other calendars →
              From URL. */}
          {teamsReady && (
            <div className="wc-url-fallback">
              <div className="wc-url-fallback-label">
                {c(
                  '◆ ¿NO FUNCIONA EL BOTÓN? COPIA ESTA URL Y PÉGALA EN GOOGLE CALENDAR → "OTROS CALENDARIOS" → "DESDE URL"',
                  '◆ BUTTON NOT WORKING? COPY THIS URL AND PASTE IN GOOGLE CALENDAR → "OTHER CALENDARS" → "FROM URL"'
                )}
              </div>
              <div className="wc-url-fallback-row">
                <input
                  type="text"
                  className="wc-url-input"
                  value={absoluteHttp}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <button className="wc-url-copy" onClick={copyUrl}>
                  {copied ? c('¡Copiado!', 'Copied!') : c('Copiar', 'Copy')}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ─────────── FAQ / EXPLAINER ─────────── */}
        <section className="wc-faq">
          <h3>{c('Preguntas frecuentes', 'FAQ')}</h3>
          <div className="wc-faq-grid">
            <FAQ
              q={c('¿Es gratis?', 'Is it free?')}
              a={c(
                'Sí. 100% gratis. Sin cuenta, sin app, sin anuncios.',
                'Yes. 100% free. No account, no app, no ads.'
              )}
            />
            <FAQ
              q={c('¿Se actualizan los horarios automáticamente?', 'Do kickoffs update automatically?')}
              a={c(
                'Sí. La suscripción se sincroniza con la fuente oficial de la FIFA — si la FIFA cambia un horario, tu calendario también.',
                'Yes. The subscription syncs with the official FIFA source — if FIFA shifts a kickoff, your calendar updates too.'
              )}
            />
            <FAQ
              q={c('¿Cómo elimino el calendario?', 'How do I remove it?')}
              a={c(
                'iPhone: Ajustes → Calendario → Cuentas → elimina la suscripción. Google: Calendar → Otros calendarios → "X".',
                'iPhone: Settings → Calendar → Accounts → remove subscription. Google: Calendar → Other calendars → "X".'
              )}
            />
            <FAQ
              q={c('¿Quién está detrás?', "Who's behind this?")}
              a={c(
                'FutPools — quinielas en línea para LATAM. Si te gusta el fútbol, prueba la app.',
                'FutPools — online football pools for LATAM. If you love the game, try the app.'
              )}
            />
          </div>
        </section>

        {/* ─────────── FUTPOOLS CTA ─────────── */}
        <section className="wc-cta">
          <div className="wc-cta-inner">
            <div className="wc-cta-kicker">◆ {c('¿LISTO PARA JUGAR EL MUNDIAL?', 'READY TO PLAY THE WORLD CUP?')}</div>
            <h3>{c('Quinielas reales. Premios reales.', 'Real pools. Real prizes.')}</h3>
            <p>{c(
              'Inscríbete por $50 MXN — el ganador se lleva el 65% del premio acumulado, depositado a tu cuenta bancaria.',
              'Pay $50 MXN to enter — winner takes 65% of the pool, deposited straight to your bank.'
            )}</p>
            <Link to="/onboarding" className="wc-btn-primary">▶ {c('Jugar Quiniela del Mundial', 'Play World Cup Pool')}</Link>
          </div>
        </section>
      </main>

      <footer className="wc-footer">
        <div>© 2026 FUTPOOLS · futpools.com</div>
        <div>{c('Datos de partidos: FIFA / API-Football', 'Match data: FIFA / API-Football')}</div>
      </footer>

      {/* Paste toast — shown after Google/Android click. Persistent
          enough that the user sees it after switching to the new tab. */}
      {pasteToast && (
        <div className="wc-paste-toast" role="status">
          <div className="wc-paste-toast-icon">📋</div>
          <div className="wc-paste-toast-body">
            <div className="wc-paste-toast-title">
              {c('¡URL copiada al portapapeles!', 'URL copied to clipboard!')}
            </div>
            <div className="wc-paste-toast-text">
              {c(
                'Pega con ⌘V (o Ctrl+V) en el campo "URL del calendario" de Google y haz clic en "Agregar calendario".',
                'Paste with ⌘V (or Ctrl+V) into the "Calendar URL" field on Google and click "Add calendar".'
              )}
            </div>
          </div>
          <button className="wc-paste-toast-close" onClick={() => setPasteToast(false)} aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}

function ScopeCard({ active, onClick, badge, icon, title, desc }) {
  return (
    <button className={`wc-scope ${active ? 'on' : ''}`} onClick={onClick}>
      {badge && <span className="wc-scope-badge">{badge}</span>}
      <div className="wc-scope-icon">{icon}</div>
      <div className="wc-scope-title">{title}</div>
      <div className="wc-scope-desc">{desc}</div>
      <div className={`wc-scope-check ${active ? 'on' : ''}`}>{active ? '✓' : '○'}</div>
    </button>
  );
}

function ExportCard({ disabled, href, onClick, icon, brand, title, desc, cta, target, download }) {
  const Tag = disabled ? 'div' : 'a';
  const props = disabled
    ? {}
    : {
        href,
        target,
        rel: target ? 'noopener noreferrer' : undefined,
        download: download ? '' : undefined,
        onClick,
      };
  return (
    <Tag className={`wc-export wc-export-${brand} ${disabled ? 'is-disabled' : ''}`} {...props}>
      <div className="wc-export-icon">{icon}</div>
      <div className="wc-export-body">
        <div className="wc-export-title">{title}</div>
        <div className="wc-export-desc">{desc}</div>
      </div>
      <div className="wc-export-cta">{cta}<span className="wc-export-arrow">→</span></div>
    </Tag>
  );
}

function FAQ({ q, a }) {
  return (
    <div className="wc-faq-item">
      <div className="wc-faq-q">◆ {q}</div>
      <div className="wc-faq-a">{a}</div>
    </div>
  );
}

const scopeCount = (scope, teamCount, total) => {
  if (scope === 'all') return total ?? '—';
  if (!teamCount) return 0;
  if (scope === 'teams') return `~${teamCount * 3}`;
  if (scope === 'teams+ko') return `~${teamCount * 3 + 40}`;
  return '—';
};

/*
 * Mobile-first CSS — base styles target ~390px phone portrait, then
 * scale UP via min-width breakpoints. Touch targets are min 44×44px,
 * inputs use 16px font (prevents iOS zoom on focus), and layouts
 * default to a single column.
 *
 *   Base    (default)        ≤ 639px   single column, compact spacing
 *   sm      (min-width:640)            2-col grids, roomier padding
 *   lg      (min-width:960)            3-col grids, full hero, max-width clamp
 */
const WC_CSS = `
.fp-wc26 {
  --bg: var(--fp-bg);
  --surface: var(--fp-surface);
  --surface-alt: var(--fp-surface-alt);
  --stroke: var(--fp-stroke);
  --stroke-strong: var(--fp-stroke-strong);
  --text: var(--fp-text);
  --text-dim: var(--fp-text-dim);
  --text-muted: var(--fp-text-muted);
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
    radial-gradient(ellipse 90% 45% at 50% 0%, rgba(33,226,140,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 60% 35% at 80% 40%, rgba(255,43,214,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 70% 35% at 20% 70%, rgba(54,233,255,0.06) 0%, transparent 60%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

.fp-wc26::before {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none; z-index: 3;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 3px);
  mix-blend-mode: overlay;
}
.fp-wc26::after {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none; z-index: 2;
  background: radial-gradient(ellipse 110% 90% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%);
}

/* ──────────────── NAV (mobile base) ──────────────── */
.fp-wc26 .wc-nav {
  position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  background: rgba(7, 9, 13, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--stroke);
}
.fp-wc26 .wc-logo {
  font-family: var(--ox); font-weight: 800; font-size: 15px;
  letter-spacing: 2.5px; color: var(--text); text-decoration: none;
}
.fp-wc26 .wc-logo span { color: var(--primary); text-shadow: 0 0 12px var(--primary); }
.fp-wc26 .wc-nav-right { display: flex; gap: 10px; align-items: center; }
.fp-wc26 .wc-nav-home {
  font-family: var(--ox); font-weight: 700; font-size: 11px;
  letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-dim);
  text-decoration: none;
  padding: 8px 4px;            /* expand tap target without changing visual */
}
.fp-wc26 .wc-nav-home:hover { color: var(--primary); }
.fp-wc26 .wc-lang {
  display: flex; background: rgba(255,255,255,0.04); padding: 2px;
  clip-path: var(--hud-clip-sm);
}
.fp-wc26 .wc-lang button {
  padding: 8px 10px; font-family: var(--ox); font-size: 11px;
  font-weight: 700; letter-spacing: 1.5px; border: none; cursor: pointer;
  background: transparent; color: var(--text-muted);
  clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
  min-height: 32px;
}
.fp-wc26 .wc-lang button.active { background: var(--primary); color: var(--fp-on-primary); }

/* ──────────────── HERO (mobile base) ──────────────── */
.fp-wc26 .wc-hero {
  position: relative; padding: 28px 16px 24px;
  text-align: center; overflow: hidden;
}
.fp-wc26 .wc-grid-bg {
  position: absolute; left: 0; right: 0; bottom: 0; height: 55%;
  background:
    repeating-linear-gradient(0deg, transparent 0, transparent 29px, rgba(33,226,140,0.20) 29px, rgba(33,226,140,0.20) 30px),
    repeating-linear-gradient(90deg, transparent 0, transparent 29px, rgba(33,226,140,0.20) 29px, rgba(33,226,140,0.20) 30px);
  transform: perspective(300px) rotateX(60deg);
  transform-origin: bottom;
  mask-image: linear-gradient(0deg, black 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(0deg, black 0%, transparent 100%);
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}
.fp-wc26 .wc-hero-inner { position: relative; z-index: 5; max-width: 920px; margin: 0 auto; }
.fp-wc26 .wc-kicker {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 10px;
  color: var(--primary); letter-spacing: 2.5px; font-weight: 700;
  padding: 5px 10px;
  background: rgba(33,226,140,0.10);
  clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
  margin-bottom: 14px;
}
.fp-wc26 .wc-hero h1 {
  font-family: var(--ox); font-weight: 900;
  font-size: clamp(28px, 9vw, 44px); line-height: 1.02;
  letter-spacing: -0.5px; margin: 0 0 14px;
  text-shadow: 0 0 24px rgba(0,0,0,0.6);
}
.fp-wc26 .wc-accent { color: var(--primary); text-shadow: 0 0 24px rgba(33,226,140,0.55); }
.fp-wc26 .wc-sub {
  font-size: 14px; line-height: 1.5; color: var(--text-dim);
  max-width: 640px; margin: 0 auto 20px;
}
.fp-wc26 .wc-hero-stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 6px; margin-top: 14px;
}
.fp-wc26 .wc-stat { min-width: 0; }
.fp-wc26 .wc-stat-num {
  font-family: var(--ox); font-weight: 800; font-size: 22px;
  color: var(--text); text-shadow: 0 0 10px rgba(33,226,140,0.3);
}
.fp-wc26 .wc-stat-lab {
  font-family: var(--mono); font-size: 9px;
  color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase;
  margin-top: 1px;
}

/* ──────────────── MAIN (mobile base) ──────────────── */
.fp-wc26 .wc-main {
  position: relative; z-index: 5;
  max-width: 1080px; margin: 0 auto; padding: 16px 12px 60px;
  display: flex; flex-direction: column; gap: 18px;
}

.fp-wc26 .wc-error,
.fp-wc26 .wc-notice {
  padding: 14px 16px;
  clip-path: var(--hud-clip-sm);
  font-size: 13px;
}
.fp-wc26 .wc-error {
  background: rgba(255,59,92,0.1);
  border: 1px solid rgba(255,59,92,0.35);
  color: #FFB4C0;
}
.fp-wc26 .wc-notice {
  background: rgba(54,233,255,0.08);
  border: 1px solid rgba(54,233,255,0.32);
  color: var(--accent);
}
.fp-wc26 .wc-notice strong {
  display: block; margin-bottom: 4px;
  font-family: var(--ox); font-weight: 800; letter-spacing: 1px;
  font-size: 12px;
}
.fp-wc26 .wc-notice div { color: var(--text-dim); font-size: 13px; line-height: 1.5; }

/* ──────────────── STEP CARD (mobile base) ──────────────── */
.fp-wc26 .wc-step {
  background: var(--surface);
  border: 1px solid var(--stroke);
  clip-path: var(--hud-clip);
  padding: 18px 16px 20px;
  position: relative;
  transition: opacity 0.2s;
}
.fp-wc26 .wc-step-dim { opacity: 0.55; }
.fp-wc26 .wc-step-head {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 16px;
}
.fp-wc26 .wc-step-num {
  font-family: var(--ox); font-weight: 900;
  font-size: 28px;
  color: var(--primary);
  text-shadow: 0 0 12px rgba(33,226,140,0.5);
  min-width: 42px;
  line-height: 1;
}
.fp-wc26 .wc-step-kicker {
  font-family: var(--mono); font-size: 9px;
  color: var(--text-muted); letter-spacing: 2px; font-weight: 700;
  text-transform: uppercase;
}
.fp-wc26 .wc-step-title {
  font-family: var(--ox); font-weight: 800; font-size: 17px;
  margin: 3px 0 0; letter-spacing: 0.3px; color: var(--text);
  line-height: 1.2;
}
.fp-wc26 .wc-step-blocked {
  background: rgba(255,209,102,0.08);
  border: 1px solid rgba(255,209,102,0.25);
  color: var(--gold);
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.5px;
  padding: 10px 14px;
  clip-path: var(--hud-clip-sm);
  margin-bottom: 14px;
  line-height: 1.5;
}

/* ──────────────── SCOPE (mobile base) ──────────────── */
.fp-wc26 .wc-scope-grid {
  display: grid; gap: 10px;
  grid-template-columns: 1fr;
}
.fp-wc26 .wc-scope {
  position: relative;
  text-align: left;
  background: var(--surface-alt);
  border: 1px solid var(--stroke);
  clip-path: var(--hud-clip-sm);
  padding: 14px 14px 14px 14px;
  cursor: pointer;
  color: var(--text);
  transition: transform 0.1s, box-shadow 0.15s, border-color 0.15s;
  font-family: var(--body);
  min-height: 84px;        /* generous tap target */
}
.fp-wc26 .wc-scope:active { transform: scale(0.99); }
.fp-wc26 .wc-scope:hover { border-color: var(--stroke-strong); }
.fp-wc26 .wc-scope.on {
  background: rgba(33,226,140,0.10);
  border-color: var(--primary);
  box-shadow: 0 0 20px rgba(33,226,140,0.25);
}
.fp-wc26 .wc-scope-badge {
  position: absolute; top: 8px; right: 10px;
  font-family: var(--mono); font-size: 8px; font-weight: 800;
  color: var(--fp-on-primary); background: var(--primary);
  padding: 3px 6px;
  clip-path: polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%);
  letter-spacing: 1px;
}
.fp-wc26 .wc-scope-icon {
  font-family: var(--ox); font-size: 20px; color: var(--primary);
  margin-bottom: 6px;
}
.fp-wc26 .wc-scope-title {
  font-family: var(--ox); font-weight: 800; font-size: 15px;
  margin-bottom: 4px; letter-spacing: 0.3px;
  padding-right: 28px;     /* leaves room for the check icon */
}
.fp-wc26 .wc-scope-desc {
  font-size: 12px; line-height: 1.4; color: var(--text-dim);
}
.fp-wc26 .wc-scope-check {
  position: absolute; bottom: 12px; right: 14px;
  font-family: var(--ox); font-weight: 800; font-size: 16px;
  color: var(--text-muted);
}
.fp-wc26 .wc-scope-check.on { color: var(--primary); }

/* ──────────────── TEAMS (mobile base) ──────────────── */
.fp-wc26 .wc-teams-wrap { margin-top: 4px; margin-bottom: 18px; }
.fp-wc26 .wc-teams-bar {
  display: flex; flex-direction: column; gap: 10px;
  margin-bottom: 12px;
}
.fp-wc26 .wc-search {
  width: 100%;
  background: var(--surface-alt);
  border: 1px solid var(--stroke);
  color: var(--text);
  padding: 12px 14px;
  font-family: var(--body); font-size: 16px; /* 16px → no iOS zoom */
  clip-path: var(--hud-clip-sm);
  outline: none;
}
.fp-wc26 .wc-search:focus { border-color: var(--primary); box-shadow: 0 0 10px rgba(33,226,140,0.25); }
.fp-wc26 .wc-teams-meta {
  display: flex; gap: 10px; align-items: center;
  justify-content: space-between;
}
.fp-wc26 .wc-pill {
  font-family: var(--mono); font-size: 11px; letter-spacing: 1px;
  background: rgba(33,226,140,0.12); color: var(--primary);
  padding: 6px 10px;
  clip-path: polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%);
  font-weight: 700;
}
.fp-wc26 .wc-link {
  background: none; border: none; color: var(--text-dim);
  font-family: var(--mono); font-size: 11px; letter-spacing: 1px;
  cursor: pointer; text-transform: uppercase;
  padding: 8px 4px;
}
.fp-wc26 .wc-link:hover { color: var(--primary); }
.fp-wc26 .wc-loading {
  font-family: var(--mono); color: var(--text-muted);
  padding: 20px; text-align: center; font-size: 12px;
}
.fp-wc26 .wc-teams-grid {
  display: grid; gap: 8px;
  grid-template-columns: repeat(2, 1fr);
  max-height: 360px; overflow-y: auto;
  padding-right: 4px;
  -webkit-overflow-scrolling: touch;
}
.fp-wc26 .wc-team {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface-alt);
  border: 1px solid var(--stroke);
  clip-path: var(--hud-clip-sm);
  padding: 10px 10px;
  cursor: pointer; color: var(--text); text-align: left;
  font-family: var(--body); font-size: 13px;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  min-height: 48px;
}
.fp-wc26 .wc-team:active { transform: scale(0.98); }
.fp-wc26 .wc-team.on {
  background: rgba(33,226,140,0.10);
  border-color: var(--primary);
  box-shadow: 0 0 10px rgba(33,226,140,0.2);
}
.fp-wc26 .wc-team-logo {
  width: 28px; height: 28px; flex-shrink: 0;
  background: var(--bg); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.fp-wc26 .wc-team-logo img { width: 100%; height: 100%; object-fit: contain; }
.fp-wc26 .wc-team-logo span {
  font-family: var(--ox); font-weight: 800; font-size: 10px;
  color: var(--text-muted);
}
.fp-wc26 .wc-team-name {
  flex: 1; min-width: 0;
  font-weight: 600; font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fp-wc26 .wc-team-check {
  font-family: var(--ox); font-weight: 800;
  width: 16px; text-align: center;
  color: transparent;
}
.fp-wc26 .wc-team-check.on { color: var(--primary); }

/* ──────────────── TZ (mobile base) ──────────────── */
.fp-wc26 .wc-tz-wrap {
  border-top: 1px dashed var(--stroke);
  padding-top: 14px; margin-top: 6px;
}
.fp-wc26 .wc-tz-label { margin-bottom: 8px; line-height: 1.5; }
.fp-wc26 .wc-select {
  background: var(--surface-alt);
  border: 1px solid var(--stroke);
  color: var(--text);
  padding: 12px 14px;
  font-family: var(--body); font-size: 16px;  /* iOS zoom-safe */
  width: 100%;
  clip-path: var(--hud-clip-sm);
  outline: none;
  cursor: pointer;
  min-height: 44px;
}
.fp-wc26 .wc-select:focus { border-color: var(--primary); box-shadow: 0 0 10px rgba(33,226,140,0.25); }
.fp-wc26 .wc-tz-note {
  font-family: var(--mono); font-size: 10px;
  color: var(--text-muted); letter-spacing: 0.5px;
  margin-top: 8px; max-width: 640px; line-height: 1.5;
}

/* ──────────────── COLOR PICKER (mobile base) ──────────────── */
.fp-wc26 .wc-color-block {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px dashed var(--stroke);
}
.fp-wc26 .wc-color-label { margin-bottom: 10px; }
.fp-wc26 .wc-color-grid {
  display: flex; flex-wrap: wrap; gap: 10px;
  margin-bottom: 8px;
}
.fp-wc26 .wc-color-swatch {
  width: 40px; height: 40px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  padding: 0;
  transition: transform 0.1s, box-shadow 0.15s;
  flex-shrink: 0;
}
.fp-wc26 .wc-color-swatch:active { transform: scale(0.95); }
.fp-wc26 .wc-color-swatch:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.fp-wc26 .wc-color-swatch.on {
  border-color: var(--text);
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--text);
}
.fp-wc26 .wc-color-check {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: #061018; font-weight: 900; font-size: 18px;
  font-family: var(--ox);
  text-shadow: 0 0 4px rgba(255,255,255,0.5);
}

/* ──────────────── EXPORTS (mobile base) ──────────────── */
.fp-wc26 .wc-export-grid {
  display: grid; gap: 10px;
  grid-template-columns: 1fr;
}
.fp-wc26 .wc-export {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface-alt);
  border: 1px solid var(--stroke);
  clip-path: var(--hud-clip-sm);
  padding: 14px;
  text-decoration: none;
  color: var(--text);
  transition: transform 0.1s, box-shadow 0.15s, border-color 0.15s;
  min-height: 64px;
}
.fp-wc26 .wc-export:active { transform: scale(0.99); }
.fp-wc26 .wc-export:hover {
  border-color: var(--primary);
  box-shadow: 0 0 14px rgba(33,226,140,0.22);
}
.fp-wc26 .wc-export.is-disabled {
  opacity: 0.45; cursor: not-allowed;
}
.fp-wc26 .wc-export.is-disabled:hover {
  transform: none; border-color: var(--stroke); box-shadow: none;
}
.fp-wc26 .wc-export-icon {
  font-size: 22px; line-height: 1;
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.04);
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  flex-shrink: 0;
}
.fp-wc26 .wc-export-body { flex: 1; min-width: 0; }
.fp-wc26 .wc-export-title {
  font-family: var(--ox); font-weight: 800; font-size: 13px;
  letter-spacing: 0.3px; margin-bottom: 3px;
}
.fp-wc26 .wc-export-desc {
  font-size: 11px; line-height: 1.4; color: var(--text-dim);
}
.fp-wc26 .wc-export-cta {
  font-family: var(--ox); font-weight: 800; font-size: 10px;
  letter-spacing: 1.5px; text-transform: uppercase;
  color: var(--primary);
  display: flex; align-items: center; gap: 4px;
  flex-shrink: 0;
}
.fp-wc26 .wc-export-arrow { transition: transform 0.2s; }
.fp-wc26 .wc-export:not(.is-disabled):hover .wc-export-arrow {
  transform: translateX(3px);
}

/* ──────────────── STAT BAR (mobile base) ──────────────── */
.fp-wc26 .wc-stat-bar {
  margin-top: 16px;
  background: rgba(33,226,140,0.05);
  border: 1px solid rgba(33,226,140,0.18);
  clip-path: var(--hud-clip-sm);
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.fp-wc26 .wc-stat-bar-num {
  font-family: var(--ox); font-weight: 800; font-size: 22px;
  color: var(--primary);
}
.fp-wc26 .wc-stat-bar-lab {
  font-family: var(--mono); font-size: 9px;
  color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase;
  margin-top: 1px;
}
.fp-wc26 .wc-stat-bar-pipe {
  width: 100%; height: 1px; background: var(--stroke-strong);
}

/* ──────────────── URL FALLBACK (mobile base) ──────────────── */
.fp-wc26 .wc-url-fallback {
  margin-top: 14px;
  padding: 12px 14px;
  background: rgba(54,233,255,0.05);
  border: 1px dashed rgba(54,233,255,0.35);
  clip-path: var(--hud-clip-sm);
}
.fp-wc26 .wc-url-fallback-label {
  font-family: var(--mono); font-size: 9px;
  color: var(--accent); letter-spacing: 1px; font-weight: 700;
  margin-bottom: 10px; line-height: 1.5;
}
.fp-wc26 .wc-url-fallback-row {
  display: flex; flex-direction: column; gap: 8px;
}
.fp-wc26 .wc-url-input {
  width: 100%; min-width: 0;
  background: var(--bg);
  border: 1px solid var(--stroke);
  color: var(--text);
  padding: 11px 12px;
  font-family: var(--mono); font-size: 12px;
  clip-path: var(--hud-clip-sm);
  outline: none;
}
.fp-wc26 .wc-url-input:focus { border-color: var(--accent); }
.fp-wc26 .wc-url-copy {
  background: var(--accent); color: var(--fp-on-primary);
  border: none;
  font-family: var(--ox); font-weight: 800; font-size: 12px;
  letter-spacing: 1.5px; text-transform: uppercase;
  padding: 12px 18px;
  clip-path: var(--hud-clip-sm);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.15s;
  white-space: nowrap;
  min-height: 44px;
  width: 100%;
}
.fp-wc26 .wc-url-copy:active { transform: scale(0.99); }
.fp-wc26 .wc-url-copy:hover { box-shadow: 0 0 12px rgba(54,233,255,0.5); }

/* ──────────────── FAQ (mobile base) ──────────────── */
.fp-wc26 .wc-faq h3 {
  font-family: var(--ox); font-weight: 800; font-size: 20px;
  margin: 0 0 14px; letter-spacing: 0.5px;
}
.fp-wc26 .wc-faq-grid {
  display: grid; gap: 10px;
  grid-template-columns: 1fr;
}
.fp-wc26 .wc-faq-item {
  background: var(--surface);
  border: 1px solid var(--stroke);
  clip-path: var(--hud-clip-sm);
  padding: 14px 16px;
}
.fp-wc26 .wc-faq-q {
  font-family: var(--ox); font-weight: 700; font-size: 13px;
  color: var(--primary); margin-bottom: 6px; letter-spacing: 0.3px;
  line-height: 1.4;
}
.fp-wc26 .wc-faq-a {
  font-size: 13px; line-height: 1.5; color: var(--text-dim);
}

/* ──────────────── CTA (mobile base) ──────────────── */
.fp-wc26 .wc-cta {
  text-align: center;
  background:
    radial-gradient(ellipse 70% 90% at 50% 50%, rgba(33,226,140,0.18) 0%, transparent 70%),
    var(--surface);
  border: 1px solid var(--stroke-strong);
  clip-path: var(--hud-clip);
  padding: 26px 18px;
  position: relative;
}
.fp-wc26 .wc-cta-inner { max-width: 600px; margin: 0 auto; }
.fp-wc26 .wc-cta-kicker {
  font-family: var(--mono); font-size: 10px; letter-spacing: 2px;
  color: var(--primary); font-weight: 700; margin-bottom: 10px;
}
.fp-wc26 .wc-cta h3 {
  font-family: var(--ox); font-weight: 900; font-size: 22px;
  margin: 0 0 10px; letter-spacing: 0.5px; line-height: 1.15;
}
.fp-wc26 .wc-cta p {
  color: var(--text-dim); font-size: 13px; line-height: 1.5;
  margin: 0 0 18px;
}
.fp-wc26 .wc-btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-family: var(--ox); font-weight: 800;
  letter-spacing: 1.5px; text-transform: uppercase;
  padding: 14px 22px; font-size: 13px;
  background: var(--primary); color: var(--fp-on-primary);
  text-decoration: none;
  clip-path: var(--hud-clip-sm);
  box-shadow: 0 0 20px rgba(33,226,140,0.5);
  transition: transform 0.1s, box-shadow 0.2s;
  width: 100%; max-width: 360px;
  min-height: 48px;
}
.fp-wc26 .wc-btn-primary:active { transform: scale(0.99); }
.fp-wc26 .wc-btn-primary:hover { box-shadow: 0 0 28px rgba(33,226,140,0.75); }

/* ──────────────── FOOTER (mobile base) ──────────────── */
.fp-wc26 .wc-footer {
  position: relative; z-index: 5;
  border-top: 1px solid var(--stroke);
  padding: 18px 16px;
  display: flex; flex-direction: column;
  font-family: var(--mono); font-size: 10px;
  color: var(--text-muted); letter-spacing: 0.5px;
  gap: 6px;
  text-align: center;
}

/* ──────────────── PASTE TOAST (mobile base) ──────────────── */
.fp-wc26 .wc-paste-toast {
  position: fixed;
  bottom: 12px; left: 12px; right: 12px;
  transform: none;
  z-index: 1000;
  display: flex; align-items: flex-start; gap: 12px;
  background: var(--surface);
  border: 1px solid var(--primary);
  clip-path: var(--hud-clip);
  padding: 14px 14px 14px 12px;
  max-width: none; width: auto;
  box-shadow: 0 0 28px rgba(33,226,140,0.45), 0 16px 40px rgba(0,0,0,0.5);
  animation: fpToastInMobile 0.25s ease-out;
}
@keyframes fpToastInMobile {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.fp-wc26 .wc-paste-toast-icon {
  font-size: 22px; line-height: 1; flex-shrink: 0;
  background: rgba(33,226,140,0.12);
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
}
.fp-wc26 .wc-paste-toast-body { flex: 1; min-width: 0; }
.fp-wc26 .wc-paste-toast-title {
  font-family: var(--ox); font-weight: 800; font-size: 13px;
  color: var(--primary); letter-spacing: 0.3px;
  margin-bottom: 3px;
}
.fp-wc26 .wc-paste-toast-text {
  font-size: 11px; line-height: 1.5; color: var(--text-dim);
}
.fp-wc26 .wc-paste-toast-close {
  background: none; border: none;
  color: var(--text-muted); font-size: 22px; line-height: 1;
  cursor: pointer; padding: 4px 6px; align-self: flex-start;
  min-width: 32px; min-height: 32px;
}
.fp-wc26 .wc-paste-toast-close:hover { color: var(--text); }

/* ════════════════════════════════════════════════════════════════
 * sm — 640px+ : tablet / large phone landscape
 *   2-column scope + 2-column exports, roomier hero, side-by-side
 *   stat bar, search + meta on one row.
 * ════════════════════════════════════════════════════════════════ */
@media (min-width: 640px) {
  .fp-wc26 .wc-nav { padding: 14px 24px; }
  .fp-wc26 .wc-logo { font-size: 18px; letter-spacing: 3px; }
  .fp-wc26 .wc-nav-home { font-size: 12px; letter-spacing: 2px; }

  .fp-wc26 .wc-hero { padding: 56px 24px 40px; }
  .fp-wc26 .wc-hero h1 { font-size: clamp(34px, 5.4vw, 64px); margin-bottom: 18px; }
  .fp-wc26 .wc-sub { font-size: 17px; margin-bottom: 28px; }
  .fp-wc26 .wc-kicker { font-size: 11px; letter-spacing: 3px; padding: 6px 12px; margin-bottom: 18px; }
  .fp-wc26 .wc-hero-stats {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 28px;
  }
  .fp-wc26 .wc-stat-num { font-size: 30px; }
  .fp-wc26 .wc-stat-lab { font-size: 10px; letter-spacing: 2px; }

  .fp-wc26 .wc-main { padding: 24px 18px 80px; gap: 28px; }

  .fp-wc26 .wc-step { padding: 26px 26px 30px; }
  .fp-wc26 .wc-step-num { font-size: 38px; min-width: 60px; }
  .fp-wc26 .wc-step-title { font-size: 22px; }
  .fp-wc26 .wc-step-kicker { font-size: 10px; letter-spacing: 2.5px; }
  .fp-wc26 .wc-step-head { gap: 18px; margin-bottom: 22px; }
  .fp-wc26 .wc-step-blocked { font-size: 12px; padding: 12px 16px; margin-bottom: 18px; }

  .fp-wc26 .wc-scope-grid {
    grid-template-columns: repeat(2, 1fr); gap: 14px;
  }
  .fp-wc26 .wc-scope { padding: 18px; }
  .fp-wc26 .wc-scope-icon { font-size: 22px; margin-bottom: 8px; }
  .fp-wc26 .wc-scope-title { font-size: 16px; }
  .fp-wc26 .wc-scope-desc { font-size: 13px; }

  .fp-wc26 .wc-teams-bar { flex-direction: row; align-items: center; }
  .fp-wc26 .wc-search { font-size: 14px; padding: 10px 14px; }
  .fp-wc26 .wc-teams-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    max-height: 420px; gap: 10px;
  }
  .fp-wc26 .wc-team { padding: 10px; font-size: 13px; }
  .fp-wc26 .wc-team-name { font-size: 13px; }

  .fp-wc26 .wc-tz-wrap { padding-top: 18px; margin-top: 8px; }
  .fp-wc26 .wc-select { max-width: 380px; font-size: 14px; padding: 10px 14px; }
  .fp-wc26 .wc-tz-note { font-size: 11px; margin-top: 10px; }

  .fp-wc26 .wc-export-grid {
    grid-template-columns: repeat(2, 1fr); gap: 12px;
  }
  .fp-wc26 .wc-export { padding: 16px 18px; }
  .fp-wc26 .wc-export-icon { width: 44px; height: 44px; font-size: 26px; }
  .fp-wc26 .wc-export-title { font-size: 14px; letter-spacing: 0.5px; margin-bottom: 4px; }
  .fp-wc26 .wc-export-desc { font-size: 12px; }
  .fp-wc26 .wc-export-cta { font-size: 11px; letter-spacing: 2px; }

  .fp-wc26 .wc-stat-bar {
    flex-direction: row; align-items: center; gap: 22px;
    padding: 14px 22px; margin-top: 22px;
  }
  .fp-wc26 .wc-stat-bar-num { font-size: 24px; }
  .fp-wc26 .wc-stat-bar-lab { font-size: 10px; letter-spacing: 2px; }
  .fp-wc26 .wc-stat-bar-pipe { width: 1px; height: 36px; }

  .fp-wc26 .wc-url-fallback { padding: 14px 18px; margin-top: 16px; }
  .fp-wc26 .wc-url-fallback-label { font-size: 10px; letter-spacing: 1.5px; }
  .fp-wc26 .wc-url-fallback-row { flex-direction: row; align-items: stretch; gap: 8px; }
  .fp-wc26 .wc-url-input { width: auto; flex: 1; padding: 9px 12px; }
  .fp-wc26 .wc-url-copy { width: auto; padding: 9px 18px; }

  .fp-wc26 .wc-faq h3 { font-size: 24px; margin-bottom: 18px; }
  .fp-wc26 .wc-faq-grid {
    grid-template-columns: repeat(2, 1fr); gap: 12px;
  }
  .fp-wc26 .wc-faq-item { padding: 16px 18px; }
  .fp-wc26 .wc-faq-q { font-size: 14px; }
  .fp-wc26 .wc-faq-a { font-size: 13px; }

  .fp-wc26 .wc-cta { padding: 36px 24px; }
  .fp-wc26 .wc-cta-kicker { font-size: 11px; letter-spacing: 3px; margin-bottom: 12px; }
  .fp-wc26 .wc-cta h3 { font-size: 30px; margin-bottom: 12px; }
  .fp-wc26 .wc-cta p { font-size: 15px; margin-bottom: 22px; }
  .fp-wc26 .wc-btn-primary { width: auto; padding: 16px 28px; font-size: 14px; letter-spacing: 2px; }

  .fp-wc26 .wc-footer {
    flex-direction: row; justify-content: space-between;
    padding: 22px 24px; font-size: 11px; letter-spacing: 1px;
    text-align: left; gap: 12px; flex-wrap: wrap;
  }

  .fp-wc26 .wc-paste-toast {
    left: 50%; right: auto;
    bottom: 22px;
    transform: translateX(-50%);
    max-width: 460px; width: calc(100vw - 32px);
    padding: 16px 18px 16px 16px;
  }
  @keyframes fpToastInMobile {
    from { transform: translate(-50%, 20px); opacity: 0; }
    to   { transform: translate(-50%, 0); opacity: 1; }
  }
  .fp-wc26 .wc-paste-toast-icon { width: 44px; height: 44px; font-size: 26px; }
  .fp-wc26 .wc-paste-toast-title { font-size: 14px; margin-bottom: 4px; }
  .fp-wc26 .wc-paste-toast-text { font-size: 12px; }
}

/* ════════════════════════════════════════════════════════════════
 * lg — 960px+ : desktop
 *   3-column scope, 4-column exports laid out vertically (icon on
 *   top, title + desc centered, CTA at bottom). The horizontal
 *   layout that mobile/tablet use breaks at 4-col widths — titles
 *   like "iPhone · iPad · Mac" wrap to 3 lines when the body
 *   column is only ~70px wide.
 * ════════════════════════════════════════════════════════════════ */
@media (min-width: 960px) {
  .fp-wc26 .wc-grid-bg {
    height: 60%; opacity: 0.6;
    background:
      repeating-linear-gradient(0deg, transparent 0, transparent 39px, rgba(33,226,140,0.22) 39px, rgba(33,226,140,0.22) 40px),
      repeating-linear-gradient(90deg, transparent 0, transparent 39px, rgba(33,226,140,0.22) 39px, rgba(33,226,140,0.22) 40px);
    transform: perspective(400px) rotateX(60deg);
  }

  .fp-wc26 .wc-scope-grid { grid-template-columns: repeat(3, 1fr); }

  /* Vertical export cards (4-up) — fix for the squished horizontal
     layout when the grid drops below ~280px per column. */
  .fp-wc26 .wc-export-grid { grid-template-columns: repeat(4, 1fr); }
  .fp-wc26 .wc-export {
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    padding: 20px 18px 18px;
    gap: 12px;
    min-height: 168px;
  }
  .fp-wc26 .wc-export-icon {
    width: 48px; height: 48px; font-size: 26px;
  }
  .fp-wc26 .wc-export-body {
    flex: 1;
  }
  .fp-wc26 .wc-export-title {
    font-size: 14px;
    margin-bottom: 6px;
  }
  .fp-wc26 .wc-export-desc {
    font-size: 12px;
    line-height: 1.45;
  }
  .fp-wc26 .wc-export-cta {
    margin-top: auto;
    align-self: flex-start;
    padding-top: 4px;
  }
  /* Arrow nudge feels right pointing forward when CTA sits below. */
  .fp-wc26 .wc-export:not(.is-disabled):hover .wc-export-arrow {
    transform: translateX(4px);
  }
}
`;

export default WorldCup2026Calendar;
