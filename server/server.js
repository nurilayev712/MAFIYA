require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const GameManager = require('./gameManager');
const db = require('./db');
const logger = require('./logger');
const { checkRateLimit, signToken, hashPassword, verifyPassword, securityHeadersMiddleware, httpsRedirectMiddleware } = require('./security');
const { analyzeChatMessage } = require('./chatFilter');
const adminRoutes = require('./adminRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Xavfsizlik middleware-lari (HTTPS redirect va Secure Headers)
app.use(httpsRedirectMiddleware);
app.use(securityHeadersMiddleware);

// Redis adapter gorizontal kengayish (multi-instance scaling) va kesh uchun:
let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    const { createClient } = require('redis');
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    redisClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect(), redisClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io Redis adapter va kesh muvaffaqiyatli ulandi (Horizontal Scaling faol)');
    }).catch(err => {
      logger.warn(`Redis adapterga ulanib bo'lmadi, in-memory adapter ishlatiladi: ${err.message}`);
      redisClient = null;
    });
  } catch (e) {
    logger.info('Redis paketi o\'rnatilmagan yoki yuklanmadi, standart xotira adapteri ishlatiladi.');
  }
}

const PORT = process.env.PORT || 7122;
const DISCONNECT_GRACE_SECONDS = parseInt(process.env.DISCONNECT_GRACE_SECONDS, 10) || 60;
const RATE_LIMIT_CHAT = parseInt(process.env.RATE_LIMIT_CHAT_PER_SEC, 10) || 4;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const gameManager = new GameManager(io);
const onlineUserIds = new Set();

// Admin API
app.use('/api/admin', adminRoutes(gameManager, io, onlineUserIds));

// Xonalar ro'yxati (Tomoshabinlar uchun ochiq API)
app.get('/api/rooms', (req, res) => {
  res.json({ success: true, rooms: gameManager.getPublicRoomsList() });
});

// Leaderboard API (Redis keshi bilan)
app.get('/api/leaderboard', async (req, res) => {
  try {
    if (redisClient && redisClient.isReady) {
      const cached = await redisClient.get('cache:leaderboard');
      if (cached) {
        return res.json({ success: true, leaderboard: JSON.parse(cached), cached: true });
      }
    }
  } catch (err) {
    logger.warn('Redis cache get error', { error: err.message });
  }

  const leaderboard = db.getLeaderboard(25);

  try {
    if (redisClient && redisClient.isReady) {
      await redisClient.setEx('cache:leaderboard', 30, JSON.stringify(leaderboard));
    }
  } catch (err) {
    logger.warn('Redis cache set error', { error: err.message });
  }

  res.json({ success: true, leaderboard, cached: false });
});

// Socket.io Ulanishlari
io.on('connection', (socket) => {
  let currentUserId = null;

  // 1. FOYDALANUVCHINI DB BILAN BOG'LASH & AUTH
  socket.on('init_user', ({ playerId, nickname, avatarIndex, telegramData }, callback) => {
    try {
      const id = playerId || `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // Ban tekshiruvi
      if (db.isUserBanned(id)) {
        socket.emit('user_banned', { reason: 'Sizning hisobingiz bloklangan.' });
        return callback && callback({ success: false, banned: true, message: 'Hisob bloklangan' });
      }

      currentUserId = id;
      onlineUserIds.add(id);
      socket.userId = id;

      const user = db.getOrCreateUser(id, nickname, avatarIndex, telegramData);
      const sessionToken = signToken({ userId: user.id, nickname: user.nickname });

      if (typeof callback === 'function') {
        callback({ success: true, user, token: sessionToken });
      }
    } catch (err) {
      logger.error('init_user error', err);
      if (callback) callback({ success: false });
    }
  });

  // 1.1 EMAIL VA PAROL RO'YXATDAN O'TISH
  socket.on('auth_register', ({ email, password, nickname, avatarIndex }, callback) => {
    try {
      if (!email || !password) {
        return callback && callback({ success: false, message: 'Email va parol kiritilishi shart!' });
      }
      if (password.length < 6) {
        return callback && callback({ success: false, message: 'Parol kamida 6 belgidan iborat bo\'lsin!' });
      }

      const pHash = hashPassword(password);
      const res = db.registerUserWithEmail(email, pHash, nickname, avatarIndex);
      if (!res.success) {
        return callback && callback(res);
      }

      currentUserId = res.user.id;
      onlineUserIds.add(res.user.id);
      socket.userId = res.user.id;
      const token = signToken({ userId: res.user.id, nickname: res.user.nickname, email: res.user.email });
      callback && callback({ success: true, user: res.user, token });
    } catch (err) {
      logger.error('auth_register error', err);
      callback && callback({ success: false, message: 'Ro\'yxatdan o\'tishda xatolik' });
    }
  });

  // 1.2 EMAIL VA PAROL BILAN KIRISH (LOGIN)
  socket.on('auth_login', ({ email, password }, callback) => {
    try {
      if (!email || !password) {
        return callback && callback({ success: false, message: 'Email va parolni kiriting!' });
      }

      const user = db.findUserByEmail(email);
      if (!user || !user.passwordHash) {
        return callback && callback({ success: false, message: 'Email yoki parol noto\'g\'ri!' });
      }

      if (db.isUserBanned(user.id)) {
        return callback && callback({ success: false, message: 'Hisobingiz bloklangan!' });
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return callback && callback({ success: false, message: 'Email yoki parol noto\'g\'ri!' });
      }

      currentUserId = user.id;
      onlineUserIds.add(user.id);
      socket.userId = user.id;
      const token = signToken({ userId: user.id, nickname: user.nickname, email: user.email });
      callback && callback({ success: true, user, token });
    } catch (err) {
      logger.error('auth_login error', err);
      callback && callback({ success: false, message: 'Kirishda xatolik' });
    }
  });

  // 1.3 GOOGLE OAUTH BIR BOSISHDA KIRISH
  socket.on('auth_google', ({ email, name, avatarIndex, googleId }, callback) => {
    try {
      if (!email) {
        return callback && callback({ success: false, message: 'Google akkaunt ma\'lumotlari topilmadi!' });
      }

      const user = db.googleLoginUser(email, name, avatarIndex, googleId);
      if (db.isUserBanned(user.id)) {
        return callback && callback({ success: false, message: 'Hisobingiz bloklangan!' });
      }

      currentUserId = user.id;
      onlineUserIds.add(user.id);
      socket.userId = user.id;
      const token = signToken({ userId: user.id, nickname: user.nickname, email: user.email });
      callback && callback({ success: true, user, token });
    } catch (err) {
      logger.error('auth_google error', err);
      callback && callback({ success: false, message: 'Google orqali kirishda xatolik' });
    }
  });

  // 2. PROFIL & REYTİNG
  socket.on('get_profile', ({ playerId }, callback) => {
    const user = db.getUser(playerId);
    if (callback) callback({ success: Boolean(user), user, achievementsDef: db.ACHIEVEMENTS_DEF });
  });

  socket.on('get_leaderboard', (callback) => {
    if (callback) callback({ success: true, leaderboard: db.getLeaderboard(25) });
  });

  // 3. DO'STLAR TIZIMI
  socket.on('get_friends', ({ playerId }, callback) => {
    const friends = db.getFriendsList(playerId, onlineUserIds);
    if (callback) callback({ success: true, friends });
  });

  socket.on('add_friend', ({ playerId, friendIdentifier }, callback) => {
    if (!checkRateLimit(`friend_${playerId}`, 3, 2)) {
      return callback && callback({ success: false, message: 'Iltimos, biroz kuting!' });
    }
    const res = db.addFriend(playerId, friendIdentifier);
    if (callback) callback(res);
  });

  socket.on('invite_friend', ({ friendId, roomCode, inviterName }) => {
    for (const [sId, s] of io.of("/").sockets) {
      if (s.userId === friendId) {
        s.emit('room_invitation', { roomCode, inviterName });
      }
    }
  });

  // 4. SHIKOYAT YUBORISH (REPORT USER)
  socket.on('report_user', ({ reporterId, reportedId, roomCode, reason, details }, callback) => {
    if (!checkRateLimit(`rep_${reporterId}`, 2, 5)) {
      return callback && callback({ success: false, message: 'Juda ko\'p shikoyat yuborildi!' });
    }
    const report = db.addReport(reporterId, reportedId, roomCode, reason, details);
    logger.warn('User reported', { reporterId, reportedId, roomCode, reason });
    if (callback) callback({ success: true, message: 'Shikoyatingiz qabul qilindi va moderatorlarga yuborildi.' });
  });

  // 5. MAXSUS PRESETLAR (CUSTOM ROLE PRESETS)
  socket.on('save_preset', ({ playerId, presetName, settings }, callback) => {
    const preset = db.saveCustomPreset(playerId, presetName, settings);
    if (callback) callback({ success: true, preset });
  });

  socket.on('get_presets', ({ playerId }, callback) => {
    const presets = db.getCustomPresets(playerId);
    if (callback) callback({ success: true, presets });
  });

  // 6. TOMOSHABIN (SPECTATOR) REJIMI
  socket.on('spectate_room', ({ roomCode }, callback) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) {
      return callback && callback({ success: false, message: 'Xona topilmadi!' });
    }

    room.addSpectator(socket.id);
    socket.join(room.code);

    if (callback) callback({ success: true, roomCode: room.code });
  });

  // 7. TASODIFIY XONAGA QO'SHILISH (GLOBAL MMR MATCHMAKING)
  socket.on('quick_match', ({ playerName, avatarIndex, playerId }, callback) => {
    try {
      const pId = playerId || `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      if (db.isUserBanned(pId)) {
        return callback && callback({ success: false, message: 'Hisob bloklangan!' });
      }

      currentUserId = pId;
      onlineUserIds.add(pId);
      socket.userId = pId;

      const user = db.getUser(pId);
      const userMmr = user?.mmr || 1000;
      const name = (playerName || user?.nickname || 'Mehmon').trim().substring(0, 15);

      // MMR ga eng mos ochiq xona
      const foundRoom = gameManager.findBestMatchRoom(userMmr);

      if (foundRoom) {
        const newPlayer = {
          id: pId,
          name,
          socketId: socket.id,
          isHost: false,
          isBot: false,
          avatarIndex: avatarIndex || 1,
          mmr: userMmr,
          isConnected: true
        };
        foundRoom.addPlayer(newPlayer);
        socket.join(foundRoom.code);

        if (callback) callback({ success: true, roomCode: foundRoom.code, playerId: pId, isNew: false });
        foundRoom.broadcastChatMessage({
          senderName: 'Tizim',
          text: `**${name}** (MMR: ${userMmr}) tasodifiy o'yin orqali qo'shildi!`,
          isSystem: true,
          scope: 'all'
        });
        foundRoom.broadcastRoomState();
      } else {
        const hostPlayer = {
          id: pId,
          name,
          socketId: socket.id,
          isHost: true,
          isBot: false,
          avatarIndex: avatarIndex || 1,
          mmr: userMmr,
          isConnected: true
        };
        const newRoom = gameManager.createRoom(hostPlayer, { isPublic: true });
        socket.join(newRoom.code);

        if (callback) callback({ success: true, roomCode: newRoom.code, playerId: pId, isNew: true });
        newRoom.broadcastRoomState();
      }
    } catch (err) {
      logger.error('quick_match error', err);
      if (callback) callback({ success: false, message: 'Xatolik yuz berdi.' });
    }
  });

  // 8. XONA YARATISH
  socket.on('create_room', ({ playerName, avatarIndex, isPublic, password, playerId }, callback) => {
    try {
      const pId = playerId || `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      if (db.isUserBanned(pId)) return callback && callback({ success: false, message: 'Hisob bloklangan!' });

      currentUserId = pId;
      onlineUserIds.add(pId);
      socket.userId = pId;

      const user = db.getUser(pId);
      const userMmr = user?.mmr || 1000;
      const name = (playerName || user?.nickname || 'Mehmon').trim().substring(0, 15);

      const hostPlayer = {
        id: pId,
        name,
        socketId: socket.id,
        isHost: true,
        isBot: false,
        avatarIndex: avatarIndex || 1,
        mmr: userMmr,
        isConnected: true
      };

      const room = gameManager.createRoom(hostPlayer, { isPublic, password });
      socket.join(room.code);

      if (callback) callback({ success: true, roomCode: room.code, playerId: pId });
      room.broadcastRoomState();
    } catch (err) {
      logger.error('create_room error', err);
      if (callback) callback({ success: false, message: 'Xona yaratishda xatolik yuz berdi.' });
    }
  });

  // 9. XONAGA QO'SHILISH
  socket.on('join_room', ({ roomCode, playerName, avatarIndex, password, playerId }, callback) => {
    try {
      const code = (roomCode || '').toUpperCase().trim();
      const room = gameManager.getRoom(code);

      if (!room) {
        return callback && callback({ success: false, message: 'Bunday kodli xona topilmadi!' });
      }

      if (room.phase !== 'lobby') {
        return callback && callback({ success: false, message: 'O\'yin boshlangan! Tomoshabin sifatida kiring.', canSpectate: true });
      }

      if (room.password && room.password !== password) {
        return callback && callback({ success: false, message: 'Xona paroli noto\'g\'ri!', needsPassword: true });
      }

      if (room.players.length >= 16) {
        return callback && callback({ success: false, message: 'Xonada maksimal o\'yinchilar soni (16) to\'lgan!' });
      }

      const pId = playerId || `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      if (db.isUserBanned(pId)) return callback && callback({ success: false, message: 'Hisob bloklangan!' });

      currentUserId = pId;
      onlineUserIds.add(pId);
      socket.userId = pId;

      const user = db.getUser(pId);
      const userMmr = user?.mmr || 1000;
      const name = (playerName || user?.nickname || 'Mehmon').trim().substring(0, 15);

      const newPlayer = {
        id: pId,
        name,
        socketId: socket.id,
        isHost: false,
        isBot: false,
        avatarIndex: avatarIndex || 1,
        mmr: userMmr,
        isConnected: true
      };

      room.addPlayer(newPlayer);
      socket.join(room.code);

      if (callback) callback({ success: true, roomCode: room.code, playerId: pId });

      room.broadcastChatMessage({
        senderName: 'Tizim',
        text: `**${name}** xonaga qo'shildi!`,
        isSystem: true,
        scope: 'all'
      });

      room.broadcastRoomState();
    } catch (err) {
      logger.error('join_room error', err);
      if (callback) callback({ success: false, message: 'Xonaga qo\'shilishda xatolik yuz berdi.' });
    }
  });

  // 10. QAYTA ULANISH (RECONNECT)
  socket.on('reconnect_session', ({ roomCode, playerId }, callback) => {
    try {
      const code = (roomCode || '').toUpperCase().trim();
      const room = gameManager.getRoom(code);

      if (!room) return callback && callback({ success: false, message: 'Xona mavjud emas.' });

      const player = room.getPlayer(playerId);
      if (!player) return callback && callback({ success: false, message: 'O\'yinchi topilmadi.' });

      currentUserId = player.id;
      onlineUserIds.add(player.id);
      socket.userId = player.id;

      room.reconnectPlayer(player.id, socket.id);
      socket.join(room.code);

      logger.info(`Player reconnected: ${player.name} (${code})`);

      if (callback) callback({ success: true, roomCode: room.code, playerId: player.id });

      socket.emit('chat_history', {
        messages: room.chatHistory.filter(m => {
          if (m.scope === 'mafia') return room.playersState[player.id]?.role === 'mafia';
          if (m.scope === 'ghost') return !room.playersState[player.id]?.isAlive;
          return true;
        })
      });

      room.broadcastRoomState();
    } catch (err) {
      logger.error('reconnect error', err);
      if (callback) callback({ success: false });
    }
  });

  // 11. XOST SOZLAMALARI
  socket.on('update_settings', ({ roomCode, settings }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player || !player.isHost) return;

    room.updateSettings(settings);
  });

  // 12. BOTLAR
  socket.on('add_bot', ({ roomCode }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player || !player.isHost) return;

    const bot = room.addBot();
    if (bot) {
      room.broadcastChatMessage({
        senderName: 'Tizim',
        text: `**${bot.name} (Bot)** lobbiga qo'shildi.`,
        isSystem: true,
        scope: 'all'
      });
    }
  });

  socket.on('remove_bot', ({ roomCode, botId }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player || !player.isHost) return;

    room.removeBot(botId);
  });

  // 13. O'YINNI BOSHLASH
  socket.on('start_game', ({ roomCode }, callback) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player || !player.isHost) {
      return callback && callback({ success: false, message: 'Faqat xost o\'yinni boshlashi mumkin!' });
    }

    const result = room.startGame();
    if (callback) callback(result);
  });

  // 14. TUNGI HARAKATLAR (SERVER-SIDE VALIDATION)
  socket.on('night_action', ({ roomCode, actionType, targetId }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room || room.phase !== 'night') {
      return socket.emit('action_error', { message: 'Tungi harakat faqat kechasi amalga oshiriladi.' });
    }
    const player = room.getPlayerBySocket(socket.id);
    if (!player) return;

    const state = room.playersState[player.id];
    if (!state || !state.isAlive) {
      return socket.emit('action_error', { message: 'O\'yindan chiqqan o\'yinchi harakat qila olmaydi.' });
    }

    let success = false;
    if (actionType === 'mafia_vote') {
      success = room.registerMafiaVote(player.id, targetId);
    } else if (actionType === 'maniac_kill') {
      success = room.registerManiacAction(player.id, targetId);
    } else if (actionType === 'doctor_heal') {
      success = room.registerDoctorAction(player.id, targetId);
    } else if (actionType === 'detective_investigate') {
      success = room.registerDetectiveAction(player.id, targetId);
    }

    if (!success) {
      socket.emit('action_error', { message: 'Harakat qabul qilinmadi (noto\'g\'ri rol, nishon yoki o\'zini tanlash taqiqlangan).' });
    }
  });

  // 15. KUNDUZGI OVOZ BERISH (SERVER-SIDE VALIDATION)
  socket.on('day_vote', ({ roomCode, targetId }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room || room.phase !== 'day_voting') {
      return socket.emit('action_error', { message: 'Ovoz berish faqat ovoz berish bosqichida mumkin.' });
    }
    const player = room.getPlayerBySocket(socket.id);
    if (!player) return;

    const state = room.playersState[player.id];
    if (!state || !state.isAlive) {
      return socket.emit('action_error', { message: 'O\'yindan chiqqan o\'yinchi ovoz bera olmaydi.' });
    }

    const success = room.registerVote(player.id, targetId);
    if (!success) {
      socket.emit('action_error', { message: 'Ovoz berish qabul qilinmadi.' });
    }
  });

  // 16. CHAT XABARI (ANTI-FLOOD & MODERATION)
  socket.on('send_chat', ({ roomCode, text, scope }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player) return;

    // 16.1 Ovozli cheklov (Mute) tekshiruvi
    if (db.isUserMuted(player.id)) {
      socket.emit('chat_rate_limited', { message: 'Siz qoidabuzarlik yoki moderator qarori bilan ovozsiz (mute) holatidasiz.' });
      return;
    }

    // 16.2 Rate Limiter (Anti-Flood)
    if (!checkRateLimit(`chat_${player.id}`, RATE_LIMIT_CHAT, 1)) {
      socket.emit('chat_rate_limited', { message: 'Xabarlar juda tez yuborilmoqda. Biroz kuting!' });
      return;
    }

    const cleanText = (text || '').trim();
    if (!cleanText || cleanText.length > 200) return;

    // 16.3 Nomaqbul so'zlar tahlili va avtomatik chora
    const analysis = analyzeChatMessage(cleanText);
    if (analysis.hasAbuse) {
      if (!room.abuseWarnings) room.abuseWarnings = {};
      room.abuseWarnings[player.id] = (room.abuseWarnings[player.id] || 0) + 1;

      if (room.abuseWarnings[player.id] >= 3) {
        db.muteUser(player.id, 1, 'Avtomatik filtr: Nomaqbul so\'zlar (3 marta)');
        db.addReport('system', player.id, roomCode, 'Avtomatik filtr: Nomaqbul so\'zlar', analysis.matches.join(', '));
        socket.emit('user_muted', {
          durationMinutes: 1,
          reason: 'Ketma-ket nomaqbul so\'zlar ishlatilgani sababli 1 daqiqaga ovozsiz rejimga olindingiz!'
        });
        room.broadcastChatMessage({
          senderName: 'Tizim',
          text: `⚠️ **${player.name}** nomaqbul so'zlar ishlatgani uchun 1 daqiqaga avtomatik sukutga olindi.`,
          isSystem: true,
          scope: 'all'
        });
        return;
      }
    }

    const state = room.playersState[player.id];
    const isAlive = state ? state.isAlive : true;

    if (scope === 'ghost' || !isAlive) {
      if (!isAlive && room.phase !== 'lobby') {
        room.broadcastChatMessage({
          senderId: player.id,
          senderName: `👻 ${player.name} (Arvoh)`,
          text: analysis.cleaned,
          isSystem: false,
          scope: 'ghost'
        });
        return;
      }
    }

    if (room.phase === 'night') {
      if (scope === 'mafia' && state && state.role === 'mafia' && isAlive) {
        room.broadcastChatMessage({
          senderId: player.id,
          senderName: player.name,
          text: analysis.cleaned,
          isSystem: false,
          scope: 'mafia'
        });
      }
      return;
    }

    if (room.phase === 'day_discussion' || room.phase === 'day_voting' || room.phase === 'lobby') {
      room.broadcastChatMessage({
        senderId: player.id,
        senderName: player.name,
        text: analysis.cleaned,
        isSystem: false,
        scope: 'all'
      });
    }
  });

  // 16.1 TYPING INDIKATORI (FOYDALANUVCHILAR UCHUN)
  socket.on('typing_status', ({ roomCode, isTyping }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player) return;

    socket.to(roomCode).emit('player_typing', {
      playerId: player.id,
      playerName: player.name,
      isTyping
    });
  });

  // 17. EMOJI REAKSIYALARI
  socket.on('send_reaction', ({ roomCode, targetId, emoji }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player) return;

    if (!checkRateLimit(`react_${player.id}`, 3, 2)) return;

    room.sendReaction(player.id, player.name, targetId, emoji);
  });

  // 18. YANA O'YNASH
  socket.on('restart_game', ({ roomCode }) => {
    const room = gameManager.getRoom(roomCode);
    if (!room) return;
    const player = room.getPlayerBySocket(socket.id);
    if (!player || !player.isHost) return;

    room.restartToLobby();
  });

  // 19. ALOQA UZILISHI (DISCONNECT GRACE PERIOD & BOT REPLACEMENT)
  socket.on('disconnect', () => {
    if (currentUserId) {
      onlineUserIds.delete(currentUserId);
    }

    const found = gameManager.getRoomBySocket(socket.id);
    if (found) {
      const { room, player, isSpectator } = found;
      if (isSpectator) {
        room.removeSpectator(socket.id);
      } else if (player) {
        // Disconnect grace period (60 soniya kutish, so'ng bot almashtiradi)
        room.handlePlayerDisconnect(socket.id, DISCONNECT_GRACE_SECONDS);
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`MAFIYA Enterprise Server running on port ${PORT}`);
  console.log(`=======================================================`);
  console.log(`  MAFIYA Production Server ishga tushdi:`);
  console.log(`  Local: http://localhost:${PORT}`);
  console.log(`  Admin: http://localhost:${PORT}#admin`);
  console.log(`=======================================================`);
});
