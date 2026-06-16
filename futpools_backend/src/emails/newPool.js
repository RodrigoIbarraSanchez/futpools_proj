/**
 * New quiniela announcement — sent to ALL opted-in users when the admin creates
 * a new PUBLIC pool. Marketing email, so it carries a one-click unsubscribe link
 * in the footer (and brevoService sets the List-Unsubscribe header to match).
 */
const { renderEmail, esc, WEB } = require('./layout');

module.exports = function newPool({ poolName, poolId, prizeLabel = '', unsubscribeUrl = '' } = {}) {
  const poolUrl = `${WEB}/pool/${encodeURIComponent(String(poolId || ''))}`;
  const safeName = esc(poolName || 'una nueva quiniela');
  const prizeBits = prizeLabel
    ? `<p style="margin:0 0 14px;">Premio: <strong style="color:#21E28C;">${esc(prizeLabel)}</strong>.</p>`
    : '';
  const footerExtra = unsubscribeUrl
    ? `<div style="margin-top:10px;"><a href="${esc(unsubscribeUrl)}" style="color:#9FB0AD;text-decoration:underline;">Darme de baja de novedades</a></div>`
    : '';

  return {
    subject: `Nueva quiniela: ${poolName || '¡ya está abierta!'}`,
    html: renderEmail({
      preheader: `Se abrió ${poolName || 'una nueva quiniela'}. Deja tu pronóstico antes del cierre.`,
      heading: '¡Hay quiniela nueva! ⚽',
      bodyHtml: `
        <p style="margin:0 0 14px;">Acabamos de abrir <strong style="color:#21E28C;">${safeName}</strong> y ya puedes dejar tu pronóstico.</p>
        ${prizeBits}
        <p style="margin:0;">Entra antes de que cierre, elige tus L, E o V y compite con toda la comunidad. Recuerda: puedes entrar con más de un pronóstico para subir tus probabilidades de ganar.</p>`,
      cta: { label: 'Ver la quiniela', url: poolUrl },
      footerExtra,
    }),
  };
};
