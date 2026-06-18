/**
 * Pending-payment nudge — sent once to a user who composed picks + created a
 * SPEI/PayPal intent but never completed the transfer. Shows the destination
 * account + reference so they can finish paying. Fired from
 * pendingPaymentReminderService on the 1-minute scheduler.
 */
const { renderEmail, esc, WEB } = require('./layout');

function detailRow(label, value) {
  return `<tr>
    <td style="padding:7px 0;color:#9FB0AD;font-size:13px;vertical-align:top;">${esc(label)}</td>
    <td style="padding:7px 0;color:#EAF2F0;font-size:14px;font-weight:700;text-align:right;word-break:break-all;">${esc(value)}</td>
  </tr>`;
}

module.exports = function pendingPayment({
  poolName, poolId, amountMXN = 0, amountUSD = 0, reference = '',
  method = 'spei', clabe = '', beneficiary = '', bank = '', startsAtText = '',
} = {}) {
  const poolUrl = `${WEB}/pool/${encodeURIComponent(String(poolId || ''))}`;
  const safeName = esc(poolName || 'tu quiniela');
  const isPaypal = method === 'paypal';
  const amountStr = isPaypal
    ? `$${Number(amountUSD || 0).toLocaleString('en-US')} USD`
    : `$${Number(amountMXN || 0).toLocaleString('es-MX')} MXN`;

  const rows = isPaypal
    ? detailRow('Monto', amountStr) + detailRow('Referencia', reference)
    : detailRow('Monto', amountStr)
      + (clabe ? detailRow('CLABE', clabe) : '')
      + (beneficiary ? detailRow('Beneficiario', beneficiary) : '')
      + (bank ? detailRow('Banco', bank) : '')
      + detailRow('Referencia / concepto', reference);

  const detailBox = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#0F2322;border:1px solid #1E3A37;border-radius:12px;padding:6px 16px;margin:6px 0 2px;">
      ${rows}
    </table>`;

  return {
    subject: `Te falta un paso para entrar a ${poolName || 'tu quiniela'}`,
    html: renderEmail({
      preheader: `Tu lugar en ${poolName || 'la quiniela'} está apartado. Completa tu ${isPaypal ? 'pago' : 'transferencia SPEI'} de ${amountStr}.`,
      heading: 'Te falta completar tu pago',
      bodyHtml: `
        <p style="margin:0 0 14px;">Apartaste tu lugar en <strong style="color:#21E28C;">${safeName}</strong>, pero todavía no recibimos tu ${isPaypal ? 'pago' : 'transferencia'}. Termínalo para que tus pronósticos entren a competir.</p>
        ${detailBox}
        ${startsAtText ? `<p style="margin:14px 0 0;color:#EAF2F0;">⏳ La quiniela empieza el <strong style="color:#21E28C;">${esc(startsAtText)}</strong>. Paga antes para no quedarte fuera.</p>` : ''}
        <p style="margin:14px 0 0;color:#9FB0AD;">${isPaypal
          ? 'Realiza el pago por PayPal e incluye la referencia.'
          : 'Haz la transferencia SPEI a la CLABE de arriba e incluye la referencia en el concepto.'} En cuanto confirmemos tu pago te llega el correo de participación confirmada.</p>`,
      cta: { label: isPaypal ? 'Completar mi pago' : 'Ver instrucciones de pago', url: poolUrl },
    }),
  };
};
