// QuinielaPickDesktop — desktop layout for /pool/:id/pick.
//
// Mirrors Claude Design's `screen-pick.jsx`: a 1fr+360 two-column grid
// where the left column has a quick-fill bar + per-fixture pick cards
// (3 wide tiles: home / X / away with team identity baked in), and the
// right column is a sticky aside carrying the Resumen + Distribución
// cards plus the Pay CTA.
//
// Adapted for simple_version (vs. the design's master-branch refs):
//   • No "Saldo después" — there's no balance economy
//   • Prize = entries × fee × 0.65 (winner takes the pot, not a ladder)
//   • CTA copy says the entry is paid via Stripe, not "discounted from
//     your balance"
//   • Picks-are-immutable post-payment ('confirmed via Stripe' instead
//     of 'editable until kickoff')
import { useEffect, useState } from 'react';
import { useLocale } from '../../context/LocaleContext';
import { t } from '../../i18n/translations';
import { DesktopShellChrome } from '../../desktop/DesktopShell';

const WINNER_SHARE = 0.65;

function fmtMxn(n) { return '$' + Number(n).toLocaleString('es-MX'); }

// Live ticking countdown — matches the look of the design's "CIERRA EN
// 1d 01h 57m" pill in the page head.
function useCountdown(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return { ms: 0, label: '—' };
  const ms = Math.max(0, new Date(iso).getTime() - now);
  if (ms <= 0) return { ms: 0, label: 'cerrado' };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms / 3600000) % 24);
  const m = Math.floor((ms / 60000) % 60);
  const pad = (x) => String(x).padStart(2, '0');
  return { ms, label: d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m` };
}

function CountdownPill({ iso, locale }) {
  const { label } = useCountdown(iso);
  return (
    <div className="fp-card" style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px',
    }}>
      <div>
        <div className="muted" style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>{t(locale, 'Closes in')}</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// One fixture card: index + meta + 3 wide pick tiles (home / X / away).
// Each tile has the team identity baked in so a tap reads as "I'm
// picking América" rather than "I'm picking the abstract '1'".
// ─────────────────────────────────────────────────────────────────────

function PickTile({ kind, team, picked, onClick, locale }) {
  // Tile shape varies per kind:
  //   home:  [crest] [name • LOCAL · GANA]    (left-aligned)
  //   draw:  [             X • EMPATE        ] (centered)
  //   away:  [name • VISITANTE · GANA] [crest] (right-aligned)
  const isDraw = kind === 'draw';
  const isAway = kind === 'away';
  const palette = picked
    ? {
        bg: 'rgba(33,226,140,0.18)',
        border: 'var(--fp-primary)',
        color: 'var(--fp-primary)',
        shadow: '0 0 0 3px rgba(33,226,140,0.08)',
      }
    : {
        bg: 'var(--fp-surface)',
        border: 'var(--fp-stroke)',
        color: 'var(--fp-text-dim)',
        shadow: 'none',
      };
  const subLabel = isDraw
    ? t(locale, 'EMPATE')
    : isAway ? t(locale, 'VISITANTE · GANA') : t(locale, 'LOCAL · GANA');

  const crest = team && (
    team.logo
      ? <img src={team.logo} alt="" style={{
          width: 38, height: 38, objectFit: 'contain', flexShrink: 0,
        }} />
      : <div className="fp-crest-d md" style={{
          background: `linear-gradient(135deg, hsl(${(team.name?.charCodeAt(0) || 0) * 7 % 360} 50% 30%), hsl(${(team.name?.charCodeAt(0) || 0) * 7 % 360} 60% 18%))`,
        }}>{(team.name?.[0] || '?').toUpperCase()}</div>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 16px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 'var(--app-radius-button, 10px)',
        boxShadow: palette.shadow,
        color: picked ? 'var(--fp-text)' : 'var(--fp-text)',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        transition: 'all 120ms ease',
        display: 'flex', alignItems: 'center', gap: 12,
        minHeight: 72,
        justifyContent: isDraw ? 'center' : 'flex-start',
        flexDirection: isAway ? 'row-reverse' : 'row',
        position: 'relative',
      }}
    >
      {/* ✓ checkmark badge — appears top-right when this tile is the
          selected pick. Matches the design's small green dot affordance
          so a glance at a fixture row tells you 'I've already picked
          here' without scanning the row colors. */}
      {picked && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--fp-primary)',
          color: '#0B0F14',
          display: 'grid', placeItems: 'center',
          fontSize: 11, fontWeight: 800, lineHeight: 1,
          boxShadow: '0 0 0 2px var(--fp-bg)',
        }}>✓</span>
      )}
      {!isDraw && crest}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: isDraw ? 'center' : isAway ? 'flex-end' : 'flex-start',
        gap: 2, minWidth: 0,
      }}>
        <span style={{
          fontSize: 16, fontWeight: 700, color: picked ? 'var(--fp-primary)' : 'var(--fp-text)',
          letterSpacing: isDraw ? '0.04em' : 0,
        }}>{isDraw ? 'X' : team?.name || '—'}</span>
        <span style={{
          fontFamily: 'var(--app-font-mono, monospace)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          color: picked ? 'var(--fp-primary)' : 'var(--fp-text-muted)',
          textTransform: 'uppercase',
        }}>{subLabel}</span>
      </div>
    </button>
  );
}

function FixtureCard({ fixture, idx, picks, setPick, locale }) {
  const pick = picks[fixture.fixtureId];
  const kick = fixture.kickoff
    ? new Date(fixture.kickoff).toLocaleString(undefined, {
        weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
  return (
    <div className="fp-card" style={{
      padding: 'var(--app-space-4) var(--app-space-5)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 1fr',
        gap: 'var(--app-space-4)', alignItems: 'flex-start',
      }}>
        <div className="muted" style={{
          fontSize: 13, fontWeight: 700, textAlign: 'center',
          paddingTop: 16,
        }}>{String(idx + 1).padStart(2, '0')}</div>
        <div>
          <div className="muted" style={{
            fontSize: 11, fontWeight: 600, marginBottom: 10,
          }}>
            {kick}{fixture.leagueName ? ` · ${fixture.leagueName}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PickTile
              kind="home"
              team={{ name: fixture.homeTeam, logo: fixture.homeLogo }}
              picked={pick === '1'}
              onClick={() => setPick(fixture.fixtureId, '1', idx + 1)}
              locale={locale}
            />
            <PickTile
              kind="draw"
              picked={pick === 'X'}
              onClick={() => setPick(fixture.fixtureId, 'X', idx + 1)}
              locale={locale}
            />
            <PickTile
              kind="away"
              team={{ name: fixture.awayTeam, logo: fixture.awayLogo }}
              picked={pick === '2'}
              onClick={() => setPick(fixture.fixtureId, '2', idx + 1)}
              locale={locale}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Aside: Resumen (progress + entry/prize + Pay CTA) + Distribución
// ─────────────────────────────────────────────────────────────────────

function SummaryCard({
  count, total, complete, submitting, error,
  feeMXN, prizeMxn, onSubmit, locale, isAdmin,
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  // Admin CTA drops the price (no payment) and reads as a confirm —
  // the backend will create the entry inline without Stripe.
  const ctaLabel = submitting
    ? t(locale, 'Sending…')
    : complete
      ? (isAdmin
          ? t(locale, 'Confirm (admin free entry)')
          : `${t(locale, 'Confirm for')} $${feeMXN} MXN`)
      : `${t(locale, 'Missing')} ${total - count} ${total - count === 1 ? t(locale, 'pick') : t(locale, 'picks')}`;
  return (
    <div className="fp-card">
      <h4 className="fp-section-title">{t(locale, 'Summary')}</h4>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginTop: 14,
      }}>
        <span className="muted" style={{ fontSize: 13 }}>{t(locale, 'Picks')}</span>
        <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>
          {count}<span className="muted" style={{ fontSize: 14 }}>/{total}</span>
        </span>
      </div>
      <div style={{
        height: 8, borderRadius: 999, background: 'var(--fp-surface-alt)',
        overflow: 'hidden', marginTop: 10,
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, var(--fp-primary), var(--fp-accent))',
          transition: 'width 200ms ease',
        }} />
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        marginTop: 18, padding: '12px 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">{t(locale, 'Entry')}</span>
          <span className="num" style={{ fontWeight: 600 }}>${feeMXN} MXN</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">{t(locale, 'Prize')}</span>
          <span className="gold num" style={{ fontWeight: 700 }}>
            {prizeMxn > 0 ? fmtMxn(prizeMxn) : '—'}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="fp-btn primary lg block fp-mt-4"
        disabled={!complete || submitting}
        onClick={onSubmit}
      >
        {ctaLabel}
      </button>
      <p className="muted" style={{
        fontSize: 11, lineHeight: 1.5, margin: '12px 0 0', textAlign: 'center',
      }}>
        {isAdmin
          ? t(locale, 'Admin entry — picks register immediately, no payment required.')
          : t(locale, 'Picks are submitted on the next screen and confirmed via Stripe.')}
      </p>
      {error && (
        <p style={{
          color: 'var(--fp-danger)', fontSize: 12, marginTop: 10,
          fontFamily: 'var(--app-font-mono, monospace)',
        }}>{error}</p>
      )}
    </div>
  );
}

function DistributionCard({ fixtures, picks, locale }) {
  const total = fixtures.length;
  const labels = {
    '1': t(locale, 'Home'),
    'X': t(locale, 'Draw'),
    '2': t(locale, 'Away'),
  };
  return (
    <div className="fp-card fp-mt-4">
      <h4 className="fp-section-title">{t(locale, 'Distribution')}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {['1', 'X', '2'].map((opt) => {
          const count = fixtures.filter((f) => picks[f.fixtureId] === opt).length;
          const p = total === 0 ? 0 : (count / total) * 100;
          return (
            <div key={opt} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 36px',
              alignItems: 'center', gap: 10, fontSize: 12,
            }}>
              <span className="muted">{opt} · {labels[opt]}</span>
              <div style={{
                height: 6, borderRadius: 999,
                background: 'var(--fp-surface-alt)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${p}%`, height: '100%', background: 'var(--fp-primary)',
                }} />
              </div>
              <span className="num" style={{ fontWeight: 600, textAlign: 'right' }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

export function QuinielaPickDesktop({
  quiniela, picks, setPicks, setPick,
  count, total, complete, submitting, error,
  feeMXN, onSubmit, goBack, isAdmin = false,
}) {
  const { locale } = useLocale();
  const fixtures = quiniela?.fixtures || [];
  const prizeMxn = Math.floor(
    (quiniela?.entriesCount ?? 0) * (quiniela?.entryFeeMXN ?? 50) * WINNER_SHARE
  );

  const quickAll = (val) => {
    const next = {};
    for (const f of fixtures) next[f.fixtureId] = val;
    setPicks(next);
  };
  const quickRandom = () => {
    const opts = ['1', 'X', '2'];
    const next = {};
    for (const f of fixtures) next[f.fixtureId] = opts[Math.floor(Math.random() * 3)];
    setPicks(next);
  };
  const clear = () => setPicks({});

  return (
    <DesktopShellChrome
      crumbsOverride={[
        t(locale, 'Pools'),
        quiniela?.name || '—',
        t(locale, 'Make picks'),
      ]}
    >
      <div className="fp-desktop-wide">
      <button
        type="button"
        className="fp-btn ghost sm"
        onClick={goBack}
        style={{ marginBottom: 14 }}
      >← {t(locale, 'Back to pool')}</button>

      <div className="fp-desktop-page-head">
        <div>
          <div className="muted" style={{
            fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>{t(locale, 'Create entry')}</div>
          <h1 className="fp-desktop-page-title" style={{ marginTop: 4 }}>
            {quiniela?.name}
          </h1>
          <p className="fp-desktop-page-sub">
            {t(locale, 'Tap the team you think will win. If you think it will be a draw, tap')} <strong className="green">{t(locale, 'Draw')}</strong>.
          </p>
        </div>
        <CountdownPill iso={quiniela?.startDate} locale={locale} />
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 360px',
        gap: 'var(--app-space-6)', alignItems: 'flex-start',
      }}>
        <div>
          {/* Quick fill */}
          <div className="fp-card" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 'var(--app-space-5)', padding: '14px 18px',
            flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="green" style={{ fontSize: 18, lineHeight: 1 }}>⚡</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {t(locale, 'Quick fill')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="fp-chip" onClick={quickRandom}>
                {t(locale, 'Random')}
              </button>
              <button type="button" className="fp-chip" onClick={() => quickAll('1')}>
                {t(locale, 'All home')}
              </button>
              <button type="button" className="fp-chip" onClick={() => quickAll('X')}>
                {t(locale, 'All draw')}
              </button>
              <button type="button" className="fp-chip" onClick={clear}>
                {t(locale, 'Clear')}
              </button>
            </div>
          </div>

          {/* Fixture cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-3)' }}>
            {fixtures.map((f, i) => (
              <FixtureCard
                key={f.fixtureId}
                fixture={f}
                idx={i}
                picks={picks}
                setPick={setPick}
                locale={locale}
              />
            ))}
          </div>
        </div>

        {/* Sticky aside */}
        <aside style={{
          position: 'sticky', top: 'var(--app-space-8)',
          display: 'flex', flexDirection: 'column',
        }}>
          <SummaryCard
            count={count}
            total={total}
            complete={complete}
            submitting={submitting}
            error={error}
            feeMXN={feeMXN}
            prizeMxn={prizeMxn}
            onSubmit={onSubmit}
            locale={locale}
            isAdmin={isAdmin}
          />
          <DistributionCard fixtures={fixtures} picks={picks} locale={locale} />
        </aside>
      </div>
      </div>
    </DesktopShellChrome>
  );
}
