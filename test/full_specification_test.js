const assert = require('assert');
const db = require('../server/db');
const { generateAIReplayMoments } = require('../server/gameLogic');

console.log("=== MAFIYA TO'LIQ SPETSIFIKATSIYA TESTLARI BOSHLANDI ===");

async function runTests() {
  const ts = Date.now();

  // 1. MAVSUMIY JANG PASPORTI (BATTLE PASS XP VA DARAJALAR)
  console.log("\n1. Mavsumiy Jang Pasporti (Battle Pass) sinovlari:");
  const bpUser = db.getOrCreateUser(`test_bp_${ts}`, 'JasurBP', 1);
  assert(bpUser, "Battle pass foydalanuvchisi yaratilishi kerak");

  let bp = db.getBattlePass(bpUser.id);
  assert.strictEqual(bp.level, 1, "Boshlang'ich daraja 1 bo'lishi kerak");
  assert.strictEqual(bp.currentXp, 0, "Boshlang'ich XP 0 bo'lishi kerak");
  assert.strictEqual(bp.isPremium, false, "Standart tarif Bepul bo'lishi kerak");
  assert.strictEqual(bp.tiers.length, 10, "Battle Pass 10 ta darajadan iborat bo'lishi kerak");

  // O'yin o'ynaldi (mag'lubiyat): +100 XP
  let xpRes1 = db.addMatchXP(bpUser.id, false);
  assert.strictEqual(xpRes1.xpGained, 100, "Mag'lubiyat uchun +100 XP berilishi kerak");
  assert.strictEqual(xpRes1.totalXp, 100, "Jami XP 100 bo'lishi kerak");
  assert.strictEqual(xpRes1.leveledUp, false, "Daraja hali oshmasligi kerak");

  // O'yin yutildi: +250 XP
  let xpRes2 = db.addMatchXP(bpUser.id, true);
  assert.strictEqual(xpRes2.xpGained, 250, "G'alaba uchun +250 XP berilishi kerak");
  assert.strictEqual(xpRes2.totalXp, 350, "Jami XP 350 bo'lishi kerak");

  // Yana bir g'alaba: +250 XP -> Jami 600 XP (500 XP = 2-darajaga ko'tarilish)
  let xpRes3 = db.addMatchXP(bpUser.id, true);
  assert.strictEqual(xpRes3.totalXp, 600, "Jami XP 600 bo'lishi kerak");
  assert.strictEqual(xpRes3.level, 2, "2-darajaga ko'tarilishi kerak");
  assert.strictEqual(xpRes3.leveledUp, true, "leveledUp true bo'lishi kerak");

  // 1-daraja bepul mukofotini olish
  let claimRes1 = db.claimBattlePassReward(bpUser.id, 1, false);
  assert(claimRes1.success, "1-daraja bepul mukofotini muvaffaqiyatli olishi kerak");
  assert(claimRes1.reward, "Mukofot ma'lumoti qaytishi kerak");

  // Premium bo'lmasdan premium mukofotni olishga urinish (rad etilishi kerak)
  let claimFail = db.claimBattlePassReward(bpUser.id, 1, true);
  assert.strictEqual(claimFail.success, false, "Bepul foydalanuvchi premium mukofotni ololmasligi kerak");
  console.log("✓ Battle Pass XP hisoblash va mukofot olish muvaffaqiyatli o'tdi!");

  // 2. CLICK VA PAYME TO'LOV TIZIMI ORQALI PREMIUM SOTIB OLISH
  console.log("\n2. Click va Payme to'lovlari sinovi:");
  let buyClick = db.purchaseBattlePass(bpUser.id, 'click');
  assert(buyClick.success, "Click orqali Premium xarid qilish muvaffaqiyatli bo'lishi kerak");
  assert.strictEqual(buyClick.bonusCoins, 500, "+500 Tanga bonus taqdim etilishi kerak");

  let bpAfterBuy = db.getBattlePass(bpUser.id);
  assert.strictEqual(bpAfterBuy.isPremium, true, "Foydalanuvchi endi Premium maqomiga ega bo'lishi kerak");

  // Endi 1-daraja premium mukofotini olish
  let claimPrem = db.claimBattlePassReward(bpUser.id, 1, true);
  assert(claimPrem.success, "Premium foydalanuvchi premium mukofotni olishi kerak");

  // Payme sinovi
  const paymeUser = db.getOrCreateUser(`test_payme_${ts}`, 'PaymeUser', 2);
  let buyPayme = db.purchaseBattlePass(paymeUser.id, 'payme');
  assert(buyPayme.success, "Payme orqali xarid muvaffaqiyatli bo'lishi kerak");
  assert(db.getUser(paymeUser.id).isPremiumBP, "Payme foydalanuvchisi premium bo'lishi kerak");
  console.log("✓ Click va Payme to'lovlari muvaffaqiyatli tekshirildi!");

  // 3. HAMJAMIYAT IJODXONASI (COMMUNITY COSMETICS & MODERATSIYA)
  console.log("\n3. Hamjamiyat Ijodxonasi (Kosmetika & Moderatsiya) sinovi:");
  let allCosmetics = db.getCosmetics('all', false);
  assert(Array.isArray(allCosmetics) && allCosmetics.length >= 3, "Standart tasdiqlangan kosmetikalar mavjud bo'lishi kerak");

  // Yangi dizayn yaratish
  let submitRes = db.submitCosmetic(bpUser.id, {
    name: "Moviy Alanga Ramkasi",
    type: "frame",
    cssStyle: "linear-gradient(135deg, #00c6ff, #0072ff)",
    badge: "🔥"
  });
  assert(submitRes.success, "Foydalanuvchi yangi dizayn yubora olishi kerak");
  assert.strictEqual(submitRes.cosmetic.status, 'pending', "Yangi dizayn 'pending' holatida bo'lishi kerak");

  // Admin navbatini tekshirish
  let pendingList = db.getCosmetics('all', true).filter(c => c.status === 'pending');
  assert(pendingList.some(c => c.id === submitRes.cosmetic.id), "Pending ro'yxatida yangi dizayn bo'lishi kerak");

  // Admin tasdiqlashi (Approve)
  let modApprove = db.moderateCosmetic(submitRes.cosmetic.id, 'approve');
  assert(modApprove.success, "Admin tasdiqlashi muvaffaqiyatli bo'lishi kerak");
  assert.strictEqual(modApprove.cosmetic.status, 'approved', "Status 'approved' bo'lishi kerak");

  // Foydalanuvchi ushbu tasdiqlangan dizaynni jihozlashi (Equip)
  let equipRes = db.equipCosmetic(bpUser.id, 'frame', submitRes.cosmetic.id);
  assert(equipRes.success, "Kosmetikani jihozlash muvaffaqiyatli bo'lishi kerak");
  assert.strictEqual(equipRes.equipped.frame, submitRes.cosmetic.id, "Foydalanuvchi ramkasi yangilanishi kerak");
  console.log("✓ Hamjamiyat kosmetikalari va moderatsiya navbati muvaffaqiyatli tekshirildi!");

  // 4. PAROLNI TIKLASH (FORGOT PASSWORD & VERIFICATION CODE)
  console.log("\n4. Parolni tiklash (Forgot Password) oqimi sinovi:");
  const testEmail = `player_${ts}@mafiya.uz`;
  const originalPass = "sirli_parol_123";
  let regUser = db.registerUserWithEmail(testEmail, originalPass, "ParolSinovchi", 1);
  assert(regUser.success, "Foydalanuvchi ro'yxatdan o'tishi kerak");

  // Parol tiklash kodini so'rash
  let resetReq = db.requestPasswordReset(testEmail);
  assert(resetReq.success, "Parolni tiklash so'rovi muvaffaqiyatli bo'lishi kerak");
  assert(resetReq.code && resetReq.code.length === 6, "6 xonali tasdiqlash kodi qaytishi kerak");

  // Noto'g'ri kod bilan sinab ko'rish
  let failConfirm = db.confirmPasswordReset(testEmail, "000000", "yangi_parol_456");
  assert.strictEqual(failConfirm.success, false, "Noto'g'ri kod rad etilishi kerak");

  // To'g'ri kod bilan parolni yangilash
  let newPass = "yangi_parol_789";
  let okConfirm = db.confirmPasswordReset(testEmail, resetReq.code, newPass);
  assert(okConfirm.success, "To'g'ri kod bilan parol muvaffaqiyatli yangilanishi kerak");

  // Yangi parol bilan tizimga kirish
  let loginCheck = db.loginUserWithEmail(testEmail, newPass);
  assert(loginCheck.success, "Yangi parol bilan muvaffaqiyatli kirish mumkin bo'lishi kerak");
  console.log("✓ Parolni tiklash va yangilash muvaffaqiyatli o'tdi!");

  // 5. AI KINEMATIK O'YIN REPLAY SHARHI GENERATSIYASI
  console.log("\n5. AI Kinematik Replay sharhi generatsiyasi sinovi:");
  const mockPlayers = [
    { id: 'p1', name: 'Alisher', role: 'mafia', isAlive: true },
    { id: 'p2', name: 'Bobur', role: 'doctor', isAlive: true },
    { id: 'p3', name: 'Sardor', role: 'detective', isAlive: false },
    { id: 'p4', name: 'Dilshod', role: 'citizen', isAlive: true }
  ];
  const mockState = {
    p1: { isAlive: true, role: 'mafia' },
    p2: { isAlive: true, role: 'doctor' },
    p3: { isAlive: false, role: 'detective' },
    p4: { isAlive: true, role: 'citizen' }
  };
  const mockHistory = [
    { event: 'night_kill', victim: 'Sardor', saved: false },
    { event: 'day_elimination', eliminated: 'Nodir', role: 'citizen' }
  ];

  const replayMoments = generateAIReplayMoments(
    { winner: 'mafia', reason: "Mafiya soni tenglashdi" },
    mockPlayers,
    mockState,
    mockHistory
  );

  assert(Array.isArray(replayMoments), "Replay lavhalari massiv bo'lishi kerak");
  assert.strictEqual(replayMoments.length, 5, "Replay aynan 5 ta kinematik kadrdan iborat bo'lishi kerak");
  replayMoments.forEach((m, idx) => {
    assert(m.title, `${idx}-kadr sarlavhaga ega bo'lishi kerak`);
    assert(m.narration, `${idx}-kadr AI sharhiga ega bo'lishi kerak`);
    assert(m.whyItMattered, `${idx}-kadr 'Nega muhim edi' tahliliga ega bo'lishi kerak`);
    assert(m.icon, `${idx}-kadr ramziy belgiga ega bo'lishi kerak`);
  });
  console.log("✓ AI Kinematik Replay (5 ta bosqichli tahlil) muvaffaqiyatli generatsiya qilindi!");

  // 6. DO'STLAR STATISTIKASINI SOLISHTIRISH (FRIEND COMPARISON)
  console.log("\n6. Do'stlar statistikasini solishtirish sinovi:");
  const user1 = db.getOrCreateUser(`test_cmp1_${ts}`, 'Jasur', 1);
  const user2 = db.getOrCreateUser(`test_cmp2_${ts}`, 'Temur', 2);

  // Statistika kiritish
  db.addGameStats(user1.id, true, 'mafia', { detectiveFoundMafia: true, doctorSavedPlayer: true });
  db.addGameStats(user2.id, false, 'citizen', {});

  const comp = db.getFriendComparison(user1.id, user2.id);
  assert(comp, "Solishtirish ma'lumotlari qaytishi kerak");
  assert.strictEqual(comp.me.nickname, 'Jasur', "Foydalanuvchi o'z nomi to'g'ri bo'lishi kerak");
  assert.strictEqual(comp.friend.nickname, 'Temur', "Do'st nomi to'g'ri bo'lishi kerak");
  assert(comp.me.games >= 1, "Foydalanuvchi o'yinlari ko'rinishi kerak");
  assert(comp.friend.games >= 1, "Do'st o'yinlari ko'rinishi kerak");
  assert(comp.diff, "Taqqoslash farqlari (diff) hisoblangan bo'lishi kerak");
  console.log("✓ Do'stlar statistikasini solishtirish muvaffaqiyatli tekshirildi!");

  console.log("\n==================================================================");
  console.log("🎉 BARCHA TO'LIQ SPETSIFIKATSIYA TESTLARI 100% MUVAFFAQIShI O'TDI!");
  console.log("==================================================================");
}

runTests().catch(err => {
  console.error("Testda xatolik yuz berdi:", err);
  process.exit(1);
});
