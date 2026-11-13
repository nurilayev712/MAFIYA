/**
 * MAFIYA — PHASE 4 FEATURES TEST SUITE
 * 1. Tutorial / Practice Mode
 * 2. Daily Login Streak Rewards
 * 3. Custom Rule Editor & Share Codes
 * 4. Post-Game AI Recap Generator
 */

const assert = require('assert');
const db = require('../server/db');
const { assignRoles, generateAIRecap } = require('../server/gameLogic');

console.log('========================================================');
console.log('    MAFIYA — PHASE 4 FEATURES INTEGRATION TEST SUITE    ');
console.log('========================================================\n');

// TEST 1: TUTORIAL / PRACTICE MODE
console.log('--- TEST 1: TUTORIAL VA BIRINCHI O\'YIN O\'RGANISH REJIMI ---');
const tutUserId = 'usr_tut_' + Date.now();
const userTut = db.getOrCreateUser(tutUserId, 'O\'quvchi', 1);
assert.strictEqual(userTut.tutorialCompleted, false, 'Dastlab tutorial completed false bo\'lishi kerak');
assert.strictEqual(userTut.coins, 100, 'Dastlabki tanga 100 bo\'lishi kerak');

const tutResult = db.completeTutorial(tutUserId);
assert.strictEqual(tutResult.success, true, 'completeTutorial muvaffaqiyatli bo\'lishi kerak');
assert.strictEqual(tutResult.reward, 100, 'Tutorial mukofoti 100 tanga bo\'lishi kerak');
assert.strictEqual(tutResult.coins, 200, 'Tanga 200 ga yetishi kerak');
assert.strictEqual(tutResult.tutorialCompleted, true, 'tutorialCompleted true bo\'lishi kerak');

// Qayta tugatganda qayta tanga qo'shilmasligi (idempotentlik)
const tutRepeat = db.completeTutorial(tutUserId);
assert.strictEqual(tutRepeat.alreadyCompleted, true, 'Qayta tugatganda alreadyCompleted true bo\'lishi kerak');
assert.strictEqual(tutRepeat.reward, 0, 'Qayta mukofot 0 bo\'lishi kerak');
assert.strictEqual(tutRepeat.coins, 200, 'Tanga soni o\'zgarmasligi kerak');
console.log('✓ Tutorial yakunlash va +100 tanga mukofoti to\'g\'ri ishladi!\n');

// TEST 2: KUNLIK LOGIN STREAK REWARDS
console.log('--- TEST 2: KUNLIK LOGIN STREAK VA MUKOFOTLAR TIZIMI ---');
const streakUserId = 'usr_streak_' + Date.now();
const userStreak = db.getOrCreateUser(streakUserId, 'StreakMan', 2);
const infoDay1 = db.getStreakInfo(streakUserId);
assert.strictEqual(infoDay1.streak, 1, 'Boshlang\'ich streak 1 bo\'lishi kerak');
assert.strictEqual(infoDay1.canClaimReward, true, 'Birinchi kuni mukofot olinmagan bo\'lishi kerak');
assert.strictEqual(infoDay1.reward, 50, '1-kun mukofoti 50 tanga');

// 1-kun mukofotini olish
const claim1 = db.claimDailyReward(streakUserId);
assert.strictEqual(claim1.success, true, '1-kun mukofot olish muvaffaqiyatli bo\'lishi kerak');
assert.strictEqual(claim1.coins, 150, '100 + 50 = 150 tanga bo\'lishi kerak');
assert.strictEqual(claim1.streak, 1);

// O'sha kuni yana olishga urinish (rad etilishi kerak)
const claimRepeat = db.claimDailyReward(streakUserId);
assert.strictEqual(claimRepeat.success, false, 'O\'sha kuni qayta olish rad etilishi kerak');

// Ertasi kuni kirganda (Streak ketma-ket 2 kun bo'lishi)
const userRaw = db.getUser(streakUserId);
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
userRaw.lastLoginDate = yesterday.toISOString().split('T')[0];

const infoDay2 = db.getStreakInfo(streakUserId);
assert.strictEqual(infoDay2.streak, 2, 'Ketma-ket 2-kuni streak 2 bo\'lishi kerak');
assert.strictEqual(infoDay2.canClaimReward, true, '2-kun mukofoti olinishi mumkin bo\'lishi kerak');
assert.strictEqual(infoDay2.reward, 100, '2-kun mukofoti 100 tanga bo\'lishi kerak');

const claim2 = db.claimDailyReward(streakUserId);
assert.strictEqual(claim2.success, true);
assert.strictEqual(claim2.coins, 250, '150 + 100 = 250 tanga bo\'lishi kerak');
assert.strictEqual(claim2.streak, 2);

// Kun qoldirib yuborilganda (Streak 1 ga reset bo'lishi)
const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
userRaw.lastLoginDate = threeDaysAgo.toISOString().split('T')[0];

const infoReset = db.getStreakInfo(streakUserId);
assert.strictEqual(infoReset.streak, 1, 'Kun qoldirilganda streak 1 ga reset bo\'lishi kerak');
assert.strictEqual(infoReset.reward, 50, 'Reset bo\'lgach 1-kun mukofoti 50 tanga bo\'lishi kerak');
console.log('✓ Kunlik streak hisoblash, mukofot berish va reset qilish 100% to\'g\'ri!\n');

// TEST 3: MAXSUS QOIDALAR MUHARRIRI (CUSTOM RULE EDITOR & PRESETS)
console.log('--- TEST 3: MAXSUS QOIDALAR MUHARRIRI VA PRESETLAR ---');
const customSettings = {
  mafiaCount: 2,
  doctorCount: 2,
  detectiveCount: 1,
  mayorCount: 1,
  maniacCount: 1,
  jesterCount: 1,
  hasLovers: true,
  nightTime: 45,
  discussionTime: 120,
  votingTime: 25
};

// 10 ta o'yinchi uchun rollar taqsimoti
const testPlayers = [
  { id: 'p1', name: 'Player 1' },
  { id: 'p2', name: 'Player 2' },
  { id: 'p3', name: 'Player 3' },
  { id: 'p4', name: 'Player 4' },
  { id: 'p5', name: 'Player 5' },
  { id: 'p6', name: 'Player 6' },
  { id: 'p7', name: 'Player 7' },
  { id: 'p8', name: 'Player 8' },
  { id: 'p9', name: 'Player 9' },
  { id: 'p10', name: 'Player 10' }
];

const { assigned } = assignRoles(testPlayers, customSettings);
const assignedList = Object.values(assigned);
const countRole = (r) => assignedList.filter(p => p.role === r).length;

assert.strictEqual(countRole('mafia'), 2, 'Mafiya soni 2 bo\'lishi kerak');
assert.strictEqual(countRole('doctor'), 2, 'Shifokor soni 2 bo\'lishi kerak');
assert.strictEqual(countRole('detective'), 1, 'Komissar soni 1 bo\'lishi kerak');
assert.strictEqual(countRole('mayor'), 1, 'Mayor soni 1 bo\'lishi kerak');
assert.strictEqual(countRole('maniac'), 1, 'Manyak soni 1 bo\'lishi kerak');
assert.strictEqual(countRole('jester'), 1, 'Masharaboz soni 1 bo\'lishi kerak');
assert.strictEqual(assignedList.filter(p => p.isLover).length, 2, 'Sevishganlar 2 ta bo\'lishi kerak');

// Presetni DB ga saqlash va o'chirish
const presetUserId = 'usr_preset_' + Date.now();
const saveRes = db.saveCustomPreset(presetUserId, 'Turnir Qoidalari', customSettings);
assert.strictEqual(saveRes.success, true, 'Preset muvaffaqiyatli saqlanishi kerak');
assert.ok(saveRes.preset.id, 'Preset ID ga ega bo\'lishi kerak');

const userPresets = db.getUserPresets(presetUserId);
assert.strictEqual(userPresets.length, 1, 'Foydalanuvchida 1 ta preset bo\'lishi kerak');
assert.strictEqual(userPresets[0].name, 'Turnir Qoidalari');
assert.strictEqual(userPresets[0].settings.nightTime, 45);

const delRes = db.deleteCustomPreset(presetUserId, saveRes.preset.id);
assert.strictEqual(delRes.success, true, 'Preset o\'chirilishi kerak');
assert.strictEqual(db.getUserPresets(presetUserId).length, 0);

// Qoidalarni ulashish kodi (Share code) tekshiruvi
const shareCode = 'MAFIA_RULE_' + Buffer.from(encodeURIComponent(JSON.stringify({ n: 'Pro Qoidalar', s: customSettings }))).toString('base64');
assert.ok(shareCode.startsWith('MAFIA_RULE_'), 'Share code MAFIA_RULE_ bilan boshlanishi kerak');
const decodedPayload = JSON.parse(decodeURIComponent(Buffer.from(shareCode.replace('MAFIA_RULE_', ''), 'base64').toString('utf8')));
assert.strictEqual(decodedPayload.n, 'Pro Qoidalar');
assert.strictEqual(decodedPayload.s.mafiaCount, 2);
console.log('✓ Maxsus rollar soni, presetlar saqlash va ulashish kodi muvaffaqiyatli!\n');

// TEST 4: POST-GAME AI RECAP GENERATOR
console.log('--- TEST 4: POST-GAME AI RECAP GENERATOR ---');
const playersForRecap = [
  { id: 'p1', name: 'Alisher', role: 'mafia' },
  { id: 'p2', name: 'Doniyor', role: 'doctor' },
  { id: 'p3', name: 'Farrux', role: 'detective' },
  { id: 'p4', name: 'Malika', role: 'citizen' }
];

const playersState = {
  p1: { isAlive: false, role: 'mafia' },
  p2: { isAlive: true, role: 'doctor' },
  p3: { isAlive: true, role: 'detective' },
  p4: { isAlive: true, role: 'citizen' }
};

const matchHistory = {
  detectiveFinds: ['Alisher'],
  doctorSaves: ['Malika'],
  nightKills: [],
  lynchedPlayers: ['Alisher']
};

const citizensWin = { winner: 'citizens', title: 'TINCH AHOLI G\'ALABA QOZONDI!' };
const citizenRecap = generateAIRecap(citizensWin, playersForRecap, playersState, matchHistory);
assert.ok(citizenRecap.length > 50, 'AI Recap kamida 50 belgidan iborat bo\'lishi kerak');
assert.ok(citizenRecap.includes('Alisher') || citizenRecap.includes('tinch aholi') || citizenRecap.includes('Komissar'), 'AI Recap o\'yin tafsilotlarini o\'z ichiga olishi kerak');

// Mafiya g'alabasi uchun recap
const mafiaWin = { winner: 'mafia', title: 'MAFIYA G\'ALABA QOZONDI!' };
const mafiaHistory = {
  detectiveFinds: [],
  doctorSaves: [],
  nightKills: ['Farrux', 'Malika'],
  lynchedPlayers: ['Doniyor']
};
const mafiaRecap = generateAIRecap(mafiaWin, playersForRecap, { ...playersState, p1: { isAlive: true, role: 'mafia' } }, mafiaHistory);
assert.ok(mafiaRecap.includes('Mafiya') || mafiaRecap.includes('g\'alaba'), 'Mafiya recapida g\'alaba yozilgan bo\'lishi kerak');

// Maniac g'alabasi uchun recap
const maniacWin = { winner: 'maniac', title: 'MANIAC G\'ALABA QOZONDI!' };
const maniacRecap = generateAIRecap(maniacWin, [{ id: 'p1', name: 'Qotil', role: 'maniac' }], { p1: { isAlive: true, role: 'maniac' } }, {});
assert.ok(maniacRecap.includes('Manyak') || maniacRecap.includes('yolg\'iz'), 'Maniac recap to\'g\'ri shakllanishi kerak');

// Jester g'alabasi uchun recap
const jesterWin = { winner: 'jester', title: 'JESTER G\'ALABA QOZONDI!' };
const jesterRecap = generateAIRecap(jesterWin, [{ id: 'p1', name: 'Hazilkash', role: 'jester' }], {}, { lynchedPlayers: ['Hazilkash'] });
assert.ok(jesterRecap.includes('Masharaboz') || jesterRecap.includes('Jester'), 'Jester recap to\'g\'ri shakllanishi kerak');

console.log('Namuna AI Sharhi (Fuqarolar g\'alabasi):');
console.log('"' + citizenRecap + '"\n');
console.log('Namuna AI Sharhi (Mafiya g\'alabasi):');
console.log('"' + mafiaRecap + '"\n');
console.log('✓ Post-Game AI Recap barcha g\'alaba ssenariylari uchun to\'liq generatsiya qilindi!\n');

console.log('========================================================');
console.log('   BARCHA PHASE 4 FUNKSIYALAR TESTLARI 100% O\'TDI!      ');
console.log('========================================================');
