require('dotenv').config();
const express = require('express');
const cors = require('cors');

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
const ogRoutes = require('./routes/og');

const app = express();

app.use(cors());

// Stripe webhook MUST be registered before the global JSON parser so the
// request body stays a raw Buffer — the SDK's signature verification relies
// on the exact bytes Stripe signed. Any body-parsing in between invalidates
// the signature.
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
app.use('/ads', adsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/challenges', challengeRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = app;
