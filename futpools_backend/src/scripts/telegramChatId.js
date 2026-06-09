// Run: npm run telegram:chatid
// Prints the chat id(s) the bot can reach. FIRST send any message to your
// bot from Telegram, THEN run this — Telegram only returns chats that have
// messaged the bot. Copy the id into TELEGRAM_ADMIN_CHAT_ID in .env.
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN in .env first (get it from @BotFather).');
  process.exit(1);
}

(async () => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram error:', data.description || res.status);
      process.exit(1);
    }
    const chats = new Map();
    for (const u of data.result || []) {
      const chat = u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat;
      if (chat) chats.set(chat.id, chat);
    }
    if (chats.size === 0) {
      console.log('No updates yet. Send any message to your bot in Telegram, then re-run this.');
      return;
    }
    console.log('Chat IDs found (put in TELEGRAM_ADMIN_CHAT_ID):');
    for (const [id, chat] of chats) {
      const name = chat.title
        || [chat.first_name, chat.last_name].filter(Boolean).join(' ')
        || chat.username || '';
      console.log(`  ${id}  — ${chat.type} ${name}`);
    }
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
})();
