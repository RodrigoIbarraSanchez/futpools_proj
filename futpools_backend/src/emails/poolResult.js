/**
 * Pool settled — sent to every participant once the quiniela is scored. Two
 * variants: winner (first place / won a ladder prize) vs participant. Fired
 * from poolSettlementService via brevoService.sendPoolResultsForSettlement.
 */
const { renderEmail, WEB, esc } = require('./layout');

module.exports = function poolResult({ poolName, poolId, score = 0, total = 0, isWinner = false, prizeMXN = 0 } = {}) {
  const poolUrl = `${WEB}/pool/${encodeURIComponent(String(poolId || ''))}`;
  const safeName = esc(poolName || 'la quiniela');
  const scoreLine = `Acertaste <strong style="color:#21E28C;">${esc(String(score))} de ${esc(String(total))}</strong> pronósticos.`;
  const hasPrize = isWinner && prizeMXN > 0;
  const prizeStr = hasPrize ? `$${Number(prizeMXN).toLocaleString('es-MX')} MXN` : '';

  if (isWinner) {
    return {
      subject: hasPrize
        ? `¡Ganaste ${prizeStr} en ${poolName || 'tu quiniela'}!`
        : `¡Ganaste en ${poolName || 'tu quiniela'}!`,
      html: renderEmail({
        preheader: hasPrize
          ? `Ganaste ${prizeStr} con ${score}/${total} aciertos.`
          : `Quedaste en primer lugar con ${score}/${total} aciertos.`,
        heading: hasPrize ? '¡Ganaste! 🏆' : '¡Quedaste en primer lugar! 🏆',
        bodyHtml: `
          <p style="margin:0 0 14px;">Terminó <strong style="color:#21E28C;">${safeName}</strong> y te tenemos buenas noticias.</p>
          <p style="margin:0 0 14px;">${scoreLine}${hasPrize ? ` Tu premio: <strong style="color:#21E28C;">${esc(prizeStr)}</strong>.` : ' Fuiste el número uno de la tabla.'}</p>
          <p style="margin:0;color:#9FB0AD;">${hasPrize ? 'Nos pondremos en contacto para coordinar la entrega de tu premio. ' : ''}Revisa la tabla final y presume tu victoria.</p>`,
        cta: { label: 'Ver resultados', url: poolUrl },
      }),
    };
  }

  return {
    subject: `Resultados de ${poolName || 'tu quiniela'}`,
    html: renderEmail({
      preheader: `Terminó la quiniela. Acertaste ${score}/${total}.`,
      heading: 'La quiniela terminó',
      bodyHtml: `
        <p style="margin:0 0 14px;">Ya hay resultados en <strong style="color:#21E28C;">${safeName}</strong>.</p>
        <p style="margin:0 0 14px;">${scoreLine} Esta vez no alcanzó para el primer lugar, pero la próxima jornada es otra oportunidad.</p>
        <p style="margin:0;color:#9FB0AD;">Tip: entrar con varios pronósticos en una misma quiniela sube tus probabilidades de ganar.</p>`,
      cta: { label: 'Ver resultados', url: poolUrl },
    }),
  };
};
