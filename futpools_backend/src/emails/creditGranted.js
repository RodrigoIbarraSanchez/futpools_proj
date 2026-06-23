/**
 * Credit granted — sent when an admin adds MXN store-credit to a user's
 * account. Tells them how much they have and that it covers a pool entry, with
 * a CTA to go pick and join for free.
 */
const { renderEmail, WEB, esc } = require('./layout');

module.exports = function creditGranted({ amountMXN, balanceMXN, note } = {}) {
  const amount = Number(amountMXN) || 0;
  const balance = Number(balanceMXN) || amount;
  const safeNote = note ? esc(note) : '';
  return {
    subject: `Tienes $${amount} MXN de crédito para tu próxima quiniela`,
    html: renderEmail({
      preheader: `Te abonamos $${amount} MXN. Tu próxima entrada queda cubierta — solo arma tus pronósticos.`,
      heading: '¡Tienes crédito disponible! 🎟️',
      bodyHtml: `
        <p style="margin:0 0 14px;">Te abonamos <strong style="color:#21E28C;">$${amount} MXN</strong> de crédito en tu cuenta. Tu saldo disponible es de <strong style="color:#21E28C;">$${balance} MXN</strong>.</p>
        <p style="margin:0 0 14px;">Cuando entres a una quiniela de paga, tu crédito <strong>cubre la entrada automáticamente</strong>: solo arma tus pronósticos y quedas dentro al instante, sin pagar nada.</p>
        ${safeNote ? `<p style="margin:0 0 14px;color:#9aa;">Nota: ${safeNote}</p>` : ''}`,
      cta: { label: 'Ver quinielas', url: `${WEB}/` },
    }),
  };
};
