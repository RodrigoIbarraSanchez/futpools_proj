/**
 * Activation nudge (#3) — sent ~1 day after signup to users who registered but
 * never left a prediction. Teaches the 3-step flow. Marketing email: carries
 * the one-click unsubscribe.
 */
const { renderEmail, WEB, esc, unsubFooter } = require('./layout');

module.exports = function activation({ displayName = '', unsubscribeUrl = '' } = {}) {
  const hi = displayName ? `Hola ${esc(displayName)}, ` : '';
  return {
    subject: 'Así de fácil se juega FutPools',
    html: renderEmail({
      preheader: 'Te registraste pero aún no dejas tu primer pronóstico. Te toma un minuto.',
      heading: '¿Listo para tu primer pronóstico?',
      bodyHtml: `
        <p style="margin:0 0 14px;">${hi}te registraste en FutPools pero todavía no juegas tu primera quiniela. Es más fácil de lo que parece:</p>
        <p style="margin:0 0 6px;"><strong style="color:#21E28C;">1.</strong> Abre una quiniela de la semana.</p>
        <p style="margin:0 0 6px;"><strong style="color:#21E28C;">2.</strong> Marca L (local), E (empate) o V (visitante) en cada partido.</p>
        <p style="margin:0 0 14px;"><strong style="color:#21E28C;">3.</strong> Listo, ya estás compitiendo.</p>
        <p style="margin:0;color:#9FB0AD;">Entre más pronósticos dejes, más oportunidades tienes de ganar.</p>`,
      cta: { label: 'Jugar mi primera quiniela', url: WEB },
      footerExtra: unsubFooter(unsubscribeUrl),
    }),
  };
};
