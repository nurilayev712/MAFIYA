const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/db.json');

const dir = path.dirname(DB_FILE);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

let dbData = {
  users: {},
  reports: [],
  bannedUsers: {},
  mutedUsers: {},
  customPresets: {}
};

if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    dbData = { ...dbData, ...JSON.parse(raw) };
    if (!dbData.mutedUsers) dbData.mutedUsers = {};
  } catch (e) {
    console.error('Error loading db.json:', e);
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving db.json:', e);
  }
}

const ACHIEVEMENTS_DEF = {
  first_game: { id: 'first_game', title: "Ilk Qadam", desc: "Birinchi o'yiningizni yakunlang", icon: '🎮' },
  first_win: { id: 'first_win', title: "Ilk Zafar", desc: "Birinchi marta g'olib bo'ling", icon: '🏆' },
  godfather: { id: 'godfather', title: "Don Karleone", desc: "Mafiya sifatida 3 marta g'alaba qozoning", icon: '👑' },
  sherlock: { id: 'sherlock', title: "Sherlok Xolms", desc: "Komissar sifatida 3 marta mafiyani fosh qiling", icon: '🔍' },
  hero_doc: { id: 'hero_doc', title: "Qutqaruvchi Shifokor", desc: "Shifokor sifatida 2 fuqaroni o'limdan qutqaring", icon: '💉' },
  maniac_lone: { id: 'maniac_lone', title: "Qonxo'r Qotil", desc: "Maniac sifatida yolg'iz g'olib chiqing", icon: '🩸' },
  clown_king: { id: 'clown_king', title: "Hazilkash Jester", desc: "Jester bo'lib o'zingizni osdirib yuting", icon: '🃏' },
  true_love: { id: 'true_love', title: "Abadiy Muhabbat", desc: "Sevishganlar juftligi bilan omon qoling", icon: '💖' },
  top_rank: { id: 'top_rank', title: "Afsonaviy O'yinchi", desc: "MMR reytingingiz 1200 dan oshdi", icon: '⚡' }
};

function getOrCreateUser(userId, nickname, avatarIndex, telegramData = null) {
  if (!dbData.users[userId]) {
    dbData.users[userId] = {
      id: userId,
      nickname: nickname || 'O\'yinchi',
      avatarIndex: avatarIndex || 1,
      telegramId: telegramData ? telegramData.id : null,
      telegramUsername: telegramData ? telegramData.username : null,
      createdAt: Date.now(),
      mmr: 1000, // Boshlang'ich MMR
      stats: {
        gamesPlayed: 0,
        wins: 0,
        mafiaWins: 0,
        citizenWins: 0,
        maniacWins: 0,
        jesterWins: 0,
        detectiveFinds: 0,
        doctorSaves: 0,
        roleCounts: {}
      },
      achievements: [],
      friends: []
    };
    saveDB();
  } else {
    if (nickname) dbData.users[userId].nickname = nickname;
    if (avatarIndex) dbData.users[userId].avatarIndex = avatarIndex;
    if (telegramData) {
      dbData.users[userId].telegramId = telegramData.id;
      dbData.users[userId].telegramUsername = telegramData.username;
    }
    if (dbData.users[userId].mmr === undefined) {
      dbData.users[userId].mmr = 1000;
    }
    saveDB();
  }

  return dbData.users[userId];
}

function getUser(userId) {
  return dbData.users[userId] || null;
}

function addGameStats(userId, { role, won, roleAchievements = {} }) {
  const user = dbData.users[userId];
  if (!user) return;

  user.stats.gamesPlayed = (user.stats.gamesPlayed || 0) + 1;
  user.stats.roleCounts[role] = (user.stats.roleCounts[role] || 0) + 1;

  // MMR hisoblash
  if (won) {
    user.stats.wins = (user.stats.wins || 0) + 1;
    user.mmr = (user.mmr || 1000) + 25;

    if (role === 'mafia') user.stats.mafiaWins = (user.stats.mafiaWins || 0) + 1;
    if (role === 'citizen' || role === 'doctor' || role === 'detective' || role === 'mayor') {
      user.stats.citizenWins = (user.stats.citizenWins || 0) + 1;
    }
    if (role === 'maniac') user.stats.maniacWins = (user.stats.maniacWins || 0) + 1;
    if (role === 'jester') user.stats.jesterWins = (user.stats.jesterWins || 0) + 1;
  } else {
    user.mmr = Math.max(500, (user.mmr || 1000) - 15);
  }

  if (roleAchievements.detectiveFoundMafia) {
    user.stats.detectiveFinds = (user.stats.detectiveFinds || 0) + 1;
  }
  if (roleAchievements.doctorSavedPlayer) {
    user.stats.doctorSaves = (user.stats.doctorSaves || 0) + 1;
  }

  const unlocked = [];
  function tryUnlock(key) {
    if (!user.achievements.includes(key)) {
      user.achievements.push(key);
      unlocked.push(ACHIEVEMENTS_DEF[key]);
    }
  }

  if (user.stats.gamesPlayed >= 1) tryUnlock('first_game');
  if (user.stats.wins >= 1) tryUnlock('first_win');
  if (user.stats.mafiaWins >= 3) tryUnlock('godfather');
  if (user.stats.detectiveFinds >= 3) tryUnlock('sherlock');
  if (user.stats.doctorSaves >= 2) tryUnlock('hero_doc');
  if (user.stats.maniacWins >= 1) tryUnlock('maniac_lone');
  if (user.stats.jesterWins >= 1) tryUnlock('clown_king');
  if (roleAchievements.loversSurvived) tryUnlock('true_love');
  if (user.mmr >= 1200) tryUnlock('top_rank');

  saveDB();
  return unlocked;
}

// Mavsumiy Reyting Tizimi (Seasonal MMR Ranking)
const CURRENT_SEASON = {
  season: 1,
  title: "1-Mavsum: Shahar Qahramonlari (Season 1)",
  endsAt: "2026-12-31"
};

function getRankTier(mmr = 1000) {
  if (mmr >= 1500) return { tier: 'grandmaster', title: 'Afsona (Grandmaster)', icon: '👑', color: '#ff1744' };
  if (mmr >= 1300) return { tier: 'diamond', title: 'Olmos (Diamond)', icon: '💎', color: '#00e5ff' };
  if (mmr >= 1100) return { tier: 'gold', title: 'Oltin (Gold)', icon: '🥇', color: '#ffd700' };
  if (mmr >= 900) return { tier: 'silver', title: 'Kumush (Silver)', icon: '🥈', color: '#cfd8dc' };
  return { tier: 'bronze', title: 'Bronza (Bronze)', icon: '🥉', color: '#cd7f32' };
}

// Mavsumiy Reyting Jadvali (Leaderboard Top 25)
function getLeaderboard(limit = 25) {
  const all = Object.values(dbData.users).map(u => {
    const userMmr = u.mmr || 1000;
    return {
      id: u.id,
      nickname: u.nickname,
      avatarIndex: u.avatarIndex,
      mmr: userMmr,
      rankTier: getRankTier(userMmr),
      gamesPlayed: u.stats?.gamesPlayed || 0,
      wins: u.stats?.wins || 0,
      winrate: u.stats?.gamesPlayed ? Math.round((u.stats.wins / u.stats.gamesPlayed) * 100) : 0
    };
  });

  all.sort((a, b) => b.mmr - a.mmr || b.wins - a.wins);
  return {
    season: CURRENT_SEASON,
    players: all.slice(0, limit)
  };
}

// Do'stlar
function addFriend(userId, friendIdentifier) {
  const user = dbData.users[userId];
  if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

  const cleanId = friendIdentifier.trim();
  let friend = dbData.users[cleanId];

  if (!friend) {
    friend = Object.values(dbData.users).find(u => u.nickname.toLowerCase() === cleanId.toLowerCase());
  }

  if (!friend) {
    return { success: false, message: 'Bunday o\'yinchi topilmadi!' };
  }

  if (friend.id === user.id) {
    return { success: false, message: 'O\'zingizni do\'st qilib qo\'sha olmaysiz!' };
  }

  if (user.friends.includes(friend.id)) {
    return { success: false, message: 'Bu o\'yinchi allaqachon do\'stlaringiz ro\'yxatida bor!' };
  }

  user.friends.push(friend.id);
  if (!friend.friends.includes(user.id)) {
    friend.friends.push(user.id);
  }

  saveDB();
  return { success: true, friend: { id: friend.id, nickname: friend.nickname, avatarIndex: friend.avatarIndex } };
}

function getFriendsList(userId, onlineUserIds = new Set()) {
  const user = dbData.users[userId];
  if (!user) return [];

  return user.friends.map(fId => {
    const f = dbData.users[fId];
    if (!f) return null;
    return {
      id: f.id,
      nickname: f.nickname,
      avatarIndex: f.avatarIndex,
      mmr: f.mmr || 1000,
      isOnline: onlineUserIds.has(f.id)
    };
  }).filter(Boolean);
}

// Shikoyatlar (Reports)
function addReport(reporterId, reportedId, roomCode, reason, details = '') {
  const report = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    reporterId,
    reportedId,
    roomCode,
    reason,
    details,
    timestamp: Date.now(),
    status: 'pending' // pending, resolved, dismissed
  };
  dbData.reports.push(report);
  saveDB();
  return report;
}

function getReports() {
  return dbData.reports;
}

function resolveReport(reportId, action) {
  const rep = dbData.reports.find(r => r.id === reportId);
  if (rep) {
    rep.status = action;
    saveDB();
    return true;
  }
  return false;
}

// Ban / Bloklash
function banUser(userId, reason = 'Qoidabuzarlik') {
  dbData.bannedUsers[userId] = {
    userId,
    reason,
    bannedAt: Date.now()
  };
  saveDB();
  return true;
}

function unbanUser(userId) {
  if (dbData.bannedUsers[userId]) {
    delete dbData.bannedUsers[userId];
    saveDB();
    return true;
  }
  return false;
}

function isUserBanned(userId) {
  return Boolean(dbData.bannedUsers[userId]);
}

// Ovozni o'chirish (Mute / Unmute)
function muteUser(userId, durationMinutes = 15, reason = 'Qoidabuzarlik') {
  if (!dbData.mutedUsers) dbData.mutedUsers = {};
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;
  dbData.mutedUsers[userId] = {
    userId,
    reason,
    mutedAt: Date.now(),
    expiresAt
  };
  saveDB();
  return { success: true, expiresAt };
}

function unmuteUser(userId) {
  if (dbData.mutedUsers && dbData.mutedUsers[userId]) {
    delete dbData.mutedUsers[userId];
    saveDB();
    return true;
  }
  return false;
}

function isUserMuted(userId) {
  if (!dbData.mutedUsers) dbData.mutedUsers = {};
  const record = dbData.mutedUsers[userId];
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    delete dbData.mutedUsers[userId];
    saveDB();
    return false;
  }
  return true;
}

function getMutedUsers() {
  return dbData.mutedUsers || {};
}

// Custom Presets
function saveCustomPreset(userId, presetName, settings) {
  if (!dbData.customPresets[userId]) {
    dbData.customPresets[userId] = [];
  }
  const preset = {
    id: `pst_${Date.now()}`,
    name: presetName,
    settings,
    createdAt: Date.now()
  };
  dbData.customPresets[userId].push(preset);
  saveDB();
  return preset;
}

function getCustomPresets(userId) {
  return dbData.customPresets[userId] || [];
}

function findUserByEmail(email) {
  if (!email) return null;
  const target = email.toLowerCase().trim();
  for (const id in dbData.users) {
    if (dbData.users[id].email && dbData.users[id].email.toLowerCase() === target) {
      return dbData.users[id];
    }
  }
  return null;
}

function registerUserWithEmail(email, passwordHash, nickname, avatarIndex) {
  const existing = findUserByEmail(email);
  if (existing) return { success: false, message: 'Bu email allaqachon ro\'yxatdan o\'tgan' };

  const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const user = {
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash,
    nickname: nickname || email.split('@')[0],
    avatarIndex: avatarIndex || 1,
    createdAt: Date.now(),
    mmr: 1000,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      mafiaWins: 0,
      citizenWins: 0,
      maniacWins: 0,
      jesterWins: 0,
      detectiveFinds: 0,
      doctorSaves: 0,
      roleCounts: {}
    },
    achievements: [],
    friends: []
  };

  dbData.users[userId] = user;
  saveDB();
  return { success: true, user };
}

function googleLoginUser(email, name, avatarIndex, googleId) {
  let user = findUserByEmail(email);
  if (!user) {
    const userId = `usr_g_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    user = {
      id: userId,
      email: email.toLowerCase().trim(),
      googleId: googleId || `g_${Date.now()}`,
      nickname: name || 'Google Foydalanuvchi',
      avatarIndex: avatarIndex || 1,
      createdAt: Date.now(),
      mmr: 1000,
      stats: {
        gamesPlayed: 0,
        wins: 0,
        mafiaWins: 0,
        citizenWins: 0,
        maniacWins: 0,
        jesterWins: 0,
        detectiveFinds: 0,
        doctorSaves: 0,
        roleCounts: {}
      },
      achievements: [],
      friends: []
    };
    dbData.users[userId] = user;
    saveDB();
  }
  return user;
}

module.exports = {
  ACHIEVEMENTS_DEF,
  getOrCreateUser,
  getUser,
  findUserByEmail,
  registerUserWithEmail,
  googleLoginUser,
  addGameStats,
  getLeaderboard,
  addFriend,
  getFriendsList,
  addReport,
  getReports,
  resolveReport,
  banUser,
  unbanUser,
  isUserBanned,
  muteUser,
  unmuteUser,
  isUserMuted,
  getMutedUsers,
  CURRENT_SEASON,
  getRankTier,
  saveCustomPreset,
  getCustomPresets
};
