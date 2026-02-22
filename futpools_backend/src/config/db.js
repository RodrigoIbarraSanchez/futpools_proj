const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
    // Permitir múltiples quinielas por usuario/jornada: quitar índice único si existía
    await mongoose.connection.db.collection('predictions').dropIndex('user_1_matchday_1').catch(() => {});
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
