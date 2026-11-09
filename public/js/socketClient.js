/**
 * MAFIYA ENTERPRISE — HYBRID SOCKET.IO & SERVERLESS MQTT CLIENT
 * 
 * Ishlash tartibi:
 * 1. Agar Node.js server mavjud bo'lsa (localhost yoki maxsus URL) -> Socket.io orqali ulanadi.
 * 2. Agar GitHub Pages (statik hosting) yoki serverga ulanib bo'lmasa -> Paho MQTT (HiveMQ/EMQX WSS)
 *    va mahalliy xost mexanizmi orqali 100% serverless ishlaydi!
 */

const ROLES = {
  MAFIA: 'mafia',
  DOCTOR: 'doctor',
  DETECTIVE: 'detective',
  MAYOR: 'mayor',
  MANIAC: 'maniac',
  JESTER: 'jester',
  CITIZEN: 'citizen'
};

const ROLE_INFO = {
  [ROLES.MAFIA]: {
    name: 'Mafiya (Don)',
    team: 'mafia',
    icon: 'fa-user-secret',
    color: '#ff2a44',
    title: 'Xafvli Mafiya',
    description: 'Tunda sheriklaringiz bilan shahar ahlidan qurbon tanlang. Kunduzi o\'zingizni begunoh fuqaro qilib ko\'rsatib, e\'tiborni chalg\'iting!'
  },
  [ROLES.DOCTOR]: {
    name: 'Shifokor',
    team: 'citizens',
    icon: 'fa-user-md',
    color: '#00e676',
    title: 'Shahar Shifokori',
    description: 'Har kecha bitta odamni (o\'zingizni yoki boshqa fuqaroni) mafiya va maniac hujumidan qutqarib qolasiz.'
  },
  [ROLES.DETECTIVE]: {
    name: 'Komissar / Detektiv',
    team: 'citizens',
    icon: 'fa-search',
    color: '#00b0ff',
    title: 'Adolat Komissari',
    description: 'Har kecha bitta shubhali odamni tekshirib, uning mafiya ekanligini yoki yo\'qligini bilib olasiz.'
  },
  [ROLES.MAYOR]: {
    name: 'Shahar Meri (Mayor)',
    team: 'citizens',
    icon: 'fa-landmark',
    color: '#ffb300',
    title: 'Shahar Hokimi',
    description: 'Siz shahar hokimisiz! Sizning kunduzgi ovozingiz oddiy ovoz emas — 2 ta ovoz hisoblanadi!'
  },
  [ROLES.MANIAC]: {
    name: 'Qotil / Maniac',
    team: 'neutral',
    icon: 'fa-skull-crossbones',
    color: '#e91e63',
    title: 'Yovvoyi Qotil',
    description: 'Siz yolg\'iz qotilsiz! Har kecha bitta odamni yo\'q qiling. Mafiyaga ham, fuqarolarga ham qarshisiz. Yolg\'iz qolsangiz g\'olibsiz!'
  },
  [ROLES.JESTER]: {
    name: 'Hazilkash (Jester)',
    team: 'neutral',
    icon: 'fa-masks-theater',
    color: '#ab47bc',
    title: 'Shahar Masharabozi',
    description: 'Sizning yagona maqsadingiz — odamlarni o\'zingizga ishontirib, kunduzgi ovoz berishda o\'zingizni osdirish! Agar sizni linch qilishsa, yagona g\'olib bo\'lasiz!'
  },
  [ROLES.CITIZEN]: {
    name: 'Tinch aholi',
    team: 'citizens',
    icon: 'fa-users',
    color: '#b0bec5',
    title: 'Oddiy Fuqaro',
    description: 'Siz tinch aholi vakilisiz. Sizning qurolingiz — mantiq, e\'tibor va kunduzgi ovoz berish. Jinoyatchilarni fosh qiling!'
  }
};

const BOT_PRESETS = [
  { name: 'Rustam 🤖', avatar: 1 },
  { name: 'Madina 🤖', avatar: 2 },
  { name: 'Sanjar 🤖', avatar: 3 },
  { name: 'Malika 🤖', avatar: 4 },
  { name: 'Alisher 🤖', avatar: 5 },
  { name: 'Zarina 🤖', avatar: 6 },
  { name: 'Bobur 🤖', avatar: 7 },
  { name: 'Dilnoza 🤖', avatar: 8 }
];

const BOT_QUOTES = {
  discussion: [
    'Mening fikrimcha bu yerda kimdir yolg\'on gapiryapti...',
    'Men oddiy tinch fuqaroman, menga shubha qilmanglar!',
    'Shifokor kecha kimni saqlagan bo\'lsa ham baribir yashasin!',
    'Harakatlarimizni birlashtirishimiz kerak, mafiya vaqt yutmoqda.',
    'Menga nega hamma g\'alati qarayapti? Qotil men emasman!',
    'Detektiv o\'z tekshiruv natijalarini qachon aytadi?',
    'Ehtiyot bo\'laylik, xato qilib begunohni chiqarib yubormaylik.'
  ],
  defense: [
    'Menga tuhmat qilmanglar, o\'zingiz mafiyaga o\'xshaysiz!',
    'Agar meni chiqarsangiz, tinch aholi bir kishiga kamayadi!',
    'Men begunohman, haqiqiy jinoyatchi jimgina kuzatib turibdi!'
  ]
};

class SocketClient {
  constructor() {
    this.socket = null;
    this.mqttClient = null;
    this.mqttConnected = false;
    this.isHost = false;
    this.isMqttMode = false;
    
    this.playerId = localStorage.getItem('mafia_player_id') || `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    localStorage.setItem('mafia_player_id', this.playerId);
    
    this.roomCode = localStorage.getItem('mafia_room_code') || null;
    this.playerName = localStorage.getItem('mafia_player_name') || 'O\'yinchi';
    this.avatarIndex = parseInt(localStorage.getItem('mafia_avatar_index'), 10) || 1;
    this.adminToken = localStorage.getItem('mafia_admin_token') || null;
    this.telegramData = null;
    try {
      this.telegramData = JSON.parse(localStorage.getItem('mafia_tg_data'));
    } catch(e){}

    this.state = null;
    this.callbacks = {};
    this.localRoom = null;
    this.localTimer = null;
    this.botChatTimer = null;
  }

  getServerUrl() {
    const params = new URLSearchParams(window.location.search);
    const paramServer = params.get('server');
    if (paramServer) {
      localStorage.setItem('mafia_server_url', paramServer);
      return paramServer;
    }
    const saved = localStorage.getItem('mafia_server_url');
    if (saved) return saved;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '';
    }
    return null;
  }

  init() {
    const serverUrl = this.getServerUrl();
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (serverUrl !== null || isLocalhost) {
      this.initSocketIo(serverUrl);
    } else {
      console.log('[Engine] GitHub Pages / Masofaviy statik muhit aniqlandi. MQTT P2P rejimiga ulanilmoqda...');
      this.isMqttMode = true;
      this.initMqtt();
    }
  }

  initSocketIo(serverUrl) {
    if (typeof io === 'undefined') {
      console.warn('[Socket] Socket.io kutubxonasi yuklanmagan, MQTT rejimiga o\'tilmoqda...');
      this.isMqttMode = true;
      this.initMqtt();
      return;
    }

    const opts = {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 4,
      timeout: 6000
    };

    try {
      this.socket = serverUrl ? io(serverUrl, opts) : io(opts);

      this.socket.on('connect', () => {
        console.log('[Socket] Serverga muvaffaqiyatli ulandi:', this.socket.id);
        this.isMqttMode = false;
        this.initUser(this.playerName, this.avatarIndex, this.telegramData);

        if (this.roomCode && this.playerId) {
          this.reconnectSession(this.roomCode, this.playerId);
        }
        if (this.callbacks.onConnect) this.callbacks.onConnect();
      });

      this.socket.on('connect_error', (err) => {
        console.warn('[Socket] Backend serverga ulanib bo\'lmadi. MQTT rejimiga o\'tilmoqda:', err.message);
        this.isMqttMode = true;
        this.initMqtt();
        if (this.callbacks.onConnectError) this.callbacks.onConnectError(err);
      });

      this.socket.on('room_state_update', (state) => {
        this.state = state;
        if (this.callbacks.onRoomStateUpdate) this.callbacks.onRoomStateUpdate(state);
      });

      this.socket.on('timer_tick', (data) => {
        if (this.callbacks.onTimerTick) this.callbacks.onTimerTick(data);
      });

      this.socket.on('chat_message', (msg) => {
        if (this.callbacks.onChatMessage) this.callbacks.onChatMessage(msg);
      });

      this.socket.on('chat_history', (data) => {
        if (this.callbacks.onChatHistory) this.callbacks.onChatHistory(data.messages);
      });

      this.socket.on('chat_rate_limited', (data) => {
        if (this.callbacks.onRateLimited) this.callbacks.onRateLimited(data);
      });

      this.socket.on('mafia_night_update', (data) => {
        if (this.callbacks.onMafiaNightUpdate) this.callbacks.onMafiaNightUpdate(data);
      });

      this.socket.on('detective_result', (data) => {
        if (this.callbacks.onDetectiveResult) this.callbacks.onDetectiveResult(data);
      });

      this.socket.on('doctor_action_confirmed', (data) => {
        if (this.callbacks.onDoctorConfirmed) this.callbacks.onDoctorConfirmed(data);
      });

      this.socket.on('day_vote_update', (data) => {
        if (this.callbacks.onDayVoteUpdate) this.callbacks.onDayVoteUpdate(data);
      });

      this.socket.on('player_reaction', (data) => {
        if (this.callbacks.onReaction) this.callbacks.onReaction(data);
      });

      this.socket.on('player_typing', (data) => {
        if (this.callbacks.onPlayerTyping) this.callbacks.onPlayerTyping(data);
      });

      this.socket.on('achievements_unlocked', (unlockedList) => {
        if (this.callbacks.onAchievementsUnlocked) this.callbacks.onAchievementsUnlocked(unlockedList);
      });

      this.socket.on('room_invitation', (data) => {
        if (this.callbacks.onRoomInvitation) this.callbacks.onRoomInvitation(data);
      });

      this.socket.on('system_announcement', (data) => {
        if (this.callbacks.onSystemAnnouncement) this.callbacks.onSystemAnnouncement(data);
      });

      this.socket.on('user_banned', (data) => {
        alert(`Hisobingiz bloklandi: ${data.reason}`);
        window.location.reload();
      });

      this.socket.on('user_muted', (data) => {
        if (this.callbacks.onUserMuted) this.callbacks.onUserMuted(data);
      });

      this.socket.on('user_unmuted', (data) => {
        if (this.callbacks.onUserUnmuted) this.callbacks.onUserUnmuted(data);
      });

      this.socket.on('action_error', (data) => {
        if (this.callbacks.onActionError) this.callbacks.onActionError(data);
      });

      this.socket.on('disconnect', () => {
        console.warn('[Socket] Serverdan aloqa uzildi');
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
      });
    } catch(err) {
      console.warn('[Socket] Ulanishda xato:', err);
      this.isMqttMode = true;
      this.initMqtt();
    }
  }

  // ==========================================
  // MQTT SERVERLESS TARMOQ (HIVEMQ / EMQX WSS)
  // ==========================================
  initMqtt() {
    if (typeof Paho === 'undefined' || !Paho.MQTT) {
      console.warn('[MQTT] Paho MQTT mavjud emas, qayta urinilmoqda...');
      setTimeout(() => this.initMqtt(), 500);
      return;
    }

    if (this.mqttClient && this.mqttConnected) return;

    const brokerHost = 'broker.hivemq.com';
    const brokerPort = 8884;
    const clientId = `mafia_${this.playerId}_${Math.random().toString(36).substr(2, 5)}`;

    try {
      this.mqttClient = new Paho.MQTT.Client(brokerHost, brokerPort, '/mqtt', clientId);

      this.mqttClient.onConnectionLost = (res) => {
        this.mqttConnected = false;
        console.warn('[MQTT] Aloqa uzildi:', res.errorMessage);
        if (this.roomCode) {
          setTimeout(() => this.initMqtt(), 2000);
        }
      };

      this.mqttClient.onMessageArrived = (message) => {
        try {
          const payload = JSON.parse(message.payloadString);
          this.handleMqttMessage(payload);
        } catch (e) {
          console.error('[MQTT] Xabarni o\'qishda xatolik:', e);
        }
      };

      this.mqttClient.connect({
        useSSL: true,
        timeout: 6,
        keepAliveInterval: 30,
        cleanSession: true,
        onSuccess: () => {
          this.mqttConnected = true;
          console.log('[MQTT] HiveMQ WSS brokeriga muvaffaqiyatli ulandi!');
          if (this.roomCode) {
            this.subscribeMqttRoom(this.roomCode);
          }
          if (this.callbacks.onConnect) this.callbacks.onConnect();
        },
        onFailure: (err) => {
          console.warn('[MQTT] HiveMQ ga ulanib bo\'lmadi, EMQX zaxira brokeri sinab ko\'rilmoqda...', err);
          this.fallbackToEmqx();
        }
      });
    } catch (e) {
      console.error('[MQTT] Boshlashda xato:', e);
    }
  }

  fallbackToEmqx() {
    try {
      const clientId = `mafia_${this.playerId}_${Math.random().toString(36).substr(2, 5)}`;
      this.mqttClient = new Paho.MQTT.Client('broker.emqx.io', 8084, '/mqtt', clientId);
      this.mqttClient.connect({
        useSSL: true,
        timeout: 8,
        onSuccess: () => {
          this.mqttConnected = true;
          console.log('[MQTT] EMQX WSS zaxira brokeriga ulandi!');
          if (this.roomCode) this.subscribeMqttRoom(this.roomCode);
        },
        onFailure: (e) => console.error('[MQTT] Barcha brokerlar javob bermadi:', e)
      });
    } catch(e){}
  }

  subscribeMqttRoom(roomCode) {
    if (this.mqttClient && this.mqttConnected) {
      const topic = `mafiya_game/v2/${roomCode}`;
      try {
        this.mqttClient.subscribe(topic);
        console.log('[MQTT] Mavzuga obuna bo\'lindi:', topic);
      } catch (e) {}
    }
  }

  sendMqttMessage(payload) {
    if (!this.mqttClient || !this.mqttConnected || !this.roomCode) return;
    try {
      const topic = `mafiya_game/v2/${this.roomCode}`;
      const msg = new Paho.MQTT.Message(JSON.stringify(payload));
      msg.destinationName = topic;
      this.mqttClient.send(msg);
    } catch (e) {
      console.warn('[MQTT] Xabar yuborishda xatolik:', e);
    }
  }

  handleMqttMessage(payload) {
    if (!payload || !payload.type) return;

    // 1. Mehmon xonaga qo'shilish so'rovi (Host qabul qiladi)
    if (payload.type === 'JOIN_REQUEST' && this.isHost && this.localRoom) {
      const { player, password } = payload;
      if (this.localRoom.password && this.localRoom.password !== password) {
        this.sendMqttMessage({
          type: 'JOIN_RESPONSE',
          targetPlayerId: player.id,
          success: false,
          message: 'Parol noto\'g\'ri!'
        });
        return;
      }

      const existing = this.localRoom.players.find(p => p.id === player.id);
      if (!existing) {
        this.localRoom.players.push({
          id: player.id,
          name: player.name,
          avatarIndex: player.avatarIndex || 1,
          isHost: false,
          isBot: false,
          isAlive: true,
          role: null
        });
      }

      this.broadcastLocalState();
      this.sendMqttMessage({
        type: 'JOIN_RESPONSE',
        targetPlayerId: player.id,
        success: true,
        roomCode: this.localRoom.roomCode,
        state: this.getSanitizedState(player.id)
      });
      return;
    }

    // 2. Mehmon uchun qo'shilish javobi
    if (payload.type === 'JOIN_RESPONSE' && payload.targetPlayerId === this.playerId) {
      if (payload.success) {
        this.state = payload.state;
        if (this.callbacks.onRoomStateUpdate) this.callbacks.onRoomStateUpdate(payload.state);
        if (this._joinCallback) {
          this._joinCallback({ success: true, roomCode: payload.roomCode, state: payload.state });
          this._joinCallback = null;
        }
      } else {
        if (this._joinCallback) {
          this._joinCallback({ success: false, message: payload.message });
          this._joinCallback = null;
        }
      }
      return;
    }

    // 3. Xona holati yangilanishi (Barcha ishtirokchilar uchun)
    if (payload.type === 'STATE_UPDATE') {
      const myState = payload.states ? payload.states[this.playerId] : payload.state;
      if (myState) {
        this.state = myState;
        if (this.callbacks.onRoomStateUpdate) this.callbacks.onRoomStateUpdate(myState);
      }
      return;
    }

    // 4. Taymer soniyalari
    if (payload.type === 'TIMER_TICK') {
      if (this.callbacks.onTimerTick) this.callbacks.onTimerTick(payload.data);
      return;
    }

    // 5. Chat xabarlari
    if (payload.type === 'CHAT_MSG') {
      if (this.callbacks.onChatMessage) this.callbacks.onChatMessage(payload.msg);
      return;
    }

    // 6. Emojilar
    if (payload.type === 'REACTION') {
      if (this.callbacks.onReaction) this.callbacks.onReaction(payload.data);
      return;
    }

    // 7. Yozmoqda indikatori
    if (payload.type === 'TYPING') {
      if (this.callbacks.onPlayerTyping) this.callbacks.onPlayerTyping(payload.data);
      return;
    }

    // 8. Tungi harakat yoki ovoz (Host mehmon harakatini qabul qiladi)
    if (this.isHost && this.localRoom) {
      if (payload.type === 'NIGHT_ACTION') {
        this.handleLocalNightAction(payload.playerId, payload.actionType, payload.targetId);
      } else if (payload.type === 'DAY_VOTE') {
        this.handleLocalDayVote(payload.playerId, payload.targetId);
      }
    }
  }

  // ==========================================
  // MAHALLIY XOST O'YIN DVIGATELI (LOCAL ENGINE)
  // ==========================================
  createLocalRoom(name, avatarIdx, isPublic, password) {
    const roomCode = `M${Math.floor(1000 + Math.random() * 9000)}`;
    this.isHost = true;
    this.roomCode = roomCode;
    this.subscribeMqttRoom(roomCode);

    this.localRoom = {
      roomCode,
      hostId: this.playerId,
      isPublic: Boolean(isPublic),
      password: password || '',
      phase: 'lobby',
      dayNumber: 1,
      avgMmr: 1000,
      players: [
        {
          id: this.playerId,
          name: name || this.playerName,
          avatarIndex: avatarIdx || this.avatarIndex,
          isHost: true,
          isBot: false,
          isAlive: true,
          role: null
        }
      ],
      settings: {
        mafiaCount: 1,
        hasDoctor: true,
        hasDetective: true,
        hasMayor: false,
        hasManiac: false,
        hasJester: false,
        hasLovers: false,
        nightTime: 30,
        discussionTime: 60,
        votingTime: 30,
        autoFillBots: true,
        botDifficulty: 'medium',
        revealBotsAtEnd: true
      },
      nightActions: {
        mafiaVotes: {},
        doctorTarget: null,
        detectiveTarget: null,
        maniacTarget: null
      },
      votes: {},
      chatMessages: [],
      lovers: []
    };

    this.saveSession(roomCode, this.playerId, name, avatarIdx);
    const sanitized = this.getSanitizedState(this.playerId);
    this.state = sanitized;
    return sanitized;
  }

  getSanitizedState(forPlayerId) {
    if (!this.localRoom) return null;
    const r = this.localRoom;
    const me = r.players.find(p => p.id === forPlayerId);
    const isGameOver = r.phase === 'game_over';

    const safePlayers = r.players.map(p => {
      let role = null;
      if (isGameOver) {
        role = p.role;
      } else if (p.id === forPlayerId) {
        role = p.role;
      } else if (me && me.role === 'mafia' && p.role === 'mafia') {
        role = 'mafia';
      }
      return {
        id: p.id,
        name: p.name,
        avatarIndex: p.avatarIndex,
        isHost: p.isHost,
        isBot: p.isBot,
        isAlive: p.isAlive,
        role: role,
        isLover: isGameOver || (me && r.lovers.includes(me.id) && r.lovers.includes(p.id))
      };
    });

    let myRoleInfo = null;
    let partners = [];
    if (me && me.role) {
      myRoleInfo = { ...ROLE_INFO[me.role], role: me.role };
      if (me.role === 'mafia') {
        partners = r.players.filter(p => p.role === 'mafia' && p.id !== me.id);
      }
      if (r.lovers.includes(me.id)) {
        const partnerId = r.lovers.find(id => id !== me.id);
        const partner = r.players.find(p => p.id === partnerId);
        if (partner) partners.push(partner);
      }
    }

    return {
      roomCode: r.roomCode,
      hostId: r.hostId,
      isPublic: r.isPublic,
      phase: r.phase,
      dayNumber: r.dayNumber,
      avgMmr: r.avgMmr,
      players: safePlayers,
      settings: r.settings,
      myRoleInfo: myRoleInfo,
      partners: partners,
      nightActions: me && me.role === 'mafia' ? { mafiaVotes: r.nightActions.mafiaVotes } : {},
      votes: r.votes,
      lastNightResult: r.lastNightResult || null,
      gameResult: r.gameResult || null
    };
  }

  broadcastLocalState() {
    if (!this.localRoom) return;
    const clientStates = {};
    this.localRoom.players.forEach(p => {
      clientStates[p.id] = this.getSanitizedState(p.id);
    });

    const myState = clientStates[this.playerId];
    this.state = myState;
    if (this.callbacks.onRoomStateUpdate) {
      this.callbacks.onRoomStateUpdate(myState);
    }

    this.sendMqttMessage({
      type: 'STATE_UPDATE',
      states: clientStates
    });
  }

  startLocalGame() {
    if (!this.localRoom) return;
    const r = this.localRoom;

    // Agar o'yinchilar 3 tadan kam bo'lsa, botlar qo'shamiz
    if (r.players.length < 3) {
      const needed = 4 - r.players.length;
      for (let i = 0; i < needed; i++) {
        this.addLocalBot();
      }
    }

    // Rollarni taqsimlash
    this.assignLocalRoles();
    r.phase = 'role_reveal';
    this.broadcastLocalState();

    this.runPhaseCountdown(6, () => {
      this.startLocalNight();
    });
  }

  assignLocalRoles() {
    const r = this.localRoom;
    const players = [...r.players];
    const count = players.length;
    let mafiaCount = parseInt(r.settings.mafiaCount, 10) || 1;
    const maxMafia = Math.max(1, Math.floor((count - 1) / 2));
    if (mafiaCount > maxMafia) mafiaCount = maxMafia;

    const deck = [];
    for (let i = 0; i < mafiaCount; i++) deck.push(ROLES.MAFIA);
    if (r.settings.hasDoctor && deck.length < count) deck.push(ROLES.DOCTOR);
    if (r.settings.hasDetective && deck.length < count) deck.push(ROLES.DETECTIVE);
    if (r.settings.hasMayor && deck.length < count) deck.push(ROLES.MAYOR);
    if (r.settings.hasManiac && deck.length < count) deck.push(ROLES.MANIAC);
    if (r.settings.hasJester && deck.length < count) deck.push(ROLES.JESTER);

    while (deck.length < count) {
      deck.push(ROLES.CITIZEN);
    }

    // Fisher-Yates aralashtirish
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    players.forEach((p, idx) => {
      p.role = deck[idx];
      p.isAlive = true;
    });

    r.lovers = [];
    if (r.settings.hasLovers && players.length >= 4) {
      const indices = [];
      while (indices.length < 2) {
        const rand = Math.floor(Math.random() * players.length);
        if (!indices.includes(rand)) indices.push(rand);
      }
      r.lovers = [players[indices[0]].id, players[indices[1]].id];
    }
  }

  startLocalNight() {
    const r = this.localRoom;
    r.phase = 'night';
    r.nightActions = {
      mafiaVotes: {},
      doctorTarget: null,
      detectiveTarget: null,
      maniacTarget: null
    };

    this.broadcastLocalState();

    // Botlar tungi harakatlarini 2-5 soniyada bajaradi
    setTimeout(() => {
      this.simulateBotNightActions();
    }, 2500);

    const nightTime = parseInt(r.settings.nightTime, 10) || 30;
    this.runPhaseCountdown(nightTime, () => {
      this.resolveLocalNight();
    });
  }

  simulateBotNightActions() {
    if (!this.localRoom || this.localRoom.phase !== 'night') return;
    const r = this.localRoom;
    const living = r.players.filter(p => p.isAlive);
    const nonMafia = living.filter(p => p.role !== 'mafia');

    r.players.filter(p => p.isBot && p.isAlive).forEach(bot => {
      if (bot.role === 'mafia' && nonMafia.length > 0) {
        const victim = nonMafia[Math.floor(Math.random() * nonMafia.length)];
        r.nightActions.mafiaVotes[bot.id] = victim.id;
      } else if (bot.role === 'doctor' && living.length > 0) {
        const target = living[Math.floor(Math.random() * living.length)];
        r.nightActions.doctorTarget = target.id;
      } else if (bot.role === 'detective' && living.length > 1) {
        const others = living.filter(p => p.id !== bot.id);
        const target = others[Math.floor(Math.random() * others.length)];
        r.nightActions.detectiveTarget = target.id;
      } else if (bot.role === 'maniac' && living.length > 1) {
        const others = living.filter(p => p.id !== bot.id);
        const victim = others[Math.floor(Math.random() * others.length)];
        r.nightActions.maniacTarget = victim.id;
      }
    });

    this.broadcastLocalState();
  }

  handleLocalNightAction(playerId, actionType, targetId) {
    if (!this.localRoom || this.localRoom.phase !== 'night') return;
    const r = this.localRoom;
    const player = r.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return;

    if (actionType === 'mafia_vote' && player.role === 'mafia') {
      r.nightActions.mafiaVotes[playerId] = targetId;
      if (this.callbacks.onMafiaNightUpdate) {
        this.callbacks.onMafiaNightUpdate(r.nightActions);
      }
    } else if (actionType === 'doctor_heal' && player.role === 'doctor') {
      r.nightActions.doctorTarget = targetId;
      if (playerId === this.playerId && this.callbacks.onDoctorConfirmed) {
        this.callbacks.onDoctorConfirmed();
      }
    } else if (actionType === 'detective_investigate' && player.role === 'detective') {
      r.nightActions.detectiveTarget = targetId;
      const target = r.players.find(p => p.id === targetId);
      if (playerId === this.playerId && this.callbacks.onDetectiveResult) {
        this.callbacks.onDetectiveResult({
          targetId: targetId,
          targetName: target ? target.name : '',
          isMafia: target ? target.role === 'mafia' : false
        });
      }
    } else if (actionType === 'maniac_kill' && player.role === 'maniac') {
      r.nightActions.maniacTarget = targetId;
    }
    this.broadcastLocalState();
  }

  resolveLocalNight() {
    const r = this.localRoom;
    const voteCounts = {};
    Object.values(r.nightActions.mafiaVotes).forEach(tid => {
      voteCounts[tid] = (voteCounts[tid] || 0) + 1;
    });

    let mafiaVictimId = null;
    let maxV = 0;
    Object.entries(voteCounts).forEach(([tid, count]) => {
      if (count > maxV) {
        maxV = count;
        mafiaVictimId = tid;
      }
    });

    const killedList = [];
    const docTarget = r.nightActions.doctorTarget;
    const maniacTarget = r.nightActions.maniacTarget;

    if (mafiaVictimId) {
      if (mafiaVictimId === docTarget) {
        // Shifokor qutqardi
      } else {
        killedList.push(mafiaVictimId);
      }
    }

    if (maniacTarget && maniacTarget !== docTarget && !killedList.includes(maniacTarget)) {
      killedList.push(maniacTarget);
    }

    // Sevishganlar zanjirli o'limi
    if (r.lovers && r.lovers.length === 2) {
      if (killedList.includes(r.lovers[0]) && !killedList.includes(r.lovers[1])) {
        killedList.push(r.lovers[1]);
      } else if (killedList.includes(r.lovers[1]) && !killedList.includes(r.lovers[0])) {
        killedList.push(r.lovers[0]);
      }
    }

    killedList.forEach(id => {
      const p = r.players.find(x => x.id === id);
      if (p) p.isAlive = false;
    });

    r.lastNightResult = {
      killedList: killedList.map(id => {
        const p = r.players.find(x => x.id === id);
        return { id: p.id, name: p.name, role: p.role };
      }),
      doctorSaved: Boolean(docTarget && (docTarget === mafiaVictimId || docTarget === maniacTarget))
    };

    const winner = this.checkLocalWinCondition();
    if (winner) {
      this.finishLocalGame(winner);
      return;
    }

    r.phase = 'day_announce';
    this.broadcastLocalState();

    this.runPhaseCountdown(6, () => {
      this.startLocalDiscussion();
    });
  }

  startLocalDiscussion() {
    const r = this.localRoom;
    r.phase = 'day_discussion';
    this.broadcastLocalState();

    // Botlar muhokama davomida chatda gaplashadi
    this.startBotChatLoop();

    const discTime = parseInt(r.settings.discussionTime, 10) || 60;
    this.runPhaseCountdown(discTime, () => {
      this.startLocalVoting();
    });
  }

  startBotChatLoop() {
    this.stopBotChatLoop();
    let count = 0;
    this.botChatTimer = setInterval(() => {
      count++;
      if (!this.localRoom || this.localRoom.phase !== 'day_discussion' || count > 4) {
        this.stopBotChatLoop();
        return;
      }
      const livingBots = this.localRoom.players.filter(p => p.isBot && p.isAlive);
      if (livingBots.length === 0) return;

      const bot = livingBots[Math.floor(Math.random() * livingBots.length)];
      const quote = BOT_QUOTES.discussion[Math.floor(Math.random() * BOT_QUOTES.discussion.length)];

      const msg = {
        id: `msg_${Date.now()}`,
        senderId: bot.id,
        senderName: bot.name,
        text: quote,
        scope: 'all',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: false
      };

      if (this.callbacks.onChatMessage) this.callbacks.onChatMessage(msg);
      this.sendMqttMessage({ type: 'CHAT_MSG', msg });
    }, 9000);
  }

  stopBotChatLoop() {
    if (this.botChatTimer) {
      clearInterval(this.botChatTimer);
      this.botChatTimer = null;
    }
  }

  startLocalVoting() {
    this.stopBotChatLoop();
    const r = this.localRoom;
    r.phase = 'day_voting';
    r.votes = {};
    this.broadcastLocalState();

    // Botlar 3-6 soniyada ovoz beradi
    setTimeout(() => {
      this.simulateBotVoting();
    }, 3500);

    const voteTime = parseInt(r.settings.votingTime, 10) || 30;
    this.runPhaseCountdown(voteTime, () => {
      this.resolveLocalVoting();
    });
  }

  simulateBotVoting() {
    if (!this.localRoom || this.localRoom.phase !== 'day_voting') return;
    const r = this.localRoom;
    const living = r.players.filter(p => p.isAlive);

    r.players.filter(p => p.isBot && p.isAlive).forEach(bot => {
      const others = living.filter(p => p.id !== bot.id);
      if (others.length === 0) return;

      let target = null;
      if (bot.role === 'mafia') {
        const nonMafia = others.filter(p => p.role !== 'mafia');
        target = nonMafia.length > 0 ? nonMafia[Math.floor(Math.random() * nonMafia.length)] : others[0];
      } else {
        target = others[Math.floor(Math.random() * others.length)];
      }

      const weight = bot.role === 'mayor' ? 2 : 1;
      r.votes[target.id] = (r.votes[target.id] || 0) + weight;
    });

    this.broadcastLocalState();
    if (this.callbacks.onDayVoteUpdate) {
      this.callbacks.onDayVoteUpdate({ votes: r.votes });
    }
  }

  handleLocalDayVote(voterId, targetId) {
    if (!this.localRoom || this.localRoom.phase !== 'day_voting') return;
    const r = this.localRoom;
    const voter = r.players.find(p => p.id === voterId);
    if (!voter || !voter.isAlive) return;

    if (targetId !== 'skip') {
      const weight = voter.role === 'mayor' ? 2 : 1;
      r.votes[targetId] = (r.votes[targetId] || 0) + weight;
    }

    this.broadcastLocalState();
    if (this.callbacks.onDayVoteUpdate) {
      this.callbacks.onDayVoteUpdate({ votes: r.votes });
    }
  }

  resolveLocalVoting() {
    const r = this.localRoom;
    let maxVotes = 0;
    let eliminatedId = null;
    let isTie = false;

    Object.entries(r.votes).forEach(([tid, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedId = tid;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    });

    if (eliminatedId && !isTie && maxVotes > 0) {
      const target = r.players.find(p => p.id === eliminatedId);
      if (target) {
        target.isAlive = false;

        // Agar Jester (Hazilkash) linch qilinsa -> Jester g'alaba qozonadi!
        if (target.role === 'jester') {
          this.finishLocalGame({
            winner: 'jester',
            winnerTitle: '🎭 Hazilkash (Jester) g\'olib bo\'ldi!',
            description: 'Hazilkash shahar ahlini laqillatib, o\'zini linch qildirishga erishdi!'
          });
          return;
        }

        // Sevishganlar zanjiri
        if (r.lovers && r.lovers.includes(target.id)) {
          const partnerId = r.lovers.find(id => id !== target.id);
          const partner = r.players.find(p => p.id === partnerId);
          if (partner) partner.isAlive = false;
        }
      }
    }

    const winner = this.checkLocalWinCondition();
    if (winner) {
      this.finishLocalGame(winner);
      return;
    }

    r.dayNumber++;
    this.startLocalNight();
  }

  checkLocalWinCondition() {
    const r = this.localRoom;
    const living = r.players.filter(p => p.isAlive);
    const livingMafia = living.filter(p => p.role === 'mafia');
    const livingCitizens = living.filter(p => p.role !== 'mafia' && p.role !== 'maniac' && p.role !== 'jester');
    const livingManiac = living.filter(p => p.role === 'maniac');

    // Maniac yagona tirik qolsa
    if (livingManiac.length > 0 && livingMafia.length === 0 && livingCitizens.length === 0) {
      return {
        winner: 'maniac',
        winnerTitle: '🩸 Qonxo\'r Maniac g\'olib bo\'ldi!',
        description: 'Maniac barchani yo\'q qilib, shaharda yagona tirik qolgan qotil bo\'ldi!'
      };
    }

    // Mafiya barcha fuqarolardan teng yoki ko'p bo'lsa
    if (livingMafia.length > 0 && livingMafia.length >= (livingCitizens.length + livingManiac.length)) {
      return {
        winner: 'mafia',
        winnerTitle: '🎩 Mafiya g\'alaba qozondi!',
        description: 'Mafiya shaharni to\'liq o\'z nazoratiga oldi va aholini mag\'lub etdi!'
      };
    }

    // Barcha mafiya va maniac yo'q qilingan bo'lsa
    if (livingMafia.length === 0 && livingManiac.length === 0) {
      return {
        winner: 'citizens',
        winnerTitle: '🏆 Tinch aholi g\'alaba qozondi!',
        description: 'Shahardagi barcha xavfli jinoyatchilar fosh etilib, adolat qaror topdi!'
      };
    }

    return null;
  }

  finishLocalGame(winData) {
    this.clearLocalTimers();
    const r = this.localRoom;
    r.phase = 'game_over';
    r.gameResult = {
      ...winData,
      roles: r.players.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        roleInfo: ROLE_INFO[p.role] || { name: p.role, color: '#fff' },
        isAlive: p.isAlive,
        isBot: p.isBot
      }))
    };
    this.broadcastLocalState();
  }

  runPhaseCountdown(duration, onFinish) {
    this.clearLocalTimers();
    let timeLeft = duration;

    const tick = () => {
      const data = { timeLeft, phase: this.localRoom ? this.localRoom.phase : 'lobby' };
      if (this.callbacks.onTimerTick) this.callbacks.onTimerTick(data);
      this.sendMqttMessage({ type: 'TIMER_TICK', data });

      if (timeLeft <= 0) {
        clearInterval(this.localTimer);
        this.localTimer = null;
        if (onFinish) onFinish();
      } else {
        timeLeft--;
      }
    };

    tick();
    this.localTimer = setInterval(tick, 1000);
  }

  clearLocalTimers() {
    if (this.localTimer) {
      clearInterval(this.localTimer);
      this.localTimer = null;
    }
    this.stopBotChatLoop();
  }

  addLocalBot() {
    if (!this.localRoom) return;
    const r = this.localRoom;
    const existingBotNames = r.players.filter(p => p.isBot).map(p => p.name);
    const available = BOT_PRESETS.filter(b => !existingBotNames.includes(b.name));
    const preset = available.length > 0 ? available[0] : { name: `Bot ${r.players.length + 1} 🤖`, avatar: 1 };

    r.players.push({
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: preset.name,
      avatarIndex: preset.avatar,
      isHost: false,
      isBot: true,
      isAlive: true,
      role: null
    });

    this.broadcastLocalState();
  }

  removeLocalBot(botId) {
    if (!this.localRoom) return;
    this.localRoom.players = this.localRoom.players.filter(p => p.id !== botId);
    this.broadcastLocalState();
  }

  // ==========================================
  // MIJOZ API VA VOQEALARNI BOSHQARISH
  // ==========================================
  initUser(name, avatarIdx, telegramData, callback) {
    this.playerName = name || this.playerName;
    this.avatarIndex = avatarIdx || this.avatarIndex;
    this.telegramData = telegramData || this.telegramData;

    if (this.socket && this.socket.connected) {
      this.socket.emit('init_user', {
        playerId: this.playerId,
        nickname: this.playerName,
        avatarIndex: this.avatarIndex,
        telegramData: this.telegramData
      }, callback);
    } else if (callback) {
      callback({ success: true });
    }
  }

  saveSession(roomCode, playerId, name, avatarIdx) {
    this.roomCode = roomCode;
    this.playerId = playerId;
    this.playerName = name;
    this.avatarIndex = avatarIdx;

    localStorage.setItem('mafia_room_code', roomCode);
    localStorage.setItem('mafia_player_id', playerId);
    localStorage.setItem('mafia_player_name', name);
    localStorage.setItem('mafia_avatar_index', avatarIdx);
  }

  clearSession() {
    this.roomCode = null;
    localStorage.removeItem('mafia_room_code');
  }

  quickMatch(name, avatarIdx, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('quick_match', {
        playerName: name,
        avatarIndex: avatarIdx,
        playerId: this.playerId
      }, (res) => {
        if (res && res.success) {
          this.saveSession(res.roomCode, res.playerId, name, avatarIdx);
        }
        if (callback) callback(res);
      });
    } else {
      this.createRoom(name, avatarIdx, true, '', callback);
    }
  }

  createRoom(name, avatarIdx, isPublic, password, callback) {
    // 1. Agar Node serverga ulangan bo'lsak
    if (this.socket && this.socket.connected) {
      this.socket.emit('create_room', {
        playerName: name,
        avatarIndex: avatarIdx,
        isPublic,
        password,
        playerId: this.playerId
      }, (res) => {
        if (res && res.success) {
          this.saveSession(res.roomCode, res.playerId, name, avatarIdx);
        }
        if (callback) callback(res);
      });
      return;
    }

    // 2. Serverless / MQTT xost rejimida darhol xona ochish
    const state = this.createLocalRoom(name, avatarIdx, isPublic, password);
    if (callback) {
      callback({
        success: true,
        roomCode: state.roomCode,
        playerId: this.playerId,
        state: state
      });
    }
    if (this.callbacks.onRoomStateUpdate) {
      this.callbacks.onRoomStateUpdate(state);
    }
  }

  joinRoom(roomCode, name, avatarIdx, password, callback) {
    const cleanCode = (roomCode || '').trim().toUpperCase();

    // 1. Agar serverga ulangan bo'lsak
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', {
        roomCode: cleanCode,
        playerName: name,
        avatarIndex: avatarIdx,
        password,
        playerId: this.playerId
      }, (res) => {
        if (res && res.success) {
          this.saveSession(res.roomCode, res.playerId, name, avatarIdx);
        }
        if (callback) callback(res);
      });
      return;
    }

    // 2. Serverless / MQTT rejimida xonaga qo'shilish
    this.isHost = false;
    this.roomCode = cleanCode;
    this.saveSession(cleanCode, this.playerId, name, avatarIdx);
    this.subscribeMqttRoom(cleanCode);

    this._joinCallback = callback;
    this.sendMqttMessage({
      type: 'JOIN_REQUEST',
      password: password,
      player: {
        id: this.playerId,
        name: name,
        avatarIndex: avatarIdx
      }
    });

    // 5 soniyadan keyin javob kelmasa xatolik berish
    setTimeout(() => {
      if (this._joinCallback) {
        this._joinCallback({
          success: false,
          message: 'Xona topilmadi yoki xona egasi javob bermadi. Kodni tekshiring!'
        });
        this._joinCallback = null;
      }
    }, 5000);
  }

  spectateRoom(roomCode, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('spectate_room', { roomCode }, (res) => {
        if (res && res.success) this.roomCode = res.roomCode;
        if (callback) callback(res);
      });
    } else {
      this.joinRoom(roomCode, 'Tomoshabin', 1, '', callback);
    }
  }

  reconnectSession(roomCode, playerId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('reconnect_session', { roomCode, playerId }, (res) => {
        if (res && res.success) {
          console.log('[Socket] Qayta ulandi:', roomCode);
        } else {
          this.clearSession();
        }
      });
    }
  }

  getProfile(callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('get_profile', { playerId: this.playerId }, callback);
    } else {
      const stats = JSON.parse(localStorage.getItem('mafia_local_stats') || '{}');
      if (callback) {
        callback({
          success: true,
          user: {
            nickname: this.playerName,
            avatarIndex: this.avatarIndex,
            mmr: stats.mmr || 1000,
            rankTier: stats.tier || 'Kumush (Silver)',
            gamesPlayed: stats.games || 0,
            wins: stats.wins || 0,
            winRate: stats.games ? Math.round((stats.wins / stats.games) * 100) : 0,
            favRole: 'Detektiv'
          }
        });
      }
    }
  }

  getLeaderboard(callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('get_leaderboard', callback);
    } else if (callback) {
      callback({
        success: true,
        leaderboard: [
          { rank: 1, nickname: 'Don_Corleone', mmr: 1650, tier: 'Afsona (Grandmaster)', wins: 42, games: 50 },
          { rank: 2, nickname: 'Sherlock_Uz', mmr: 1480, tier: 'Olmos (Diamond)', wins: 35, games: 44 },
          { rank: 3, nickname: 'Doctor_Live', mmr: 1320, tier: 'Platina (Platinum)', wins: 28, games: 39 },
          { rank: 4, nickname: this.playerName || 'Siz', mmr: 1000, tier: 'Kumush (Silver)', wins: 5, games: 8 }
        ]
      });
    }
  }

  getFriends(callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('get_friends', { playerId: this.playerId }, callback);
    } else if (callback) {
      const savedFriends = JSON.parse(localStorage.getItem('mafia_friends') || '[]');
      callback({
        success: true,
        friends: savedFriends.length > 0 ? savedFriends : [
          { id: 'f_ali', nickname: 'Ali_Kop', isOnline: true },
          { id: 'f_vali', nickname: 'Vali_Sher', isOnline: false }
        ]
      });
    }
  }

  addFriend(friendIdentifier, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('add_friend', { playerId: this.playerId, friendIdentifier }, callback);
    } else {
      const savedFriends = JSON.parse(localStorage.getItem('mafia_friends') || '[]');
      savedFriends.push({ id: `f_${Date.now()}`, nickname: friendIdentifier, isOnline: true });
      localStorage.setItem('mafia_friends', JSON.stringify(savedFriends));
      if (callback) callback({ success: true });
    }
  }

  inviteFriend(friendId) {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('invite_friend', {
        friendId,
        roomCode: this.roomCode,
        inviterName: this.playerName
      });
    }
  }

  reportUser(reportedId, reason, details, callback) {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('report_user', {
        reporterId: this.playerId,
        reportedId,
        roomCode: this.roomCode,
        reason,
        details
      }, callback);
    } else if (callback) {
      callback({ success: true });
    }
  }

  savePreset(presetName, settings, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('save_preset', { playerId: this.playerId, presetName, settings }, callback);
    } else {
      const presets = JSON.parse(localStorage.getItem('mafia_presets') || '{}');
      presets[presetName] = settings;
      localStorage.setItem('mafia_presets', JSON.stringify(presets));
      if (callback) callback({ success: true });
    }
  }

  getPresets(callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('get_presets', { playerId: this.playerId }, callback);
    } else {
      const presets = JSON.parse(localStorage.getItem('mafia_presets') || '{}');
      if (callback) callback({ success: true, presets });
    }
  }

  sendReaction(targetId, emoji) {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_reaction', { roomCode: this.roomCode, targetId, emoji });
    } else {
      const data = { senderName: this.playerName, emoji, targetId };
      if (this.callbacks.onReaction) this.callbacks.onReaction(data);
      this.sendMqttMessage({ type: 'REACTION', data });
    }
  }

  updateSettings(settings) {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('update_settings', { roomCode: this.roomCode, settings });
    } else if (this.isHost && this.localRoom) {
      this.localRoom.settings = { ...this.localRoom.settings, ...settings };
      this.broadcastLocalState();
    }
  }

  addBot() {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('add_bot', { roomCode: this.roomCode });
    } else if (this.isHost && this.localRoom) {
      this.addLocalBot();
    }
  }

  removeBot(botId) {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('remove_bot', { roomCode: this.roomCode, botId });
    } else if (this.isHost && this.localRoom) {
      this.removeLocalBot(botId);
    }
  }

  startGame(callback) {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('start_game', { roomCode: this.roomCode }, callback);
    } else if (this.isHost && this.localRoom) {
      this.startLocalGame();
      if (callback) callback({ success: true });
    }
  }

  sendNightAction(actionType, targetId) {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('night_action', { roomCode: this.roomCode, actionType, targetId });
    } else if (this.isHost && this.localRoom) {
      this.handleLocalNightAction(this.playerId, actionType, targetId);
    } else {
      this.sendMqttMessage({
        type: 'NIGHT_ACTION',
        playerId: this.playerId,
        actionType,
        targetId
      });
    }
  }

  sendDayVote(targetId) {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('day_vote', { roomCode: this.roomCode, targetId });
    } else if (this.isHost && this.localRoom) {
      this.handleLocalDayVote(this.playerId, targetId);
    } else {
      this.sendMqttMessage({
        type: 'DAY_VOTE',
        playerId: this.playerId,
        targetId
      });
    }
  }

  sendChat(text, scope = 'all') {
    if (!this.roomCode || !text.trim()) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_chat', { roomCode: this.roomCode, text, scope });
    } else {
      const msg = {
        id: `msg_${Date.now()}`,
        senderId: this.playerId,
        senderName: this.playerName,
        text: text.trim(),
        scope,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: false
      };
      if (this.callbacks.onChatMessage) this.callbacks.onChatMessage(msg);
      this.sendMqttMessage({ type: 'CHAT_MSG', msg });
    }
  }

  restartGame() {
    if (!this.roomCode) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('restart_game', { roomCode: this.roomCode });
    } else if (this.isHost && this.localRoom) {
      this.clearLocalTimers();
      this.localRoom.phase = 'lobby';
      this.localRoom.players.forEach(p => {
        p.isAlive = true;
        p.role = null;
      });
      this.localRoom.nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null, maniacTarget: null };
      this.localRoom.votes = {};
      this.localRoom.lastNightResult = null;
      this.localRoom.gameResult = null;
      this.broadcastLocalState();
    }
  }

  // Admin REST API Fetchers
  async adminLogin(key) {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (data.success) {
        this.adminToken = data.token;
        localStorage.setItem('mafia_admin_token', data.token);
      }
      return data;
    } catch (e) {
      return { success: false, message: 'Serverga ulanib bo\'lmadi' };
    }
  }

  async adminGetDashboard() {
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${this.adminToken}` }
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  async adminGetRooms() {
    try {
      const res = await fetch('/api/admin/rooms', {
        headers: { Authorization: `Bearer ${this.adminToken}` }
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  async adminCloseRoom(roomCode) {
    try {
      const res = await fetch('/api/admin/room/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.adminToken}`
        },
        body: JSON.stringify({ roomCode })
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  async adminGetReports() {
    try {
      const res = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${this.adminToken}` }
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  async adminResolveReport(reportId, action) {
    try {
      const res = await fetch('/api/admin/report/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.adminToken}`
        },
        body: JSON.stringify({ reportId, action })
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  async adminBanUser(userId, reason) {
    try {
      const res = await fetch('/api/admin/user/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.adminToken}`
        },
        body: JSON.stringify({ userId, reason })
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  async adminMuteUser(userId, durationMinutes = 15, reason = 'Moderator tomonidan sukutga olindi') {
    try {
      const res = await fetch('/api/admin/user/mute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.adminToken}`
        },
        body: JSON.stringify({ userId, durationMinutes, reason })
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  async adminUnmuteUser(userId) {
    try {
      const res = await fetch('/api/admin/user/unmute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.adminToken}`
        },
        body: JSON.stringify({ userId })
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  async adminBroadcast(message) {
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.adminToken}`
        },
        body: JSON.stringify({ message })
      });
      return await res.json();
    } catch(e) { return { success: false }; }
  }

  // Auth Metodlari
  authRegister(email, password, nickname, avatarIndex, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('auth_register', { email, password, nickname, avatarIndex }, callback);
    } else if (callback) {
      callback({ success: true, user: { nickname, avatarIndex } });
    }
  }

  authLogin(email, password, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('auth_login', { email, password }, callback);
    } else if (callback) {
      callback({ success: true, user: { nickname: email.split('@')[0], avatarIndex: 1 } });
    }
  }

  authGoogle(email, name, avatarIndex, googleId, callback) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('auth_google', { email, name, avatarIndex, googleId }, callback);
    } else if (callback) {
      callback({ success: true, user: { nickname: name, avatarIndex } });
    }
  }

  sendTypingStatus(roomCode, isTyping) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing_status', { roomCode, isTyping });
    } else {
      this.sendMqttMessage({
        type: 'TYPING',
        data: { userId: this.playerId, userName: this.playerName, isTyping }
      });
    }
  }
}

window.socketClient = new SocketClient();
