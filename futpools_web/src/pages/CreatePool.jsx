import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import {
  HudFrame, ArcadeButton, ArenaLabel, arenaInputStyle, SectionLabel,
} from '../arena-ui/primitives';

// ────────────────────────────────────────────────────────────────────
// Helpers

function kickoffLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function kickoffShortTag(iso) {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
}

function isUpcoming(iso) {
  if (!iso) return false;
  return new Date(iso) > new Date();
}

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);

function isLiveFixture(fx) {
  return LIVE_STATUSES.has(String(fx?.status || '').toUpperCase());
}

function isPickable(fx) {
  return isUpcoming(fx?.date) || isLiveFixture(fx);
}

// Source = { kind: 'league'|'team', id, name, logo, country, season? }
const sourceKey = (s) => `${s.kind === 'league' ? 'L' : 'T'}${s.id}`;

// ────────────────────────────────────────────────────────────────────
// Visibility pill (admin only)

function VisibilityPill({ active, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: 10,
        textAlign: 'left',
        cursor: 'pointer',
        background: active ? 'var(--fp-primary)' : 'var(--fp-surface)',
        color: active ? 'var(--fp-on-primary)' : 'var(--fp-text)',
        border: `1px solid ${active ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
        clipPath: 'var(--fp-clip-sm)',
      }}
    >
      <div style={{ fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800, letterSpacing: 2 }}>{title}</div>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 0.5,
        opacity: active ? 0.85 : 0.6, marginTop: 2,
      }}>{subtitle}</div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────
// Basket row (on main page — removable)

function BasketRow({ fx, onRemove, locale }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: 10,
      background: 'var(--fp-surface)', border: '1px solid var(--fp-stroke)',
      clipPath: 'var(--fp-clip-sm)', marginBottom: 6,
    }}>
      <SourceLogoSmall url={fx.teams?.home?.logo} fallback="shield" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {fx.teams?.home?.name} vs {fx.teams?.away?.name}
        </div>
        <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
          {kickoffLabel(fx.date)}
          {fx.league?.name && <> · <span style={{ color: 'var(--fp-text-dim)' }}>{fx.league.name}</span></>}
        </div>
      </div>
      <SourceLogoSmall url={fx.teams?.away?.logo} fallback="shield" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="remove"
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--fp-surface-alt)', border: 'none', cursor: 'pointer',
          color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 12, fontWeight: 700,
        }}
      >✕</button>
    </div>
  );
}

function SourceLogoSmall({ url, fallback = 'shield', size = 28 }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 4, background: 'var(--fp-surface-alt)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, color: 'var(--fp-accent)',
    }}>{fallback === 'trophy' ? '🏆' : '⚽'}</div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Picker modal

function FixturePickerModal({ open, onClose, onDone, selected, onToggle, locale }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]); // [{kind,...}]
  const [activeSource, setActiveSource] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [loadingFx, setLoadingFx] = useState(false);
  const debounceRef = useRef(null);

  // reset when reopened
  useEffect(() => {
    if (!open) {
      setQuery(''); setResults([]); setActiveSource(null); setFixtures([]);
    }
  }, [open]);

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    try {
      const [leagues, teams] = await Promise.all([
        api.get(`/football/leagues/search?query=${encodeURIComponent(q)}`),
        api.get(`/football/teams/search?query=${encodeURIComponent(q)}`),
      ]);
      const combined = [
        ...(Array.isArray(leagues) ? leagues : []).slice(0, 8).map(l => ({ kind: 'league', ...l })),
        ...(Array.isArray(teams)   ? teams   : []).slice(0, 12).map(tm => ({ kind: 'team', ...tm })),
      ];
      setResults(combined);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (activeSource) return; // when a source is selected, ignore query changes here
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, activeSource, runSearch]);

  const selectSource = async (src) => {
    setActiveSource(src);
    setFixtures([]);
    setLoadingFx(true);
    try {
      const qs = src.kind === 'team'
        ? `teamId=${src.id}`
        : `leagueId=${src.id}${src.season ? `&season=${src.season}` : ''}`;
      const data = await api.get(`/football/fixtures?${qs}`);
      setFixtures(Array.isArray(data) ? data : []);
    } catch {
      setFixtures([]);
    } finally {
      setLoadingFx(false);
    }
  };

  const clearSource = () => { setActiveSource(null); setFixtures([]); };

  if (!open) return null;

  const POPULAR = [
    ['Liga MX',          'liga mx'],
    ['Premier League',   'premier league'],
    ['La Liga',          'la liga'],
    ['Champions League', 'uefa champions'],
    ['MLS',              'major league soccer'],
    ['Serie A',          'serie a'],
  ];

  const basketCount = selected.size;
  const firstInBasket = (() => {
    // `selected` is a Map of fixtureId → fixture object; find earliest kickoff
    let first = null;
    for (const fx of selected.values()) {
      if (!fx?.date) continue;
      const d = new Date(fx.date);
      if (!first || d < first.d) first = { d, fx };
    }
    return first?.fx || null;
  })();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        maxWidth: 430, width: '100%', height: '100%', margin: '0 auto',
        background: 'var(--fp-bg)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px',
          borderBottom: '1px solid var(--fp-stroke)',
        }}>
          <button
            type="button"
            onClick={activeSource ? clearSource : onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 12,
            }}
          >{activeSource ? `← ${t(locale, 'Back')}` : t(locale, 'Close')}</button>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 13,
          }}>
            {activeSource ? t(locale, 'PICK FIXTURES') : t(locale, 'ADD FIXTURES')}
          </div>
          <button
            type="button"
            onClick={onDone}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--fp-primary)', fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 13, letterSpacing: 2,
            }}
          >{t(locale, 'Done').toUpperCase()}</button>
        </div>

        {/* Search bar (always visible) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: 'var(--fp-bg2)', borderBottom: '1px solid var(--fp-stroke)',
        }}>
          <span style={{ color: 'var(--fp-text-muted)', fontSize: 14 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (activeSource) setActiveSource(null);
            }}
            placeholder={t(locale, 'Search a league or team…')}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--fp-text)', fontFamily: 'var(--fp-mono)', fontSize: 14,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="clear"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--fp-text-dim)', fontSize: 14,
              }}
            >✕</button>
          )}
          {searching && <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)' }}>…</span>}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 140px' }}>
          {!activeSource && query.trim().length < 2 && (
            <>
              <SectionLabel color="var(--fp-primary)">{t(locale, 'POPULAR')}</SectionLabel>
              <div style={{ height: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {POPULAR.map(([label, q]) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuery(q)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px',
                      background: 'var(--fp-surface)', border: '1px solid var(--fp-stroke)',
                      clipPath: 'var(--fp-clip-sm)', cursor: 'pointer',
                      color: 'var(--fp-text)', fontFamily: 'var(--fp-display)',
                      fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
                    }}
                  >
                    <span style={{ color: 'var(--fp-accent)' }}>🏆</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{label.toUpperCase()}</span>
                  </button>
                ))}
              </div>
              <div style={{
                fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)',
                marginTop: 14,
              }}>
                {t(locale, 'Or type any team or league name above — we\'ll pull upcoming games from API-Football.')}
              </div>
            </>
          )}

          {!activeSource && query.trim().length >= 2 && results.length === 0 && !searching && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fp-text-dim)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔎</div>
              <div style={{ fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 13, color: 'var(--fp-text-muted)' }}>
                {t(locale, 'No matches')}
              </div>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, marginTop: 6 }}>
                {t(locale, 'Try another spelling or shorter query.')}
              </div>
            </div>
          )}

          {!activeSource && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map((src) => (
                <button
                  key={sourceKey(src)}
                  type="button"
                  onClick={() => selectSource(src)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    background: 'var(--fp-surface)', border: '1px solid var(--fp-stroke)',
                    clipPath: 'var(--fp-clip-sm)', cursor: 'pointer', color: 'var(--fp-text)',
                    textAlign: 'left',
                  }}
                >
                  <SourceLogoSmall url={src.logo} fallback={src.kind === 'league' ? 'trophy' : 'shield'} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--fp-display)', fontWeight: 800, fontSize: 14,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{src.name}</div>
                    <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, marginTop: 2 }}>
                      <span style={{ color: 'var(--fp-accent)', fontWeight: 700, letterSpacing: 1.5 }}>
                        {src.kind === 'league' ? t(locale, 'LEAGUE') : t(locale, 'TEAM')}
                      </span>
                      <span style={{ color: 'var(--fp-text-dim)' }}> · </span>
                      <span style={{ color: 'var(--fp-text-muted)' }}>{src.country || ''}</span>
                    </div>
                  </div>
                  <span style={{ color: 'var(--fp-text-dim)', fontSize: 14 }}>›</span>
                </button>
              ))}
            </div>
          )}

          {activeSource && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 12,
                background: 'var(--fp-surface-alt)', clipPath: 'var(--fp-clip-sm)',
              }}>
                <SourceLogoSmall url={activeSource.logo} fallback={activeSource.kind === 'league' ? 'trophy' : 'shield'} size={34} />
                <div>
                  <div style={{
                    fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                    color: 'var(--fp-accent)',
                  }}>
                    {activeSource.kind === 'league' ? t(locale, 'LEAGUE') : t(locale, 'TEAM')}
                  </div>
                  <div style={{ fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800 }}>
                    {activeSource.name}
                  </div>
                </div>
              </div>

              {loadingFx ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 11, letterSpacing: 1.5 }}>
                  {t(locale, 'LOADING FIXTURES…')}
                </div>
              ) : fixtures.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--fp-text-dim)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🗓️</div>
                  <div style={{ fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800, letterSpacing: 2, color: 'var(--fp-text-muted)' }}>
                    {t(locale, 'No upcoming matches')}
                  </div>
                  <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, marginTop: 6 }}>
                    {t(locale, 'The season may be off or this team has no scheduled games.')}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fixtures.map((fx) => {
                    const picked = selected.has(fx.fixtureId);
                    const live = isLiveFixture(fx);
                    const played = !isPickable(fx);
                    return (
                      <button
                        key={fx.fixtureId}
                        type="button"
                        disabled={played}
                        onClick={() => onToggle(fx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                          background: picked ? 'color-mix(in srgb, var(--fp-primary) 12%, transparent)' : 'var(--fp-surface)',
                          border: `${picked ? 1.5 : 1}px solid ${picked ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
                          clipPath: 'var(--fp-clip-sm)', cursor: played ? 'default' : 'pointer',
                          opacity: played ? 0.45 : 1, color: 'var(--fp-text)', textAlign: 'left',
                        }}
                      >
                        {/* radio */}
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%',
                          border: `1.5px solid ${picked ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {picked && <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--fp-primary)' }} />}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <SourceLogoSmall url={fx.teams?.home?.logo} fallback="shield" size={22} />
                            <span style={{ fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800 }}>{fx.teams?.home?.name}</span>
                            <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-dim)' }}>vs</span>
                            <span style={{ fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800 }}>{fx.teams?.away?.name}</span>
                            <SourceLogoSmall url={fx.teams?.away?.logo} fallback="shield" size={22} />
                          </div>
                          <div style={{
                            fontFamily: 'var(--fp-mono)', fontSize: 10, marginTop: 3,
                            color: (played || live) ? 'var(--fp-danger)' : 'var(--fp-text-muted)',
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}>
                            <span>{kickoffLabel(fx.date)}</span>
                            {live && (
                              <>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fp-danger)' }} />
                                <span style={{ fontWeight: 700, letterSpacing: 1.2 }}>LIVE</span>
                              </>
                            )}
                            {played && !live && (
                              <span>· <span style={{ fontWeight: 700, letterSpacing: 1 }}>{t(locale, 'ALREADY PLAYED')}</span></span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky basket bar */}
        {basketCount > 0 && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '14px 16px', background: 'var(--fp-primary)',
            color: 'var(--fp-on-primary)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800, letterSpacing: 2 }}>
                {tFormat(locale, '{n} IN BASKET', { n: basketCount })}
              </div>
              {firstInBasket && (
                <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, opacity: 0.85 }}>
                  {t(locale, 'FIRST')} · {kickoffShortTag(firstInBasket.date)}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onDone}
              style={{
                padding: '10px 16px', background: 'var(--fp-bg)',
                color: 'var(--fp-primary)', border: '1.5px solid var(--fp-primary)',
                clipPath: 'var(--fp-clip-sm)', cursor: 'pointer',
                fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 800, letterSpacing: 2,
              }}
            >{t(locale, 'Done').toUpperCase()} →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main page

export function CreatePool() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { locale } = useLocale();
  const isAdmin = user?.isAdmin === true;

  const [name, setName] = useState('');
  // simple_version: free-text message from creator to participants.
  // Persisted server-side in the existing `description` field.
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState('public');
  // simple_version: every pool charges a flat MXN fee via Stripe at
  // checkout. The legacy SPONSOR/COINS economy is gone. Default $50;
  // admin can override per pool.
  const [entryFeeMXN, setEntryFeeMXN] = useState(50);
  // Legacy state kept zeroed because the API still accepts these
  // fields on master — sending zeros keeps a backward-compat payload.
  const entryCostCoins = 0;
  const prizeCoins = 0;

  // Basket: Map fixtureId → full fixture object (so we preserve kickoff/teams for submit)
  const [basket, setBasket] = useState(() => new Map());
  const [pickerOpen, setPickerOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [createdPool, setCreatedPool] = useState(null);

  const toggleFx = (fx) => {
    setBasket((prev) => {
      const next = new Map(prev);
      if (next.has(fx.fixtureId)) next.delete(fx.fixtureId);
      else next.set(fx.fixtureId, fx);
      return next;
    });
  };
  const removeFx = (fixtureId) => {
    setBasket((prev) => {
      const next = new Map(prev);
      next.delete(fixtureId);
      return next;
    });
  };

  const selectedFixtures = Array.from(basket.values())
    .filter(isPickable)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const canSubmit =
    name.trim().length > 0
    && selectedFixtures.length > 0
    && Number(entryFeeMXN) >= 1
    && !submitting;

  // First-blocking reason for the disabled CTA. Order mirrors the form
  // sections so the hint points the user to the next thing to fix.
  const canSubmitHint = !canSubmit
    ? (name.trim().length === 0
        ? t(locale, 'Add a name to continue')
        : selectedFixtures.length === 0
          ? t(locale, 'Pick at least one match')
          : Number(entryFeeMXN) < 1
            ? t(locale, 'Set an entry fee in MXN')
            : null)
    : null;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: name.trim(),
        description: message.trim(),
        prizeLabel: '',
        visibility,
        // simple_version: real-money entry fee. The legacy coin fields
        // ride along zeroed so a master backend wouldn't choke on them.
        entryFeeMXN: Number(entryFeeMXN),
        entryCostCoins,
        prizeCoins,
        fixtures: selectedFixtures.map(fx => ({
          fixtureId: fx.fixtureId,
          leagueId:   fx.league?.id,
          leagueName: fx.league?.name || '',
          homeTeamId: fx.teams?.home?.id,
          awayTeamId: fx.teams?.away?.id,
          homeTeam:   fx.teams?.home?.name || '',
          awayTeam:   fx.teams?.away?.name || '',
          homeLogo:   fx.teams?.home?.logo || '',
          awayLogo:   fx.teams?.away?.logo || '',
          kickoff:    fx.date,
          status:     fx.status || '',
        })),
      };
      const pool = await api.post('/quinielas', payload, token);
      setCreatedPool(pool);
    } catch (err) {
      setErrorMsg(err?.message || 'Could not create pool');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdPool) {
    return <CreatedSuccess pool={createdPool} onClose={() => navigate('/')} locale={locale} />;
  }

  return (
    <>
      <div style={{ padding: '14px 16px 120px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)', fontSize: 12,
            }}
          >← {t(locale, 'Cancel')}</button>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 14,
          }}>{t(locale, 'CREATE POOL')}</div>
          <div style={{ width: 60 }} />
        </div>

        {/* BASICS */}
        <div style={{ marginBottom: 18 }}>
          <SectionLabel color="var(--fp-primary)">{t(locale, 'BASICS')}</SectionLabel>
          <div style={{ height: 8 }} />
          <ArenaLabel>{t(locale, 'NAME')}</ArenaLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(locale, 'La vaquita del mundial')} style={arenaInputStyle} />
          <div style={{ height: 10 }} />
          <ArenaLabel>{t(locale, 'MESSAGE (optional)')}</ArenaLabel>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t(locale, '¡Que gane el mejor! 🏆')}
            rows={3}
            style={{ ...arenaInputStyle, resize: 'vertical', fontFamily: 'var(--fp-mono)' }}
          />
        </div>

        {/* ENTRY FEE — simple_version: flat MXN per entry, paid via Stripe.
            The legacy SPONSOR/COINS dual economy is gone (admin-only form,
            real-money pools only). Pre-filled to $50 per spec; admin can
            override per pool when a special event needs a different tier. */}
        <div style={{ marginBottom: 18 }}>
          <SectionLabel color="var(--fp-primary)">{t(locale, 'ENTRY FEE')}</SectionLabel>
          <div style={{ height: 8 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 28, fontWeight: 900,
              color: 'var(--fp-primary)',
            }}>$</div>
            <input
              type="number"
              min="1"
              step="1"
              value={entryFeeMXN}
              onChange={(e) => setEntryFeeMXN(e.target.value.replace(/[^\d]/g, ''))}
              style={{
                ...arenaInputStyle,
                fontFamily: 'var(--fp-display)',
                fontSize: 24,
                fontWeight: 900,
                textAlign: 'center',
                width: 120,
              }}
            />
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 12, fontWeight: 700,
              letterSpacing: 1.5, color: 'var(--fp-text-muted)',
            }}>MXN</div>
            <div style={{ flex: 1 }} />
          </div>
          <div style={{
            marginTop: 8, fontFamily: 'var(--fp-mono)', fontSize: 10,
            color: 'var(--fp-text-dim)',
          }}>
            {t(locale, 'Each participant pays this via Stripe at signup. The winner is paid out manually.')}
          </div>
        </div>

        {/* Visibility */}
        {isAdmin ? (
          <div style={{ marginBottom: 18 }}>
            <SectionLabel color="var(--fp-primary)">{t(locale, 'VISIBILITY')}</SectionLabel>
            <div style={{ height: 8 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <VisibilityPill active={visibility === 'private'} onClick={() => setVisibility('private')}
                title={t(locale, 'PRIVATE')} subtitle={t(locale, 'Only people with the code')} />
              <VisibilityPill active={visibility === 'public'}  onClick={() => setVisibility('public')}
                title={t(locale, 'PUBLIC')}  subtitle={t(locale, "Show in everyone's Home")} />
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom: 18, display: 'flex', gap: 6, alignItems: 'center',
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1.5,
            color: 'var(--fp-text-dim)',
          }}>
            <span>🔒</span>
            <span>{t(locale, 'PRIVATE POOL — SHARE BY INVITE CODE')}</span>
          </div>
        )}

        {/* FIXTURES */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <SectionLabel color="var(--fp-primary)">{t(locale, 'FIXTURES')}</SectionLabel>
            <div style={{ flex: 1 }} />
            {selectedFixtures.length > 0 && (
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1.5, color: 'var(--fp-accent)' }}>
                {tFormat(locale, '{n} SELECTED', { n: selectedFixtures.length })}
              </div>
            )}
          </div>

          {selectedFixtures.length === 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              style={{
                width: '100%', padding: '28px 16px', textAlign: 'center',
                background: 'color-mix(in srgb, var(--fp-surface) 50%, transparent)',
                border: '1px dashed color-mix(in srgb, var(--fp-primary) 50%, transparent)',
                clipPath: 'var(--fp-clip-sm)', cursor: 'pointer', color: 'var(--fp-primary)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 24 }}>＋🔍</span>
              <span style={{ fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 13 }}>
                {t(locale, 'ADD FIXTURES')}
              </span>
              <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>
                {t(locale, 'Search any league or team — add games one by one')}
              </span>
            </button>
          ) : (
            <>
              {selectedFixtures.map(fx => (
                <BasketRow key={fx.fixtureId} fx={fx} onRemove={() => removeFx(fx.fixtureId)} locale={locale} />
              ))}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                style={{
                  width: '100%', padding: '12px 16px', marginTop: 4,
                  background: 'transparent',
                  border: '1px dashed color-mix(in srgb, var(--fp-primary) 60%, transparent)',
                  clipPath: 'var(--fp-clip-sm)', cursor: 'pointer', color: 'var(--fp-primary)',
                  fontFamily: 'var(--fp-display)', fontWeight: 800, letterSpacing: 2, fontSize: 11,
                }}
              >+ {t(locale, 'ADD MORE FIXTURES')}</button>
            </>
          )}
        </div>

        {errorMsg && (
          <div style={{
            padding: 10, marginBottom: 10,
            fontFamily: 'var(--fp-mono)', fontSize: 11,
            color: 'var(--fp-danger)',
          }}>{errorMsg}</div>
        )}
      </div>

      {/* Sticky CTA */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        padding: '14px 16px 28px',
        background: 'linear-gradient(180deg, transparent, var(--fp-bg) 50%)',
        zIndex: 40,
      }}>
        <div style={{ maxWidth: 430, margin: '0 auto' }}>
          {canSubmitHint && (
            <div style={{
              marginBottom: 8, textAlign: 'center',
              fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700,
              letterSpacing: 1.2, color: 'var(--fp-text-dim)',
            }}>{canSubmitHint}</div>
          )}
          <ArcadeButton size="lg" fullWidth disabled={!canSubmit} onClick={onSubmit}>
            {submitting ? t(locale, 'Creating…') : `▶ ${t(locale, 'CREATE POOL')}`}
          </ArcadeButton>
        </div>
      </div>

      <FixturePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onDone={() => setPickerOpen(false)}
        selected={basket}
        onToggle={toggleFx}
        locale={locale}
      />
    </>
  );
}

// 3-tier presets (v3 simplification). Label each by intent so the user
// picks semantically; the numeric amount is secondary information.
// MUST match the backend whitelist — anything outside coerces to 0.
const SPONSOR_PRIZE_PRESETS = [
  { amount: 50,   tierKey: 'CASUAL' },
  { amount: 250,  tierKey: 'STANDARD' },
  { amount: 1000, tierKey: 'HIGH STAKES' },
];
const ENTRY_COIN_PRESETS = [
  { amount: 25,  tierKey: 'CASUAL' },
  { amount: 100, tierKey: 'STANDARD' },
  { amount: 500, tierKey: 'HIGH STAKES' },
];

function EntryTypePill({ active, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: 10, cursor: 'pointer',
        background: active ? 'var(--fp-primary)' : 'var(--fp-surface)',
        border: `1px solid ${active ? 'var(--fp-primary)' : 'var(--fp-stroke)'}`,
        clipPath: 'var(--fp-clip-sm)',
        textAlign: 'left',
      }}
    >
      <div style={{
        fontFamily: 'var(--fp-display)', fontSize: 13, fontWeight: 900,
        letterSpacing: 2, color: active ? 'var(--fp-on-primary)' : 'var(--fp-text)',
      }}>{title}</div>
      <div style={{
        marginTop: 4, fontFamily: 'var(--fp-mono)', fontSize: 9,
        color: active ? 'color-mix(in srgb, var(--fp-on-primary) 85%, transparent)' : 'var(--fp-text-muted)',
      }}>{subtitle}</div>
    </button>
  );
}

function CoinPresetChip({ amount, active, onClick, accent = 'var(--fp-gold)', tierLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 4px', cursor: 'pointer', textAlign: 'center',
        background: active ? accent : 'var(--fp-surface)',
        border: `1px solid ${active ? accent : 'var(--fp-stroke)'}`,
        clipPath: 'var(--fp-clip-sm)',
      }}
    >
      {tierLabel && (
        <div style={{
          fontFamily: 'var(--fp-mono)', fontSize: 8, fontWeight: 700,
          letterSpacing: 1.2,
          color: active ? 'color-mix(in srgb, var(--fp-on-primary) 90%, transparent)' : 'var(--fp-text-muted)',
          marginBottom: 2,
        }}>{tierLabel}</div>
      )}
      <div style={{
        fontFamily: 'var(--fp-display)', fontSize: 18, fontWeight: 900,
        color: active ? 'var(--fp-on-primary)' : accent,
      }}>{amount}</div>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 8, fontWeight: 700,
        letterSpacing: 1.5,
        color: active ? 'color-mix(in srgb, var(--fp-on-primary) 80%, transparent)' : 'var(--fp-text-muted)',
      }}>COINS</div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────
// "Pool created" success screen

function CreatedSuccess({ pool, onClose, locale }) {
  const [copied, setCopied] = useState(false);
  const code = pool.inviteCode || '';
  const shareURL = typeof window !== 'undefined'
    ? `${window.location.origin}/p/${code}`
    : `futpools://p/${code}`;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in non-secure contexts or cross-origin iframes.
      // Surface the URL in a prompt so the user can still grab it manually.
      window.prompt('Copy this link', text);
    }
  };

  /// Mobile-only native share — desktop share sheets (Chrome macOS) can glue
  /// `title`/`text` onto `url` when piping to a share target, producing
  /// garbled links like `/p/CODE Foo Pool Name`. On desktop we copy straight
  /// to the clipboard (more predictable, probably what the user wants anyway).
  const isMobileShareAvailable = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && ((navigator.userAgentData && navigator.userAgentData.mobile === true)
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''));

  const share = async () => {
    if (isMobileShareAvailable) {
      try {
        // URL only — no `title`/`text` so nothing can get concatenated.
        await navigator.share({ url: shareURL });
        return;
      } catch { /* user cancelled or share failed → fall through to copy */ }
    }
    copy(shareURL);
  };

  return (
    <div style={{ padding: 16, maxWidth: 430, margin: '0 auto' }}>
      <div style={{
        fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 800, letterSpacing: 2,
        color: 'var(--fp-primary)', textAlign: 'center', marginTop: 40, marginBottom: 10,
      }}>
        🎉 {t(locale, 'POOL CREATED!')}
      </div>
      <div style={{
        fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
        textAlign: 'center', marginBottom: 24, textTransform: 'uppercase',
      }}>{pool.name}</div>

      <HudFrame>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 2,
            color: 'var(--fp-text-muted)', marginBottom: 8,
          }}>{t(locale, 'INVITE CODE')}</div>
          <button
            type="button"
            onClick={() => copy(code)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--fp-display)', fontSize: 32, fontWeight: 900,
              letterSpacing: 6, color: 'var(--fp-primary)',
            }}
          >{code}</button>
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-dim)', marginTop: 6,
          }}>{copied ? t(locale, 'Link copied') : t(locale, 'Tap to copy')}</div>
        </div>
      </HudFrame>

      <div style={{ height: 12 }} />
      <ArcadeButton size="lg" fullWidth onClick={share}>{t(locale, 'Share link').toUpperCase()}</ArcadeButton>
      <div style={{ height: 8 }} />
      <ArcadeButton size="lg" fullWidth variant="surface" onClick={onClose}>{t(locale, 'Done').toUpperCase()}</ArcadeButton>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Invite resolver — keep from original file

/**
 * Extract the first 8 valid invite-alphabet chars from a path segment. The
 * backend mint uses `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I) — any
 * char outside that set is garbage from a mangled share (e.g. a messaging
 * app that glued the share text onto the URL when a friend pasted it back
 * into the address bar). We pull the first 8 alphabet chars we see, which
 * recovers the invite for URLs like `/p/TADWQ2WL Join my FutPools…`.
 */
const INVITE_ALPHABET_RE = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
function sanitizeInviteCode(raw) {
  if (!raw) return '';
  const upper = decodeURIComponent(String(raw)).toUpperCase();
  const matches = upper.match(INVITE_ALPHABET_RE) || [];
  return matches.slice(0, 8).join('');
}

export function InviteResolver() {
  const navigate = useNavigate();
  const rawCode = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
  const code = sanitizeInviteCode(rawCode);

  useEffect(() => {
    if (!code || code.length !== 8) { navigate('/', { replace: true }); return; }
    let cancel = false;
    api.get(`/quinielas/invite/${code}`)
      .then((pool) => { if (!cancel && pool?._id) navigate(`/pool/${pool._id}`, { replace: true }); })
      .catch(() => { if (!cancel) navigate('/', { replace: true }); });
    return () => { cancel = true; };
  }, [code, navigate]);

  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
      RESOLVING INVITE…
    </div>
  );
}
