/**
 * Production-Ready GameManager — Zero Client Trust, Disconnect Grace Period & Bot Takeover, Spectator Mode
 */
const { ROLES, ROLE_INFO, PHASES, assignRoles, checkWinner, resolveNight, resolveDayVote } = require('./gameLogic');
const BotManager = require('./botManager');
const db = require('./db');
const logger = require('./logger');
const { filterChatMessage } = require('./chatFilter');

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

class Room {
  constructor(code, hostPlayer, io, options = {}) {
    this.code = code;
    this.hostId = hostPlayer.id;
    this.io = io;
    this.players = [hostPlayer];
    this.spectators = new Set(); // socketId set
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.isPublic = options.isPublic !== false;
    this.password = options.password || '';
    this.avgMmr = hostPlayer.mmr || 1000;

    this.settings = {
      mafiaCount: 1,
      hasDoctor: true,
      hasDetective: true,
      hasMayor: false,
      hasManiac: false,
      hasJester: false,
      hasLovers: false,
      autoFillBots: true,
      botDifficulty: 'medium', // 'easy' | 'medium' | 'hard'
      revealBotsAtEnd: true,
      nightTime: 30,
      discussionTime: 60,
      votingTime: 30
    };

    this.playersState = {};
    this.loverPair = null;
    this.nightActions = {
      mafiaVotes: {},
      mafiaVoterPicks: {},
      maniacTarget: null,
      doctorTarget: null,
      detectiveTarget: null,
      detectiveResult: null
    };
    this.votes = {};
    this.chatHistory = [];
    this.timer = null;
    this.timeLeft = 0;
    this.winner = null;
    this.lastNightResult = null;
    this.lastLynchResult = null;

    // Disconnect grace timers
    this.disconnectTimers = new Map(); // playerId -> Timeout

    this.botManager = new BotManager(this);
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  getPlayerBySocket(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  addPlayer(player) {
    const existing = this.getPlayer(player.id);
    if (existing) {
      existing.socketId = player.socketId;
      existing.isConnected = true;
      existing.name = player.name || existing.name;

      // Agar disconnect taymeri bo'lsa, to'xtatish
      if (this.disconnectTimers.has(player.id)) {
        clearTimeout(this.disconnectTimers.get(player.id));
        this.disconnectTimers.delete(player.id);
        logger.info(`Player reconnected within grace period: ${player.name} (${this.code})`);
      }

      return existing;
    }

    this.players.push(player);
    this.recalculateAvgMmr();
    this.autoAdjustRoles();
    this.broadcastRoomState();
    return player;
  }

  reconnectPlayer(playerId, newSocketId) {
    const player = this.getPlayer(playerId);
    if (!player) return null;
    player.socketId = newSocketId;
    player.isConnected = true;
    if (this.disconnectTimers.has(playerId)) {
      clearTimeout(this.disconnectTimers.get(playerId));
      this.disconnectTimers.delete(playerId);
      logger.info(`Player reconnected within grace period: ${player.name} (${this.code})`);
    }
    return player;
  }

  addSpectator(socketId) {
    this.spectators.add(socketId);
    // Tomoshabinga xavfsiz holatni yuborish
    const safeState = this.getClientStateFor(null, true);
    this.io.to(socketId).emit('room_state_update', safeState);
  }

  removeSpectator(socketId) {
    this.spectators.delete(socketId);
  }

  removePlayer(playerId) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      const removed = this.players.splice(idx, 1)[0];
      if (this.playersState[playerId]) {
        this.playersState[playerId].isAlive = false;
        this.playersState[playerId].killedBy = 'disconnect';
      }

      if (removed.isHost && this.players.length > 0) {
        const newHost = this.players.find(p => !p.isBot) || this.players[0];
        newHost.isHost = true;
        this.hostId = newHost.id;
      }

      this.recalculateAvgMmr();
      this.autoAdjustRoles();
      this.broadcastRoomState();

      if (this.phase !== PHASES.LOBBY && this.phase !== PHASES.GAME_OVER) {
        this.checkWinConditions();
      }
    }
  }

  handlePlayerDisconnect(socketId, graceSeconds = 60) {
    const player = this.getPlayerBySocket(socketId);
    if (!player) return;

    player.isConnected = false;
    this.broadcastRoomState();

    if (this.phase === PHASES.LOBBY) {
      // Lobbi holatida oddiy o'yinchi bo'lsa darhol chiqaramiz
      this.removePlayer(player.id);
      return;
    }

    // O'yin davomida bo'lsa: 60 soniya kutish taymeri (Grace Period)
    logger.info(`Disconnect grace period started for ${player.name} (60s) in room ${this.code}`);

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(player.id);
      if (!player.isConnected && this.playersState[player.id]?.isAlive) {
        // 60 soniyada qaytmadi: Bot almashtiradi (Bot Takeover)
        this.replaceWithBot(player);
      }
    }, graceSeconds * 1000);

    this.disconnectTimers.set(player.id, timer);
  }

  replaceWithBot(player) {
    logger.info(`Player ${player.name} timed out. Replaced by Bot in room ${this.code}`);
    player.isBot = true;
    player.name = `${player.name} (Bot)`;

    this.broadcastChatMessage({
      senderName: 'Tizim',
      text: `**${player.name}** aloqaga qaytmadi. Uning o'rnini aqlli Bot egalladi!`,
      isSystem: true,
      scope: 'all'
    });

    this.broadcastRoomState();

    // Agar hozir harakat fazasi bo'lsa, bot harakatini chaqirish
    if (this.phase === PHASES.NIGHT) {
      this.botManager.handleNightPhase();
    } else if (this.phase === PHASES.DAY_VOTING) {
      this.botManager.handleDayVoting();
    }
  }

  recalculateAvgMmr() {
    const realPlayers = this.players.filter(p => !p.isBot);
    if (realPlayers.length === 0) {
      this.avgMmr = 1000;
      return;
    }
    const sum = realPlayers.reduce((acc, p) => acc + (p.mmr || 1000), 0);
    this.avgMmr = Math.round(sum / realPlayers.length);
  }

  autoAdjustRoles() {
    const count = this.players.length;
    const maxMafia = Math.max(1, Math.floor((count - 1) / 2));
    if (this.settings.mafiaCount > maxMafia) this.settings.mafiaCount = maxMafia;
    if (this.settings.mafiaCount < 1) this.settings.mafiaCount = 1;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.isPublic !== undefined) this.isPublic = newSettings.isPublic;
    if (newSettings.password !== undefined) this.password = newSettings.password;

    this.autoAdjustRoles();
    this.broadcastRoomState();
  }

  addBot() {
    if (this.players.length >= 16) return null;
    const bot = this.botManager.createBot();
    this.players.push(bot);
    this.autoAdjustRoles();
    this.broadcastRoomState();
    return bot;
  }

  removeBot(botId) {
    const idx = this.players.findIndex(p => p.id === botId && p.isBot);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      this.autoAdjustRoles();
      this.broadcastRoomState();
      return true;
    }
    return false;
  }

  startGame() {
    // Agar o'yinchilar yetarli bo'lmasa va autoFillBots yoqilgan bo'lsa, avtomatik botlar qo'shish
    if (this.settings.autoFillBots !== false && this.players.length < 4) {
      const needed = 4 - this.players.length;
      for (let i = 0; i < needed; i++) {
        this.addBot();
      }
    }

    if (this.players.length < 3) {
      return { success: false, message: 'O\'yinni boshlash uchun kamida 3 nafar o\'yinchi kerak!' };
    }

    this.round = 1;
    this.winner = null;
    this.lastNightResult = null;
    this.lastLynchResult = null;
    this.chatHistory = [];

    const { assigned, loverPair } = assignRoles(this.players, this.settings);
    this.playersState = assigned;
    this.loverPair = loverPair;

    this.setPhase(PHASES.ROLE_REVEAL, 6, () => {
      this.startNightPhase();
    });

    this.broadcastChatMessage({
      senderName: 'Tizim',
      text: 'O\'yin boshlandi! Barcha o\'yinchilarga maxfiy rollar taqsimlandi.',
      isSystem: true,
      scope: 'all'
    });

    return { success: true };
  }

  startNightPhase() {
    this.setPhase(PHASES.NIGHT, this.settings.nightTime, () => {
      this.endNightPhase();
    });

    this.nightActions = {
      mafiaVotes: {},
      mafiaVoterPicks: {},
      maniacTarget: null,
      doctorTarget: null,
      detectiveTarget: null,
      detectiveResult: null
    };

    this.broadcastChatMessage({
      senderName: 'Tizim',
      text: `Tun kirdi (${this.round}-kecha). Shahar sokin uyquga ketdi...`,
      isSystem: true,
      scope: 'all'
    });

    this.botManager.handleNightPhase();
  }

  registerMafiaVote(voterId, targetId) {
    if (this.phase !== PHASES.NIGHT) return false;
    const voterState = this.playersState[voterId];
    if (!voterState || voterState.role !== ROLES.MAFIA || !voterState.isAlive) return false;

    if (targetId && (!this.playersState[targetId] || !this.playersState[targetId].isAlive)) {
      return false;
    }

    this.nightActions.mafiaVoterPicks[voterId] = targetId;

    const votes = {};
    Object.values(this.nightActions.mafiaVoterPicks).forEach(tid => {
      if (tid) votes[tid] = (votes[tid] || 0) + 1;
    });
    this.nightActions.mafiaVotes = votes;

    this.sendMafiaUpdate();
    this.checkFastForwardNight();
    return true;
  }

  registerManiacAction(maniacId, targetId) {
    if (this.phase !== PHASES.NIGHT) return false;
    const manState = this.playersState[maniacId];
    if (!manState || manState.role !== ROLES.MANIAC || !manState.isAlive) return false;

    // Manyak o'zini o'zi nishonga ololmaydi
    if (!targetId || targetId === maniacId || !this.playersState[targetId] || !this.playersState[targetId].isAlive) {
      return false;
    }

    this.nightActions.maniacTarget = targetId;
    this.checkFastForwardNight();
    return true;
  }

  registerDoctorAction(doctorId, targetId) {
    if (this.phase !== PHASES.NIGHT) return false;
    const docState = this.playersState[doctorId];
    if (!docState || docState.role !== ROLES.DOCTOR || !docState.isAlive) return false;

    if (targetId && (!this.playersState[targetId] || !this.playersState[targetId].isAlive)) {
      return false;
    }

    this.nightActions.doctorTarget = targetId;
    const player = this.getPlayer(doctorId);
    if (player && player.socketId) {
      this.io.to(player.socketId).emit('doctor_action_confirmed', { targetId });
    }

    this.checkFastForwardNight();
    return true;
  }

  registerDetectiveAction(detectiveId, targetId) {
    if (this.phase !== PHASES.NIGHT) return false;
    const detState = this.playersState[detectiveId];
    if (!detState || detState.role !== ROLES.DETECTIVE || !detState.isAlive) return false;

    // Komissar o'zini o'zi tekshira olmaydi
    if (!targetId || targetId === detectiveId || !this.playersState[targetId] || !this.playersState[targetId].isAlive) {
      return false;
    }

    this.nightActions.detectiveTarget = targetId;
    const targetState = this.playersState[targetId];
    const isMafia = targetState.role === ROLES.MAFIA;
    const targetPlayer = this.getPlayer(targetId);

    const result = {
      targetId,
      targetName: targetPlayer ? targetPlayer.name : 'Noma\'lum',
      isMafia
    };
    this.nightActions.detectiveResult = result;

    const player = this.getPlayer(detectiveId);
    if (player && player.socketId) {
      this.io.to(player.socketId).emit('detective_result', result);
    }

    this.checkFastForwardNight();
    return true;
  }

  sendMafiaUpdate() {
    const mafiaPlayers = this.players.filter(p => this.playersState[p.id]?.role === ROLES.MAFIA);
    mafiaPlayers.forEach(p => {
      if (p.socketId) {
        this.io.to(p.socketId).emit('mafia_night_update', {
          voterPicks: this.nightActions.mafiaVoterPicks,
          votes: this.nightActions.mafiaVotes
        });
      }
    });
  }

  checkFastForwardNight() {
    if (this.phase !== PHASES.NIGHT) return;

    const aliveMafia = this.players.filter(p => this.playersState[p.id]?.isAlive && this.playersState[p.id]?.role === ROLES.MAFIA);
    const aliveManiac = this.players.filter(p => this.playersState[p.id]?.isAlive && this.playersState[p.id]?.role === ROLES.MANIAC);
    const aliveDoctor = this.players.filter(p => this.playersState[p.id]?.isAlive && this.playersState[p.id]?.role === ROLES.DOCTOR);
    const aliveDetective = this.players.filter(p => this.playersState[p.id]?.isAlive && this.playersState[p.id]?.role === ROLES.DETECTIVE);

    const mafiaDone = aliveMafia.length === 0 || aliveMafia.every(m => Boolean(this.nightActions.mafiaVoterPicks[m.id]));
    const maniacDone = aliveManiac.length === 0 || Boolean(this.nightActions.maniacTarget);
    const doctorDone = aliveDoctor.length === 0 || Boolean(this.nightActions.doctorTarget);
    const detectiveDone = aliveDetective.length === 0 || Boolean(this.nightActions.detectiveTarget);

    if (mafiaDone && maniacDone && doctorDone && detectiveDone) {
      if (this.timeLeft > 2) {
        this.clearTimer();
        this.timeLeft = 2;
        this.startTimer(() => this.endNightPhase());
      }
    }
  }

  endNightPhase() {
    const result = resolveNight(this.nightActions, this.playersState);
    this.lastNightResult = result;

    let announceText = '';
    if (result.killedList.length > 0) {
      const names = result.killedList.map(k => {
        const p = this.getPlayer(k.id);
        const reason = k.by === 'broken_heart' ? '(singan yurak tufayli)' : (k.by === 'maniac' ? '(qotil qurboni)' : '');
        return `**${p ? p.name : 'Kimdir'}** ${reason}`;
      });
      announceText = `Qonli tong... Qurbonlar: ${names.join(', ')}!`;
    } else if (result.savedByDoctor) {
      announceText = `Xushxabar! Shifokor ushbu kecha fuqaroni o'limdan qutqarib qoldi!`;
    } else {
      announceText = `Sokin tun... Hech kim qurbon bo'lmadi.`;
    }

    this.broadcastChatMessage({
      senderName: 'Tizim',
      text: announceText,
      isSystem: true,
      scope: 'all'
    });

    if (this.checkWinConditions()) return;

    this.setPhase(PHASES.DAY_ANNOUNCE, 6, () => {
      this.startDayDiscussion();
    });
  }

  startDayDiscussion() {
    this.setPhase(PHASES.DAY_DISCUSSION, this.settings.discussionTime, () => {
      this.startDayVoting();
    });

    this.broadcastChatMessage({
      senderName: 'Tizim',
      text: `Kun yorishdi (${this.round}-kun). Fuqarolar maydonga yig'ildi. Muhokamani boshlang!`,
      isSystem: true,
      scope: 'all'
    });

    this.botManager.handleDayDiscussion();
  }

  startDayVoting() {
    this.votes = {};
    this.setPhase(PHASES.DAY_VOTING, this.settings.votingTime, () => {
      this.endDayVoting();
    });

    this.broadcastChatMessage({
      senderName: 'Tizim',
      text: `Ovoz berish boshlandi! Shubhali shaxsni tanlang yoki Skip qiling.`,
      isSystem: true,
      scope: 'all'
    });

    this.botManager.handleDayVoting();
  }

  registerVote(voterId, targetId) {
    if (this.phase !== PHASES.DAY_VOTING) return false;
    const voterState = this.playersState[voterId];
    if (!voterState || !voterState.isAlive) return false;

    if (targetId !== 'skip') {
      if (!this.playersState[targetId] || !this.playersState[targetId].isAlive) {
        return false;
      }
    }

    this.votes[voterId] = targetId;
    this.broadcastVoteUpdate();

    const alivePlayers = this.players.filter(p => this.playersState[p.id]?.isAlive);
    const allVoted = alivePlayers.every(p => Boolean(this.votes[p.id]));

    if (allVoted && this.timeLeft > 2) {
      this.clearTimer();
      this.timeLeft = 2;
      this.startTimer(() => this.endDayVoting());
    }

    return true;
  }

  broadcastVoteUpdate() {
    this.io.to(this.code).emit('day_vote_update', {
      votes: this.votes
    });
  }

  endDayVoting() {
    const result = resolveDayVote(this.votes, this.playersState);
    this.lastLynchResult = result;

    if (result.eliminatedId && result.role === ROLES.JESTER) {
      const elimPlayer = this.getPlayer(result.eliminatedId);
      this.broadcastChatMessage({
        senderName: 'Tizim',
        text: `**${elimPlayer ? elimPlayer.name : 'Kimdir'}** shahar tomonidan osildi! Uning roli **JESTER** edi!`,
        isSystem: true,
        scope: 'all'
      });
      this.checkWinConditions({ jesterLynchWinnerId: result.eliminatedId });
      return;
    }

    let announceText = '';
    if (result.eliminatedId) {
      const eliminatedPlayer = this.getPlayer(result.eliminatedId);
      const roleName = ROLE_INFO[result.role]?.name || result.role;
      announceText = `Shahar qarori bilan **${eliminatedPlayer ? eliminatedPlayer.name : 'Kimdir'}** chiqarildi! Haqiqiy roli: **${roleName}** edi!`;

      if (result.loverDiedId) {
        const loverPlayer = this.getPlayer(result.loverDiedId);
        announceText += ` Sevishgani halok bo'lgani sababli **${loverPlayer ? loverPlayer.name : 'Sevishgan'}** ham vafot etdi!`;
      }
    } else if (result.isTie) {
      announceText = `Ovozlar teng keldi! Hech kim jazoga tortilmadi.`;
    } else {
      announceText = `Ko'pchilik ovoz berishni o'tkazib yubordi (Skip). Hech kim chiqarilmadi.`;
    }

    this.broadcastChatMessage({
      senderName: 'Tizim',
      text: announceText,
      isSystem: true,
      scope: 'all'
    });

    if (this.checkWinConditions()) return;

    this.round++;
    this.setPhase(PHASES.DAY_ANNOUNCE, 5, () => {
      this.startNightPhase();
    });
  }

  checkWinConditions(context = {}) {
    const winResult = checkWinner(this.playersState, context);
    if (winResult) {
      this.winner = winResult;
      this.setPhase(PHASES.GAME_OVER, 0, null);

      this.broadcastChatMessage({
        senderName: 'Tizim',
        text: `O'yin yakunlandi! ${winResult.title} - ${winResult.reason}`,
        isSystem: true,
        scope: 'all'
      });

      this.saveGameResultsToDB(winResult);
      return true;
    }
    return false;
  }

  saveGameResultsToDB(winResult) {
    this.players.forEach(p => {
      if (p.isBot) return;
      const state = this.playersState[p.id];
      if (!state) return;

      let won = false;
      if (winResult.winner === 'mafia' && state.role === ROLES.MAFIA) won = true;
      else if (winResult.winner === 'citizens' && (state.role === ROLES.CITIZEN || state.role === ROLES.DOCTOR || state.role === ROLES.DETECTIVE || state.role === ROLES.MAYOR)) won = true;
      else if (winResult.winner === 'maniac' && state.role === ROLES.MANIAC) won = true;
      else if (winResult.winner === 'jester' && p.id === winResult.winnerPlayerId) won = true;
      else if (winResult.winner === 'lovers' && state.isLover) won = true;

      const roleAchievements = {
        loversSurvived: winResult.winner === 'lovers' && state.isLover
      };

      const unlocked = db.addGameStats(p.id, { role: state.role, won, roleAchievements });
      if (unlocked && unlocked.length > 0 && p.socketId) {
        this.io.to(p.socketId).emit('achievements_unlocked', unlocked);
      }
    });

    this.recalculateAvgMmr();
  }

  restartToLobby() {
    this.clearTimer();
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.winner = null;
    this.playersState = {};
    this.loverPair = null;
    this.nightActions = {
      mafiaVotes: {},
      mafiaVoterPicks: {},
      maniacTarget: null,
      doctorTarget: null,
      detectiveTarget: null,
      detectiveResult: null
    };
    this.votes = {};
    this.chatHistory = [];
    this.lastNightResult = null;
    this.lastLynchResult = null;

    this.broadcastChatMessage({
      senderName: 'Tizim',
      text: 'O\'yin qayta boshlandi, barcha o\'yinchilar lobbiga qaytarildi.',
      isSystem: true,
      scope: 'all'
    });

    this.broadcastRoomState();
  }

  setPhase(phase, durationSeconds, onComplete) {
    this.clearTimer();
    this.phase = phase;
    this.timeLeft = durationSeconds;

    this.broadcastRoomState();

    if (durationSeconds > 0 && onComplete) {
      this.startTimer(onComplete);
    }
  }

  startTimer(onComplete) {
    this.clearTimer();
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.io.to(this.code).emit('timer_tick', { timeLeft: this.timeLeft, phase: this.phase });

      if (this.timeLeft <= 0) {
        this.clearTimer();
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    }, 1000);
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  broadcastChatMessage(msg) {
    const cleanText = filterChatMessage(msg.text);
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      ...msg,
      text: cleanText
    };

    this.chatHistory.push(message);

    if (msg.scope === 'mafia') {
      const mafiaPlayers = this.players.filter(p => this.playersState[p.id]?.role === ROLES.MAFIA);
      mafiaPlayers.forEach(p => {
        if (p.socketId) this.io.to(p.socketId).emit('chat_message', message);
      });
    } else if (msg.scope === 'ghost') {
      const deadPlayers = this.players.filter(p => !this.playersState[p.id]?.isAlive);
      deadPlayers.forEach(p => {
        if (p.socketId) this.io.to(p.socketId).emit('chat_message', message);
      });
      // Tomoshabinlar ham arvohlar chatini ko'ra oladi
      this.spectators.forEach(sId => {
        this.io.to(sId).emit('chat_message', message);
      });
    } else {
      this.io.to(this.code).emit('chat_message', message);
      this.spectators.forEach(sId => {
        this.io.to(sId).emit('chat_message', message);
      });
    }
  }

  sendReaction(senderId, senderName, targetId, emoji) {
    this.io.to(this.code).emit('player_reaction', {
      senderId,
      senderName,
      targetId,
      emoji
    });
  }

  // Zero Client Trust: Har bir o'yinchiga faqat o'ziga ruxsat etilgan ma'lumot jo'natiladi
  broadcastRoomState() {
    this.players.forEach(player => {
      if (!player.socketId) return;
      const clientState = this.getClientStateFor(player.id, false);
      this.io.to(player.socketId).emit('room_state_update', clientState);
    });

    // Tomoshabinlarga ham xavfsiz holat jo'natish
    const spectatorState = this.getClientStateFor(null, true);
    this.spectators.forEach(sId => {
      this.io.to(sId).emit('room_state_update', spectatorState);
    });
  }

  getClientStateFor(playerId, isSpectator = false) {
    const isGameOver = this.phase === PHASES.GAME_OVER;
    const myState = playerId ? (this.playersState[playerId] || null) : null;
    const isMafia = myState?.role === ROLES.MAFIA;

    // O'yinchilar ro'yxati
    const safePlayers = this.players.map(p => {
      const state = this.playersState[p.id];
      const isAlive = state ? state.isAlive : true;
      let role = null;

      if (isGameOver || !isAlive) {
        role = state?.role;
      } else if (!isSpectator && p.id === playerId) {
        role = state?.role;
      } else if (!isSpectator && isMafia && state?.role === ROLES.MAFIA) {
        role = ROLES.MAFIA;
      }

      const showBotStatus = isGameOver || (this.settings.revealBotsAtEnd === false);

      return {
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isBot: showBotStatus ? p.isBot : false,
        personality: isGameOver && p.isBot ? p.personality : null,
        avatarIndex: p.avatarIndex,
        isConnected: p.isConnected !== false,
        isAlive,
        role,
        isLover: isGameOver ? state?.isLover : (!isSpectator && p.id === playerId ? state?.isLover : false),
        killedBy: isGameOver ? state?.killedBy : (state?.isAlive ? null : state?.killedBy)
      };
    });

    let mafiaPartners = [];
    if (!isSpectator && isMafia) {
      mafiaPartners = this.players
        .filter(p => p.id !== playerId && this.playersState[p.id]?.role === ROLES.MAFIA)
        .map(p => ({ id: p.id, name: p.name, isAlive: this.playersState[p.id]?.isAlive }));
    }

    let loverPartner = null;
    if (!isSpectator && myState?.isLover && myState.loverPartnerId) {
      const p = this.getPlayer(myState.loverPartnerId);
      if (p) {
        loverPartner = { id: p.id, name: p.name, isAlive: this.playersState[p.id]?.isAlive };
      }
    }

    return {
      roomCode: this.code,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      isPublic: this.isPublic,
      hasPassword: Boolean(this.password),
      isSpectator,
      avgMmr: this.avgMmr,
      settings: this.settings,
      timeLeft: this.timeLeft,
      players: safePlayers,
      myRole: !isSpectator ? (myState?.role || null) : null,
      myRoleInfo: (!isSpectator && myState?.role) ? ROLE_INFO[myState.role] : null,
      isAlive: !isSpectator ? (myState ? myState.isAlive : true) : false,
      isLover: !isSpectator ? (myState ? myState.isLover : false) : false,
      loverPartner,
      mafiaPartners,
      winner: this.winner,
      lastNightResult: this.lastNightResult,
      lastLynchResult: this.lastLynchResult,
      votes: this.phase === PHASES.DAY_VOTING ? this.votes : {},
      nightActions: (!isSpectator && isMafia && this.phase === PHASES.NIGHT) ? {
        voterPicks: this.nightActions.mafiaVoterPicks,
        votes: this.nightActions.mafiaVotes
      } : {}
    };
  }
}

class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  createRoom(hostPlayer, options = {}) {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = new Room(code, hostPlayer, this.io, options);
    this.rooms.set(code, room);
    logger.info(`Room created: ${code} by ${hostPlayer.name} (MMR: ${hostPlayer.mmr || 1000})`);
    return room;
  }

  // MMR ga mos ochiq xona qidirish (Matchmaking)
  findBestMatchRoom(userMmr = 1000) {
    let bestRoom = null;
    let minDiff = Infinity;

    for (const room of this.rooms.values()) {
      if (room.isPublic && !room.password && room.phase === PHASES.LOBBY && room.players.length < 16) {
        const diff = Math.abs((room.avgMmr || 1000) - userMmr);
        if (diff < minDiff) {
          minDiff = diff;
          bestRoom = room;
        }
      }
    }
    return bestRoom;
  }

  // Ochiq xonalar ro'yxati (Tomoshabinlar va Ro'yxat uchun)
  getPublicRoomsList() {
    const list = [];
    for (const room of this.rooms.values()) {
      list.push({
        code: room.code,
        hostName: room.players.find(p => p.isHost)?.name || 'Xost',
        playerCount: room.players.length,
        isPublic: room.isPublic,
        hasPassword: Boolean(room.password),
        phase: room.phase,
        round: room.round,
        avgMmr: room.avgMmr || 1000
      });
    }
    return list;
  }

  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(code.toUpperCase()) || null;
  }

  getRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      const player = room.getPlayerBySocket(socketId);
      if (player) return { room, player };
      if (room.spectators.has(socketId)) return { room, isSpectator: true };
    }
    return null;
  }

  removeRoom(code) {
    const room = this.rooms.get(code);
    if (room) {
      room.clearTimer();
      this.rooms.delete(code);
      logger.info(`Room removed: ${code}`);
    }
  }
}

module.exports = GameManager;
