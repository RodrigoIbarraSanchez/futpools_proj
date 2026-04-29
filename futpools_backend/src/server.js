const app = require('./app');
const connectDB = require('./config/db');
const { startLivePolling } = require('./services/apiFootball');
const { startDailyPickScheduler } = require('./services/dailyPickService');

connectDB();
startLivePolling();
// Daily Pick scheduler — picks today's featured fixture at 00:00 local
// (and every minute thereafter, idempotent) + settles finished Daily
// Picks to award bonus Tickets.
startDailyPickScheduler();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
