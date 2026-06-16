/**
 * Pool closing soon (#2) — "last call" sent a few hours before a public pool
 * starts, to opted-in users who have NOT entered it yet. Marketing email: one
 * per pool, carries the one-click unsubscribe.
 */
const { renderEmail, WEB, esc, unsubFooter } = require('./layout');

module.exports = function poolClosingSoon({ poolName, poolId, startsAtText = '', prizeLabel = '', unsubscribeUrl = '' } = {}) {
  const poolUrl = `${WEB}/pool/${encodeURIComponent(String(poolId || ''))}`;
  const safe = esc(poolName || 'la quiniela');
  const prizeBits = prizeLabel
    ? `<p style="margin:0 0 14px;">Premio: <strong style="color:#21E28C;">${esc(prizeLabel)}</strong>.</p>`
    : '';
  return {
    subject: `Última llamada: ${poolName || 'la quiniela'} está por cerrar`,
    html: renderEmail({
      preheader: `${poolName || 'La quiniela'} cierra pronto. Deja tu pronóstico antes del inicio.`,
      heading: 'Última llamada ⏳',
      bodyHtml: `
        <p style="margin:0 0 14px;">La quiniela <strong style="color:#21E28C;">${safe}</strong> está por cerrar y todavía no dejas tu pronóstico.</p>
        ${startsAtText ? `<p style="margin:0 0 14px;">Empieza el <strong style="color:#21E28C;">${esc(startsAtText)}</strong>. Después de eso ya no podrás entrar.</p>` : ''}
        ${prizeBits}
        <p style="margin:0;">Elige tus L, E o V y compite. Recuerda: puedes entrar con más de un pronóstico para subir tus probabilidades de ganar.</p>`,
      cta: { label: 'Entrar ahora', url: poolUrl },
      footerExtra: unsubFooter(unsubscribeUrl),
    }),
  };
};
