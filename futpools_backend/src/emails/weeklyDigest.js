/**
 * Weekly digest (#6) — once-a-week roundup of the open public pools, sent to
 * opted-in users. Marketing email: carries the one-click unsubscribe. Skipped
 * entirely when there are no open pools (lifecycleEmailService guards that).
 */
const { renderEmail, WEB, esc, unsubFooter } = require('./layout');

function poolRow({ name, startsAtText, prizeLabel, poolId }) {
  const url = `${WEB}/pool/${encodeURIComponent(String(poolId || ''))}`;
  return `<tr><td style="padding:12px 0;border-bottom:1px solid #1E3A37;">
    <a href="${url}" style="color:#EAF2F0;text-decoration:none;font-size:16px;font-weight:700;">${esc(name || 'Quiniela')}</a>
    ${startsAtText ? `<div style="color:#9FB0AD;font-size:13px;margin-top:3px;">Empieza el ${esc(startsAtText)}</div>` : ''}
    ${prizeLabel ? `<div style="color:#21E28C;font-size:13px;margin-top:3px;">Premio: ${esc(prizeLabel)}</div>` : ''}
  </td></tr>`;
}

module.exports = function weeklyDigest({ items = [], unsubscribeUrl = '' } = {}) {
  const rows = items.map(poolRow).join('');
  const count = items.length;
  return {
    subject: 'Las quinielas de esta semana en FutPools',
    html: renderEmail({
      preheader: `${count} ${count === 1 ? 'quiniela abierta' : 'quinielas abiertas'} esta semana. Deja tus pronósticos.`,
      heading: 'Quinielas abiertas esta semana ⚽',
      bodyHtml: `
        <p style="margin:0 0 8px;">Estas son las quinielas que puedes jugar ahora mismo:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0;">${rows}</table>
        <p style="margin:14px 0 0;color:#9FB0AD;">Entra a la que más te late y deja tu pronóstico antes del cierre.</p>`,
      cta: { label: 'Ver todas las quinielas', url: WEB },
      footerExtra: unsubFooter(unsubscribeUrl),
    }),
  };
};
