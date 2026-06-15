/**
 * One-time backfill: upsert every existing user into Brevo as a contact in the
 * marketing list (BREVO_LIST_ID), so you can send the welcome CAMPAIGN to your
 * current user base from the Brevo dashboard. New users from here on are synced
 * automatically by the register hook (brevoService.welcomeNewUser).
 *
 * Idempotent: uses Brevo's bulk import with updateExistingContacts:true, so
 * re-running it just refreshes attributes — no duplicates.
 *
 * Run:  npm run brevo:backfill
 * Needs in .env:  MONGODB_URI, BREVO_API_KEY, BREVO_LIST_ID
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const API_KEY = process.env.BREVO_API_KEY;
const LIST_ID = Number(process.env.BREVO_LIST_ID);
const BATCH = 1000; // Brevo import accepts large jsonBody; batch to be safe.

async function importBatch(contacts) {
  const res = await fetch('https://api.brevo.com/v3/contacts/import', {
    method: 'POST',
    headers: {
      'api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      listIds: [LIST_ID],
      updateExistingContacts: true,
      jsonBody: contacts,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`import → ${res.status} ${data.code || ''} ${data.message || ''}`.trim());
  }
  return res.json().catch(() => ({}));
}

async function main() {
  if (!API_KEY || !Number.isInteger(LIST_ID) || LIST_ID <= 0) {
    console.error('[backfill] Set BREVO_API_KEY and a numeric BREVO_LIST_ID in .env');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('[backfill] Set MONGODB_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}).select('email displayName username locale').lean();
  const contacts = users
    .filter((u) => u.email)
    .map((u) => ({
      email: u.email,
      attributes: { FIRSTNAME: u.displayName || u.username || '', LOCALE: u.locale || 'es' },
    }));
  console.log(`[backfill] ${users.length} users → ${contacts.length} contacts to import into list ${LIST_ID}`);

  for (let i = 0; i < contacts.length; i += BATCH) {
    const slice = contacts.slice(i, i + BATCH);
    // eslint-disable-next-line no-await-in-loop
    await importBatch(slice);
    console.log(`[backfill] queued ${Math.min(i + BATCH, contacts.length)}/${contacts.length}`);
  }

  await mongoose.disconnect();
  console.log('[backfill] done. Brevo processes imports asynchronously — check Contacts → the list in a minute.');
}

main().catch(async (err) => {
  console.error('[backfill] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
