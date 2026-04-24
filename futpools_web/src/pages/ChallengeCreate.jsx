/**
 * Challenge creation screen.
 *
 * Single scrollable form with five stacked sections (fixture → market → pick →
 * stake → opponent). Wizard-style sections collapse once completed so the
 * user always sees the next required action highlighted. Reuses the same
 * `/football/leagues/search` + `/football/fixtures` API surface as CreatePool.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t, tFormat } from '../i18n/translations';
import { AppBackground } from '../arena-ui/AppBackground';
import { HudFrame, ArcadeButton, IconButton, TeamCrest } from '../arena-ui/primitives';

const STAKE_PRESETS = [10, 25, 50, 100, 250, 500];

const MARKETS = [
  { key: '1X2',  label: '1X2',       sub: 'home / draw / away' },
  { key: 'OU25', label: 'O/U 2.5',   sub: 'over or under' },
  { key: 'BTTS', label: 'BTTS',      sub: 'both teams score' },
];

const PICK_OPTIONS = {
  '1X2':  [{ k: '1', l: 'HOME' }, { k: 'X', l: 'DRAW' }, { k: '2', l: 'AWAY' }],
  'OU25': [{ k: 'OVER', l: 'OVER 2.5' }, { k: 'UNDER', l: 'UNDER 2.5' }],
  'BTTS': [{ k: 'YES', l: 'YES' }, { k: 'NO', l: 'NO' }],
};

export function ChallengeCreate() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { locale } = useLocale();

  const [fixture, setFixture] = useState(null);
  const [marketType, setMarketType] = useState(null);
  const [pick, setPick] = useState(null);
  const [stake, setStake] = useState(null);
  const [opponent, setOpponent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const balance = user?.balance ?? 0;
  const canSubmit = !!(fixture && marketType && pick && stake && opponent.trim());
  const insufficientBalance = stake != null && balance < stake;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (insufficientBalance) { setError(t(locale, 'Insufficient balance — visit the shop to recharge.')); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post('/challenges', {
        opponentUsername: opponent.trim().replace(/^@/, '').toLowerCase(),
        fixture: {
          fixtureId: fixture.fixtureId,
          leagueId: fixture.leagueId,
          leagueName: fixture.leagueName,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeLogo: fixture.homeLogo,
          awayLogo: fixture.awayLogo,
          kickoff: fixture.kickoff,
        },
        marketType,
        challengerPick: pick,
        stakeCoins: stake,
      }, token);
      // Server accepted — hop to detail so the creator can copy the share link.
      navigate(`/challenges/${res._id}`, { replace: true });
    } catch (e) {
      // Surface server-provided error codes in human copy.
      const msg = e.message || 'Failed';
      if (/INSUFFICIENT_BALANCE/.test(msg)) setError(t(locale, 'Insufficient balance — visit the shop to recharge.'));
      else if (/Opponent not found/i.test(msg)) setError(t(locale, 'That user does not exist.'));
      else if (/Cannot challenge yourself/i.test(msg)) setError(t(locale, "You can't challenge yourself."));
      else if (/FIXTURE_STARTED/.test(msg)) setError(t(locale, 'Fixture already started.'));
      else setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppBackground />

      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--fp-stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate(-1)}>←</IconButton>
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--fp-display)', fontSize: 12, letterSpacing: 3,
            fontWeight: 700,
          }}>⚔ {t(locale, 'NEW CHALLENGE')}</div>
          <div style={{ width: 32 }} />
        </div>
      </div>

      <div style={{ padding: '16px 16px 140px' }}>
        {/* SECTION 1 — Fixture */}
        <Section title={`① ${t(locale, 'PICK A MATCH')}`} locked={false}>
          {fixture ? (
            <FixturePinned fixture={fixture} onChange={() => setFixture(null)} />
          ) : (
            <FixtureSearch locale={locale} onPick={(fx) => setFixture(fx)} />
          )}
        </Section>

        {/* SECTION 2 — Market type */}
        <Section title={`② ${t(locale, 'MARKET')}`} locked={!fixture}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MARKETS.map((m) => {
              const active = marketType === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={!fixture}
                  onClick={() => { setMarketType(m.key); setPick(null); }}
                  style={pillStyle(active, !fixture)}
                >
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{m.label}</div>
                  <div style={{ fontSize: 8, opacity: 0.75, fontFamily: 'var(--fp-mono)' }}>{m.sub}</div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* SECTION 3 — Outcome pick */}
        <Section title={`③ ${t(locale, 'YOUR PICK')}`} locked={!marketType}>
          {marketType ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {PICK_OPTIONS[marketType].map((opt) => {
                const active = pick === opt.k;
                return (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => setPick(opt.k)}
                    style={{ ...pillStyle(active, false), flex: 1, padding: '12px 4px' }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{opt.k}</div>
                    <div style={{ fontSize: 9, opacity: 0.75, fontFamily: 'var(--fp-mono)' }}>{opt.l}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <LockedHint locale={locale} msg={t(locale, 'Pick a market first.')} />
          )}
        </Section>

        {/* SECTION 4 — Stake */}
        <Section title={`④ ${t(locale, 'STAKE')}`} locked={!pick}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STAKE_PRESETS.map((n) => {
              const active = stake === n;
              const over = n > balance;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!pick}
                  onClick={() => setStake(n)}
                  style={{ ...pillStyle(active, !pick), flex: '1 0 30%', padding: '10px 4px' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800 }}>🪙 {n}</div>
                  {over && <div style={{ fontSize: 8, color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)' }}>NEED MORE</div>}
                </button>
              );
            })}
          </div>
          <div style={{
            marginTop: 8,
            fontFamily: 'var(--fp-mono)', fontSize: 10,
            color: insufficientBalance ? 'var(--fp-danger)' : 'var(--fp-text-muted)',
          }}>
            {tFormat(locale, 'Your balance: {n} coins', { n: balance })}
          </div>
        </Section>

        {/* SECTION 5 — Opponent */}
        <Section title={`⑤ ${t(locale, 'OPPONENT')}`} locked={!stake}>
          <input
            type="text"
            placeholder="@username"
            disabled={!stake}
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--fp-bg2)',
              border: '1px solid var(--fp-stroke)',
              clipPath: 'var(--fp-clip-sm)',
              color: 'var(--fp-text)',
              fontFamily: 'var(--fp-mono)', fontSize: 13, letterSpacing: 1,
              outline: 'none',
            }}
          />
        </Section>

        {/* Summary + submit */}
        {canSubmit && (
          <HudFrame>
            <div style={{ padding: 14 }}>
              <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)', letterSpacing: 2, marginBottom: 8 }}>
                ◆ {t(locale, 'REVIEW')}
              </div>
              <div style={{ fontFamily: 'var(--fp-display)', fontSize: 14, marginBottom: 10 }}>
                {tFormat(locale, "You're betting {stake} coins that {outcome} in {home} vs {away}. Winner gets {payout} coins.", {
                  stake,
                  outcome: pickSummary(locale, marketType, pick),
                  home: fixture.homeTeam,
                  away: fixture.awayTeam,
                  payout: Math.floor(stake * 2 * 0.9),
                })}
              </div>
            </div>
          </HudFrame>
        )}

        {error && (
          <div style={{
            marginTop: 10, padding: 10,
            background: 'color-mix(in srgb, var(--fp-danger) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--fp-danger) 45%, transparent)',
            clipPath: 'var(--fp-clip-sm)',
            fontFamily: 'var(--fp-mono)', fontSize: 11, color: 'var(--fp-danger)',
          }}>{error}</div>
        )}
      </div>

      {/* Sticky submit */}
      <div style={{
        position: 'fixed', bottom: 104, left: 0, right: 0,
        maxWidth: 430, margin: '0 auto',
        padding: '8px 16px 0',
        background: 'linear-gradient(180deg, transparent, var(--fp-bg) 40%)',
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <ArcadeButton
            size="lg"
            fullWidth
            disabled={!canSubmit || submitting || insufficientBalance}
            onClick={handleSubmit}
          >
            {submitting ? t(locale, 'SENDING…')
              : insufficientBalance ? t(locale, 'INSUFFICIENT BALANCE')
              : canSubmit ? `▶ ${tFormat(locale, 'SEND · {n} COINS', { n: stake })}`
              : t(locale, 'COMPLETE ALL STEPS')}
          </ArcadeButton>
        </div>
      </div>
    </>
  );
}

function pickSummary(locale, marketType, pick) {
  if (marketType === '1X2') {
    return pick === '1' ? t(locale, 'home wins')
      : pick === '2' ? t(locale, 'away wins')
      : t(locale, 'it ends in a draw');
  }
  if (marketType === 'OU25') {
    return pick === 'OVER' ? t(locale, 'there are 3 or more goals') : t(locale, 'there are 2 or fewer goals');
  }
  return pick === 'YES' ? t(locale, 'both teams score') : t(locale, "one team doesn't score");
}

function Section({ title, locked, children }) {
  return (
    <div style={{ marginBottom: 18, opacity: locked ? 0.45 : 1 }}>
      <div style={{
        fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 2,
        color: 'var(--fp-primary)', marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

function LockedHint({ msg }) {
  return (
    <div style={{
      padding: 10,
      fontFamily: 'var(--fp-mono)', fontSize: 10,
      color: 'var(--fp-text-faint)',
    }}>{msg}</div>
  );
}

function pillStyle(active, disabled) {
  return {
    background: active ? 'var(--fp-primary)' : 'var(--fp-bg2)',
    color: active ? 'var(--fp-on-primary)' : 'var(--fp-text-dim)',
    border: active ? '1px solid var(--fp-primary)' : '1px solid var(--fp-stroke)',
    clipPath: 'var(--fp-clip-sm)',
    padding: '10px 12px',
    fontFamily: 'var(--fp-display)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    opacity: disabled ? 0.4 : 1,
  };
}

// ────────────────────────────────────────────────────────────────────
// FixtureSearch — replicates CreatePool's search UX locally. Shows a search
// input; debounces; lists league/team hits; tapping a source expands into a
// list of fixtures. Callback fires with the chosen fixture.

function FixtureSearch({ locale, onPick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeSource, setActiveSource] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [loadingFx, setLoadingFx] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    try {
      const [leagues, teams] = await Promise.all([
        api.get(`/football/leagues/search?query=${encodeURIComponent(q)}`),
        api.get(`/football/teams/search?query=${encodeURIComponent(q)}`),
      ]);
      setResults([
        ...(Array.isArray(leagues) ? leagues : []).slice(0, 8).map(l => ({ kind: 'league', ...l })),
        ...(Array.isArray(teams) ? teams : []).slice(0, 8).map(tm => ({ kind: 'team', ...tm })),
      ]);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  const selectSource = async (src) => {
    setActiveSource(src);
    setFixtures([]);
    setLoadingFx(true);
    try {
      const qs = src.kind === 'team'
        ? `teamId=${src.id}`
        : `leagueId=${src.id}${src.season ? `&season=${src.season}` : ''}`;
      const data = await api.get(`/football/fixtures?${qs}`);
      const now = Date.now();
      const upcoming = (Array.isArray(data) ? data : [])
        .filter(f => f.kickoff && new Date(f.kickoff).getTime() > now);
      setFixtures(upcoming);
    } catch { setFixtures([]); }
    finally { setLoadingFx(false); }
  };

  return (
    <div>
      <input
        type="text"
        placeholder={t(locale, 'Search a league or team…')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'var(--fp-bg2)',
          border: '1px solid var(--fp-stroke)',
          clipPath: 'var(--fp-clip-sm)',
          color: 'var(--fp-text)',
          fontFamily: 'var(--fp-body)', fontSize: 14,
          outline: 'none',
          marginBottom: 8,
        }}
      />
      {searching && (
        <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)' }}>…</div>
      )}

      {!activeSource && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map((r) => (
            <button
              key={`${r.kind}-${r.id}`}
              type="button"
              onClick={() => selectSource(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 8,
                background: 'var(--fp-bg2)',
                border: '1px solid var(--fp-stroke)',
                clipPath: 'var(--fp-clip-sm)',
                fontFamily: 'var(--fp-body)', fontSize: 12,
                color: 'var(--fp-text)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 8, color: 'var(--fp-text-muted)' }}>
                {r.kind.toUpperCase()}
              </span>
              <span>{r.name}</span>
            </button>
          ))}
        </div>
      )}

      {activeSource && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <button onClick={() => { setActiveSource(null); setFixtures([]); }} style={{
              background: 'transparent', border: '1px solid var(--fp-stroke)',
              color: 'var(--fp-text-dim)',
              fontFamily: 'var(--fp-mono)', fontSize: 9, letterSpacing: 1,
              padding: '4px 8px', clipPath: 'var(--fp-clip-sm)', cursor: 'pointer',
            }}>← BACK</button>
            <div style={{ fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 700, color: 'var(--fp-text)' }}>
              {activeSource.name}
            </div>
          </div>
          {loadingFx ? (
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)', padding: 10 }}>
              {t(locale, 'Loading…')}
            </div>
          ) : fixtures.length === 0 ? (
            <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 10, color: 'var(--fp-text-muted)', padding: 10 }}>
              {t(locale, 'No upcoming matches found.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              {fixtures.slice(0, 40).map((fx) => (
                <button
                  key={fx.fixtureId}
                  type="button"
                  onClick={() => onPick(fx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: 8,
                    background: 'var(--fp-bg2)',
                    border: '1px solid var(--fp-stroke)',
                    clipPath: 'var(--fp-clip-sm)',
                    fontFamily: 'var(--fp-body)', fontSize: 12,
                    color: 'var(--fp-text)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <TeamCrest name={fx.homeTeam} logoURL={fx.homeLogo} size={22} />
                  <span style={{ flex: 1 }}>{fx.homeTeam} vs {fx.awayTeam}</span>
                  <TeamCrest name={fx.awayTeam} logoURL={fx.awayLogo} size={22} />
                  <span style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-muted)' }}>
                    {new Date(fx.kickoff).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FixturePinned({ fixture, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 10,
      background: 'color-mix(in srgb, var(--fp-primary) 10%, var(--fp-surface) 90%)',
      border: '1px solid color-mix(in srgb, var(--fp-primary) 50%, transparent)',
      clipPath: 'var(--fp-clip-sm)',
    }}>
      <TeamCrest name={fixture.homeTeam} logoURL={fixture.homeLogo} size={26} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 12, fontWeight: 800,
          color: 'var(--fp-text)',
        }}>{fixture.homeTeam} vs {fixture.awayTeam}</div>
        <div style={{ fontFamily: 'var(--fp-mono)', fontSize: 9, color: 'var(--fp-text-muted)' }}>
          {fixture.leagueName} · {new Date(fixture.kickoff).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
      <TeamCrest name={fixture.awayTeam} logoURL={fixture.awayLogo} size={26} />
      <button
        type="button"
        onClick={onChange}
        style={{
          background: 'transparent', border: 'none',
          color: 'var(--fp-text-dim)', fontSize: 16,
          cursor: 'pointer', padding: 4,
        }}
      >✕</button>
    </div>
  );
}
