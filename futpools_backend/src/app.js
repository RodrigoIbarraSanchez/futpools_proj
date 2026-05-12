require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { isSimpleMode } = require('./config/mode');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const leagueRoutes = require('./routes/leagues');
const matchdayRoutes = require('./routes/matchdays');
const matchRoutes = require('./routes/matches');
const predictionRoutes = require('./routes/predictions');
const footballRoutes = require('./routes/football');
const quinielaRoutes = require('./routes/quinielas');
const settingsRoutes = require('./routes/settings');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');
const adsRoutes = require('./routes/ads');
const paymentsRoutes = require('./routes/payments');
const paymentsController = require('./controllers/paymentsController');
const challengeRoutes = require('./routes/challenges');
const ticketsRoutes = require('./routes/tickets');
const dailyPickRoutes = require('./routes/dailyPick');
const sweepstakesRoutes = require('./routes/sweepstakes');
const poolPaymentsRoutes = require('./routes/poolPayments');
const publicRoutes = require('./routes/public');
const ogRoutes = require('./routes/og');

const app = express();

app.use(cors());

// Stripe webhook MUST be registered before the global JSON parser so the
// request body stays a raw Buffer — the SDK's signature verification relies
// on the exact bytes Stripe signed. Any body-parsing in between invalidates
// the signature.
//
// One webhook URL serves BOTH flows (coin packs + pool entries). The
// handler dispatches by session.metadata: poolId → poolPaymentService,
// packId → coin-pack credit. This means we mount the webhook in both
// modes — simple_version still needs it for pool entry creation.
app.post(
  '/payments/webhook',
  express.raw({ type: 'application/json' }),
  paymentsController.handleWebhook
);

app.use(express.json());

// OG share pages — must be registered before API routes so crawlers
// (WhatsApp, Telegram, iMessage) receive the meta-tag HTML, not JSON.
app.use(ogRoutes);

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/leagues', leagueRoutes);
app.use('/matchdays', matchdayRoutes);
app.use('/matches', matchRoutes);
app.use('/predictions', predictionRoutes);
app.use('/football', footballRoutes);
app.use('/quinielas', quinielaRoutes);
app.use('/settings', settingsRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/admin', adminRoutes);

// In simple_version we don't expose the legacy coin/ticket/challenge/
// sweepstakes/dailyPick/IAP economy. Schema and controllers stay on disk
// so a rollback to master is just a flag flip — no migration. Hiding the
// routes at the edge gives clients a clean 404 instead of half-functional
// surface.
if (!isSimpleMode()) {
  app.use('/ads', adsRoutes);
  app.use('/payments', paymentsRoutes);
  app.use('/challenges', challengeRoutes);
  app.use('/tickets', ticketsRoutes);
  app.use('/daily-pick', dailyPickRoutes);
  app.use('/sweepstakes', sweepstakesRoutes);
}

// Per-pool Stripe Checkout (simple_version only). Lives under /pools to
// avoid namespace collision with /payments which is coin-pack territory.
// The companion webhook handler is the shared /payments/webhook above —
// dispatch happens by session.metadata.poolId vs metadata.packId.
if (isSimpleMode()) {
  app.use('/pools', poolPaymentsRoutes);
}

// Unauthenticated read-only endpoints used by the iOS onboarding
// "App Demo" screen (real fixtures before signup).
app.use('/public', publicRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true, mode: isSimpleMode() ? 'simple' : 'master' });
});

module.exports = app;
