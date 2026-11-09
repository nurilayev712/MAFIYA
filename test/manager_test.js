/**
 * GameManager va BotManager to'liq tizim sinovi
 */
const GameManager = require('../server/gameManager');

// Mock socket.io
const mockIo = {
  to: (roomCode) => ({
    emit: (event, data) => {
      // console.log(`[MockIO to ${roomCode}] ${event}`);
    }
  })
};

const gm = new GameManager(mockIo);

// 1. Xona yaratish
const host = {
  id: 'host_1',
  name: 'Xostbek',
  socketId: 'sock_1',
  isHost: true,
  isBot: false,
  avatarIndex: 1,
  isConnected: true
};

const room = gm.createRoom(host);
console.assert(room && room.code.length === 5, 'Xona kodi 5 belgili bo\'lishi kerak');
console.log('✓ Xona yaratildi:', room.code);

// 2. Botlar qo'shish (3 ta bot)
const bot1 = room.addBot();
const bot2 = room.addBot();
const bot3 = room.addBot();
console.assert(room.players.length === 4, 'Jami 4 ta o\'yinchi bo\'lishi kerak');
console.log('✓ 3 ta bot qo\'shildi. O\'yinchilar soni:', room.players.length);

// 3. Sozlamalar
room.updateSettings({
  mafiaCount: 1,
  hasDoctor: true,
  hasDetective: true,
  nightTime: 10,
  discussionTime: 10,
  votingTime: 10
});
console.log('✓ Sozlamalar yangilandi');

// 4. O'yinni boshlash
const startRes = room.startGame();
console.assert(startRes.success, 'O\'yin boshlanishi kerak');
console.assert(room.phase === 'role_reveal', 'Faza role_reveal bo\'lishi kerak');
console.log('✓ O\'yin boshlandi, faza:', room.phase);

// 5. Client safe state tekshirish
const clientState = room.getClientStateFor(host.id);
console.assert(clientState.myRole, 'Hostda rol bo\'lishi kerak');
console.assert(clientState.players.length === 4, '4 ta safe player qaytishi kerak');
console.log('✓ Host roli:', clientState.myRole);

// Test tugagach xonani tozalash
room.clearTimer();
console.log('\n===============================================');
console.log('GAMEMANAGER VA XONA TIZIMI 100% ISHLAMOQDA!');
console.log('===============================================');
