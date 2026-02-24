require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const League = require('../models/League');
const Matchday = require('../models/Matchday');
const Match = require('../models/Match');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await User.deleteMany({});
    await League.deleteMany({});
    await Matchday.deleteMany({});
    await Match.deleteMany({});

    const league = await League.create({
      name: 'Liga MX',
      code: 'LIGA_MX',
      country: 'México',
    });

    const demoUser = await User.create({
      email: 'demo@futpools.app',
      password: 'Password123',
      username: 'demo_user',
      displayName: 'Demo User',
      balance: 100,
    });

    const adminUser = await User.create({
      email: 'admin@futpools.app',
      password: process.env.ADMIN_PASSWORD || 'Password123',
      username: 'admin',
      displayName: 'Admin',
      balance: 100,
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const matchday = await Matchday.create({
      league: league._id,
      name: 'Jornada 1',
      startDate,
      endDate,
      status: 'open',
    });

    const matchDates = [
      new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
      new Date(startDate.getTime() + 48 * 60 * 60 * 1000),
      new Date(startDate.getTime() + 72 * 60 * 60 * 1000),
    ];

    await Match.insertMany([
      { matchday: matchday._id, homeTeam: 'América', awayTeam: 'Chivas', scheduledAt: matchDates[0] },
      { matchday: matchday._id, homeTeam: 'Cruz Azul', awayTeam: 'Pumas', scheduledAt: matchDates[1] },
      { matchday: matchday._id, homeTeam: 'Monterrey', awayTeam: 'Tigres', scheduledAt: matchDates[2] },
    ]);

    console.log(
      'Seed completed: 2 users, 1 league, 1 matchday, 3 matches'
    );
    console.log(
      `Demo user: ${demoUser.email} / Password123`
    );
    console.log(
      `Admin user: ${adminUser.email} / ${process.env.ADMIN_PASSWORD || 'Password123'}`
    );
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();
