// Run: npm run telegram:test
// Sends a test message to verify TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID.
require('dotenv').config();
const { sendTelegramMessage, isConfigured } = require('../services/telegramService');

(async () => {
  if (!isConfigured()) {
    console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in .env first.');
    process.exit(1);
  }
  const r = await sendTelegramMessage('✅ FutPools: prueba de notificación. Si ves esto, tus alertas de pago SPEI están listas.');
  console.log('Result:', JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
})();
