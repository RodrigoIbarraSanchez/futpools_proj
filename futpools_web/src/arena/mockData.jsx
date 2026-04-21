// mockData.jsx — Sample data mirroring the Quiniela / User shape

export const MOCK_USER = {
  displayName: 'Diego Ramírez',
  username: 'diego_r',
  level: 27,
  xp: 680,
  xpMax: 1000,
  division: 'gold',
  divisionLabel: 'Oro I',
  rankGlobal: 1247,
  streak: 5,
  streakBest: 12,
  coins: 1250,
  avatar: '#FF2BD6',
  totalEntries: 84,
  correctPicks: 312,
  winRate: 58,
  poolsWon: 7,
};

export const MOCK_ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Primera sangre', desc: 'Gana tu primera quiniela', unlocked: true, icon: '🏆', rarity: 'common' },
  { id: 'hat_trick', name: 'Hat-trick', desc: '3 aciertos seguidos', unlocked: true, icon: '⚡', rarity: 'rare' },
  { id: 'perfect', name: 'Quiniela perfecta', desc: '100% en una jornada', unlocked: true, icon: '◆', rarity: 'epic' },
  { id: 'veteran', name: 'Veterano', desc: '50 quinielas jugadas', unlocked: true, icon: '◉', rarity: 'rare' },
  { id: 'streak_10', name: 'Imparable', desc: 'Racha de 10', unlocked: false, icon: '★', rarity: 'epic' },
  { id: 'legend', name: 'Leyenda del barrio', desc: 'Llega a división Leyenda', unlocked: false, icon: '♛', rarity: 'legendary' },
];

export const TEAMS = {
  rma: { name: 'Real Madrid',  short: 'RMA', color: '#FFFFFF' },
  fcb: { name: 'Barcelona',    short: 'FCB', color: '#A50044' },
  atm: { name: 'Atlético',     short: 'ATM', color: '#CB3524' },
  sev: { name: 'Sevilla',      short: 'SEV', color: '#D4001E' },
  bet: { name: 'Real Betis',   short: 'BET', color: '#00954C' },
  val: { name: 'Valencia',     short: 'VAL', color: '#FF6A00' },
  vil: { name: 'Villarreal',   short: 'VIL', color: '#FFE667' },
  rso: { name: 'Real Sociedad',short: 'RSO', color: '#0F4C9D' },
  ath: { name: 'Athletic',     short: 'ATH', color: '#EE2E24' },
  get: { name: 'Getafe',       short: 'GET', color: '#004FA3' },
};

export const MOCK_POOL = {
  id: 'p1',
  name: 'LA LIGA · JORNADA 28',
  code: 'LL-J28',
  status: 'live',
  prize: '$12,500',
  entry: '$15',
  currency: 'MXN',
  entriesCount: 847,
  heat: 92,
  startsIn: "LIVE · 34' 2T",
  fixtures: [
    { id: 1, home: TEAMS.rma, away: TEAMS.fcb, time: '15:00', status: 'live', minute: "34'", score: [2, 1], pick: '1' },
    { id: 2, home: TEAMS.atm, away: TEAMS.sev, time: '17:30', status: 'live', minute: "12'", score: [0, 0], pick: 'X' },
    { id: 3, home: TEAMS.bet, away: TEAMS.val, time: '19:00', status: 'upcoming', pick: '1' },
    { id: 4, home: TEAMS.vil, away: TEAMS.rso, time: '21:00', status: 'upcoming', pick: '2' },
    { id: 5, home: TEAMS.ath, away: TEAMS.get, time: 'DOM 13:00', status: 'upcoming', pick: '1' },
  ],
};

export const MOCK_POOLS = [
  {
    id: 'p1', name: 'LA LIGA · J28', status: 'live',
    prize: '$12,500', entry: '$15', heat: 92, entries: 847,
    subtitle: 'LIVE · 2 partidos en juego', fixtures: MOCK_POOL.fixtures.slice(0, 2),
  },
  {
    id: 'p2', name: 'PREMIER · MW30', status: 'open',
    prize: '$8,200', entry: '$10', heat: 64, entries: 512,
    subtitle: 'Cierra en 3h 24min',
    fixtures: [
      { id: 11, home: { name: 'Arsenal', short: 'ARS', color: '#EF0107' }, away: { name: 'Chelsea', short: 'CHE', color: '#034694' }, time: 'SAB 14:00', status: 'upcoming' },
      { id: 12, home: { name: 'Liverpool', short: 'LIV', color: '#C8102E' }, away: { name: 'Man City', short: 'MCI', color: '#6CABDD' }, time: 'SAB 16:30', status: 'upcoming' },
    ],
  },
  {
    id: 'p3', name: 'CHAMPIONS · 1/4 IDA', status: 'open',
    prize: '$25,000', entry: '$25', heat: 88, entries: 1203,
    subtitle: '🔥 High stakes · Cierra MAR 20:00',
    fixtures: [
      { id: 21, home: { name: 'PSG', short: 'PSG', color: '#004170' }, away: { name: 'Bayern', short: 'BAY', color: '#DC052D' }, time: 'MAR 20:00', status: 'upcoming' },
      { id: 22, home: { name: 'Inter', short: 'INT', color: '#0068A8' }, away: { name: 'Arsenal', short: 'ARS', color: '#EF0107' }, time: 'MIE 20:00', status: 'upcoming' },
    ],
  },
  {
    id: 'p4', name: 'LIGA MX · J15', status: 'upcoming',
    prize: '$4,500', entry: '$5', heat: 41, entries: 234,
    subtitle: 'Empieza VIE 19:00',
    fixtures: [
      { id: 31, home: { name: 'América', short: 'AME', color: '#FEE100' }, away: { name: 'Chivas', short: 'CHV', color: '#C4122E' }, time: 'VIE 19:00', status: 'upcoming' },
    ],
  },
  {
    id: 'p5', name: 'MUNDIAL SUB-20', status: 'closed',
    prize: '$3,000', entry: '$8', heat: 22, entries: 189,
    subtitle: 'Resultado: 4/5 · +$45 ganados',
    fixtures: [],
    wonAmount: '+$45',
  },
];

export const MOCK_LEADERBOARD = [
  { rank: 1, name: 'carla.gk',      score: 4, of: 5, avatar: '#FFD166', you: false },
  { rank: 2, name: 'pablo.strikes', score: 4, of: 5, avatar: '#36E9FF', you: false },
  { rank: 3, name: 'diego_r',       score: 3, of: 5, avatar: '#FF2BD6', you: true  },
  { rank: 4, name: 'luis.mx',       score: 3, of: 5, avatar: '#21E28C', you: false },
  { rank: 5, name: 'ana.10',        score: 3, of: 5, avatar: '#7A1FB8', you: false },
  { rank: 6, name: 'martin88',      score: 2, of: 5, avatar: '#E08855', you: false },
  { rank: 7, name: 'sofia.bet',     score: 2, of: 5, avatar: '#FF3B5C', you: false },
  { rank: 8, name: 'xavi_90',       score: 2, of: 5, avatar: '#36E9FF', you: false },
];

export const MOCK_ENTRIES = [
  {
    id: 'e1', poolId: 'p1', poolName: 'LA LIGA · J28', entryNum: 2,
    status: 'live', score: 3, of: 5, date: 'Hoy 14:50',
    fixtures: MOCK_POOL.fixtures,
  },
  {
    id: 'e2', poolId: 'p3', poolName: 'CHAMPIONS · 1/4', entryNum: 1,
    status: 'pending', score: 0, of: 2, date: 'Lun 11:30',
    fixtures: [
      { id: 21, home: { name: 'PSG', short: 'PSG', color: '#004170' }, away: { name: 'Bayern', short: 'BAY', color: '#DC052D' }, time: 'MAR 20:00', status: 'upcoming', pick: '1' },
      { id: 22, home: { name: 'Inter', short: 'INT', color: '#0068A8' }, away: { name: 'Arsenal', short: 'ARS', color: '#EF0107' }, time: 'MIE 20:00', status: 'upcoming', pick: 'X' },
    ],
  },
  {
    id: 'e3', poolId: 'p5', poolName: 'MUNDIAL SUB-20', entryNum: 1,
    status: 'won', score: 4, of: 5, date: 'Sáb 22:10',
    prize: '+$45',
    fixtures: [],
  },
];

export const RECHARGE_PACKS = [
  { id: 'p50',  coins: 50,  price: '$29',   tag: null,           bonus: 0   },
  { id: 'p100', coins: 100, price: '$55',   tag: 'Popular',      bonus: 5   },
  { id: 'p200', coins: 200, price: '$99',   tag: '+10% BONUS',   bonus: 20  },
  { id: 'p500', coins: 500, price: '$229',  tag: 'Mejor valor',  bonus: 75  },
];
