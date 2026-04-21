import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import {
  HudFrame, HudChip, LiveDot, StatTile, StatInline,
  TeamCrest, SectionLabel, ArcadeButton,
} from '../arena-ui/primitives';

// ──────────────────────────────────────────────────────────────
// Live/state helpers (shared across Home sub-components)
// ──────────────────────────────────────────────────────────────

/// A fixture is "live" when the polled /football/fixtures endpoint flags it so.
/// Polling mirrors iOS's HomeViewModel.refreshLiveFixtures.
function isFixtureLive(fixture, liveFixtures) {
  return liveFixtures[fixture.fixtureId]?.status?.isLive === true;
}

function resolveStatus(q, locale, liveFixtures) {
  const hasActuallyLive = (q.fixtures || []).some(f => isFixtureLive(f, liveFixtures));
  if (hasActuallyLive) return { key: 'live', label: 'LIVE', color: 'var(--fp-danger)' };

  if (q.status === 'completed') return { key: 'closed', label: t(locale, 'Completed').toUpperCase(), color: 'var(--fp-text-muted)' };
  const now = new Date();
  if (q.endDate && new Date(q.endDate) < now) return { key: 'closed', label: t(locale, 'Closed').toUpperCase(), color: 'var(--fp-text-muted)' };
  if (q.startDate && new Date(q.startDate) > now) return { key: 'upcoming', label: t(locale, 'Upcoming').toUpperCase(), color: 'var(--fp-accent)' };
  return { key: 'open', label: t(locale, 'Open').toUpperCase(), color: 'var(--fp-primary)' };
}

/// Derives the hero block's status with "LIVE NOW" only when at least one fixture
/// is actually running per the polled data — not just `q.status`.
function heroState(q, liveFixtures, locale) {
  const fixtures = q?.fixtures || [];
  const hasLive = fixtures.some(f => isFixtureLive(f, liveFixtures));
  if (hasLive) return { label: t(locale, 'LIVE NOW'), color: 'var(--fp-danger)', showDot: true, live: true };

  const now = new Date();
  const endedByStatus = q?.status === 'completed';
  const endedByDate = q?.endDate && new Date(q.endDate) < now;
  if (endedByStatus || endedByDate) {
    return { label: t(locale, 'POOL FINISHED'), color: 'var(--fp-text-muted)', showDot: false, live: false };
  }
  const anyUpcoming = fixtures.some(f => f.kickoff && new Date(f.kickoff) > now);
  if (anyUpcoming) return { label: t(locale, 'Upcoming').toUpperCase(), color: 'var(--fp-accent)', showDot: false, live: false };
  return { label: t(locale, 'POOL FINISHED'), color: 'var(--fp-text-muted)', showDot: false, live: false };
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// ──────────────────────────────────────────────────────────────
// Header — pool title + real coin balance
// ──────────────────────────────────────────────────────────────
function ArenaHeader({ coins }) {
  return (
    <div style={{
      padding: '14px 16px 10px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: '1px solid var(--fp-stroke)',
      background: 'linear-gradient(180deg, var(--fp-bg2), transparent)',
    }}>
      <div style={{
        flex: 1,
        fontFamily: 'var(--fp-display)', fontSize: 24, fontWeight: 800,
        letterSpacing: 3, textTransform: 'uppercase',
        color: 'var(--fp-text)',
      }}>POOLS</div>
      <CoinBadge value={coins} />
    </div>
  );
}

function CoinBadge({ value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px',
      background: 'color-mix(in srgb, var(--fp-gold) 15%, transparent)',
      clipPath: 'var(--fp-clip-sm)',
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, var(--fp-gold), #B88A1F)',
        boxShadow: '0 0 6px rgba(255,209,102,0.5)',
      }} />
      <span style={{
        fontFamily: 'var(--fp-mono)', fontSize: 13, fontWeight: 700,
        color: 'var(--fp-gold)',
      }}>
        {Number(value).toLocaleString()}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Banner (optional; fetched from /settings like iOS)
// ──────────────────────────────────────────────────────────────
function ArenaBanner({ url }) {
  if (!url) return null;
  return (
    <div style={{ padding: '0 16px 12px' }}>
      <img
        src={url}
        alt=""
        style={{
          width: '100%',
          aspectRatio: '3 / 1',
          objectFit: 'cover',
          clipPath: 'var(--fp-clip)',
          display: 'block',
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Quick Play hero
// ──────────────────────────────────────────────────────────────
function QuickPlayHero({ quiniela, liveFixtures, locale, embedded = false }) {
  const hs = heroState(quiniela, liveFixtures, locale);

  return (
    <div style={{ padding: embedded ? '4px 0 0' : '8px 16px 12px' }}>
      {!embedded && <SectionLabel color="var(--fp-primary)">QUICK PLAY</SectionLabel>}
      {!embedded && <div style={{ height: 8 }} />}
      <HudFrame
        clip="lg"
        glow="var(--fp-primary)"
        bg="linear-gradient(135deg, var(--fp-surface), var(--fp-surface-alt) 60%, color-mix(in srgb, var(--fp-primary) 13%, transparent))"
      >
        <div style={{ padding: 16, position: 'relative' }}>
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 3,
            background: 'var(--fp-primary)', boxShadow: '0 0 10px var(--fp-primary)',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {hs.showDot && <LiveDot color={hs.color} />}
            <span style={{
              fontFamily: 'var(--fp-display)', fontSize: 10, letterSpacing: 2,
              color: hs.color, fontWeight: 800,
            }}>
              {hs.label}
            </span>
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'var(--fp-mono)', fontSize: 10,
              color: 'var(--fp-text-muted)',
            }}>
              {quiniela.entriesCount ?? 0} {t(locale, 'PLAYERS')}
            </span>
          </div>
          <div style={{
            fontFamily: 'var(--fp-display)', fontSize: 22, fontWeight: 800,
            letterSpacing: 1, lineHeight: 1.1, marginBottom: 8,
            textTransform: 'uppercase',
          }}>{quiniela.name}</div>
          <div style={{ display: 'flex', gap: 18, marginBottom: 12, flexWrap: 'wrap' }}>
            <StatInline label={t(locale, 'Prize')}    value={quiniela.prize}                color="var(--fp-primary)" mono />
            <StatInline label={t(locale, 'Entry')}    value={quiniela.cost}                 color="var(--fp-accent)"  mono />
            <StatInline label={t(locale, 'Fixtures')} value={quiniela.fixtures?.length ?? 0} color="var(--fp-gold)"    mono />
          </div>
          <Link to={`/pool/${quiniela._id}`} style={{ textDecoration: 'none' }}>
            <ArcadeButton size="md">▶ {hs.live ? 'RESUME' : 'OPEN'}</ArcadeButton>
          </Link>
        </div>
      </HudFrame>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Featured carousel — horizontal scroll-snap slider for >1 featured pool
// ──────────────────────────────────────────────────────────────
function FeaturedCarousel({ pools, liveFixtures, locale }) {
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(0);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', marginBottom: 8,
      }}>
        <SectionLabel color="var(--fp-primary)">FEATURED</SectionLabel>
        <span style={{
          fontFamily: 'var(--fp-mono)', fontSize: 10,
          color: 'var(--fp-text-muted)',
        }}>{index + 1} / {pools.length}</span>
      </div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {pools.map((q) => (
          <div
            key={q._id}
            style={{
              flex: '0 0 100%',
              scrollSnapAlign: 'center',
              padding: '0 16px',
              boxSizing: 'border-box',
            }}
          >
            <QuickPlayHero quiniela={q} liveFixtures={liveFixtures} locale={locale} embedded />
          </div>
        ))}
      </div>
      {/* Page dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
        {pools.map((_, i) => (
          <div key={i} style={{
            width: i === index ? 16 : 6,
            height: 4,
            borderRadius: 2,
            background: i === index ? 'var(--fp-primary)' : 'var(--fp-stroke-strong)',
            transition: 'width 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Filter strip — ALL / OPEN / LIVE / CLOSED (disjoint buckets)
// ──────────────────────────────────────────────────────────────
function FilterStrip({ active, onChange, allCount, openCount, liveCount, closedCount, mineCount, locale }) {
  const items = [
    { id: 'all',    label: `${t(locale, 'ALL')} ${allCount}`,       color: null },
    { id: 'mine',   label: `${t(locale, 'MINE')} ${mineCount}`,     color: 'var(--fp-hot)' },
    { id: 'open',   label: `${t(locale, 'OPEN')} ${openCount}`,     color: 'var(--fp-primary)' },
    { id: 'live',   label: `${t(locale, 'LIVE')} ${liveCount}`,     color: 'var(--fp-danger)' },
    { id: 'closed', label: `${t(locale, 'CLOSED')} ${closedCount}`, color: 'var(--fp-text-muted)' },
  ];
  return (
    <div style={{
      padding: '0 16px',
      display: 'flex', gap: 6, overflowX: 'auto',
    }}>
      {items.map(it => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            style={{
              padding: '6px 12px',
              background: isActive ? (it.color ?? 'var(--fp-primary)') : 'var(--fp-surface-alt)',
              color: isActive ? 'var(--fp-on-primary)' : 'var(--fp-text-dim)',
              fontFamily: 'var(--fp-display)', fontSize: 11, fontWeight: 700,
              letterSpacing: 2,
              clipPath: 'var(--fp-clip-sm)',
              border: 'none',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// QuinielaCard — shows live status + live scores when polled
// ──────────────────────────────────────────────────────────────
function QuinielaCard({ quiniela, liveFixtures, locale }) {
  const status = resolveStatus(quiniela, locale, liveFixtures);
  const preview = (quiniela.fixtures || []).slice(0, 2);
  const isLive = status.key === 'live';

  return (
    <Link to={`/pool/${quiniela._id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: 10 }}>
      <HudFrame glow={isLive ? 'var(--fp-danger)' : undefined}>
        <div style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <div style={{
              fontFamily: 'var(--fp-display)', fontSize: 15, fontWeight: 800,
              letterSpacing: 1.2, flex: 1, lineHeight: 1.1, textTransform: 'uppercase',
            }}>{quiniela.name}</div>
            <HudChip color={status.color} showLiveDot={isLive}>{status.label}</HudChip>
          </div>

          <div style={{
            fontFamily: 'var(--fp-mono)', fontSize: 10, letterSpacing: 0.5,
            color: 'var(--fp-text-dim)', marginBottom: 10,
          }}>
            {formatDate(quiniela.startDate)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: preview.length ? 10 : 0 }}>
            <StatTile label={t(locale, 'POT')}     value={quiniela.prize}             color="var(--fp-gold)" />
            <StatTile label={t(locale, 'ENTRY')}   value={quiniela.cost}              color="var(--fp-text)" />
            <StatTile label={t(locale, 'PLAYERS')} value={quiniela.entriesCount ?? 0} color="var(--fp-accent)" />
          </div>

          {preview.length > 0 && (
            <div style={{ background: 'var(--fp-bg2)', padding: 8, clipPath: 'var(--fp-clip-sm)' }}>
              {preview.map((f, i) => {
                const live = liveFixtures[f.fixtureId];
                const isLiveFx = live?.status?.isLive === true;
                return (
                  <div key={f.fixtureId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                      borderTop: i > 0 ? '1px dashed var(--fp-stroke)' : 'none',
                    }}>
                    <TeamCrest name={f.homeTeam} logoURL={f.homeLogo} size={22} />
                    <div style={{
                      fontFamily: 'var(--fp-mono)', fontSize: 10,
                      flex: 1, color: 'var(--fp-text-dim)',
                    }}>
                      {String(f.homeTeam).slice(0,3).toUpperCase()} <span style={{ color: 'var(--fp-text-faint)' }}>vs</span> {String(f.awayTeam).slice(0,3).toUpperCase()}
                    </div>
                    <TeamCrest name={f.awayTeam} logoURL={f.awayLogo} size={22} />
                    {isLiveFx ? (
                      <span style={{
                        fontFamily: 'var(--fp-mono)', fontSize: 10, fontWeight: 700,
                        color: 'var(--fp-danger)', marginLeft: 6,
                      }}>
                        {live.score?.home ?? 0}-{live.score?.away ?? 0} {live.status.elapsed ? `${live.status.elapsed}'` : ''}
                      </span>
                    ) : f.kickoff ? (
                      <span style={{
                        fontFamily: 'var(--fp-mono)', fontSize: 10,
                        color: 'var(--fp-text-muted)', marginLeft: 6,
                      }}>
                        {new Date(f.kickoff).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </HudFrame>
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────
export function Home() {
  const { user, token } = useAuth();
  const { locale } = useLocale();
  const [quinielas, setQuinielas] = useState([]);
  const [liveFixtures, setLiveFixtures] = useState({});
  const [bannerURL, setBannerURL] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const pollTimer = useRef(null);

  const loadPools = async () => {
    setLoading(true);
    setError(null);
    try {
      // Optional token: backend includes the caller's own private pools when authed.
      const list = await api.get('/quinielas', token);
      setQuinielas(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const s = await api.get('/settings');
      setBannerURL(s?.bannerImageURL?.trim() || null);
    } catch {
      setBannerURL(null);
    }
  };

  const refreshLiveFixtures = async () => {
    const ids = Array.from(new Set((quinielas || []).flatMap(q => (q.fixtures || []).map(f => f.fixtureId)))).filter(Boolean);
    if (ids.length === 0) return;
    try {
      // chunk at 50 ids to mirror iOS
      const chunks = [];
      for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
      const responses = await Promise.all(
        chunks.map(chunk => api.get(`/football/fixtures?ids=${chunk.join(',')}`).catch(() => []))
      );
      const map = {};
      responses.flat().forEach(f => {
        if (f?.fixtureId != null) map[f.fixtureId] = f;
      });
      setLiveFixtures(map);
    } catch {
      // silent — keep previous snapshot
    }
  };

  useEffect(() => {
    loadPools();
    loadSettings();
  }, []);

  // Whenever the pool list changes, refresh live fixtures + start a 30s poll.
  useEffect(() => {
    refreshLiveFixtures();
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (quinielas.length > 0) {
      pollTimer.current = setInterval(refreshLiveFixtures, 30_000);
    }
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quinielas]);

  // Disjoint buckets: LIVE ⊔ OPEN ⊔ CLOSED = ALL
  const now = new Date();
  const hasLiveFixture = q => (q.fixtures || []).some(f => isFixtureLive(f, liveFixtures));
  const isClosed = q => q.status === 'completed' || (q.endDate && new Date(q.endDate) < now);

  const liveQs   = quinielas.filter(q => hasLiveFixture(q));
  const closedQs = quinielas.filter(q => !hasLiveFixture(q) && isClosed(q));
  const openQs   = quinielas.filter(q => !hasLiveFixture(q) && !isClosed(q));

  // QUICK PLAY selection — admin-featured wins; otherwise fallback rule.
  // Private user-created pools never qualify for the hero; they'd leak private
  // pools into another user's Home if we ever relax the list filter.
  const publicPools = quinielas.filter(q => (q.visibility ?? 'public') !== 'private');
  const publicIds   = new Set(publicPools.map(q => q._id));
  const adminFeatured = publicPools.filter(q => q.featured === true);
  const autoFeatured = liveQs.find(q => publicIds.has(q._id))
    ?? [...openQs]
        .filter(q => publicIds.has(q._id))
        .sort((a, b) => {
          const da = a.startDate ? new Date(a.startDate).getTime() : Infinity;
          const db = b.startDate ? new Date(b.startDate).getTime() : Infinity;
          return da - db;
        })[0]
    ?? null;
  const quickPlayPools = adminFeatured.length > 0
    ? adminFeatured
    : (autoFeatured ? [autoFeatured] : []);

  const myQs = user?._id
    ? quinielas.filter(q => q.createdBy === user._id)
    : [];

  const filtered = (() => {
    switch (activeFilter) {
      case 'live':   return liveQs;
      case 'open':   return openQs;
      case 'closed': return closedQs;
      case 'mine':   return myQs;
      default:       return quinielas;
    }
  })();

  // Don't repeat QUICK PLAY pools inside ACTIVE POOLS.
  const shownIds = new Set(quickPlayPools.map(q => q._id));
  const morePools = filtered.filter(q => !shownIds.has(q._id));

  return (
    <>
      <ArenaHeader coins={user?.balance ?? 0} />

      <ArenaBanner url={bannerURL} />

      {quickPlayPools.length > 1 ? (
        <FeaturedCarousel pools={quickPlayPools} liveFixtures={liveFixtures} locale={locale} />
      ) : quickPlayPools[0] ? (
        <QuickPlayHero quiniela={quickPlayPools[0]} liveFixtures={liveFixtures} locale={locale} />
      ) : null}

      <FilterStrip
        active={activeFilter}
        onChange={setActiveFilter}
        allCount={quinielas.length}
        openCount={openQs.length}
        liveCount={liveQs.length}
        closedCount={closedQs.length}
        mineCount={myQs.length}
        locale={locale}
      />

      <div style={{ padding: '0 16px 24px' }}>
        {loading && quinielas.length === 0 && (
          <div style={{ textAlign: 'center', padding: 28, color: 'var(--fp-text-dim)', fontFamily: 'var(--fp-mono)' }}>
            {t(locale, 'Loading pools…').toUpperCase()}
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--fp-danger)', fontFamily: 'var(--fp-mono)', fontSize: 12 }}>
            {error}
          </div>
        )}
        {!loading && quinielas.length === 0 && !error && (
          <HudFrame>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏆</div>
              <div style={{
                fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
                letterSpacing: 2, color: 'var(--fp-text)',
              }}>{t(locale, 'No pools right now').toUpperCase()}</div>
              <div style={{
                fontFamily: 'var(--fp-body)', fontSize: 12,
                color: 'var(--fp-text-dim)', marginTop: 6, marginBottom: 14,
              }}>{t(locale, "Check back soon or we'll notify you when new pools are available to play.")}</div>
              <ArcadeButton size="sm" variant="surface" onClick={loadPools}>
                {t(locale, 'Refresh').toUpperCase()}
              </ArcadeButton>
            </div>
          </HudFrame>
        )}

        {morePools.length > 0 && (
          <>
            <div style={{ margin: '14px 0 10px' }}>
              <SectionLabel>{t(locale, 'ACTIVE POOLS')}</SectionLabel>
            </div>
            {morePools.map((q, i) => (
              <div key={q._id} className="fp-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <QuinielaCard quiniela={q} liveFixtures={liveFixtures} locale={locale} />
              </div>
            ))}
          </>
        )}
      </div>

    </>
  );
}

