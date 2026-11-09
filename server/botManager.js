/**
 * Kengaytirilgan AI Botlar Boshqaruvi — Claude API, Shaxsiyatlar, Typing Indikatori va Mantiqiy Qarorlar
 */
const { ROLES } = require('./gameLogic');
const { AIBotService } = require('./aiBotService');

const BOT_NAMES = [
  'Sherzod', 'Aziza', 'Jamshid', 'Madina', 'Bobur', 
  'Zarina', 'Otabek', 'Dildora', 'Farrux', 'Nilufar',
  'Anvar', 'Kamola', 'Rustam', 'Laylo', 'Sardor'
];

class BotManager {
  constructor(room) {
    this.room = room;
  }

  createBot() {
    const existingNames = new Set(this.room.players.map(p => p.name));
    let availableNames = BOT_NAMES.filter(n => !existingNames.has(n));
    if (availableNames.length === 0) {
      availableNames = [`Bot_${Math.floor(100 + Math.random() * 900)}`];
    }
    const chosenName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const personality = AIBotService.getRandomPersonality();

    return {
      id: botId,
      name: chosenName,
      socketId: null,
      isBot: true,
      isHost: false,
      isReady: true,
      avatarIndex: Math.floor(Math.random() * 8) + 1,
      personality
    };
  }

  /**
   * Tungi harakatlar
   */
  handleNightPhase() {
    if (!this.room || this.room.phase !== 'night') return;

    const alivePlayers = this.room.players.filter(p => this.room.playersState[p.id]?.isAlive);
    const aliveBots = alivePlayers.filter(p => p.isBot);

    setTimeout(() => {
      if (this.room.phase !== 'night') return;

      aliveBots.forEach(bot => {
        const state = this.room.playersState[bot.id];
        if (!state) return;

        // Mafiya
        if (state.role === ROLES.MAFIA) {
          const nonMafiaAlive = alivePlayers.filter(p => this.room.playersState[p.id]?.role !== ROLES.MAFIA);
          if (nonMafiaAlive.length > 0) {
            const existingVotes = this.room.nightActions.mafiaVotes || {};
            let targetId = null;
            const votedTargets = Object.keys(existingVotes);
            if (votedTargets.length > 0 && Math.random() > 0.3) {
              targetId = votedTargets[0];
            } else {
              const target = nonMafiaAlive[Math.floor(Math.random() * nonMafiaAlive.length)];
              targetId = target.id;
            }
            this.room.registerMafiaVote(bot.id, targetId);
          }
        }
        // Maniac (Qotil)
        else if (state.role === ROLES.MANIAC) {
          const others = alivePlayers.filter(p => p.id !== bot.id);
          if (others.length > 0) {
            const target = others[Math.floor(Math.random() * others.length)];
            this.room.registerManiacAction(bot.id, target.id);
          }
        }
        // Shifokor
        else if (state.role === ROLES.DOCTOR) {
          if (alivePlayers.length > 0) {
            const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
            this.room.nightActions.doctorTarget = target.id;
          }
        }
        // Komissar
        else if (state.role === ROLES.DETECTIVE) {
          const others = alivePlayers.filter(p => p.id !== bot.id);
          if (others.length > 0) {
            const target = others[Math.floor(Math.random() * others.length)];
            this.room.nightActions.detectiveTarget = target.id;
          }
        }
      });

      this.room.checkFastForwardNight();
    }, 2000 + Math.random() * 2000);
  }

  /**
   * Kunduzgi muhokama — "Yozmoqda..." indikatori va AI nutq
   */
  handleDayDiscussion() {
    if (!this.room || this.room.phase !== 'day_discussion') return;

    const aliveBots = this.room.players.filter(p => p.isBot && this.room.playersState[p.id]?.isAlive);
    if (aliveBots.length === 0) return;

    // Suhbatda bir yoki ikkita bot qatnashadi
    const botsToSpeak = aliveBots.sort(() => Math.random() - 0.5).slice(0, 2);

    botsToSpeak.forEach((bot, idx) => {
      const startDelay = 2500 + idx * 5000 + Math.random() * 2500;

      setTimeout(async () => {
        if (this.room.phase !== 'day_discussion') return;

        // Oxirgi chatni tekshirib, botning ismi tilga olinganmi yo'qmi bilamiz
        const recentChat = (this.room.chatHistory || []).slice(-4);
        let replyingTo = null;
        let isDirectReply = false;

        for (const msg of recentChat) {
          if (msg.senderId !== bot.id && msg.text && msg.text.toLowerCase().includes(bot.name.toLowerCase())) {
            replyingTo = msg.senderName;
            isDirectReply = true;
            break;
          }
        }

        // 1. "Yozmoqda..." indikatorini chiqarish
        this.room.io.to(this.room.code).emit('player_typing', {
          playerId: bot.id,
          playerName: bot.name,
          isTyping: true
        });

        // 2. Insoniy kechikish (2.2 - 3.5 soniya)
        const typingDelay = 2200 + Math.random() * 1500;

        setTimeout(async () => {
          if (this.room.phase !== 'day_discussion') {
            this.room.io.to(this.room.code).emit('player_typing', {
              playerId: bot.id,
              playerName: bot.name,
              isTyping: false
            });
            return;
          }

          // Nutq yaratish
          const speech = await AIBotService.generateSpeech({
            bot,
            room: this.room,
            isDirectReply,
            replyingTo
          });

          // 3. Typing indikatorini o'chirish
          this.room.io.to(this.room.code).emit('player_typing', {
            playerId: bot.id,
            playerName: bot.name,
            isTyping: false
          });

          // 4. Xabarni chatga uzatish
          if (speech) {
            this.room.broadcastChatMessage({
              senderId: bot.id,
              senderName: bot.name,
              text: speech,
              isSystem: false,
              scope: 'day'
            });
          }
        }, typingDelay);

      }, startDelay);
    });
  }

  /**
   * Kunduzgi mantiqiy ovoz berish
   */
  handleDayVoting() {
    if (!this.room || this.room.phase !== 'day_voting') return;

    const aliveBots = this.room.players.filter(p => p.isBot && this.room.playersState[p.id]?.isAlive);
    const alivePlayers = this.room.players.filter(p => this.room.playersState[p.id]?.isAlive);

    aliveBots.forEach((bot, index) => {
      const delay = 2000 + (index * 1400) + Math.random() * 1600;
      setTimeout(() => {
        if (this.room.phase !== 'day_voting') return;

        const targetId = AIBotService.decideVote({
          bot,
          room: this.room,
          alivePlayers
        });

        this.room.registerVote(bot.id, targetId);
      }, delay);
    });
  }
}

module.exports = BotManager;
