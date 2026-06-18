/**
 * Payment-received acknowledgement (#1) — sent when the payer taps "I've
 * transferred" (userMarkedPaidAt). Reassures them we got the notice and are
 * verifying. Account email: NOT governed by the marketing opt-out.
 */
const { renderEmail, WEB, esc } = require('./layout');

module.exports = function paymentReceived({ poolName, poolId } = {}) {
  const poolUrl = `${WEB}/pool/${encodeURIComponent(String(poolId || ''))}`;
  const safe = esc(poolName || 'tu quiniela');
  return {
    subject: 'Recibimos tu aviso de pago',
    html: renderEmail({
      preheader: 'Tenemos tu aviso de pago. Lo estamos verificando y te confirmamos en breve.',
      heading: 'Estamos verificando tu pago',
      bodyHtml: `
        <p style="margin:0 0 14px;">Gracias, recibimos tu aviso de que ya hiciste el pago de tu participación en <strong style="color:#21E28C;">${safe}</strong>.</p>
        <p style="margin:0 0 14px;">Lo estamos verificando. En cuanto lo confirmemos te llega el correo de <strong>participación confirmada</strong> y tus pronósticos entran a competir.</p>
        <p style="margin:0;color:#9FB0AD;">Normalmente es rápido. Si pasa mucho tiempo, responde a este correo y lo revisamos.</p>`,
      cta: { label: 'Ver mi quiniela', url: poolUrl },
    }),
  };
};
