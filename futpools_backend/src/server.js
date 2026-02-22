const app = require('./app');
const connectDB = require('./config/db');
const { startLivePolling } = require('./services/apiFootball');

connectDB();
startLivePolling();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
