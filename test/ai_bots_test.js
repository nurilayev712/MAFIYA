/**
 * AI Botlar va Yangi Funksiyalar (Login/Google/Claude/Shaxsiyatlar) Integratsiya Testi
 */
const assert = require('assert');
const { ROLES } = require('../server/gameLogic');
const GameManager = require('../server/gameManager');
const { AIBotService, BOT_PERSONALITIES } = require('../server/aiBotService');
const db = require('../server/db');
const { hashPassword, verifyPassword } = require('../server/security');

async function runTests() {
  console.log('========================================================');
  console.log('    MAFIYA SAYTI - AI BOTLAR VA LOGIN INTEGRATSIYASI    ');
  console.log('========================================================\n');

  // TEST 1: Parol xeshlash va tekshirish
  console.log('--- TEST 1: Email + Parol xeshlash & tekshirish ---');
  const rawPass = 'MeningMaxfiyParolim2026';
  const hashed = hashPassword(rawPass);
  assert(verifyPassword(rawPass, hashed), 'Parol to\'g\'ri tasdiqlanishi kerak');
  assert(!verifyPassword('Noto\'g\'riParol', hashed), 'Noto\'g\'ri parol rad etilishi kerak');
  console.log('✓ Parol xeshlash testi muvaffaqiyatli!\n');

  // TEST 2: Email orqali ro'yxatdan o'tish va Google login
  console.log('--- TEST 2: DB Email va Google login ---');
  const email = `mafia_player_${Date.now()}@example.com`;
  const regRes = db.registerUserWithEmail(email, hashed, 'Don_Alisher', 3);
  assert(regRes.success && regRes.user.email === email, 'Ro\'yxatdan o\'tish muvaffaqiyatli bo\'lishi kerak');

  const gUser = db.googleLoginUser('google_user@gmail.com', 'Google_Qahramon', 2, 'g_12345');
  assert(gUser && gUser.googleId === 'g_12345', 'Google login muvaffaqiyatli bo\'lishi kerak');
  console.log('✓ Email va Google orqali foydalanuvchi tizimi muvaffaqiyatli!\n');

  // TEST 3: Botlar Shaxsiyati va Yaratilishi
  console.log('--- TEST 3: Botlar va Shaxsiyatlar (Personalities) ---');
  const mockIo = {
    to: () => ({ emit: () => {} })
  };
  const gm = new GameManager(mockIo);
  const host = { id: 'p_host', name: 'Xostbek', isHost: true, socketId: 's_host', mmr: 1000 };
  const room = gm.createRoom(host);

  const bot1 = room.addBot();
  const bot2 = room.addBot();
  assert(bot1 && bot1.isBot, 'Bot yaratilishi kerak');
  assert(bot1.personality && bot1.personality.id, 'Botga shaxsiyat biriktirilishi kerak');
  console.log(`✓ Bot yaratildi: ${bot1.name} (Shaxsiyat: ${bot1.personality.name} ${bot1.personality.icon})`);
  console.log(`✓ Bot yaratildi: ${bot2.name} (Shaxsiyat: ${bot2.personality.name} ${bot2.personality.icon})`);
  console.log('✓ Shaxsiyatlar tizimi muvaffaqiyatli!\n');

  // TEST 4: Auto-Fill Bots (Avtomatik to'ldirish)
  console.log('--- TEST 4: Avtomatik Botlar Bilan To\'ldirish (Auto-Fill) ---');
  // Yangi 1 kishilik xona ochamiz
  const room2 = gm.createRoom({ id: 'p_solo', name: 'YakkaO\'yinchi', isHost: true, socketId: 's_solo', mmr: 1000 });
  assert.strictEqual(room2.players.length, 1);
  assert.strictEqual(room2.settings.autoFillBots, true);

  // O'yinni boshlaymiz, autoFillBots avtomatik 4 nafarga to'ldirishi kerak!
  const startRes = room2.startGame();
  assert(startRes.success, 'O\'yin boshlanishi kerak');
  assert.strictEqual(room2.players.length, 4, 'Xonada 4 ta o\'yinchi bo\'lishi kerak');
  console.log(`✓ O'yin boshlanganda avtomatik to'ldirildi. Jami o'yinchilar: ${room2.players.map(p => p.name).join(', ')}`);
  console.log('✓ Auto-fill bots funksiyasi muvaffaqiyatli!\n');

  // TEST 5: Botlarning Nutqi (Claude / Smart Fallback)
  console.log('--- TEST 5: Botlarning Tabiiy Nutqi va Himoyalanishi ---');
  const testBot = room2.players.find(p => p.isBot);
  assert(testBot, 'Bot topilmadi');

  // Bevosita ayblanganda
  const speechDefend = await AIBotService.generateSpeech({
    bot: testBot,
    room: room2,
    isDirectReply: true,
    replyingTo: 'YakkaO\'yinchi'
  });
  assert(speechDefend && speechDefend.length > 5, 'Bot himoyalanish nutqi bo\'sh bo\'lmasligi kerak');
  console.log(`✓ Bot himoyalanish javobi: "${speechDefend}"`);

  // Oddiy kunduzgi muhokama nutqi
  const speechRegular = await AIBotService.generateSpeech({
    bot: testBot,
    room: room2,
    isDirectReply: false
  });
  assert(speechRegular && speechRegular.length > 5);
  console.log(`✓ Bot muhokama nutqi: "${speechRegular}"\n`);

  // TEST 6: Mantiqiy Ovoz Berish (Mafiya sherigiga ovoz bermasligi)
  console.log('--- TEST 6: Mantiqiy Ovoz Berish (Mafia Safe Check) ---');
  // Mafiya botini topamiz yoki sun'iy holat
  const mafiaBot = {
    id: 'bot_mafia_1',
    name: 'Don_Bot',
    isBot: true,
    personality: BOT_PERSONALITIES.shubhachi
  };
  const mockRoom = {
    playersState: {
      bot_mafia_1: { role: ROLES.MAFIA, isAlive: true },
      bot_mafia_2: { role: ROLES.MAFIA, isAlive: true },
      p_citizen: { role: ROLES.CITIZEN, isAlive: true }
    },
    votes: { p_citizen: 'bot_mafia_1' },
    chatHistory: []
  };

  const alivePlayers = [
    { id: 'bot_mafia_1', name: 'Don_Bot' },
    { id: 'bot_mafia_2', name: 'Partner_Bot' },
    { id: 'p_citizen', name: 'Fuqaro_Bobur' }
  ];

  const voteTarget = AIBotService.decideVote({
    bot: mafiaBot,
    room: mockRoom,
    alivePlayers
  });

  assert.strictEqual(voteTarget, 'p_citizen', 'Mafiya boti hech qachon sherigiga ovoz bermasligi kerak!');
  console.log(`✓ Mafiya boti sherigiga emas, fuqaroga (${voteTarget}) ovoz berdi!\n`);

  // TEST 7: O'yin so'ngida botlarni oshkor qilish (revealBotsAtEnd)
  console.log('--- TEST 7: O\'yin so\'ngida botlarni oshkor qilish ---');
  // O'yin davomida (lobby/night)
  const clientStateMidGame = room2.getClientStateFor(room2.players[0].id);
  const botInState = clientStateMidGame.players.find(p => p.id === testBot.id);
  assert.strictEqual(botInState.isBot, false, 'O\'yin davomida bot ekanligi yashirin bo\'lishi kerak');

  // O'yin tugaganda (game_over)
  room2.phase = 'game_over';
  const clientStateGameOver = room2.getClientStateFor(room2.players[0].id);
  const botGameOver = clientStateGameOver.players.find(p => p.id === testBot.id);
  assert.strictEqual(botGameOver.isBot, true, 'O\'yin tugagach bot oshkor qilinishi kerak');
  assert(botGameOver.personality, 'O\'yin tugagach shaxsiyat ko\'rinishi kerak');
  console.log(`✓ O'yin so'ngida oshkor qilindi: ${botGameOver.name} (Bot: ${botGameOver.isBot}, Shaxsiyat: ${botGameOver.personality.name})`);

  console.log('\n========================================================');
  console.log('    BARCHA AI BOT VA AUTH TESTLARI 100% O\'TDI!         ');
  console.log('========================================================');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
