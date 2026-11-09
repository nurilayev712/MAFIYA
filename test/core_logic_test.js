/**
 * MAFIYA — Asosiy O'yin Mantig'i, Xavfsizlik va Server-Authoritative Testlar
 * Vote Counting, Win Conditions, Phase Transitions, Security & Reconnect
 */

const assert = require('assert');
const {
  ROLES,
  PHASES,
  assignRoles,
  resolveNight,
  resolveDayVote,
  checkWinner
} = require('../server/gameLogic');
const GameManager = require('../server/gameManager');
const db = require('../server/db');
const { analyzeChatMessage } = require('../server/chatFilter');

console.log('========================================================');
console.log('    MAFIYA — CORE LOGIC & SERVER-AUTHORITY TEST SUITE   ');
console.log('========================================================\n');

// 1. OVOZLARNI HISOBLASH (VOTE COUNTING)
console.log('--- TEST 1: OVOZLARNI HISOBLASH (VOTE COUNTING) ---');

// 1.1 Oddiy ko'pchilik ovozi
const state1 = {
  p1: { id: 'p1', role: ROLES.CITIZEN, isAlive: true },
  p2: { id: 'p2', role: ROLES.CITIZEN, isAlive: true },
  p3: { id: 'p3', role: ROLES.MAFIA, isAlive: true }
};
const votes1 = { p1: 'p3', p2: 'p3', p3: 'p1' };
const res1 = resolveDayVote(votes1, state1);
assert.strictEqual(res1.eliminatedId, 'p3', 'Ko\'pchilik ovozi bilan p3 chiqarilishi kerak');
assert.strictEqual(res1.isTie, false, 'Durang bo\'lmasligi kerak');
console.log('✓ Oddiy ko\'pchilik ovozi to\'g\'ri hisoblandi: p3 (Mafia) chiqarildi.');

// 1.2 Durang ovoz berish (Tie vote)
const votesTie = { p1: 'p2', p2: 'p1' };
const resTie = resolveDayVote(votesTie, state1);
assert.strictEqual(resTie.eliminatedId, null, 'Durangda hech kim chiqarilmasligi kerak');
assert.strictEqual(resTie.isTie, true, 'Durang qayd etilishi kerak');
console.log('✓ Durang ovoz berishda hech kim o\'yindan chiqarilmadi.');

// 1.3 Mayor (Hokim) ovozining 2x hisoblanishi
const stateMayor = {
  mayor1: { id: 'mayor1', role: ROLES.MAYOR, isAlive: true },
  cit1: { id: 'cit1', role: ROLES.CITIZEN, isAlive: true },
  maf1: { id: 'maf1', role: ROLES.MAFIA, isAlive: true }
};
// maf1 va cit1 mayor1 ga ovoz berdi (2 ovoz), lekin mayor1 maf1 ga ovoz berdi (2 ovoz x2 = 2)
// Agar mayor1 maf1 ga berib, cit1 maf1 ga bersa = 3 ovoz
const votesMayor = { mayor1: 'maf1', cit1: 'mayor1', maf1: 'mayor1' };
const resMayor = resolveDayVote(votesMayor, stateMayor);
// mayor1 ning maf1 ga bergan ovozi 2 ball, cit1+maf1 ning mayor1 ga bergan ovozi 2 ball => Durang
assert.strictEqual(resMayor.voteCounts['maf1'], 2, 'Mayor ovozi 2 ball bo\'lishi kerak');
assert.strictEqual(resMayor.voteCounts['mayor1'], 2, 'Oddiy ovozlar 2 ball');
assert.strictEqual(resMayor.isTie, true, '2 ga 2 bo\'lib durang bo\'lishi kerak');
console.log('✓ Mayor (Hokim) ovozi x2 og\'irlikka ega ekanligi tasdiqlandi.');

// 1.4 Masxaraboz (Jester) ovoz berishda chiqarilganda g'alabasi
const stateJester = {
  j1: { id: 'j1', role: ROLES.JESTER, isAlive: true },
  p2: { id: 'p2', role: ROLES.CITIZEN, isAlive: true },
  p3: { id: 'p3', role: ROLES.MAFIA, isAlive: true }
};
const votesJester = { p2: 'j1', p3: 'j1' };
const resJester = resolveDayVote(votesJester, stateJester);
assert.strictEqual(resJester.eliminatedId, 'j1');
assert.strictEqual(resJester.role, ROLES.JESTER);
const jesterWin = checkWinner(stateJester, { lastLynchResult: resJester });
assert(jesterWin && jesterWin.winner === 'jester', 'Jester yakka o\'zi g\'alaba qozonishi shart');
console.log('✓ Masxaraboz linch sudi orqali chiqarilganda yakka o\'zi g\'olib bo\'ldi.');


// 2. G'ALABA SHARTLARI (WIN CONDITIONS)
console.log('\n--- TEST 2: G\'ALABA SHARTLARI (WIN CONDITIONS) ---');

// 2.1 Barcha mafiya o'lganda tinch aholi yutishi
const stateTownWin = {
  c1: { id: 'c1', role: ROLES.CITIZEN, isAlive: true },
  c2: { id: 'c2', role: ROLES.DOCTOR, isAlive: true },
  m1: { id: 'm1', role: ROLES.MAFIA, isAlive: false }
};
const townWin = checkWinner(stateTownWin);
assert.strictEqual(townWin.winner, 'citizens', 'Tinch aholi g\'alaba qozonishi kerak');
console.log('✓ Tinch aholi barcha mafiyani yo\'qotib g\'alaba qozondi.');

// 2.2 Mafiya soni fuqarolardan teng yoki ko'p bo'lganda mafiya yutishi
const stateMafiaWin = {
  c1: { id: 'c1', role: ROLES.CITIZEN, isAlive: true },
  m1: { id: 'm1', role: ROLES.MAFIA, isAlive: true }
};
const mafiaWin = checkWinner(stateMafiaWin);
assert.strictEqual(mafiaWin.winner, 'mafia', 'Mafiya soni teng bo\'lganda g\'alaba qozonishi kerak');
console.log('✓ Mafiya soni tenglashganda (1 vs 1) Mafiya g\'alaba qozondi.');

// 2.3 Manyak yolg'iz qolganda g'alaba qozonishi
const stateManiacWin = {
  man1: { id: 'man1', role: ROLES.MANIAC, isAlive: true },
  c1: { id: 'c1', role: ROLES.CITIZEN, isAlive: false },
  m1: { id: 'm1', role: ROLES.MAFIA, isAlive: false }
};
const manWin = checkWinner(stateManiacWin);
assert.strictEqual(manWin.winner, 'maniac', 'Manyak yolg\'iz qolganda g\'alaba qozonishi kerak');
console.log('✓ Qonxo\'r Manyak so\'nggi omon qoluvchi sifatida g\'alaba qozondi.');

// 2.4 Sevishganlar zanjirli o'limi
const nightLovers = {
  mafiaVotes: { p1: 1 },
  maniacTarget: null,
  doctorTarget: null,
  detectiveTarget: null
};
const loversState = {
  p1: { id: 'p1', role: ROLES.CITIZEN, isAlive: true, isLover: true, loverPartnerId: 'p2' },
  p2: { id: 'p2', role: ROLES.DOCTOR, isAlive: true, isLover: true, loverPartnerId: 'p1' },
  p3: { id: 'p3', role: ROLES.MAFIA, isAlive: true, isLover: false }
};
const loversRes = resolveNight(nightLovers, loversState);
assert.strictEqual(loversRes.killedList.length, 2, 'Ikkala sevishgan ham o\'lishi kerak');
assert(loversRes.killedList.some(k => k.id === 'p1' && k.by === 'mafia'), 'p1 mafiya tomonidan o\'ldirildi');
assert(loversRes.killedList.some(k => k.id === 'p2' && k.by === 'broken_heart'), 'p2 singan yurak sababli o\'ldi');
console.log('✓ Sevishganlar zanjirli o\'limi (Lovers chain death) muvaffaqiyatli tekshirildi.');


// 3. SERVER-AUTHORITATIVE XAVFSIZLIK VA MA'LUMOT FILTRLASH
console.log('\n--- TEST 3: SERVER-AUTHORITATIVE SECURITY & ROLE LEAK PREVENTION ---');

// Mock IO
const mockIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {}
};
const gm = new GameManager(mockIo);
const host = { id: 'usr_host', name: 'Sherbek', socketId: 'sock_host', mmr: 1000, isConnected: true };
const room = gm.createRoom(host);

// 3 ta qo'shimcha o'yinchi
room.addPlayer({ id: 'usr_2', name: 'Zokir', socketId: 'sock_2', mmr: 1000, isConnected: true });
room.addPlayer({ id: 'usr_3', name: 'Jasur', socketId: 'sock_3', mmr: 1000, isConnected: true });
room.addPlayer({ id: 'usr_4', name: 'Bobur', socketId: 'sock_4', mmr: 1000, isConnected: true });

// O'yinni boshlash
room.startGame();

// O'yin davomida usr_host uchun xavfsiz klient holatini olish:
const clientStateForHost = room.getClientStateFor('usr_host', false);
const otherPlayers = clientStateForHost.players.filter(p => p.id !== 'usr_host');

otherPlayers.forEach(p => {
  // Agar ikkalasi ham mafiya bo'lmasa, boshqa hech qaysi o'yinchining roli oshkor bo'lmasligi shart!
  if (clientStateForHost.myRole !== ROLES.MAFIA || p.role !== ROLES.MAFIA) {
    assert.strictEqual(p.role, null, `Xavfsizlik buzildi! ${p.name} roli klientga oshkor bo'ldi!`);
  }
});
console.log('✓ Zero Client Trust: Hech bir o\'yinchi boshqa o\'yinchining maxfiy rolini ko\'ra olmaydi.');

// Tomoshabin uchun holat
const spectatorState = room.getClientStateFor(null, true);
assert.strictEqual(spectatorState.myRole, null, 'Tomoshabinda myRole bo\'lmasligi kerak');
spectatorState.players.forEach(p => {
  assert.strictEqual(p.role, null, 'Tomoshabinga ham o\'yin davomida tiriklarning roli ko\'rinmaydi');
});
console.log('✓ Tomoshabin uchun xavfsiz holat to\'g\'ri filtrlangan.');


// 4. ACTION VALIDATION & OUT-OF-TURN HARAKATLARNI BLOKLASH
console.log('\n--- TEST 4: HARAKATLARNI VALIDATSIYA QILISH VA TEKSHIRISH ---');

// 4.1 Kunduzi tungi harakat qilishga urinish:
room.phase = PHASES.DAY_DISCUSSION;
const invalidNightAction = room.registerDetectiveAction('usr_host', 'usr_2');
assert.strictEqual(invalidNightAction, false, 'Kunduzi tungi harakat rad etilishi kerak');
console.log('✓ Kunduzgi fazada tungi harakat muvaffaqiyatli to\'xtatildi.');

// 4.2 O'lgan o'yinchi ovoz berishga urinishi:
room.phase = PHASES.DAY_VOTING;
room.playersState['usr_2'].isAlive = false; // usr_2 vafot etdi
const deadPlayerVote = room.registerVote('usr_2', 'usr_host');
assert.strictEqual(deadPlayerVote, false, 'O\'lgan o\'yinchi ovoz bera olmaydi');
console.log('✓ O\'yindan chiqqan o\'yinchining ovoz berishi rad etildi.');

// 4.3 Detektiv yoki Manyakning o'zini o'zi tanlashi:
room.phase = PHASES.NIGHT;
const selfCheck = room.registerDetectiveAction('usr_host', 'usr_host');
assert.strictEqual(selfCheck, false, 'Detektiv o\'zini tekshira olmaydi');
console.log('✓ Detektivning o\'zini tekshirishga urinishi to\'xtatildi.');


// 5. CHAT SENZURASI VA ANTI-FLOOD/ABUSE MODERATSIYASI
console.log('\n--- TEST 5: CHAT SENZURASI VA AVTOMATIK SUKUTGA OLISH (MUTE) ---');

const testAbuseMsg = "Sen ahmoq va gandon ekansan!";
const analyzed = analyzeChatMessage(testAbuseMsg);
assert.strictEqual(analyzed.hasAbuse, true, 'Haqorat aniqlanishi kerak');
assert(analyzed.cleaned.includes('*****'), 'Haqoratli so\'z yulduzcha bilan yopilishi kerak');
console.log(`✓ Nomaqbul so'z filtrlandi: "${testAbuseMsg}" -> "${analyzed.cleaned}"`);

// Foydalanuvchini mute qilish va tekshirish
db.muteUser('test_muted_user', 5, 'Haqorat uchun');
assert.strictEqual(db.isUserMuted('test_muted_user'), true, 'Foydalanuvchi mute holatida bo\'lishi shart');
db.unmuteUser('test_muted_user');
assert.strictEqual(db.isUserMuted('test_muted_user'), false, 'Unmute qilingach mute bekor bo\'lishi shart');
console.log('✓ Ovozni o\'chirish (Mute/Unmute) DB funksiyalari to\'liq ishlamoqda.');


// 6. MAVSUMIY REYTING (SEASONAL MMR & TIERS)
console.log('\n--- TEST 6: MAVSUMIY REYTING VA DARAJALAR (MMR & RANK TIERS) ---');
const tier1 = db.getRankTier(850);
assert.strictEqual(tier1.tier, 'bronze');
const tier2 = db.getRankTier(1150);
assert.strictEqual(tier2.tier, 'gold');
const tier3 = db.getRankTier(1550);
assert.strictEqual(tier3.tier, 'grandmaster');
const leaderboard = db.getLeaderboard(10);
assert(leaderboard.season && leaderboard.season.season === 1, 'Mavsum ma\'lumoti mavjud bo\'lishi shart');
console.log(`✓ Mavsumiy reyting darajalari to'g'ri hisoblandi: 850 MMR -> ${tier1.title}, 1550 MMR -> ${tier3.title}`);

console.log('\n========================================================');
console.log('  BARCHA SERVER-AUTHORITATIVE VA MANTIQ TESTLARI 100%! ');
console.log('========================================================');

room.clearTimer();
process.exit(0);
