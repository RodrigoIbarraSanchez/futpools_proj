/**
 * Branded HTML email shell for all FutPools transactional emails. Email HTML is
 * its own dialect: table-based layout + inline styles (divs/flexbox and <style>
 * blocks are unreliable across Gmail/Outlook/Apple Mail). Keep new emails going
 * through renderEmail() so they share the header, button, and footer.
 *
 * Dark FutPools look (matches the app): near-black background, green primary,
 * FP wordmark. Web-safe font stack only (custom fonts don't load in most
 * clients). Builders in this folder return { subject, html } and the send
 * happens in brevoService.sendEmail.
 */

const WEB = (process.env.WEB_APP_BASE_URL || 'https://futpools.com').replace(/\/+$/, '');

const C = {
  bg: '#06100F', // page background
  card: '#0C1A18', // email card
  cardAlt: '#0F2322', // header/footer bars
  stroke: '#1E3A37',
  text: '#EAF2F0',
  textDim: '#9FB0AD',
  primary: '#21E28C',
  onPrimary: '#06251A',
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escape user-controlled text before dropping it into the HTML. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A green CTA button (table-based so Outlook renders it). */
function button(label, url) {
  if (!label || !url) return '';
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 4px;">
    <tr><td align="center" bgcolor="${C.primary}" style="border-radius:10px;">
      <a href="${esc(url)}" target="_blank"
         style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;font-weight:800;
                color:${C.onPrimary};text-decoration:none;border-radius:10px;letter-spacing:.2px;">
        ${esc(label)}
      </a>
    </td></tr>
  </table>`;
}

/**
 * Wrap body content in the branded shell.
 *   preheader  — hidden inbox-preview line (improves open rates).
 *   heading    — big title at the top of the body.
 *   bodyHtml   — pre-built inner HTML (paragraphs etc.) — caller is responsible
 *                for escaping any user data it injects.
 *   cta        — { label, url } optional green button.
 *   footerExtra— optional extra footer HTML (e.g. an unsubscribe line).
 */
function renderEmail({ preheader = '', heading = '', bodyHtml = '', cta = null, footerExtra = '' }) {
  const ctaHtml = cta ? button(cta.label, cta.url) : '';
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(heading || 'FutPools')}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:600px;max-width:100%;background:${C.card};border:1px solid ${C.stroke};border-radius:16px;overflow:hidden;">
      <!-- header -->
      <tr><td style="background:${C.cardAlt};padding:22px 28px;border-bottom:1px solid ${C.stroke};" align="left">
        <img src="${WEB}/icon-192.png" width="34" height="34" alt="FutPools"
             style="vertical-align:middle;border-radius:8px;">
        <span style="font-family:${FONT};font-size:18px;font-weight:900;letter-spacing:1px;color:${C.text};vertical-align:middle;margin-left:10px;">
          FUT<span style="color:${C.primary};">POOLS</span>
        </span>
      </td></tr>
      <!-- body -->
      <tr><td style="padding:32px 28px;font-family:${FONT};color:${C.text};">
        ${heading ? `<h1 style="margin:0 0 16px;font-size:23px;line-height:1.25;font-weight:800;color:${C.text};">${esc(heading)}</h1>` : ''}
        <div style="font-size:15px;line-height:1.6;color:${C.text};">${bodyHtml}</div>
        ${ctaHtml}
      </td></tr>
      <!-- footer -->
      <tr><td style="background:${C.cardAlt};padding:20px 28px;border-top:1px solid ${C.stroke};
                     font-family:${FONT};font-size:12px;line-height:1.6;color:${C.textDim};" align="center">
        <div>FutPools · <a href="${WEB}" style="color:${C.textDim};text-decoration:underline;">futpools.com</a></div>
        <div style="margin-top:4px;">Quinielas de fútbol entre amigos. Mayores de 18 años.</div>
        ${footerExtra}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

module.exports = { renderEmail, button, esc, WEB, C, FONT };
