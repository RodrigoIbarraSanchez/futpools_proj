/** Password recovery — sends the reset CODE the user enters in the app. */
const { renderEmail, esc } = require('./layout');

module.exports = function passwordReset({ code, minutes } = {}) {
  return {
    subject: 'Tu código para recuperar la contraseña',
    html: renderEmail({
      preheader: `Tu código es ${code}. Vence en ${minutes} minutos.`,
      heading: 'Recupera tu contraseña',
      bodyHtml: `
        <p style="margin:0 0 18px;">Usa este código en la app de FutPools para restablecer tu contraseña:</p>
        <div style="text-align:center;margin:8px 0 18px;">
          <span style="display:inline-block;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:8px;
                       color:#21E28C;background:#0F2322;border:1px solid #1E3A37;border-radius:12px;padding:14px 24px;">${esc(code)}</span>
        </div>
        <p style="margin:0;color:#9FB0AD;">Vence en ${esc(String(minutes))} minutos. Si no pediste esto, ignora este correo: tu cuenta sigue segura.</p>`,
    }),
  };
};
