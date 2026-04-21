import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { HudFrame, HudChip, XpBar, ArcadeButton } from '../arena-ui/primitives';

export function MyEntries() {
  const { token } = useAuth();
  const { locale } = useLocale();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!token) { setEntries([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setEntries(await api.get('/quinielas/entries/me', token)); }
    catch (e) { setError(e.message); setEntries([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const grouped = entries.reduce((acc, entry) => {
    const qid = entry.quiniela?._id || entry.quiniela;
    if (!acc[qid]) acc[qid] = { quiniela: entry.quiniela, entries: [] };
    acc[qid].entries.push(entry);
    return acc;
  }, {});
  const groups = Object.values(grouped).sort((a, b) => {
    const da = a.quiniela?.startDate ? new Date(a.quiniela.startDate) : 0;
    const db = b.quiniela?.startDate ? new Date(b.quiniela.startDate) : 0;
    return db - da;
  });

  return (
    <>
      {/* Header */}
      <div style={{ padding: '18px 16px 14px' }}>
        <div style={{
          fontFamily: 'var(--fp-display)', fontSize: 28, fontWeight: 800,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>
          {t(locale, 'My Entries')}
        </div>
        {!loading && entries.length > 0 && (
          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 1,
            color: 'var(--fp-text-muted)', marginTop: 4,
          }}>
            [ {entries.length} TOTAL ]
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 28, color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
            {t(locale, 'Loading entries…').toUpperCase()}
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 12, textAlign: 'center', padding: 12 }}>
            {error}
          </div>
        )}
        {!loading && entries.length === 0 && !error && (
          <HudFrame>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
                letterSpacing: 2, color: 'var(--fp-text)',
              }}>NO ENTRIES YET</div>
              <div style={{
                fontFamily: 'var(--fp-body)', fontSize: 12,
                color: 'var(--fp-text-dim)', marginTop: 6, marginBottom: 14,
              }}>{t(locale, "You don't have any entries yet. Join a pool to create one.")}</div>
              <Link to="/" style={{ textDecoration: 'none' }}>
                <ArcadeButton size="sm" variant="surface">POOLS</ArcadeButton>
              </Link>
            </div>
          </HudFrame>
        )}

        {groups.map((group, gi) => (
          <div key={group.quiniela?._id} className="fp-slide-up" style={{ animationDelay: `${gi * 60}ms` }}>
            <GroupCard group={group} />
          </div>
        ))}
      </div>
    </>
  );
}

function GroupCard({ group }) {
  const best = group.entries.reduce((best, e) => {
    const s = e.score ?? 0;
    const t = e.totalPossible ?? (group.quiniela?.fixtures?.length ?? 0);
    return s > (best?.s ?? -1) ? { s, t } : best;
  }, null) ?? { s: 0, t: group.quiniela?.fixtures?.length ?? 0 };

  const closed = group.quiniela?.endDate && new Date(group.quiniela.endDate) < new Date();
  const status = closed
    ? { label: 'CLOSED', color: 'var(--fp-text-muted)' }
    : { label: 'PENDING', color: 'var(--fp-accent)' };

  return (
    <Link to={`/pool/${group.quiniela?._id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: 10 }}>
      <HudFrame>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <div style={{
              flex: 1,
              fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>{group.quiniela?.name}</div>
            <HudChip color={status.color}>{status.label}</HudChip>
          </div>

          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10,
            color: 'var(--fp-text-muted)', marginBottom: 10,
          }}>
            ENTRIES · {group.entries.length}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <XpBar value={best.s} max={Math.max(best.t, 1)} color={status.color} segments={Math.max(best.t, 1)} height={8} />
            </div>
            <div style={{
              fontFamily: 'var(--fp-mono)', fontSize: 14, fontWeight: 800,
              color: status.color, minWidth: 44, textAlign: 'right',
            }}>
              {best.s}/{best.t}
            </div>
          </div>
        </div>
      </HudFrame>
    </Link>
  );
}
