/** Welcome email — sent on registration. */
const { renderEmail, WEB } = require('./layout');

module.exports = function welcome({ displayName } = {}) {
  const name = String(displayName || '').trim() || 'crack';
  return {
    subject: '¡Bienvenido a FutPools!',
    html: renderEmail({
      preheader: 'Tu cuenta está lista. Únete a las quinielas y compite por premios reales.',
      // heading is escaped inside renderEmail — pass raw.
      heading: `¡Bienvenido, ${name}!`,
      bodyHtml: `
        <p style="margin:0 0 14px;">Ya eres parte de FutPools. Aquí compites con tu banda en quinielas de fútbol: pronosticas L, E o V en los partidos de la jornada y quien más acierta se lleva el premio.</p>
        <p style="margin:0 0 4px;">Hay quinielas abiertas seguido, entre semana y de fin de semana. Entra, llena tus pronósticos y compite.</p>`,
      cta: { label: 'Jugar ahora', url: WEB },
    }),
  };
};
