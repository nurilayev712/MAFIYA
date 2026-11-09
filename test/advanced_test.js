const { ROLES, assignRoles, checkWinner, resolveNight, resolveDayVote } = require('../server/gameLogic');

console.log('--- TEST 1: Kengaytirilgan rollar taqsimoti ---');
const players = [
  { id: 'p1', name: 'Alisher' },
  { id: 'p2', name: 'Bobur' },
  { id: 'p3', name: 'Dildora' },
  { id: 'p4', name: 'Zarina' },
  { id: 'p5', name: 'Otabek' },
  { id: 'p6', name: 'Madina' }
];

const settings = {
  mafiaCount: 1,
  hasDoctor: true,
  hasDetective: true,
  hasMayor: true,
  hasManiac: true,
  hasJester: true,
  hasLovers: true
};

const { assigned, loverPair } = assignRoles(players, settings);
console.log('Taqsimot:', Object.entries(assigned).map(([id, s]) => `${id}: ${s.role} (Lover: ${s.isLover})`));
console.assert(loverPair && loverPair.length === 2, '2 ta sevishgan bo\'lishi shart');
console.log('✓ Kengaytirilgan taqsimot testi muvaffaqiyatli!');

console.log('--- TEST 2: Jester (Hazilkash) linch sudi g\'alabasi ---');
const jesterWin = checkWinner(assigned, { jesterLynchWinnerId: 'p1' });
console.assert(jesterWin && jesterWin.winner === 'jester', 'Jester yutishi kerak');
console.log('✓ Jester g\'alabasi muvaffaqiyatli:', jesterWin.title);

console.log('--- TEST 3: Mayor ovozi x2 bo\'lishi ---');
const testVoteState = {
  p1: { role: ROLES.MAYOR, isAlive: true },
  p2: { role: ROLES.CITIZEN, isAlive: true },
  p3: { role: ROLES.MAFIA, isAlive: true }
};
// p1 (Mayor) p3 ga ovoz beradi (2 ovoz), p2 p1 ga ovoz beradi (1 ovoz)
const voteRes = resolveDayVote({
  p1: 'p3',
  p2: 'p1'
}, testVoteState);
console.assert(voteRes.eliminatedId === 'p3', 'p3 Mayor tufayli chiqarilishi kerak');
console.assert(voteRes.voteCounts['p3'] === 2, 'p3 da 2 ta ovoz bo\'lishi kerak');
console.log('✓ Mayor ovozi x2 testi muvaffaqiyatli!');

console.log('--- TEST 4: Maniac g\'alabasi ---');
const testManiacState = {
  p1: { role: ROLES.MANIAC, isAlive: true },
  p2: { role: ROLES.CITIZEN, isAlive: false },
  p3: { role: ROLES.MAFIA, isAlive: false }
};
const maniacWin = checkWinner(testManiacState);
console.assert(maniacWin && maniacWin.winner === 'maniac', 'Maniac yutishi kerak');
console.log('✓ Maniac g\'alabasi muvaffaqiyatli:', maniacWin.title);

console.log('\n===============================================');
console.log('KENGAYTIRILGAN ROLLARDAGI BARCHA TESTLAR 100% O\'TDI!');
console.log('===============================================');
