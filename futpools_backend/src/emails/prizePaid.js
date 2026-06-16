/**
 * Prize paid (#4) — sent to each winner when the admin marks a settled pool as
 * paid (winnerPaidAt). Closes the money loop with confidence. Account email:
 * NOT governed by the marketing opt-out.
 */
const { renderEmail, WEB, esc } = require('./layout');

module.exports = function prizePaid({ poolName, poolId, prizeMXN = 0, prizeLabel = '', note = '' } = {}) {
  const poolUrl = `${WEB}/pool/${encodeURIComponent(String(poolId || ''))}`;
  const safe = esc(poolName || 'tu quiniela');
  const prizeStr = prizeMXN > 0
    ? `$${Number(prizeMXN).toLocaleString('es-MX')} MXN`
    : (prizeLabel || '');
  const prizeLine = prizeStr
    ? `Te enviamos tu premio: <strong style="color:#21E28C;">${esc(prizeStr)}</strong>.`
    : 'Te enviamos tu premio.';
  const noteLine = note ? `<p style="margin:0 0 14px;color:#9FB0AD;">Nota: ${esc(note)}</p>` : '';
  return {
    subject: `Tu premio de ${poolName || 'la quiniela'} va en camino`,
    html: renderEmail({
      preheader: `${prizeStr ? `Te enviamos ${prizeStr}. ` : ''}Gracias por jugar en FutPools.`,
      heading: '¡Tu premio fue pagado! 🎉',
      bodyHtml: `
        <p style="margin:0 0 14px;">Ganaste en <strong style="color:#21E28C;">${safe}</strong> y ya procesamos tu pago. ${prizeLine}</p>
        ${noteLine}
        <p style="margin:0;color:#9FB0AD;">Si no lo ves reflejado en un par de días, responde a este correo y lo revisamos. ¡Gracias por jugar!</p>`,
      cta: { label: 'Ver la quiniela', url: poolUrl },
    }),
  };
};
