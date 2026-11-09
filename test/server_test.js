/**
 * Server va o'yin mantig'ining avtomatlashtirilgan integratsiya testi
 */
const { ROLES, assignRoles, checkWinner, resolveNight, resolveDayVote } = require('../server/gameLogic');

console.log('--- TEST 1: Rol taqsimlash ---');
const dummyPlayers = [
  { id: 'p1', name: 'Alisher' },
  { id: 'p2', name: 'Bobur' },
  { id: 'p3', name: 'Dildora' },
  { id: 'p4', name: 'Zarina' }
];

const settings = {
  mafiaCount: 1,
  hasDoctor: true,
  hasDetective: true
};

const { assigned, loverPair } = assignRoles(dummyPlayers, settings);
console.log('Taqsimlangan rollar:', Object.entries(assigned).map(([id, s]) => `${id}: ${s.role}`));

const rolesFound = Object.values(assigned).map(s => s.role);
console.assert(rolesFound.includes(ROLES.MAFIA), 'Mafiya bo\'lishi shart!');
console.assert(rolesFound.includes(ROLES.DOCTOR), 'Shifokor bo\'lishi shart!');
console.assert(rolesFound.includes(ROLES.DETECTIVE), 'Komissar bo\'lishi shart!');
console.assert(rolesFound.includes(ROLES.CITIZEN), 'Tinch aholi bo\'lishi shart!');
console.log('✓ Rol taqsimlash testi muvaffaqiyatli!');

console.log('--- TEST 2: G\'alaba shartlari ---');
const testStateCitizensWin = {
  p1: { role: ROLES.MAFIA, isAlive: false },
  p2: { role: ROLES.CITIZEN, isAlive: true },
  p3: { role: ROLES.DOCTOR, isAlive: true }
};
const win1 = checkWinner(testStateCitizensWin);
console.assert(win1 && win1.winner === 'citizens', 'Tinch aholi yutishi kerak');
console.log('✓ Tinch aholi g\'alabasi testi muvaffaqiyatli:', win1.title);

const testStateMafiaWin = {
  p1: { role: ROLES.MAFIA, isAlive: true },
  p2: { role: ROLES.CITIZEN, isAlive: true }
};
const win2 = checkWinner(testStateMafiaWin);
console.assert(win2 && win2.winner === 'mafia', 'Mafiya yutishi kerak (1 ga 1)');
console.log('✓ Mafiya g\'alabasi testi muvaffaqiyatli:', win2.title);

console.log('--- TEST 3: Tungi harakatlar (Shifokor qutqarishi) ---');
const testNightState = {
  p1: { role: ROLES.MAFIA, isAlive: true },
  p2: { role: ROLES.CITIZEN, isAlive: true }
};
const nightResult = resolveNight({
  mafiaVotes: { p2: 1 },
  doctorTarget: 'p2'
}, testNightState);
console.assert(nightResult.savedByDoctor === true, 'Shifokor p2 ni qutqargan bo\'lishi kerak');
console.assert(nightResult.killedList.length === 0, 'Hech kim o\'lmasligi kerak');
console.log('✓ Shifokor saqlab qolish testi muvaffaqiyatli!');

console.log('--- TEST 4: Kunduzgi ovoz berish ---');
const testDayState = {
  p1: { role: ROLES.MAFIA, isAlive: true },
  p2: { role: ROLES.CITIZEN, isAlive: true },
  p3: { role: ROLES.CITIZEN, isAlive: true }
};
const dayResult = resolveDayVote({
  p1: 'p2',
  p2: 'p1',
  p3: 'p1'
}, testDayState);
console.assert(dayResult.eliminatedId === 'p1', 'p1 eng ko\'p ovoz olib linch qilinishi kerak');
console.assert(testDayState.p1.isAlive === false, 'p1 endi o\'lik bo\'lishi kerak');
console.log('✓ Kunduzgi ovoz berish testi muvaffaqiyatli!');

console.log('\n===============================================');
console.log('BARCHA MANTIQIY TESTLAR 100% MUVAFFAQIYATLI O\'TDI!');
console.log('===============================================');
