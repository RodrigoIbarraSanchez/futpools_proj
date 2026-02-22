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

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/leagues', leagueRoutes);
app.use('/matchdays', matchdayRoutes);
app.use('/matches', matchRoutes);
app.use('/predictions', predictionRoutes);
app.use('/football', footballRoutes);
app.use('/quinielas', quinielaRoutes);
app.use('/settings', settingsRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = app;
