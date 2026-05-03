import { useState, useMemo, useEffect, useRef } from 'react';

// ─── ISO 3166-1 alpha-2 list ─────────────────────────────────────────
// Built once at import. Names come from the browser's Intl.DisplayNames
// (current locale by default — falls back to English on older runtimes).
// Flag emoji is derived from the 2-letter code via regional indicator
// shifting; identical to the iOS CountryCatalog.flagEmoji helper.

const ISO_CODES = [
  'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT',
  'AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW',
  'BV','BR','IO','BN','BG','BF','BI','CV','KH','CM','CA','KY','CF','TD','CL',
  'CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ',
  'DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ',
  'FI','FR','GF','PF','TF','GA','GM','GE','DE','GH','GI','GR','GL','GD','GP',
  'GU','GT','GG','GN','GW','GY','HT','HM','VA','HN','HK','HU','IS','IN','ID',
  'IR','IQ','IE','IM','IL','IT','JM','JP','JE','JO','KZ','KE','KI','KP','KR',
  'KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY',
  'MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS',
  'MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK',
  'MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR',
  'QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC','WS','SM','ST',
  'SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES',
  'LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK','TO',
  'TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','UY','UZ','VU',
  'VE','VN','VG','VI','WF','EH','YE','ZM','ZW',
];

export function flagEmoji(code) {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  const base = 0x1F1E6 - 0x41;
  return [...upper].map((c) => String.fromCodePoint(base + c.charCodeAt(0))).join('');
}

function buildList(locale) {
  let names;
  try {
    names = new Intl.DisplayNames([locale || 'en'], { type: 'region' });
  } catch {
    names = null;
  }
  return ISO_CODES.map((code) => ({
    code,
    name: (names && names.of(code)) || code,
    flag: flagEmoji(code),
  })).sort((a, b) => a.name.localeCompare(b.name, locale || 'en'));
}

// ─── Searchable picker (modal sheet) ─────────────────────────────────

export function CountryPicker({ value, onChange, locale, t, onClose }) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => buildList(locale === 'es' ? 'es-MX' : 'en-US'), [locale]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [query, list]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const onPick = (code) => {
    onChange(code);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, height: '85vh',
          background: 'var(--fp-bg, #07090D)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1,
            fontFamily: 'var(--fp-display)', fontSize: 14, fontWeight: 800,
            letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--fp-text, #F3F6FB)',
          }}>{t ? t(locale, 'Country') : 'Country'}</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 0,
            color: 'var(--fp-text-dim, rgba(243,246,251,0.68))',
            fontFamily: 'var(--fp-mono)', fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
          }}>{t ? t(locale, 'Cancel') : 'Cancel'}</button>
        </div>
        <div style={{ padding: '8px 16px 12px' }}>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t ? t(locale, 'Search countries') : 'Search countries'}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--fp-surface, #11161E)',
              color: 'var(--fp-text, #F3F6FB)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              fontFamily: 'var(--fp-mono)', fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center',
              color: 'var(--fp-text-dim, rgba(243,246,251,0.68))',
              fontFamily: 'var(--fp-mono)', fontSize: 12,
            }}>—</div>
          ) : filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => onPick(c.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '12px 14px',
                background: c.code === value ? 'rgba(33,226,140,0.12)' : 'transparent',
                border: 0, borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--fp-text, #F3F6FB)',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 22 }}>{c.flag}</span>
              <span style={{ flex: 1, fontFamily: 'var(--fp-body)', fontSize: 14 }}>{c.name}</span>
              <span style={{
                fontFamily: 'var(--fp-mono)', fontSize: 11,
                color: 'var(--fp-text-dim, rgba(243,246,251,0.68))',
              }}>{c.code}</span>
              {c.code === value && (
                <span style={{ color: 'var(--fp-primary, #21E28C)', fontWeight: 800 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function countryName(code, locale) {
  if (!code) return '';
  try {
    const names = new Intl.DisplayNames([locale === 'es' ? 'es-MX' : 'en-US'], { type: 'region' });
    return names.of(code) || code;
  } catch {
    return code;
  }
}
