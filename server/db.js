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
      coins: 100, // Boshlang'ich tangalar
      streak: 1, // Boshlang'ich kunlik streak
      lastLoginDate: null,
      tutorialCompleted: false,
      bpXp: 0,
      bpLevel: 1,
      isPremiumBP: false,
      claimedBPTiers: [],
      equippedCosmetics: { frame: null, chatBg: null, roomTheme: null },
      inventory: [],
      emailVerified: true,
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
    if (dbData.users[userId].coins === undefined) {
      dbData.users[userId].coins = 100;
    }
    if (dbData.users[userId].streak === undefined) {
      dbData.users[userId].streak = 1;
    }
    if (dbData.users[userId].tutorialCompleted === undefined) {
      dbData.users[userId].tutorialCompleted = false;
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
  if (!dbData.customPresets) dbData.customPresets = {};
  if (!dbData.customPresets[userId]) {
    dbData.customPresets[userId] = [];
  }
  const preset = {
    id: `pst_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: presetName,
    settings,
    createdAt: Date.now()
  };
  dbData.customPresets[userId].push(preset);
  saveDB();
  return { success: true, preset, ...preset };
}

function getCustomPresets(userId) {
  if (!dbData.customPresets) dbData.customPresets = {};
  return dbData.customPresets[userId] || [];
}

function deleteCustomPreset(userId, presetId) {
  if (!dbData.customPresets || !dbData.customPresets[userId]) return { success: false };
  const initial = dbData.customPresets[userId].length;
  dbData.customPresets[userId] = dbData.customPresets[userId].filter(p => p.id !== presetId);
  if (dbData.customPresets[userId].length !== initial) {
    saveDB();
    return { success: true };
  }
  return { success: false };
}

// -------------------------------------------------------------
// KUNLIK KIRISH STREAK VA TANGALAR TIZIMI (DAILY STREAK REWARDS)
// -------------------------------------------------------------
function getStreakInfo(userId) {
  const user = dbData.users[userId];
  if (!user) return { streak: 1, coins: 100, claimedToday: false, canClaimReward: true, nextReward: 50, reward: 50 };
  if (user.coins === undefined) user.coins = 100;
  if (!user.streak) user.streak = 1;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const claimedToday = user.lastLoginDate === todayStr;

  let currentStreak = user.streak || 1;

  // Agar bugun hali olinmagan bo'lsa:
  if (user.lastLoginDate && !claimedToday) {
    const diffTime = Math.abs(new Date(todayStr) - new Date(user.lastLoginDate));
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      currentStreak = 1; // Ketma-ket kun uzildi, 1 ga qaytadi
      user.streak = 1;
      saveDB();
    } else if (diffDays === 1) {
      currentStreak = (user.streak || 0) + 1; // Kecha olgan, demak bugun ketma-ket keyingi kun
    }
  }

  const nextReward = Math.min(500, 50 * currentStreak);

  return {
    streak: currentStreak,
    coins: user.coins || 100,
    claimedToday,
    canClaimReward: !claimedToday,
    reward: nextReward,
    nextReward,
    lastLoginDate: user.lastLoginDate
  };
}

function claimDailyReward(userId) {
  const user = dbData.users[userId];
  if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

  if (user.coins === undefined) user.coins = 100;
  if (!user.streak) user.streak = 0;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (user.lastLoginDate === todayStr) {
    return {
      success: false,
      alreadyClaimed: true,
      canClaimReward: false,
      streak: user.streak,
      coins: user.coins,
      totalCoins: user.coins,
      reward: 0,
      rewardCoins: 0,
      message: 'Siz bugungi kunlik mukofotingizni allaqachon olgansiz! Ertaga yana kiring.'
    };
  }

  let streak = user.streak || 0;
  if (!user.lastLoginDate) {
    streak = 1;
  } else {
    const diffTime = Math.abs(new Date(todayStr) - new Date(user.lastLoginDate));
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak += 1;
    } else if (diffDays > 1) {
      streak = 1; // 1 kundan ortiq tashlab ketilgan, streak 1 dan boshlanadi
    } else {
      streak = Math.max(1, streak);
    }
  }

  const rewardCoins = Math.min(500, 50 * streak);
  user.streak = streak;
  user.coins += rewardCoins;
  user.lastLoginDate = todayStr;

  saveDB();

  return {
    success: true,
    streak: user.streak,
    reward: rewardCoins,
    rewardCoins,
    coins: user.coins,
    totalCoins: user.coins,
    canClaimReward: false,
    message: `Ajoyib! ${streak}-kunlik streak uchun +${rewardCoins} tanga berildi! 🔥`
  };
}

function completeTutorial(userId) {
  const user = dbData.users[userId];
  if (!user) return { success: false };
  if (!user.tutorialCompleted) {
    user.tutorialCompleted = true;
    user.coins = (user.coins || 100) + 100;
    saveDB();
    return { success: true, reward: 100, bonusCoins: 100, coins: user.coins, totalCoins: user.coins, tutorialCompleted: true };
  }
  return { success: true, alreadyCompleted: true, reward: 0, bonusCoins: 0, coins: user.coins || 100, totalCoins: user.coins || 100, tutorialCompleted: true };
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
    coins: 100,
    streak: 1,
    lastLoginDate: null,
    tutorialCompleted: false,
    bpXp: 0,
    bpLevel: 1,
    isPremiumBP: false,
    claimedBPTiers: [],
    equippedCosmetics: { frame: null, chatBg: null, roomTheme: null },
    inventory: [],
    emailVerified: false,
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
      coins: 100,
      streak: 1,
      lastLoginDate: null,
      tutorialCompleted: false,
      bpXp: 0,
      bpLevel: 1,
      isPremiumBP: false,
      claimedBPTiers: [],
      equippedCosmetics: { frame: null, chatBg: null, roomTheme: null },
      inventory: [],
      emailVerified: true,
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

// -------------------------------------------------------------
// MAVSUMIY JANG PASPORTI (SEASONAL BATTLE PASS)
// -------------------------------------------------------------
const BATTLE_PASS_TIERS = [
  { level: 1, xpRequired: 0, free: { type: 'coins', value: 100, name: '100 Tanga 💰' }, premium: { type: 'coins', value: 300, name: '300 Tanga 💰' } },
  { level: 2, xpRequired: 500, free: { type: 'title', value: 'Boshlovchi Detektiv', name: 'Unvon: Boshlovchi Detektiv 🕵️' }, premium: { type: 'frame', value: 'frame_gold', name: 'Oltin Ramka 👑' } },
  { level: 3, xpRequired: 1000, free: { type: 'coins', value: 150, name: '150 Tanga 💰' }, premium: { type: 'chat_bg', value: 'bg_noir', name: 'Retro Noir Chati 🕶️' } },
  { level: 4, xpRequired: 1500, free: { type: 'title', value: 'Shahar Himoyachisi', name: 'Unvon: Shahar Himoyachisi 🛡️' }, premium: { type: 'coins', value: 500, name: '500 Tanga 💰' } },
  { level: 5, xpRequired: 2000, free: { type: 'coins', value: 200, name: '200 Tanga 💰' }, premium: { type: 'theme', value: 'theme_neon_red', name: 'Neon Qon Mavzusi 🩸' } },
  { level: 6, xpRequired: 2500, free: { type: 'frame', value: 'frame_bronze', name: 'Bronza Ramka 🥉' }, premium: { type: 'title', value: 'Sokin Qotil', name: 'Unvon: Sokin Qotil 🗡️' } },
  { level: 7, xpRequired: 3000, free: { type: 'coins', value: 250, name: '250 Tanga 💰' }, premium: { type: 'coins', value: 700, name: '700 Tanga 💰' } },
  { level: 8, xpRequired: 3500, free: { type: 'title', value: 'Tungi Qidiruvchi', name: 'Unvon: Tungi Qidiruvchi 🌙' }, premium: { type: 'frame', value: 'frame_cyber', name: 'Kiber Ramka ⚡' } },
  { level: 9, xpRequired: 4000, free: { type: 'coins', value: 300, name: '300 Tanga 💰' }, premium: { type: 'chat_bg', value: 'bg_tashkent', name: 'Tungi Toshkent Chati 🌃' } },
  { level: 10, xpRequired: 4500, free: { type: 'title', value: 'Afsonaviy O\'yinchi', name: 'Unvon: Afsonaviy O\'yinchi 🏆' }, premium: { type: 'title', value: 'Don Salieri', name: 'Eksklyuziv Unvon: Don Salieri (+1000 Tanga) 🎩' } }
];

function getBattlePass(userId) {
  const user = dbData.users[userId];
  if (!user) return null;
  if (user.bpXp === undefined) user.bpXp = 0;
  if (user.bpLevel === undefined) user.bpLevel = 1;
  if (user.isPremiumBP === undefined) user.isPremiumBP = false;
  if (!user.claimedBPTiers) user.claimedBPTiers = [];

  // XP bo'yicha joriy levelni hisoblash
  let currentLevel = 1;
  for (let i = BATTLE_PASS_TIERS.length - 1; i >= 0; i--) {
    if (user.bpXp >= BATTLE_PASS_TIERS[i].xpRequired) {
      currentLevel = BATTLE_PASS_TIERS[i].level;
      break;
    }
  }
  user.bpLevel = currentLevel;

  const nextTier = BATTLE_PASS_TIERS.find(t => t.level === currentLevel + 1);
  const curTier = BATTLE_PASS_TIERS.find(t => t.level === currentLevel) || BATTLE_PASS_TIERS[0];
  const nextXp = nextTier ? nextTier.xpRequired : curTier.xpRequired;

  const tiersWithStatus = BATTLE_PASS_TIERS.map(t => {
    const isUnlocked = user.bpXp >= t.xpRequired;
    const isFreeClaimed = user.claimedBPTiers.includes(`free_${t.level}`);
    const isPremiumClaimed = user.claimedBPTiers.includes(`premium_${t.level}`);

    return {
      level: t.level,
      tier: t.level,
      xpRequired: t.xpRequired,
      free: { ...t.free, claimed: isFreeClaimed, canClaim: isUnlocked && !isFreeClaimed },
      premium: { ...t.premium, claimed: isPremiumClaimed, canClaim: isUnlocked && user.isPremiumBP && !isPremiumClaimed }
    };
  });

  return {
    level: user.bpLevel,
    xp: user.bpXp,
    currentXp: user.bpXp,
    nextXp,
    xpNeeded: nextXp,
    isPremium: user.isPremiumBP,
    claimedTiers: user.claimedBPTiers || [],
    tiers: tiersWithStatus
  };
}

function addMatchXP(userId, isWinner = false) {
  const user = dbData.users[userId];
  if (!user) return { xpAdded: 0, xpGained: 0, newLevel: 1, level: 1, totalXp: 0, leveledUp: false };

  if (user.bpXp === undefined) user.bpXp = 0;
  if (user.bpLevel === undefined) user.bpLevel = 1;

  const oldLevel = user.bpLevel;
  const xpToAdd = isWinner ? 250 : 100; // 100 XP ishtirok, 150 bonus g'alaba uchun
  user.bpXp += xpToAdd;

  // Level tekshiruvi
  for (let i = BATTLE_PASS_TIERS.length - 1; i >= 0; i--) {
    if (user.bpXp >= BATTLE_PASS_TIERS[i].xpRequired) {
      user.bpLevel = BATTLE_PASS_TIERS[i].level;
      break;
    }
  }

  saveDB();
  return {
    xpAdded: xpToAdd,
    xpGained: xpToAdd,
    newLevel: user.bpLevel,
    level: user.bpLevel,
    newXP: user.bpXp,
    totalXp: user.bpXp,
    leveledUp: user.bpLevel > oldLevel
  };
}

function claimBattlePassReward(userId, tierLevel, isPremium = false) {
  const user = dbData.users[userId];
  if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };
  if (!user.claimedBPTiers) user.claimedBPTiers = [];
  if (user.coins === undefined) user.coins = 100;
  if (!user.inventory) user.inventory = [];

  const tier = BATTLE_PASS_TIERS.find(t => t.level === tierLevel);
  if (!tier) return { success: false, message: 'Daraja topilmadi' };

  if (user.bpXp < tier.xpRequired) {
    return { success: false, message: 'Bu darajaga hali yetib kelmadingiz' };
  }

  const claimKey = isPremium ? `premium_${tierLevel}` : `free_${tierLevel}`;
  if (user.claimedBPTiers.includes(claimKey)) {
    return { success: false, message: 'Ushbu mukofot allaqachon olingan' };
  }

  if (isPremium && !user.isPremiumBP) {
    return { success: false, message: 'Premium mukofotni olish uchun Premium Pasport talab qilinadi' };
  }

  const reward = isPremium ? tier.premium : tier.free;
  if (reward.type === 'coins') {
    user.coins += reward.value;
    if (tierLevel === 10 && isPremium) user.coins += 1000; // Don Salieri maxsus tangasi
  } else if (reward.type === 'title') {
    user.title = reward.value;
    user.inventory.push({ type: 'title', id: reward.value, name: reward.name });
  } else {
    user.inventory.push({ type: reward.type, id: reward.value, name: reward.name });
  }

  user.claimedBPTiers.push(claimKey);
  saveDB();

  return {
    success: true,
    reward,
    coins: user.coins,
    claimedBPTiers: user.claimedBPTiers
  };
}

function purchaseBattlePass(userId, provider = 'click') {
  const user = dbData.users[userId];
  if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

  user.isPremiumBP = true;
  user.coins = (user.coins || 100) + 500; // 500 tanga xarid bonusi

  if (!dbData.payments) dbData.payments = [];
  const paymentRecord = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    userId,
    provider: provider.toUpperCase(),
    amount: 25000, // 25,000 UZS
    currency: 'UZS',
    item: 'Seasonal Battle Pass Premium',
    createdAt: Date.now(),
    status: 'completed'
  };
  dbData.payments.push(paymentRecord);
  saveDB();

  return {
    success: true,
    message: `Premium Jang Pasporti muvaffaqiyatli faollashtirildi (${provider.toUpperCase()})! +500 Tanga taqdim etildi.`,
    isPremium: true,
    bonusCoins: 500,
    coins: user.coins,
    payment: paymentRecord
  };
}

// -------------------------------------------------------------
// HAMJAMIYAT IJODXONA MARKAZI (COMMUNITY CONTENT HUB)
// -------------------------------------------------------------
const DEFAULT_COSMETICS = [
  { id: 'frame_gold', type: 'frame', name: 'Oltin Qirol Ramkasi', author: 'MAFIYA Official', css: 'border: 3px solid #ffd700; box-shadow: 0 0 10px #ffd700;', status: 'approved', createdAt: Date.now() },
  { id: 'frame_cyber', type: 'frame', name: 'Neon Kiber Ramka', author: 'CyberDon', css: 'border: 3px solid #00b0ff; box-shadow: 0 0 12px #00b0ff;', status: 'approved', createdAt: Date.now() },
  { id: 'frame_blood', type: 'frame', name: 'Qonli Alanga Ramkasi', author: 'RedMafia', css: 'border: 3px solid #ff2a44; box-shadow: 0 0 14px rgba(255,42,68,0.7);', status: 'approved', createdAt: Date.now() },
  { id: 'bg_noir', type: 'chat_bg', name: 'Retro Noir', author: 'MAFIYA Official', css: 'background: linear-gradient(180deg, #18181b 0%, #09090b 100%);', status: 'approved', createdAt: Date.now() },
  { id: 'bg_tashkent', type: 'chat_bg', name: 'Tungi Toshkent', author: 'ToshkentlikDon', css: 'background: linear-gradient(180deg, #0f172a 0%, #020617 100%); border: 1px solid #3b82f6;', status: 'approved', createdAt: Date.now() },
  { id: 'theme_neon_red', type: 'room_theme', name: 'Neon Qon Mavzusi', author: 'MAFIYA Official', css: '--accent-red: #ff1744;', status: 'approved', createdAt: Date.now() },
  { id: 'theme_emerald', type: 'room_theme', name: 'Zahar Zumrad Mavzusi', author: 'EmeraldBoss', css: '--accent-emerald: #00e676;', status: 'approved', createdAt: Date.now() }
];

function initCommunityCosmetics() {
  if (!dbData.communityCosmetics || dbData.communityCosmetics.length === 0) {
    dbData.communityCosmetics = [...DEFAULT_COSMETICS];
    saveDB();
  }
}
initCommunityCosmetics();

function getCosmetics(type = null, includePending = false) {
  if (!dbData.communityCosmetics || dbData.communityCosmetics.length === 0) {
    dbData.communityCosmetics = [...DEFAULT_COSMETICS];
  }
  let list = dbData.communityCosmetics;
  if (!includePending) {
    list = list.filter(c => c.status === 'approved');
  }
  if (type && type !== 'all') {
    list = list.filter(c => c.type === type);
  }
  return list.map(c => ({
    ...c,
    cssStyle: c.cssStyle || c.css,
    css: c.css || c.cssStyle
  }));
}

function submitCosmetic(userId, { name, type, css, cssStyle, description, badge }) {
  const user = dbData.users[userId];
  if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

  if (!dbData.communityCosmetics) dbData.communityCosmetics = [...DEFAULT_COSMETICS];

  const styleValue = (css || cssStyle || '').trim().slice(0, 150);
  const cosmetic = {
    id: `cosm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    authorId: userId,
    author: user.nickname || 'Foydalanuvchi',
    name: (name || '').trim().slice(0, 30),
    type: ['frame', 'chat_bg', 'room_theme', 'theme'].includes(type) ? type : 'frame',
    css: styleValue,
    cssStyle: styleValue,
    badge: (badge || '🎨').slice(0, 4),
    description: (description || '').trim().slice(0, 100),
    status: 'pending', // Moderatsiya kutmoqda
    createdAt: Date.now()
  };

  dbData.communityCosmetics.push(cosmetic);
  saveDB();
  return { success: true, cosmetic, message: 'Kosmetika moderatsiyaga muvaffaqiyatli yuborildi!' };
}

function moderateCosmetic(cosmeticId, action = 'approve') {
  if (!dbData.communityCosmetics) return { success: false };
  const item = dbData.communityCosmetics.find(c => c.id === cosmeticId);
  if (!item) return { success: false, message: 'Element topilmadi' };

  item.status = action === 'approve' ? 'approved' : 'rejected';
  saveDB();
  return { success: true, item, cosmetic: item, status: item.status };
}

function equipCosmetic(userId, type, cosmeticId) {
  const user = dbData.users[userId];
  if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };
  if (!user.equippedCosmetics) user.equippedCosmetics = { frame: null, chatBg: null, roomTheme: null };

  const cosmetic = (dbData.communityCosmetics || DEFAULT_COSMETICS).find(c => c.id === cosmeticId && c.status === 'approved');
  if (!cosmetic && cosmeticId !== null) {
    return { success: false, message: 'Kosmetika mavjud emas' };
  }

  user.equippedCosmetics[type] = cosmeticId;
  saveDB();
  return { success: true, equipped: user.equippedCosmetics, equippedCosmetics: user.equippedCosmetics, cosmetic };
}

// -------------------------------------------------------------
// PAROLNI TIKLASH VA EMAIL TASDIQLASH (FORGOT PASSWORD & VERIFY)
// -------------------------------------------------------------
const passwordResetCodes = new Map(); // email -> { code, expiresAt }

function requestPasswordReset(email) {
  if (!email) return { success: false, message: 'Email kiritilishi shart' };
  const user = findUserByEmail(email);
  if (!user) return { success: false, message: 'Ushbu email bilan ro\'yxatdan o\'tgan akkaunt topilmadi' };

  const code = String(Math.floor(100000 + Math.random() * 900000));
  passwordResetCodes.set(email.toLowerCase().trim(), {
    code,
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 daqiqa
  });

  return {
    success: true,
    code, // UI va demo uchun ko'rsatiladi
    message: `Tiklash kodi yuborildi: ${code} (15 daqiqa davomida amal qiladi)`
  };
}

function confirmPasswordReset(email, code, newPasswordHash) {
  if (!email || !code || !newPasswordHash) {
    return { success: false, message: 'Barcha ma\'lumotlar to\'ldirilishi shart' };
  }

  const record = passwordResetCodes.get(email.toLowerCase().trim());
  if (!record) {
    return { success: false, message: 'Tiklash kodi topilmadi yoki muddati o\'tgan' };
  }

  if (Date.now() > record.expiresAt) {
    passwordResetCodes.delete(email.toLowerCase().trim());
    return { success: false, message: 'Kodingizning muddati o\'tib ketgan' };
  }

  if (record.code !== String(code).trim()) {
    return { success: false, message: 'Noto\'g\'ri tasdiqlash kodi' };
  }

  const user = findUserByEmail(email);
  if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };

  user.passwordHash = newPasswordHash;
  passwordResetCodes.delete(email.toLowerCase().trim());
  saveDB();

  return { success: true, message: 'Parolingiz muvaffaqiyatli yangilandi! Endi yangi parol bilan kirishingiz mumkin.' };
}

function verifyUserEmail(userId) {
  const user = dbData.users[userId];
  if (!user) return { success: false };
  user.emailVerified = true;
  saveDB();
  return { success: true, message: 'Email muvaffaqiyatli tasdiqlandi!' };
}

// -------------------------------------------------------------
// DO'ST STATISTIKASINI YONMA-YON TAQQOSLASH (COMPARE STATS)
// -------------------------------------------------------------
function getFriendComparison(userId, friendId) {
  const u1 = dbData.users[userId];
  const u2 = dbData.users[friendId];
  if (!u1 || !u2) return { success: false, message: 'Foydalanuvchilar topilmadi' };

  const getStatsObj = (u) => {
    const played = u.stats?.gamesPlayed || 0;
    const wins = u.stats?.wins || 0;
    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
    return {
      id: u.id,
      nickname: u.nickname,
      avatarIndex: u.avatarIndex || 1,
      mmr: u.mmr || 1000,
      rank: getRankTier(u.mmr || 1000).name,
      coins: u.coins || 100,
      streak: u.streak || 1,
      games: played,
      gamesPlayed: played,
      wins,
      winRate: `${winRate}%`,
      mafiaWins: u.stats?.mafiaWins || 0,
      detectiveFinds: u.stats?.detectiveFinds || 0,
      doctorSaves: u.stats?.doctorSaves || 0,
      bpLevel: u.bpLevel || 1,
      isPremiumBP: !!u.isPremiumBP,
      favoriteRole: Object.entries(u.stats?.roleCounts || {}).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Fuqaro'
    };
  };

  const meObj = getStatsObj(u1);
  const frObj = getStatsObj(u2);

  return {
    success: true,
    me: meObj,
    friend: frObj,
    diff: {
      mmr: meObj.mmr - frObj.mmr,
      wins: meObj.wins - frObj.wins,
      games: meObj.gamesPlayed - frObj.gamesPlayed
    }
  };
}

function loginUserWithEmail(email, password) {
  const user = findUserByEmail(email);
  if (!user || !user.passwordHash) return { success: false, message: 'Foydalanuvchi topilmadi yoki parol o\'rnatilmagan' };
  
  let isValid = false;
  try {
    const { verifyPassword } = require('./security');
    isValid = verifyPassword(password, user.passwordHash);
  } catch (e) {
    isValid = (password === user.passwordHash);
  }

  if (!isValid && password !== user.passwordHash) {
    return { success: false, message: 'Parol noto\'g\'ri' };
  }
  return { success: true, user };
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
  getCustomPresets,
  getUserPresets: getCustomPresets,
  deleteCustomPreset,
  getStreakInfo,
  claimDailyReward,
  completeTutorial,
  BATTLE_PASS_TIERS,
  getBattlePass,
  addMatchXP,
  claimBattlePassReward,
  purchaseBattlePass,
  getCosmetics,
  submitCosmetic,
  moderateCosmetic,
  equipCosmetic,
  requestPasswordReset,
  confirmPasswordReset,
  verifyUserEmail,
  loginUserWithEmail,
  getFriendComparison
};
