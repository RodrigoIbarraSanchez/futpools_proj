// MyEntries — desktop "Mis Apuestas" surface.
//
// Lists every entry the user has across all pools, grouped by quiniela,
// with expandable rows that reveal the per-fixture picks. Mirrors the
// Claude Design `screen-entries.jsx` mock 1:1, scoped to fields that
// actually exist in simple_version (entryNumber, score, totalPossible,
// picks).
//
// On mobile this page renders the same content vertically (no sidebar)
// — useful when an iOS user opens the link from a push notification.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { useIsDesktop } from '../desktop/useIsDesktop';

function statusKey(quiniela) {
  if (!quiniela) return 'completed';
  if (quiniela.status === 'completed') return 'completed';
  const now = Date.now();
  if (quiniela.endDate && new Date(quiniela.endDate).getTime() < now) return 'completed';
  if (quiniela.startDate && new Date(quiniela.startDate).getTime() > now) return 'upcoming';
  return 'open';
}

function statusLabel(key, locale) {
  switch (key) {
    case 'live':       return 'LIVE';
    case 'open':       return t(locale, 'Open').toUpperCase();
    case 'upcoming':   return t(locale, 'Upcoming').toUpperCase();
    case 'completed':  return t(locale, 'Closed').toUpperCase();
    default:           return key.toUpperCase();
  }
}

function PicksGrid({ quiniela, picks }) {
  const fixtures = quiniela?.fixtures || [];
  return (
    <div style={{
      display: 'grid', gap: 8,
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    }}>
      {fixtures.map((f) => {
        const pick = (picks || []).find((p) => p.fixtureId === f.fixtureId)?.pick;
        return (
          <div key={f.fixtureId} style={{
            padding: '10px 12px',
            background: 'var(--fp-surface)',
            border: '1px solid var(--fp-stroke)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <span style={{
              fontSize: 12, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: 'var(--fp-text-dim)',
            }}>
              {f.homeTeam} <span style={{ color: 'var(--fp-text-faint)' }}>vs</span> {f.awayTeam}
            </span>
            <span style={{
              width: 26, height: 26, borderRadius: 6,
              background: pick ? 'rgba(33,226,140,0.16)' : 'var(--fp-surface-alt)',
              color: pick ? 'var(--fp-primary)' : 'var(--fp-text-muted)',
              fontSize: 13, fontWeight: 700,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>{pick || '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

function EntryRow({ entry, quiniela, expanded, onToggle, locale }) {
  const score = entry.score ?? 0;
  const total = entry.totalPossible ?? quiniela?.fixtures?.length ?? 0;
  const pct = total > 0 ? (score / total) * 100 : 0;
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ width: 110 }}>
          <span style={{ fontWeight: 700 }}>
            {t(locale, 'Entry')} #{entry.entryNumber ?? 1}
          </span>
        </td>
        <td className="num" style={{ fontWeight: 700, fontSize: 15 }}>
          {score}/{total}
        </td>
        <td style={{ width: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, height: 6, borderRadius: 999,
              background: 'var(--fp-surface-alt)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: 'var(--fp-primary)',
              }} />
            </div>
            <span className="muted num" style={{ fontSize: 11 }}>{Math.round(pct)}%</span>
          </div>
        </td>
        <td style={{ width: 40, textAlign: 'right' }}>
          <span style={{
            display: 'inline-block',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 140ms',
            opacity: 0.4,
            fontSize: 14,
            fontWeight: 700,
          }}>›</span>
        </td>
      </tr>
      {expanded && quiniela && (
        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
          <td colSpan={4} style={{ padding: '18px 24px' }}>
            <div className="muted" style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 10,
            }}>{t(locale, 'Your picks')}</div>
            <PicksGrid quiniela={quiniela} picks={entry.picks} />
          </td>
        </tr>
      )}
    </>
  );
}

export function MyEntries() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { locale } = useLocale();
  const isDesktop = useIsDesktop();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    setLoading(true);
    api.get('/quinielas/entries/me', token)
      .then((data) => {
        if (cancelled) return;
        setEntries(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  // Group by pool. Each entry from the backend has a populated `quiniela`
  // object (see quinielaController.getMyEntries) — fall back gracefully
  // if the populate ever drops a row.
  const groups = (() => {
    const map = new Map();
    for (const e of entries) {
      const q = e.quiniela;
      if (!q?._id) continue;
      if (!map.has(q._id)) map.set(q._id, { quiniela: q, items: [] });
      map.get(q._id).items.push(e);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ad = a.quiniela.startDate ? new Date(a.quiniela.startDate).getTime() : 0;
      const bd = b.quiniela.startDate ? new Date(b.quiniela.startDate).getTime() : 0;
      return bd - ad;
    });
  })();

  // ── Mobile rendering: stacked cards (the desktop shell isn't mounted
  //    here, so we can't rely on `.fp-desktop-shell` scoped CSS).
  if (!isDesktop) {
    return (
      <div style={{ padding: '14px 16px 32px' }}>
        <h1 style={{
          fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 800,
          letterSpacing: 2, color: 'var(--fp-text)', margin: '0 0 4px',
          textTransform: 'uppercase',
        }}>{t(locale, 'My Entries')}</h1>
        <p style={{
          margin: '0 0 16px', color: 'var(--fp-text-dim)',
          fontFamily: 'var(--fp-mono)', fontSize: 11,
        }}>{t(locale, 'Entries you have made in each pool.')}</p>

        {loading && <div style={{ color: 'var(--fp-text-dim)', textAlign: 'center', padding: 40 }}>
          {t(locale, 'Loading…')}
        </div>}
        {error && <div style={{ color: 'var(--fp-danger)', fontSize: 12 }}>{error}</div>}

        {!loading && groups.length === 0 && (
          <div style={{
            border: '1px dashed var(--fp-stroke)', borderRadius: 12,
            padding: 24, textAlign: 'center', color: 'var(--fp-text-muted)',
          }}>
            <div style={{ color: 'var(--fp-text)', fontWeight: 700, marginBottom: 6 }}>
              {t(locale, 'No entries yet')}
            </div>
            {t(locale, 'Join a pool to make your first entry.')}
          </div>
        )}

        {groups.map(({ quiniela, items }) => (
          <div
            key={quiniela._id}
            style={{
              marginBottom: 12,
              background: 'var(--fp-surface)',
              border: '1px solid var(--fp-stroke)',
              borderRadius: 12,
              padding: 12,
            }}
            onClick={() => navigate(`/pool/${quiniela._id}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontFamily: 'var(--fp-mono)', fontSize: 9, fontWeight: 800,
                letterSpacing: 1.5, color: 'var(--fp-primary)',
              }}>{statusLabel(statusKey(quiniela), locale)}</span>
              <span style={{ color: 'var(--fp-text-muted)', fontSize: 11 }}>
                · {items.length} {items.length === 1 ? t(locale, 'entry') : t(locale, 'entries')}
              </span>
            </div>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 16, fontWeight: 800,
              textTransform: 'uppercase', color: 'var(--fp-text)',
            }}>{quiniela.name}</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((e) => {
                const total = e.totalPossible ?? quiniela.fixtures?.length ?? 0;
                const pct = total > 0 ? (e.score / total) * 100 : 0;
                return (
                  <div key={e._id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: 'var(--fp-mono)', fontSize: 11,
                    color: 'var(--fp-text-dim)',
                  }}>
                    <span style={{ flexShrink: 0 }}>#{e.entryNumber}</span>
                    <span style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: 'var(--fp-surface-alt)', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', background: 'var(--fp-primary)',
                      }} />
                    </span>
                    <span style={{ color: 'var(--fp-text)', fontWeight: 700 }}>
                      {e.score ?? 0}/{total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Desktop rendering: page head + grouped table cards.
  return (
    <div className="fp-desktop-wide">
      <div className="fp-desktop-page-head">
        <div>
          <h1 className="fp-desktop-page-title">{t(locale, 'My Entries')}</h1>
          <p className="fp-desktop-page-sub">
            {t(locale, 'Entries you have made in each pool.')}
          </p>
        </div>
        <button
          type="button"
          className="fp-btn primary"
          onClick={() => navigate('/')}
        >
          + {t(locale, 'New entry')}
        </button>
      </div>

      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--fp-text-dim)' }}>
          {t(locale, 'Loading…')}
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--fp-danger)', fontSize: 13, padding: 16 }}>{error}</div>
      )}

      {!loading && groups.length === 0 && !error && (
        <div className="fp-empty">
          <h4>{t(locale, 'No entries yet')}</h4>
          {t(locale, 'Join a pool to make your first entry.')}
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="fp-btn primary"
              onClick={() => navigate('/')}
            >🏆 {t(locale, 'View pools')}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-space-5)' }}>
        {groups.map(({ quiniela, items }) => (
          <div key={quiniela._id} className="fp-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--fp-stroke)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
              background: 'rgba(255,255,255,0.015)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <span className={`fp-status ${statusKey(quiniela)}`}>
                  {statusKey(quiniela) === 'live' && <span className="pulse" />}
                  {statusLabel(statusKey(quiniela), locale)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 16, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{quiniela.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {quiniela.fixtures?.length ?? 0} {t(locale, 'fixtures')} · {items.length}{' '}
                    {items.length === 1 ? t(locale, 'entry') : t(locale, 'entries')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="fp-btn ghost sm"
                onClick={() => navigate(`/pool/${quiniela._id}`)}
              >{t(locale, 'View pool')} ›</button>
            </div>
            <table className="fp-table">
              <thead>
                <tr>
                  <th>{t(locale, 'Entry')}</th>
                  <th className="num">{t(locale, 'Score')}</th>
                  <th>{t(locale, 'Progress')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <EntryRow
                    key={e._id}
                    entry={e}
                    quiniela={quiniela}
                    expanded={expanded === e._id}
                    onToggle={() => setExpanded(expanded === e._id ? null : e._id)}
                    locale={locale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
