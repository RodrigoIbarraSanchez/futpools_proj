/**
 * Telegram notifications for the organizer. The cheapest reliable way to
 * push a real-time alert (e.g. "a player marked their SPEI as paid") to the
 * admin's phone without email/web-push infra.
 *
 * Setup (see README / the scripts below):
 *   1. Create a bot with @BotFather → copy the token.
 *   2. Send any message to your new bot from your Telegram account.
 *   3. Run `npm run telegram:chatid` to print your chat id.
 *   4. Put both in .env:  TELEGRAM_BOT_TOKEN=...  TELEGRAM_ADMIN_CHAT_ID=...
 *   5. Restart the backend.  (`TELEGRAM_ADMIN_CHAT_ID` may be a
 *      comma-separated list to notify multiple organizers.)
 *
 * All sends are best-effort: missing config or a Telegram outage logs a
 * warning and never throws into the caller's flow.
 */

const botToken = () => process.env.TELEGRAM_BOT_TOKEN || '';
const chatIds = () => (process.env.TELEGRAM_ADMIN_CHAT_ID || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isConfigured() {
  return !!botToken() && chatIds().length > 0;
}

/**
 * Send a plain-text message to every configured admin chat. Plain text (no
 * parse_mode) so user-supplied fields (display names, tracking notes) can't
 * break Markdown/HTML parsing. Returns { ok, results } and never rejects.
 */
async function sendTelegramMessage(text) {
  const token = botToken();
  const ids = chatIds();
  if (!token || ids.length === 0) return { ok: false, reason: 'NOT_CONFIGURED' };

  const results = [];
  for (const chatId of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      // eslint-disable-next-line no-await-in-loop
      const data = await res.json().catch(() => ({}));
      if (!data.ok) console.warn(`[telegram] send failed (chat ${chatId}):`, data.description || res.status);
      results.push({ chatId, ok: !!data.ok });
    } catch (err) {
      console.warn(`[telegram] send error (chat ${chatId}):`, err.message);
      results.push({ chatId, ok: false });
    }
  }
  return { ok: true, results };
}

module.exports = { sendTelegramMessage, isConfigured };
