/**
 * Participation confirmed — sent when the admin confirms a user's manual (SPEI)
 * payment. Re-engagement CTA: invite them to add ANOTHER entry to the same
 * pool (more entries = more chances to win).
 */
const { renderEmail, WEB, esc } = require('./layout');

module.exports = function participationConfirmed({ poolName, poolId } = {}) {
  const poolUrl = `${WEB}/pool/${encodeURIComponent(String(poolId || ''))}`;
  const safeName = esc(poolName || 'la quiniela');
  return {
    subject: `Participación confirmada: ${poolName || 'tu quiniela'}`,
    html: renderEmail({
      preheader: 'Tu pago se confirmó y ya estás dentro. Suma más pronósticos para subir tus chances.',
      heading: '¡Tu participación está confirmada!',
      bodyHtml: `
        <p style="margin:0 0 14px;">Confirmamos tu pago y ya estás dentro de <strong style="color:#21E28C;">${safeName}</strong>. Tus pronósticos quedaron registrados y competirán en vivo durante la jornada.</p>
        <p style="margin:0 0 4px;">¿Quieres más posibilidades de ganar? <strong>Cada pronóstico extra es otra oportunidad.</strong> Puedes entrar de nuevo con otra combinación de L, E o V y multiplicar tus chances en esta misma quiniela: a mayor número de pronósticos, mayor tu probabilidad de ganar.</p>`,
      cta: { label: 'Dejar otro pronóstico', url: poolUrl },
    }),
  };
};
