/**
 * Socket.io Mijoz qatlami — Enterprise & Admin API
 */
class SocketClient {
  constructor() {
    this.socket = null;
    this.playerId = localStorage.getItem('mafia_player_id') || `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    localStorage.setItem('mafia_player_id', this.playerId);
    
    this.roomCode = localStorage.getItem('mafia_room_code') || null;
    this.playerName = localStorage.getItem('mafia_player_name') || '';
    this.avatarIndex = parseInt(localStorage.getItem('mafia_avatar_index'), 10) || 1;
    this.adminToken = localStorage.getItem('mafia_admin_token') || null;
    this.telegramData = null;
    try {
      this.telegramData = JSON.parse(localStorage.getItem('mafia_tg_data'));
    } catch(e){}

    this.state = null;
    this.callbacks = {};
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
    return '';
  }

  init() {
    const serverUrl = this.getServerUrl();
    const opts = {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      timeout: 10000
    };

    if (serverUrl) {
      console.log('[Socket] Serverga ulanmoqda:', serverUrl);
      this.socket = io(serverUrl, opts);
    } else {
      this.socket = io(opts);
    }

    this.socket.on('connect', () => {
      console.log('[Socket] Serverga ulandi:', this.socket.id);
      this.initUser(this.playerName, this.avatarIndex, this.telegramData);

      if (this.roomCode && this.playerId) {
        this.reconnectSession(this.roomCode, this.playerId);
      }
      if (this.callbacks.onConnect) {
        this.callbacks.onConnect();
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Serverga ulanib bo\'lmadi:', err.message);
      if (this.callbacks.onConnectError) {
        this.callbacks.onConnectError(err);
      }
    });

    this.socket.on('room_state_update', (state) => {
      this.state = state;
      if (this.callbacks.onRoomStateUpdate) {
        this.callbacks.onRoomStateUpdate(state);
      }
    });

    this.socket.on('timer_tick', (data) => {
      if (this.callbacks.onTimerTick) {
        this.callbacks.onTimerTick(data);
      }
    });

    this.socket.on('chat_message', (msg) => {
      if (this.callbacks.onChatMessage) {
        this.callbacks.onChatMessage(msg);
      }
    });

    this.socket.on('chat_history', (data) => {
      if (this.callbacks.onChatHistory) {
        this.callbacks.onChatHistory(data.messages);
      }
    });

    this.socket.on('chat_rate_limited', (data) => {
      if (this.callbacks.onRateLimited) {
        this.callbacks.onRateLimited(data);
      }
    });

    this.socket.on('mafia_night_update', (data) => {
      if (this.callbacks.onMafiaNightUpdate) {
        this.callbacks.onMafiaNightUpdate(data);
      }
    });

    this.socket.on('detective_result', (data) => {
      if (this.callbacks.onDetectiveResult) {
        this.callbacks.onDetectiveResult(data);
      }
    });

    this.socket.on('doctor_action_confirmed', (data) => {
      if (this.callbacks.onDoctorConfirmed) {
        this.callbacks.onDoctorConfirmed(data);
      }
    });

    this.socket.on('day_vote_update', (data) => {
      if (this.callbacks.onDayVoteUpdate) {
        this.callbacks.onDayVoteUpdate(data);
      }
    });

    this.socket.on('player_reaction', (data) => {
      if (this.callbacks.onReaction) {
        this.callbacks.onReaction(data);
      }
    });

    this.socket.on('player_typing', (data) => {
      if (this.callbacks.onPlayerTyping) {
        this.callbacks.onPlayerTyping(data);
      }
    });

    this.socket.on('achievements_unlocked', (unlockedList) => {
      if (this.callbacks.onAchievementsUnlocked) {
        this.callbacks.onAchievementsUnlocked(unlockedList);
      }
    });

    this.socket.on('room_invitation', (data) => {
      if (this.callbacks.onRoomInvitation) {
        this.callbacks.onRoomInvitation(data);
      }
    });

    this.socket.on('system_announcement', (data) => {
      if (this.callbacks.onSystemAnnouncement) {
        this.callbacks.onSystemAnnouncement(data);
      }
    });

    this.socket.on('user_banned', (data) => {
      alert(`Hisobingiz bloklandi: ${data.reason}`);
      window.location.reload();
    });

    this.socket.on('user_muted', (data) => {
      if (this.callbacks.onUserMuted) {
        this.callbacks.onUserMuted(data);
      }
    });

    this.socket.on('user_unmuted', (data) => {
      if (this.callbacks.onUserUnmuted) {
        this.callbacks.onUserUnmuted(data);
      }
    });

    this.socket.on('action_error', (data) => {
      if (this.callbacks.onActionError) {
        this.callbacks.onActionError(data);
      }
    });

    this.socket.on('disconnect', () => {
      console.warn('[Socket] Serverdan aloqa uzildi');
      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect();
      }
    });
  }

  initUser(name, avatarIdx, telegramData, callback) {
    this.playerName = name || this.playerName;
    this.avatarIndex = avatarIdx || this.avatarIndex;
    this.telegramData = telegramData || this.telegramData;

    this.socket.emit('init_user', {
      playerId: this.playerId,
      nickname: this.playerName,
      avatarIndex: this.avatarIndex,
      telegramData: this.telegramData
    }, callback);
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
  }

  createRoom(name, avatarIdx, isPublic, password, callback) {
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
  }

  joinRoom(roomCode, name, avatarIdx, password, callback) {
    this.socket.emit('join_room', {
      roomCode,
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
  }

  spectateRoom(roomCode, callback) {
    this.socket.emit('spectate_room', { roomCode }, (res) => {
      if (res && res.success) {
        this.roomCode = res.roomCode;
      }
      if (callback) callback(res);
    });
  }

  reconnectSession(roomCode, playerId) {
    this.socket.emit('reconnect_session', { roomCode, playerId }, (res) => {
      if (res && res.success) {
        console.log('[Socket] Qayta ulandi:', roomCode);
      } else {
        this.clearSession();
      }
    });
  }

  getProfile(callback) {
    this.socket.emit('get_profile', { playerId: this.playerId }, callback);
  }

  getLeaderboard(callback) {
    this.socket.emit('get_leaderboard', callback);
  }

  getFriends(callback) {
    this.socket.emit('get_friends', { playerId: this.playerId }, callback);
  }

  addFriend(friendIdentifier, callback) {
    this.socket.emit('add_friend', { playerId: this.playerId, friendIdentifier }, callback);
  }

  inviteFriend(friendId) {
    if (!this.roomCode) return;
    this.socket.emit('invite_friend', {
      friendId,
      roomCode: this.roomCode,
      inviterName: this.playerName
    });
  }

  reportUser(reportedId, reason, details, callback) {
    if (!this.roomCode) return;
    this.socket.emit('report_user', {
      reporterId: this.playerId,
      reportedId,
      roomCode: this.roomCode,
      reason,
      details
    }, callback);
  }

  savePreset(presetName, settings, callback) {
    this.socket.emit('save_preset', { playerId: this.playerId, presetName, settings }, callback);
  }

  getPresets(callback) {
    this.socket.emit('get_presets', { playerId: this.playerId }, callback);
  }

  sendReaction(targetId, emoji) {
    if (!this.roomCode) return;
    this.socket.emit('send_reaction', { roomCode: this.roomCode, targetId, emoji });
  }

  updateSettings(settings) {
    if (!this.roomCode) return;
    this.socket.emit('update_settings', { roomCode: this.roomCode, settings });
  }

  addBot() {
    if (!this.roomCode) return;
    this.socket.emit('add_bot', { roomCode: this.roomCode });
  }

  removeBot(botId) {
    if (!this.roomCode) return;
    this.socket.emit('remove_bot', { roomCode: this.roomCode, botId });
  }

  startGame(callback) {
    if (!this.roomCode) return;
    this.socket.emit('start_game', { roomCode: this.roomCode }, callback);
  }

  sendNightAction(actionType, targetId) {
    if (!this.roomCode) return;
    this.socket.emit('night_action', { roomCode: this.roomCode, actionType, targetId });
  }

  sendDayVote(targetId) {
    if (!this.roomCode) return;
    this.socket.emit('day_vote', { roomCode: this.roomCode, targetId });
  }

  sendChat(text, scope = 'all') {
    if (!this.roomCode) return;
    this.socket.emit('send_chat', { roomCode: this.roomCode, text, scope });
  }

  restartGame() {
    if (!this.roomCode) return;
    this.socket.emit('restart_game', { roomCode: this.roomCode });
  }

  // --- ADMIN REST API FETCHERS ---
  async adminLogin(key) {
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
  }

  async adminGetDashboard() {
    const res = await fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${this.adminToken}` }
    });
    return res.json();
  }

  async adminGetRooms() {
    const res = await fetch('/api/admin/rooms', {
      headers: { Authorization: `Bearer ${this.adminToken}` }
    });
    return res.json();
  }

  async adminCloseRoom(roomCode) {
    const res = await fetch('/api/admin/room/close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.adminToken}`
      },
      body: JSON.stringify({ roomCode })
    });
    return res.json();
  }

  async adminGetReports() {
    const res = await fetch('/api/admin/reports', {
      headers: { Authorization: `Bearer ${this.adminToken}` }
    });
    return res.json();
  }

  async adminResolveReport(reportId, action) {
    const res = await fetch('/api/admin/report/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.adminToken}`
      },
      body: JSON.stringify({ reportId, action })
    });
    return res.json();
  }

  async adminBanUser(userId, reason) {
    const res = await fetch('/api/admin/user/ban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.adminToken}`
      },
      body: JSON.stringify({ userId, reason })
    });
    return res.json();
  }

  async adminMuteUser(userId, durationMinutes = 15, reason = 'Moderator tomonidan sukutga olindi') {
    const res = await fetch('/api/admin/user/mute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.adminToken}`
      },
      body: JSON.stringify({ userId, durationMinutes, reason })
    });
    return res.json();
  }

  async adminUnmuteUser(userId) {
    const res = await fetch('/api/admin/user/unmute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.adminToken}`
      },
      body: JSON.stringify({ userId })
    });
    return res.json();
  }

  async adminBroadcast(message) {
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.adminToken}`
      },
      body: JSON.stringify({ message })
    });
    return res.json();
  }

  // Auth Metodlari
  authRegister(email, password, nickname, avatarIndex, callback) {
    this.socket.emit('auth_register', { email, password, nickname, avatarIndex }, callback);
  }

  authLogin(email, password, callback) {
    this.socket.emit('auth_login', { email, password }, callback);
  }

  authGoogle(email, name, avatarIndex, googleId, callback) {
    this.socket.emit('auth_google', { email, name, avatarIndex, googleId }, callback);
  }

  sendTypingStatus(roomCode, isTyping) {
    this.socket.emit('typing_status', { roomCode, isTyping });
  }
}

window.socketClient = new SocketClient();
