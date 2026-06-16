/**
 * Public email endpoints (no auth). Currently just the unsubscribe landing for
 * marketing/announcement emails. Account emails (password reset, payment
 * confirmation) are NOT governed by this opt-out — only mass announcements
 * check User.emailOptOut.
 */
const User = require('../models/User');
const emailToken = require('../lib/emailToken');

/** Minimal branded confirmation page (no app deps, renders standalone). */
function page(title, message, accent = '#21E28C') {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · FutPools</title></head>
<body style="margin:0;background:#06100F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#EAF2F0;">
<div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center;">
  <div style="font-size:20px;font-weight:900;letter-spacing:1px;margin-bottom:28px;">FUT<span style="color:#21E28C;">POOLS</span></div>
  <div style="background:#0C1A18;border:1px solid #1E3A37;border-radius:16px;padding:32px 24px;">
    <h1 style="margin:0 0 12px;font-size:22px;color:${accent};">${title}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#9FB0AD;">${message}</p>
  </div>
  <div style="margin-top:24px;font-size:13px;"><a href="https://futpools.com" style="color:#9FB0AD;text-decoration:underline;">futpools.com</a></div>
</div></body></html>`;
}

/**
 * GET/POST /email/unsubscribe?u=<userId>&t=<token>
 * GET = user clicked the footer link. POST = mailbox one-click (RFC 8058);
 * params still travel in the query string so both share this handler.
 */
async function unsubscribe(req, res) {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const u = String(req.query.u || '');
  const t = String(req.query.t || '');
  if (!emailToken.verify(u, t)) {
    return res.status(400).send(page(
      'Enlace no válido',
      'Este enlace de baja no es válido o está incompleto. Si quieres dejar de recibir novedades, escríbenos a rodrigo@futpools.com.',
      '#FF6B6B'));
  }
  try {
    await User.updateOne({ _id: u }, { $set: { emailOptOut: true, emailOptOutAt: new Date() } });
  } catch (err) {
    console.warn('[email] unsubscribe failed:', err.message);
    return res.status(400).send(page(
      'No pudimos procesar tu baja',
      'Escríbenos a rodrigo@futpools.com y te damos de baja manualmente.',
      '#FF6B6B'));
  }
  return res.send(page(
    'Listo, te diste de baja',
    'No volverás a recibir correos de novedades ni de nuevas quinielas. Los correos de tu cuenta (recuperación de contraseña y confirmación de pago) seguirán llegando con normalidad.'));
}

module.exports = { unsubscribe };
