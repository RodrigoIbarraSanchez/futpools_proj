/**
 * Win-back (#5) — sent to users who played before but have gone quiet for a few
 * weeks. Marketing email: carries the one-click unsubscribe and is rate-limited
 * by a cooldown in lifecycleEmailService.
 */
const { renderEmail, WEB, esc, unsubFooter } = require('./layout');

module.exports = function winback({ displayName = '', unsubscribeUrl = '' } = {}) {
  const hi = displayName ? `${esc(displayName)}, ` : '';
  return {
    subject: 'Te extrañamos en la cancha',
    html: renderEmail({
      preheader: 'Hace rato no dejas un pronóstico. Hay quinielas nuevas esperándote.',
      heading: '¿Volvemos a jugar?',
      bodyHtml: `
        <p style="margin:0 0 14px;">${hi}hace un tiempo que no dejas un pronóstico en FutPools. El fútbol no para y hay quinielas nuevas cada semana.</p>
        <p style="margin:0 0 14px;">Vuelve, arma tu pronóstico en un minuto y pelea por el primer lugar.</p>
        <p style="margin:0;color:#9FB0AD;">Entre más pronósticos dejes, más oportunidades de ganar.</p>`,
      cta: { label: 'Ver quinielas abiertas', url: WEB },
      footerExtra: unsubFooter(unsubscribeUrl),
    }),
  };
};
