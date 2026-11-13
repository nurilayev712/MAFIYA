/**
 * Mafiya Enterprise — Asosiy Frontend Dasturi
 */

document.addEventListener('DOMContentLoaded', () => {
  const screens = {
    home: document.getElementById('screen-home'),
    lobby: document.getElementById('screen-lobby'),
    roleReveal: document.getElementById('screen-role-reveal'),
    game: document.getElementById('screen-game'),
    gameOver: document.getElementById('screen-game-over')
  };

  // Modallar
  const createModal = document.getElementById('create-room-modal');
  const joinModal = document.getElementById('join-modal');
  const rulesModal = document.getElementById('rules-modal');
  const profileModal = document.getElementById('profile-modal');
  const friendsModal = document.getElementById('friends-modal');
  const achievementsModal = document.getElementById('achievements-modal');
  const leaderboardModal = document.getElementById('leaderboard-modal');
  const spectatorModal = document.getElementById('spectator-modal');
  const adminModal = document.getElementById('admin-modal');
  const reportModal = document.getElementById('report-modal');
  const serverSettingsModal = document.getElementById('server-settings-modal');
  const tutorialModal = document.getElementById('tutorial-modal');
  const customRulesModal = document.getElementById('custom-rules-modal');
  const streakRewardModal = document.getElementById('streak-reward-modal');

  const toastContainer = document.getElementById('toast-container');
  const floatingContainer = document.getElementById('floating-emojis-container');

  const AVATARS = [
    { id: 1, icon: '🕵️‍♂️' },
    { id: 2, icon: '🎩' },
    { id: 3, icon: '🕶️' },
    { id: 4, icon: '👨‍⚕️' },
    { id: 5, icon: '👩‍💼' },
    { id: 6, icon: '🎭' },
    { id: 7, icon: '🧔' },
    { id: 8, icon: '🧛' }
  ];

  let selectedAvatarId = 1;
  let currentRoomState = null;
  let currentChatTab = 'all'; // 'all', 'mafia', 'ghost'
  let myNightTarget = null;
  let myDayVote = null;
  let maxTimeForCurrentPhase = 30;
  let isCreateRoomPublic = true;
  let selectedReactionEmoji = null;
  let reportTargetUserId = null;

  // 1. DASTLABKI YUKLASH VA I18N
  function initApp() {
    window.i18n.setLang(window.i18n.lang);
    document.getElementById('current-lang-text').textContent = window.i18n.lang.toUpperCase();

    const avatarContainer = document.getElementById('avatar-selector');
    avatarContainer.innerHTML = '';

    const savedAvatar = parseInt(localStorage.getItem('mafia_avatar_index'), 10) || 1;
    selectedAvatarId = savedAvatar;

    AVATARS.forEach(av => {
      const div = document.createElement('div');
      div.className = `avatar-opt ${av.id === selectedAvatarId ? 'selected' : ''}`;
      div.textContent = av.icon;
      div.dataset.id = av.id;
      div.addEventListener('click', () => {
        window.sounds.playClick();
        document.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        selectedAvatarId = av.id;
        localStorage.setItem('mafia_avatar_index', av.id);
      });
      avatarContainer.appendChild(div);
    });

    const savedName = localStorage.getItem('mafia_player_name') || '';
    if (savedName) {
      document.getElementById('player-name-input').value = savedName;
    } else {
      const defaultName = `Don_${Math.floor(100 + Math.random() * 900)}`;
      document.getElementById('player-name-input').value = defaultName;
      localStorage.setItem('mafia_player_name', defaultName);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      document.getElementById('join-room-code-input').value = roomParam.toUpperCase();
      openModal(joinModal);
    }

    // Ping o'lchash
    measurePing();
    setInterval(measurePing, 5000);

    // Hash orqali admin modal ochish (#admin)
    if (window.location.hash === '#admin') {
      openModal(adminModal);
    }

    // Phase 4: Kunlik streak va Maxsus qoidalar muharriri
    initDailyStreak();
    initCustomRuleEditor();
  }

  function measurePing() {
    const start = Date.now();
    fetch('/api/rooms').then(() => {
      const ping = Date.now() - start;
      const el = document.getElementById('ping-text');
      if (el) el.textContent = `${ping}ms`;
    }).catch(() => {});
  }

  function showScreen(screenKey) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[screenKey]) {
      screens[screenKey].classList.add('active');
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'success') icon = 'fa-circle-check';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function openModal(modal) {
    window.sounds.playClick();
    modal.classList.add('active');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
  }

  // 2. HEADER TUGMALARI
  const langToggleBtn = document.getElementById('btn-lang-toggle');
  const langDropdown = document.getElementById('lang-dropdown');

  langToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langDropdown.style.display = langDropdown.style.display === 'none' ? 'block' : 'none';
  });

  document.querySelectorAll('.lang-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const lang = opt.dataset.lang;
      window.i18n.setLang(lang);
      document.getElementById('current-lang-text').textContent = lang.toUpperCase();
      langDropdown.style.display = 'none';
      window.sounds.playClick();
      showToast(`Til: ${lang.toUpperCase()}`, 'success');
    });
  });

  document.addEventListener('click', () => {
    langDropdown.style.display = 'none';
  });

  // Header modallar ochish
  document.getElementById('rules-btn').addEventListener('click', () => openModal(rulesModal));
  document.getElementById('close-rules-modal').addEventListener('click', () => closeModal(rulesModal));

  document.getElementById('btn-open-leaderboard').addEventListener('click', () => {
    openModal(leaderboardModal);
    loadLeaderboardData();
  });
  document.getElementById('close-leaderboard-modal').addEventListener('click', () => closeModal(leaderboardModal));

  document.getElementById('btn-open-spectator').addEventListener('click', () => {
    openModal(spectatorModal);
    loadSpectatorRooms();
  });
  document.getElementById('close-spectator-modal').addEventListener('click', () => closeModal(spectatorModal));

  document.getElementById('btn-open-admin').addEventListener('click', () => {
    openModal(adminModal);
    if (window.socketClient.adminToken) {
      document.getElementById('admin-login-box').style.display = 'none';
      document.getElementById('admin-panel-content').style.display = 'block';
      loadAdminDashboard();
    }
  });
  document.getElementById('close-admin-modal').addEventListener('click', () => closeModal(adminModal));

  document.getElementById('btn-open-profile').addEventListener('click', () => {
    openModal(profileModal);
    loadProfileData();
  });
  document.getElementById('close-profile-modal').addEventListener('click', () => closeModal(profileModal));

  document.getElementById('btn-open-friends').addEventListener('click', () => {
    openModal(friendsModal);
    loadFriendsData();
  });
  document.getElementById('close-friends-modal').addEventListener('click', () => closeModal(friendsModal));

  document.getElementById('btn-open-achievements').addEventListener('click', () => {
    openModal(achievementsModal);
    loadAchievementsData();
  });
  document.getElementById('close-achievements-modal').addEventListener('click', () => closeModal(achievementsModal));

  document.getElementById('close-report-modal').addEventListener('click', () => closeModal(reportModal));
  document.getElementById('btn-cancel-report').addEventListener('click', () => closeModal(reportModal));

  // Server sozlamalari modali
  const btnOpenServer = document.getElementById('btn-open-server-settings');
  if (btnOpenServer) {
    btnOpenServer.addEventListener('click', () => {
      openModal(serverSettingsModal);
      const cur = localStorage.getItem('mafia_server_url') || '';
      document.getElementById('custom-server-url-input').value = cur;
    });
  }
  document.getElementById('close-server-settings-modal')?.addEventListener('click', () => closeModal(serverSettingsModal));
  document.getElementById('btn-save-server')?.addEventListener('click', () => {
    const val = document.getElementById('custom-server-url-input').value.trim();
    if (val) {
      localStorage.setItem('mafia_server_url', val);
      showToast('Server manzili saqlandi! Sahifa yangilanmoqda...', 'success');
    } else {
      localStorage.removeItem('mafia_server_url');
      showToast('Standart serverga qaytarildi! Sahifa yangilanmoqda...', 'info');
    }
    setTimeout(() => window.location.reload(), 1000);
  });
  document.getElementById('btn-reset-server')?.addEventListener('click', () => {
    localStorage.removeItem('mafia_server_url');
    document.getElementById('custom-server-url-input').value = '';
    showToast('Standart serverga qaytarildi. Sahifa yangilanmoqda...', 'info');
    setTimeout(() => window.location.reload(), 1000);
  });

  document.getElementById('sound-btn').addEventListener('click', () => {
    const isMuted = window.sounds.toggleMute();
    const icon = document.getElementById('sound-icon');
    if (isMuted) {
      icon.className = 'fa-solid fa-volume-xmark';
      icon.style.color = '#ff475e';
      showToast('Tovush o\'chirildi', 'info');
    } else {
      icon.className = 'fa-solid fa-volume-high';
      icon.style.color = '';
      window.sounds.playClick();
      showToast('Tovush yoqildi', 'success');
    }
  });

  document.getElementById('btn-telegram-login').addEventListener('click', () => {
    window.sounds.playClick();
    const promptName = prompt("Telegram profilingiz ismini kiriting:", "TelegramFoydalanuvchi");
    if (promptName && promptName.trim()) {
      const cleanName = promptName.trim().substring(0, 15);
      document.getElementById('player-name-input').value = cleanName;
      const tgData = { id: `tg_${Date.now()}`, username: cleanName };
      localStorage.setItem('mafia_tg_data', JSON.stringify(tgData));
      window.socketClient.initUser(cleanName, selectedAvatarId, tgData);
      showToast(`Telegram orqali ulandi: @${cleanName}`, 'success');
    }
  });

  // 3. BOSH SAHIFA HODISALARI
  document.getElementById('btn-quick-match').addEventListener('click', () => {
    window.sounds.playClick();
    const nameInput = document.getElementById('player-name-input').value.trim();
    if (!nameInput) {
      showToast('Iltimos, avval ismingizni kiriting!', 'error');
      document.getElementById('player-name-input').focus();
      return;
    }

    showToast('MMR darajangizga mos ochiq xona qidirilmoqda...', 'info');
    window.socketClient.quickMatch(nameInput, selectedAvatarId, (res) => {
      if (res && res.success) {
        if (res.isNew) {
          showToast(`Yangi MMR xonasi ochildi: ${res.roomCode}`, 'success');
        } else {
          showToast(`Xonaga ulandingiz: ${res.roomCode}`, 'success');
        }
      } else {
        showToast(res?.message || 'Xatolik yuz berdi', 'error');
      }
    });
  });

  document.getElementById('btn-show-create-modal').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name-input').value.trim();
    if (!nameInput) {
      showToast('Iltimos, avval ismingizni kiriting!', 'error');
      document.getElementById('player-name-input').focus();
      return;
    }
    openModal(createModal);
  });
  document.getElementById('close-create-modal').addEventListener('click', () => closeModal(createModal));
  document.getElementById('btn-cancel-create').addEventListener('click', () => closeModal(createModal));

  const optPublic = document.getElementById('type-opt-public');
  const optPrivate = document.getElementById('type-opt-private');
  const passWrap = document.getElementById('private-password-wrap');

  optPublic.addEventListener('click', () => {
    window.sounds.playClick();
    optPublic.classList.add('active');
    optPrivate.classList.remove('active');
    passWrap.style.display = 'none';
    isCreateRoomPublic = true;
  });

  optPrivate.addEventListener('click', () => {
    window.sounds.playClick();
    optPrivate.classList.add('active');
    optPublic.classList.remove('active');
    passWrap.style.display = 'block';
    isCreateRoomPublic = false;
  });

  document.getElementById('btn-confirm-create').addEventListener('click', () => {
    window.sounds.playClick();
    const nameInput = document.getElementById('player-name-input').value.trim();
    const password = document.getElementById('create-room-password').value.trim();

    window.socketClient.createRoom(nameInput, selectedAvatarId, isCreateRoomPublic, password, (res) => {
      if (res && res.success) {
        closeModal(createModal);
        showToast('Xona yaratildi!', 'success');
      } else {
        showToast(res?.message || 'Xatolik', 'error');
      }
    });
  });

  document.getElementById('btn-show-join-modal').addEventListener('click', () => openModal(joinModal));
  document.getElementById('close-join-modal').addEventListener('click', () => closeModal(joinModal));
  document.getElementById('btn-cancel-join').addEventListener('click', () => closeModal(joinModal));

  document.getElementById('btn-confirm-join').addEventListener('click', () => {
    window.sounds.playClick();
    const nameInput = document.getElementById('player-name-input').value.trim();
    const codeInput = document.getElementById('join-room-code-input').value.trim().toUpperCase();
    const passwordInput = document.getElementById('join-password-input').value.trim();

    if (!nameInput) {
      showToast('Ismingizni kiriting!', 'error');
      closeModal(joinModal);
      document.getElementById('player-name-input').focus();
      return;
    }

    if (!codeInput) {
      showToast('Xona kodini kiriting!', 'error');
      return;
    }

    window.socketClient.joinRoom(codeInput, nameInput, selectedAvatarId, passwordInput, (res) => {
      if (res && res.success) {
        closeModal(joinModal);
        showToast('Xonaga qo\'shildingiz!', 'success');
      } else {
        if (res?.needsPassword) {
          document.getElementById('join-password-wrap').style.display = 'block';
        }
        showToast(res?.message || 'Xatolik', 'error');
      }
    });
  });

  // 4. LOBBI HODISALARI
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    window.sounds.playClick();
    if (!currentRoomState) return;
    navigator.clipboard.writeText(currentRoomState.roomCode).then(() => {
      showToast(`Nusxalandi: ${currentRoomState.roomCode}`, 'success');
    });
  });

  document.getElementById('btn-share-link').addEventListener('click', () => {
    window.sounds.playClick();
    if (!currentRoomState) return;
    const shareUrl = `${window.location.origin}?room=${currentRoomState.roomCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Mafiya O\'yini',
        text: `Men bilan "Mafiya" o'ynang! KOD: ${currentRoomState.roomCode}`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Havola nusxalandi!', 'success');
      });
    }
  });

  // Custom Preset saqlash
  document.getElementById('btn-save-custom-preset').addEventListener('click', () => {
    window.sounds.playClick();
    const name = prompt("Maxsus sozlamalar to'plami (Preset) nomini kiriting:", "MeningRejimim");
    if (!name || !name.trim()) return;

    if (currentRoomState) {
      window.socketClient.savePreset(name.trim(), currentRoomState.settings, (res) => {
        if (res && res.success) {
          showToast(`Preset saqlandi: ${name}`, 'success');
        }
      });
    }
  });

  function emitSettingsChange() {
    if (!currentRoomState || currentRoomState.hostId !== window.socketClient.playerId) return;

    const mafiaCount = parseInt(document.getElementById('mafia-count-val').textContent, 10) || 1;
    const hasDoctor = document.getElementById('setting-doctor').checked;
    const hasDetective = document.getElementById('setting-detective').checked;
    const hasMayor = document.getElementById('setting-mayor').checked;
    const hasManiac = document.getElementById('setting-maniac').checked;
    const hasJester = document.getElementById('setting-jester').checked;
    const hasLovers = document.getElementById('setting-lovers').checked;

    const autoFillBots = document.getElementById('setting-auto-fill-bots') ? document.getElementById('setting-auto-fill-bots').checked : true;
    const botDifficulty = document.getElementById('setting-bot-difficulty') ? document.getElementById('setting-bot-difficulty').value : 'medium';
    const revealBotsAtEnd = document.getElementById('setting-reveal-bots') ? document.getElementById('setting-reveal-bots').checked : true;

    const nightTime = parseInt(document.getElementById('time-night').value, 10) || 30;
    const discussionTime = parseInt(document.getElementById('time-discuss').value, 10) || 60;
    const votingTime = parseInt(document.getElementById('time-vote').value, 10) || 30;

    window.socketClient.updateSettings({
      mafiaCount,
      hasDoctor,
      hasDetective,
      hasMayor,
      hasManiac,
      hasJester,
      hasLovers,
      autoFillBots,
      botDifficulty,
      revealBotsAtEnd,
      nightTime,
      discussionTime,
      votingTime
    });
  }

  document.getElementById('btn-mafia-plus').addEventListener('click', () => {
    window.sounds.playClick();
    const valElem = document.getElementById('mafia-count-val');
    valElem.textContent = parseInt(valElem.textContent, 10) + 1;
    emitSettingsChange();
  });

  document.getElementById('btn-mafia-minus').addEventListener('click', () => {
    window.sounds.playClick();
    const valElem = document.getElementById('mafia-count-val');
    let val = parseInt(valElem.textContent, 10);
    if (val > 1) {
      valElem.textContent = val - 1;
      emitSettingsChange();
    }
  });

  ['setting-doctor', 'setting-detective', 'setting-mayor', 'setting-maniac', 'setting-jester', 'setting-lovers', 'setting-auto-fill-bots', 'setting-reveal-bots', 'setting-bot-difficulty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        window.sounds.playClick();
        emitSettingsChange();
      });
    }
  });

  ['time-night', 'time-discuss', 'time-vote'].forEach(id => {
    document.getElementById(id).addEventListener('change', emitSettingsChange);
  });

  const onAddBotClick = () => {
    window.sounds.playClick();
    window.socketClient.addBot();
    showToast("Bot qo'shildi 🤖", 'info');
  };
  document.getElementById('btn-add-bot').addEventListener('click', onAddBotClick);
  const quickAddBotBtn = document.getElementById('btn-quick-add-bot');
  if (quickAddBotBtn) {
    quickAddBotBtn.addEventListener('click', onAddBotClick);
  }

  document.getElementById('btn-start-game').addEventListener('click', () => {
    window.sounds.playClick();
    if (!currentRoomState) return;

    const count = currentRoomState.players ? currentRoomState.players.length : 1;
    const autoFill = currentRoomState.settings ? (currentRoomState.settings.autoFillBots !== false) : true;

    if (count < 3 && !autoFill) {
      showToast("O'yinni boshlash uchun kamida 3 nafar o'yinchi kerak! '+ Bot qo'shish' tugmasini bosing yoki sozlamalarda avto-to'ldirishni yoqing.", 'error');
      return;
    }

    const startBtn = document.getElementById('btn-start-game');
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> O\'yin boshlanmoqda...';

    window.socketClient.startGame((res) => {
      startBtn.disabled = false;
      startBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span data-i18n="startGame">O\'yinni boshlash</span>';
      if (res && !res.success) {
        showToast(res.message || "O'yinni boshlashda xatolik yuz berdi", 'error');
      }
    });
  });

  // 5. O'YIN VA REAKSIYALAR
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.sounds.playClick();
      const emoji = btn.dataset.emoji;
      if (currentRoomState) {
        window.socketClient.sendReaction(currentRoomState.roomCode, emoji);
      }
      showFloatingEmoji(emoji);
      showToast(`Reaksiya yuborildi: ${emoji}`, 'info');
    });
  });

  const tabPublic = document.getElementById('tab-public-chat');
  const tabMafia = document.getElementById('tab-mafia-chat');
  const tabGhost = document.getElementById('tab-ghost-chat');

  tabPublic.addEventListener('click', () => {
    window.sounds.playClick();
    tabPublic.classList.add('active');
    tabMafia.classList.remove('active');
    tabGhost.classList.remove('active');
    currentChatTab = 'all';
    filterChatMessages();
  });

  tabMafia.addEventListener('click', () => {
    window.sounds.playClick();
    tabMafia.classList.add('active');
    tabPublic.classList.remove('active');
    tabGhost.classList.remove('active');
    currentChatTab = 'mafia';
    filterChatMessages();
  });

  tabGhost.addEventListener('click', () => {
    window.sounds.playClick();
    tabGhost.classList.add('active');
    tabPublic.classList.remove('active');
    tabMafia.classList.remove('active');
    currentChatTab = 'ghost';
    filterChatMessages();
  });

  document.getElementById('chat-input-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input-text');
    const text = input.value.trim();
    if (!text) return;

    window.socketClient.sendChat(text, currentChatTab);
    input.value = '';
    window.sounds.playClick();
  });

  document.getElementById('btn-skip-vote').addEventListener('click', () => {
    window.sounds.playClick();
    myDayVote = 'skip';
    window.socketClient.sendDayVote('skip');
    showToast('Ovoz berishni o\'tkazib yubordingiz (Skip)', 'info');
    renderGamePlayers();
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    window.sounds.playClick();
    window.socketClient.restartGame();
  });

  document.getElementById('btn-leave-to-home').addEventListener('click', () => {
    window.sounds.playClick();
    window.socketClient.clearSession();
    window.location.reload();
  });

  document.getElementById('btn-gameover-profile').addEventListener('click', () => {
    openModal(profileModal);
    loadProfileData();
  });

  // Shikoyat yuborish
  document.getElementById('btn-confirm-report').addEventListener('click', () => {
    window.sounds.playClick();
    if (!reportTargetUserId) return;

    const reason = document.getElementById('report-reason-select').value;
    const details = document.getElementById('report-details-input').value.trim();

    window.socketClient.reportUser(reportTargetUserId, reason, details, (res) => {
      if (res && res.success) {
        showToast(res.message, 'success');
        closeModal(reportModal);
      } else {
        showToast(res?.message || 'Xatolik', 'error');
      }
    });
  });

  // 6. SERVER EVENTLARI
  window.socketClient.callbacks.onRoomStateUpdate = (state) => {
    const prevPhase = currentRoomState ? currentRoomState.phase : null;
    currentRoomState = state;

    if (prevPhase !== state.phase) {
      handlePhaseTransition(prevPhase, state.phase, state);
    }

    renderCurrentScreen(state);
  };

  window.socketClient.callbacks.onTimerTick = ({ timeLeft, phase }) => {
    updateTimerDisplay(timeLeft, phase);
  };

  window.socketClient.callbacks.onChatMessage = (msg) => {
    appendChatMessage(msg);
  };

  window.socketClient.callbacks.onChatHistory = (messages) => {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    messages.forEach(msg => appendChatMessage(msg));
  };

  window.socketClient.callbacks.onRateLimited = (data) => {
    showToast(data.message, 'error');
  };

  window.socketClient.callbacks.onMafiaNightUpdate = (data) => {
    if (currentRoomState) {
      currentRoomState.nightActions = data;
      renderGamePlayers();
    }
  };

  window.socketClient.callbacks.onDetectiveResult = (data) => {
    const msg = data.isMafia
      ? `🚨 TEKSHIRUV: **${data.targetName}** — MAFIYA!`
      : `✅ TEKSHIRUV: **${data.targetName}** — Tinch aholi.`;
    showToast(msg, data.isMafia ? 'error' : 'success');
    window.sounds.playDay();
  };

  window.socketClient.callbacks.onDoctorConfirmed = () => {
    showToast('Shifokor himoyasi tasdiqlandi.', 'success');
  };

  window.socketClient.callbacks.onDayVoteUpdate = (data) => {
    if (currentRoomState) {
      currentRoomState.votes = data.votes;
      renderGamePlayers();
    }
  };

  window.socketClient.callbacks.onReaction = ({ senderName, emoji, targetId }) => {
    showFloatingEmoji(emoji);
    const targetPlayer = currentRoomState?.players.find(p => p.id === targetId);
    showToast(`${senderName} ➡️ ${targetPlayer ? targetPlayer.name : ''}: ${emoji}`, 'info');
  };

  window.socketClient.callbacks.onPlayerTyping = (data) => {
    const indicator = document.getElementById('chat-typing-indicator');
    const textEl = document.getElementById('typing-text');
    if (!indicator || !textEl) return;
    if (data.isTyping) {
      textEl.textContent = `${data.playerName} yozmoqda...`;
      indicator.style.display = 'block';
    } else {
      indicator.style.display = 'none';
    }
  };

  window.socketClient.callbacks.onAchievementsUnlocked = (unlockedList) => {
    unlockedList.forEach(ach => {
      showToast(`🏆 YUTUQ OCHILDI: ${ach.icon} ${ach.title} — ${ach.desc}`, 'success');
      window.sounds.playVictory();
    });
  };

  window.socketClient.callbacks.onRoomInvitation = ({ roomCode, inviterName }) => {
    if (confirm(`${inviterName} sizni o'yin xonasiga taklif qilmoqda (KOD: ${roomCode}). Qo'shilasizmi?`)) {
      document.getElementById('join-room-code-input').value = roomCode;
      document.getElementById('btn-confirm-join').click();
    }
  };

  window.socketClient.callbacks.onSystemAnnouncement = ({ title, message }) => {
    alert(`${title}\n\n${message}`);
  };

  window.socketClient.callbacks.onUserMuted = ({ durationMinutes, reason }) => {
    showToast(`🔇 Siz ${durationMinutes} daqiqaga ovozsiz rejimga olindingiz! Sabab: ${reason}`, 'error');
  };

  window.socketClient.callbacks.onUserUnmuted = ({ message }) => {
    showToast(`🔊 ${message || 'Ovozsiz rejim bekor qilindi.'}`, 'success');
  };

  window.socketClient.callbacks.onActionError = ({ message }) => {
    showToast(`⚠️ ${message}`, 'error');
  };

  window.socketClient.callbacks.onDisconnect = () => {
    showToast('⚠️ Serverdan aloqa uzildi. Qayta ulanish kutilmoqda...', 'error');
  };

  function showFloatingEmoji(emoji) {
    const span = document.createElement('span');
    span.className = 'floating-emoji';
    span.textContent = emoji;
    span.style.left = `${30 + Math.random() * 40}%`;
    span.style.top = `${50 + Math.random() * 20}%`;
    floatingContainer.appendChild(span);
    setTimeout(() => span.remove(), 2300);
  }

  // 7. RENDERLAR
  function renderCurrentScreen(state) {
    switch (state.phase) {
      case 'lobby':
        showScreen('lobby');
        renderLobby(state);
        break;
      case 'role_reveal':
        showScreen('roleReveal');
        renderRoleReveal(state);
        break;
      case 'night':
      case 'day_announce':
      case 'day_discussion':
      case 'day_voting':
      case 'day_voting_result':
        showScreen('game');
        renderGame(state);
        break;
      case 'game_over':
        showScreen('gameOver');
        renderGameOver(state);
        break;
    }
  }

  function handlePhaseTransition(oldPhase, newPhase, state) {
    myNightTarget = null;
    myDayVote = null;

    if (newPhase === 'night') {
      window.sounds.playNight();
      maxTimeForCurrentPhase = state.settings.nightTime || 30;
      showToast('Tun kirdi... Shahar uyquga ketdi.', 'info');
      // Mobil qurilmada avtomatik maydon tabiga o'tish
      switchToMobileBoard();
    } else if (newPhase === 'day_announce' || newPhase === 'day_discussion') {
      window.sounds.playDay();
      maxTimeForCurrentPhase = state.settings.discussionTime || 60;
      if (state.lastNightResult?.killedList?.length > 0) {
        window.sounds.playDeath();
      }
    } else if (newPhase === 'day_voting') {
      window.sounds.playClick();
      maxTimeForCurrentPhase = state.settings.votingTime || 30;
      showToast('Ovoz berish fazasi boshlandi!', 'info');
      // Mobil qurilmada avtomatik ovoz berish maydoniga o'tish
      switchToMobileBoard();
    } else if (newPhase === 'game_over') {
      window.sounds.playVictory();
    }
  }

  function renderLobby(state) {
    document.getElementById('lobby-room-code').textContent = state.roomCode;
    document.getElementById('player-count').textContent = state.players.length;
    document.getElementById('room-visibility-badge').textContent = state.isPublic ? '🌐 Ochiq xona' : '🔒 Yopiq xona';
    document.getElementById('room-avg-mmr').textContent = `MMR: ${state.avgMmr || 1000}`;

    const myId = window.socketClient.playerId;
    const isHost = (state.hostId === myId) || 
                   (state.players && state.players.some(p => p.id === myId && p.isHost));
    const startBtn = document.getElementById('btn-start-game');
    const waitingMsg = document.getElementById('waiting-host-msg');
    const addBotBtn = document.getElementById('btn-add-bot');
    const quickAddBotBtn = document.getElementById('btn-quick-add-bot');

    if (isHost) {
      startBtn.style.display = 'inline-flex';
      waitingMsg.style.display = 'none';
      if (addBotBtn) addBotBtn.style.display = 'inline-flex';
      if (quickAddBotBtn) quickAddBotBtn.style.display = 'inline-flex';

      ['btn-mafia-plus', 'btn-mafia-minus', 'setting-doctor', 'setting-detective', 'setting-mayor', 'setting-maniac', 'setting-jester', 'setting-lovers', 'setting-auto-fill-bots', 'setting-reveal-bots', 'setting-bot-difficulty'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
      });
    } else {
      startBtn.style.display = 'none';
      waitingMsg.style.display = 'block';
      if (addBotBtn) addBotBtn.style.display = 'none';
      if (quickAddBotBtn) quickAddBotBtn.style.display = 'none';

      ['btn-mafia-plus', 'btn-mafia-minus', 'setting-doctor', 'setting-detective', 'setting-mayor', 'setting-maniac', 'setting-jester', 'setting-lovers', 'setting-auto-fill-bots', 'setting-reveal-bots', 'setting-bot-difficulty'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
      });
    }

    document.getElementById('mafia-count-val').textContent = state.settings.mafiaCount;
    document.getElementById('setting-doctor').checked = state.settings.hasDoctor;
    document.getElementById('setting-detective').checked = state.settings.hasDetective;
    document.getElementById('setting-mayor').checked = state.settings.hasMayor;
    document.getElementById('setting-maniac').checked = state.settings.hasManiac;
    document.getElementById('setting-jester').checked = state.settings.hasJester;
    document.getElementById('setting-lovers').checked = state.settings.hasLovers;

    if (document.getElementById('setting-auto-fill-bots') && state.settings.autoFillBots !== undefined) {
      document.getElementById('setting-auto-fill-bots').checked = state.settings.autoFillBots;
    }
    if (document.getElementById('setting-bot-difficulty') && state.settings.botDifficulty) {
      document.getElementById('setting-bot-difficulty').value = state.settings.botDifficulty;
    }
    if (document.getElementById('setting-reveal-bots') && state.settings.revealBotsAtEnd !== undefined) {
      document.getElementById('setting-reveal-bots').checked = state.settings.revealBotsAtEnd;
    }

    document.getElementById('time-night').value = state.settings.nightTime;
    document.getElementById('time-discuss').value = state.settings.discussionTime;
    document.getElementById('time-vote').value = state.settings.votingTime;

    const list = document.getElementById('lobby-players-list');
    list.innerHTML = '';

    state.players.forEach(p => {
      const isMe = p.id === window.socketClient.playerId;
      const avatarIcon = AVATARS.find(a => a.id === p.avatarIndex)?.icon || '👤';

      const card = document.createElement('div');
      card.className = `player-lobby-card ${isMe ? 'is-you' : ''}`;

      let crownHtml = p.isHost ? '<span class="host-crown-badge"><i class="fa-solid fa-crown"></i></span>' : '';
      let botRemoveHtml = (isHost && p.isBot) ? `<button class="btn-remove-bot" data-botid="${p.id}">&times;</button>` : '';

      card.innerHTML = `
        ${crownHtml}
        ${botRemoveHtml}
        <div class="player-avatar-icon">${avatarIcon}</div>
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-status-tag">${isMe ? '(Siz)' : (p.isBot ? '🤖 Bot' : 'O\'yinchi')}</div>
      `;

      if (isHost && p.isBot) {
        card.querySelector('.btn-remove-bot').addEventListener('click', (e) => {
          e.stopPropagation();
          window.sounds.playClick();
          window.socketClient.removeBot(p.id);
        });
      }

      list.appendChild(card);
    });

    const minHint = document.getElementById('min-players-hint');
    const autoFill = state.settings?.autoFillBots !== false;

    if (state.players.length < 3) {
      if (autoFill) {
        minHint.textContent = `Avto-to'ldirish yoqilgan (boshlanganda 4 tagacha botlar qo'shiladi)`;
        minHint.style.color = '#60a5fa';
      } else {
        minHint.textContent = `Kamida 3 o'yinchi kerak (yana ${3 - state.players.length} ta)`;
        minHint.style.color = '#ff6b7d';
      }
    } else {
      minHint.textContent = 'O\'yinni boshlashga tayyor!';
      minHint.style.color = '#69f0ae';
    }

    // Xost uchun 'O'yinni boshlash' tugmasi doimo bosiladigan faol holatda qoladi
    startBtn.disabled = false;
  }

  function renderRoleReveal(state) {
    const roleInfo = state.myRoleInfo;
    if (!roleInfo) return;

    const titleEl = document.getElementById('reveal-role-title');
    const teamEl = document.getElementById('reveal-role-team');
    const descEl = document.getElementById('reveal-role-desc');
    const iconEl = document.getElementById('reveal-role-icon');
    const cardEl = document.getElementById('role-card-inner');
    const partnersBox = document.getElementById('reveal-partners-box');
    const partnersList = document.getElementById('reveal-partners-list');
    const loverBox = document.getElementById('reveal-lover-box');
    const loverName = document.getElementById('reveal-lover-name');

    titleEl.textContent = roleInfo.name;
    descEl.textContent = roleInfo.description;
    iconEl.innerHTML = `<i class="fa-solid ${roleInfo.icon}"></i>`;
    cardEl.style.borderColor = roleInfo.color;
    iconEl.style.color = roleInfo.color;
    iconEl.style.borderColor = roleInfo.color;

    if (roleInfo.team === 'mafia') {
      teamEl.textContent = 'Mafiya jamoasi';
      teamEl.style.color = 'var(--mafia-red)';
      teamEl.style.background = 'rgba(255, 42, 68, 0.2)';
      if (state.mafiaPartners && state.mafiaPartners.length > 0) {
        partnersBox.style.display = 'block';
        partnersList.textContent = state.mafiaPartners.map(p => p.name).join(', ');
      } else {
        partnersBox.style.display = 'none';
      }
    } else if (roleInfo.team === 'neutral') {
      teamEl.textContent = 'Mustaqil Neytral Jamoa';
      teamEl.style.color = roleInfo.color;
      teamEl.style.background = `${roleInfo.color}33`;
      partnersBox.style.display = 'none';
    } else {
      teamEl.textContent = 'Tinch aholi jamoasi';
      teamEl.style.color = '#00e676';
      teamEl.style.background = 'rgba(0, 230, 118, 0.2)';
      partnersBox.style.display = 'none';
    }

    if (state.isLover && state.loverPartner) {
      loverBox.style.display = 'block';
      loverName.textContent = state.loverPartner.name;
    } else {
      loverBox.style.display = 'none';
    }
  }

  function renderGame(state) {
    document.getElementById('game-round-badge').textContent = `${state.round}-RAUND`;

    const roleInfo = state.myRoleInfo;
    if (roleInfo) {
      document.getElementById('my-role-name').textContent = roleInfo.name;
      document.getElementById('my-role-badge-icon').className = `fa-solid ${roleInfo.icon}`;
      document.getElementById('my-role-badge-icon').style.color = roleInfo.color;
    } else if (state.isSpectator) {
      document.getElementById('my-role-name').textContent = 'Tomoshabin 👁️';
    }

    const phaseMain = document.getElementById('phase-main-title');
    const phaseSub = document.getElementById('phase-sub-title');
    const phaseIcon = document.getElementById('phase-icon');
    const guideText = document.getElementById('guide-action-text');
    const skipBar = document.getElementById('vote-skip-bar');
    const mafiaTab = document.getElementById('tab-mafia-chat');
    const ghostTab = document.getElementById('tab-ghost-chat');

    mafiaTab.style.display = state.myRole === 'mafia' ? 'flex' : 'none';
    ghostTab.style.display = (!state.isAlive || state.isSpectator) ? 'flex' : 'none';

    const amIAlive = state.isAlive && !state.isSpectator;

    if (state.phase === 'night') {
      phaseMain.textContent = 'TUN FAZASI';
      phaseSub.textContent = 'Shahar qorong\'ulik qo\'ynida...';
      phaseIcon.className = 'fa-solid fa-moon phase-icon';
      phaseIcon.style.color = '#a78bfa';
      skipBar.style.display = 'none';

      if (state.isSpectator) {
        guideText.innerHTML = '<i class="fa-solid fa-eye"></i> Siz tomoshabinsiz. O\'yinni jonli kuzatib boryapsiz.';
      } else if (!amIAlive) {
        guideText.innerHTML = '<i class="fa-solid fa-ghost"></i> Siz arvohsiz. Arvohlar chatida gaplashishingiz mumkin.';
      } else if (state.myRole === 'mafia') {
        guideText.innerHTML = '<i class="fa-solid fa-crosshairs" style="color:var(--mafia-red)"></i> Mafiya: Yo\'q qilish uchun bitta fuqaroni tanlang!';
      } else if (state.myRole === 'maniac') {
        guideText.innerHTML = '<i class="fa-solid fa-skull-crossbones" style="color:var(--maniac-pink)"></i> Maniac: Tungi qurboningizni tanlang!';
      } else if (state.myRole === 'doctor') {
        guideText.innerHTML = '<i class="fa-solid fa-hand-holding-medical" style="color:var(--doctor-green)"></i> Shifokor: Qutqarish uchun bitta o\'yinchini tanlang!';
      } else if (state.myRole === 'detective') {
        guideText.innerHTML = '<i class="fa-solid fa-magnifying-glass" style="color:var(--detective-blue)"></i> Komissar: Tekshirish uchun gumonlanuvchini tanlang!';
      } else {
        guideText.innerHTML = '<i class="fa-solid fa-bed"></i> Siz sokin uxlab yotibsiz...';
      }

    } else if (state.phase === 'day_announce') {
      phaseMain.textContent = 'TONG OTISHI';
      phaseSub.textContent = 'Tungi voqealar ma\'lum bo\'lmoqda...';
      phaseIcon.className = 'fa-solid fa-sun phase-icon';
      phaseIcon.style.color = '#fbbf24';
      skipBar.style.display = 'none';

      let msg = 'Tun tinch o\'tdi. Hech kim halok bo\'lmadi.';
      if (state.lastNightResult?.killedList?.length > 0) {
        const names = state.lastNightResult.killedList.map(k => {
          const p = state.players.find(pl => pl.id === k.id);
          const rInfo = (window.ROLE_INFO && p && p.role && window.ROLE_INFO[p.role]) ? window.ROLE_INFO[p.role] : null;
          const rName = rInfo ? ` (${rInfo.name})` : (p && p.role ? ` (${p.role})` : '');
          return `<strong>${p ? p.name : 'Kimdir'}</strong>${rName}`;
        });
        msg = `Qonli tun qurbonlari: ${names.join(', ')}!`;
      } else if (state.lastNightResult?.savedByDoctor || state.lastNightResult?.doctorSaved) {
        msg = 'Shifokor bir fuqaroning hayotini saqlab qoldi! Hech kim o\'lmadi!';
      }
      guideText.innerHTML = `<i class="fa-solid fa-newspaper"></i> ${msg}`;

    } else if (state.phase === 'day_discussion') {
      phaseMain.textContent = 'KUNDUZGI MUHOKAMA';
      phaseSub.textContent = 'Fuqarolar maydonda bahslashmoqda...';
      phaseIcon.className = 'fa-solid fa-users-viewfinder phase-icon';
      phaseIcon.style.color = '#60a5fa';
      skipBar.style.display = 'none';
      guideText.innerHTML = '<i class="fa-solid fa-comments"></i> Umumiy chatda bahslashib, jinoyatchilarni fosh qiling!';

    } else if (state.phase === 'day_voting') {
      phaseMain.textContent = 'OVOZ BERISH';
      phaseSub.textContent = 'Linch sudi: Gumonlanuvchini tanlang!';
      phaseIcon.className = 'fa-solid fa-scale-balanced phase-icon';
      phaseIcon.style.color = '#f87171';

      if (amIAlive) {
        skipBar.style.display = 'block';
        guideText.innerHTML = '<i class="fa-solid fa-check-to-slot"></i> Shubhali o\'yinchiga ovoz bering yoki pastdagi "Skip" tugmasini bosing.';
      } else {
        skipBar.style.display = 'none';
        guideText.innerHTML = '<i class="fa-solid fa-ghost"></i> O\'lganlar va tomoshabinlar ovoz berishda qatnasha olmaydi.';
      }

    } else if (state.phase === 'day_voting_result') {
      phaseMain.textContent = 'OVOZ BERISH NATIJASI';
      phaseSub.textContent = 'Shahar sudi qarori e\'lon qilindi';
      phaseIcon.className = 'fa-solid fa-gavel phase-icon';
      phaseIcon.style.color = '#ef4444';
      skipBar.style.display = 'none';

      const res = state.lastVoteResult;
      const msg = res?.announcement || 'Ovoz berish yakunlandi.';
      guideText.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> ${msg}`;
    }

    renderGamePlayers();
  }

  function renderGamePlayers() {
    if (!currentRoomState) return;
    const grid = document.getElementById('game-players-grid');
    grid.innerHTML = '';

    const state = currentRoomState;
    const myId = window.socketClient.playerId;
    const myPlayer = state.players.find(p => p.id === myId);
    const amIAlive = (state.isAlive !== undefined ? state.isAlive : (myPlayer ? myPlayer.isAlive : true)) && !state.isSpectator;
    const myRole = state.myRole || myPlayer?.role || (state.myRoleInfo?.role);
    const phase = state.phase;

    // Halok bo'lganlar (Qabriston) panelini yangilash
    const cemeteryBar = document.getElementById('cemetery-bar');
    const cemeteryList = document.getElementById('cemetery-list');
    const cemeteryCount = document.getElementById('cemetery-count');

    if (cemeteryBar && cemeteryList) {
      const deadPlayers = state.players.filter(p => !p.isAlive);
      if (deadPlayers.length > 0) {
        cemeteryBar.style.display = 'flex';
        if (cemeteryCount) cemeteryCount.textContent = deadPlayers.length;
        cemeteryList.innerHTML = '';
        deadPlayers.forEach(dp => {
          const rInfo = (window.ROLE_INFO && dp.role && window.ROLE_INFO[dp.role]) ? window.ROLE_INFO[dp.role] : null;
          const rName = rInfo ? rInfo.name : (dp.role ? dp.role.toUpperCase() : 'Begunoh fuqaro');
          const rColor = rInfo ? rInfo.color : '#ff5252';
          const item = document.createElement('span');
          item.className = 'cemetery-item';
          item.innerHTML = `💀 <strong>${escapeHtml(dp.name)}</strong> <small style="color:${rColor}; font-weight:700;">(${rName})</small>`;
          cemeteryList.appendChild(item);
        });
      } else {
        cemeteryBar.style.display = 'none';
      }
    }

    const voteCounts = {};
    if (phase === 'day_voting' && state.votes) {
      Object.entries(state.votes).forEach(([vid, tid]) => {
        if (tid && tid !== 'skip') {
          const vState = state.players.find(p => p.id === vid);
          const weight = vState?.role === 'mayor' ? 2 : 1;
          voteCounts[tid] = (voteCounts[tid] || 0) + weight;
        }
      });
    }

    const mafiaPicks = state.nightActions?.voterPicks || state.nightActions?.mafiaVotes || {};

    state.players.forEach(p => {
      const isMe = p.id === myId;
      const isAlive = p.isAlive;
      const avatarIcon = AVATARS.find(a => a.id === p.avatarIndex)?.icon || '👤';

      const card = document.createElement('div');
      card.className = `game-player-card ${isAlive ? 'is-alive' : 'is-dead'}`;

      let actionBadgeHtml = '';
      let targetedClass = '';

      if (phase === 'night' && amIAlive && isAlive) {
        if (myRole === 'mafia') {
          if (myNightTarget === p.id) {
            targetedClass = 'targeted-by-me';
            actionBadgeHtml = '<span class="player-action-btn-pill" style="color:var(--mafia-red)"><i class="fa-solid fa-crosshairs"></i> Nishon</span>';
          }
          const partnerPickers = Object.entries(mafiaPicks).filter(([vid, tid]) => tid === p.id && vid !== myId);
          if (partnerPickers.length > 0) {
            actionBadgeHtml += '<span class="player-action-btn-pill" style="color:#ffb300"><i class="fa-solid fa-eye"></i> Mafiya</span>';
          }
        } else if (myRole === 'maniac') {
          if (myNightTarget === p.id) {
            targetedClass = 'targeted-by-maniac';
            actionBadgeHtml = '<span class="player-action-btn-pill" style="color:var(--maniac-pink)"><i class="fa-solid fa-skull-crossbones"></i> Qotillik</span>';
          }
        } else if (myRole === 'doctor') {
          if (myNightTarget === p.id) {
            targetedClass = 'targeted-by-doctor';
            actionBadgeHtml = '<span class="player-action-btn-pill" style="color:var(--doctor-green)"><i class="fa-solid fa-hand-holding-medical"></i> Qutqarish</span>';
          }
        } else if (myRole === 'detective') {
          if (!isMe && myNightTarget === p.id) {
            targetedClass = 'targeted-by-detective';
            actionBadgeHtml = '<span class="player-action-btn-pill" style="color:var(--detective-blue)"><i class="fa-solid fa-magnifying-glass"></i> Tekshirish</span>';
          }
        }
      }

      if (phase === 'day_voting') {
        if (myDayVote === p.id) {
          targetedClass = 'targeted-by-me';
          actionBadgeHtml = '<span class="player-action-btn-pill"><i class="fa-solid fa-check"></i> Sizning ovozingiz</span>';
        }
      }

      let tallyBadgeHtml = '';
      if (voteCounts[p.id]) {
        tallyBadgeHtml = `<div class="vote-tally-badges">${voteCounts[p.id]}</div>`;
      }

      let deadHtml = '';
      let deadBadgeHtml = '';
      if (!isAlive) {
        deadHtml = '<div class="dead-skull-overlay"><i class="fa-solid fa-skull"></i></div>';
        const rInfo = (window.ROLE_INFO && p.role && window.ROLE_INFO[p.role]) ? window.ROLE_INFO[p.role] : null;
        const rName = rInfo ? rInfo.name : (p.role ? p.role.toUpperCase() : 'Oddiy fuqaro');
        const rColor = rInfo ? rInfo.color : '#ff5252';
        const rIcon = rInfo ? rInfo.icon : 'fa-user';

        deadBadgeHtml = `
          <div class="dead-tag-pill"><i class="fa-solid fa-skull-crossbones"></i> VAFOT ETGAN</div>
          <div class="dead-role-reveal" style="color:${rColor};">
            <i class="fa-solid ${rIcon}"></i> Roli: <strong>${rName}</strong>
          </div>
        `;
      }

      let loverBadgeHtml = '';
      if (p.isLover) {
        loverBadgeHtml = '<span class="lover-heart-badge" title="Sevishgan juftlik">❤️</span>';
      }

      let mayorBadgeHtml = '';
      if (p.role === 'mayor') {
        mayorBadgeHtml = '<span class="mayor-badge" title="Shahar Meri (x2 ovoz)">🏛️</span>';
      }

      if (targetedClass) card.classList.add(targetedClass);

      let roleTagHtml = '';
      if (p.role && isAlive) {
        roleTagHtml = `<small style="font-size:0.75rem; color:var(--mafia-red); font-weight:700;">${p.role.toUpperCase()}</small>`;
      }

      // Shikoyat qilish tugmasi (Report)
      let reportBtnHtml = (!isMe && !p.isBot) ? `<button class="card-report-btn" data-rpid="${p.id}" data-rpname="${escapeHtml(p.name)}" title="Shikoyat qilish">🚩</button>` : '';

      card.innerHTML = `
        ${reportBtnHtml}
        ${loverBadgeHtml}
        ${mayorBadgeHtml}
        ${tallyBadgeHtml}
        ${deadHtml}
        <div class="player-avatar-icon">${avatarIcon}</div>
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-status-tag">${isMe ? '(Siz) ' : ''}${isAlive ? '🟢 Tirik' : '💀 Halok bo\'lgan'}</div>
        ${roleTagHtml}
        ${deadBadgeHtml}
        ${actionBadgeHtml}
      `;

      // Report tugmasi
      if (!isMe && !p.isBot) {
        card.querySelector('.card-report-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          reportTargetUserId = p.id;
          document.getElementById('report-target-name').textContent = p.name;
          openModal(reportModal);
        });
      }

      // Karta bosilganda stiker / emoji MUTLAQO yuborilmaydi! Faqat o'yin amallari:
      card.addEventListener('click', () => {
        if (!amIAlive) {
          showToast('Siz vafot etgansiz (Arvohsiz). Tiriklarning o\'yiniga aralasha olmaysiz!', 'info');
          return;
        }

        if (!isAlive) {
          showToast(`${p.name} allaqachon vafot etgan! Tirik o'yinchini tanlang.`, 'info');
          return;
        }

        if (phase === 'night') {
          handleNightCardClick(p);
        } else if (phase === 'day_voting') {
          handleDayVotingCardClick(p);
        } else {
          showToast(`${p.name} (Hozir muhokama vaqti, ovoz berish boshlanishini kuting)`, 'info');
        }
      });

      grid.appendChild(card);
    });
  }

  function handleNightCardClick(targetPlayer) {
    const myPlayer = currentRoomState.players.find(p => p.id === window.socketClient.playerId);
    const role = currentRoomState.myRole || myPlayer?.role || (currentRoomState.myRoleInfo?.role);
    if (!role) {
      showToast('Rolingiz aniqlanmadi!', 'error');
      return;
    }

    window.sounds.playClick();
    myNightTarget = targetPlayer.id;

    if (role === 'mafia') {
      window.socketClient.sendNightAction('mafia_vote', targetPlayer.id);
      showToast(`${targetPlayer.name} mafiya nishoni qilindi`, 'info');
    } else if (role === 'maniac') {
      window.socketClient.sendNightAction('maniac_kill', targetPlayer.id);
      showToast(`${targetPlayer.name} qotillik uchun nishon qilindi`, 'info');
    } else if (role === 'doctor') {
      window.socketClient.sendNightAction('doctor_heal', targetPlayer.id);
      showToast(`${targetPlayer.name} davolashga tanlandi`, 'info');
    } else if (role === 'detective') {
      if (targetPlayer.id === window.socketClient.playerId) {
        showToast('O\'zingizni tekshira olmaysiz!', 'error');
        return;
      }
      window.socketClient.sendNightAction('detective_investigate', targetPlayer.id);
      showToast(`${targetPlayer.name} tekshirilmoqda...`, 'info');
    } else {
      showToast('Siz oddiy fuqarosiz, tunda uxlaysiz!', 'info');
    }

    renderGamePlayers();
  }

  function handleDayVotingCardClick(targetPlayer) {
    window.sounds.playClick();
    myDayVote = targetPlayer.id;
    window.socketClient.sendDayVote(targetPlayer.id);
    showToast(`${targetPlayer.name}ga ovoz berdingiz!`, 'info');
    renderGamePlayers();
  }

  function updateTimerDisplay(timeLeft, phase) {
    const timerVal = document.getElementById('game-timer-val');
    const timerBar = document.getElementById('timer-bar-svg');
    const roleBar = document.getElementById('role-timer-bar');

    if (timerVal) timerVal.textContent = timeLeft;

    if (timeLeft <= 5 && timeLeft > 0) {
      window.sounds.playTick();
      if (timerVal) timerVal.style.color = 'var(--mafia-red)';
    } else if (timerVal) {
      timerVal.style.color = '#fff';
    }

    const circumference = 2 * Math.PI * 45;
    const duration = maxTimeForCurrentPhase || 30;
    const progress = Math.max(0, Math.min(1, timeLeft / duration));
    const offset = circumference * (1 - progress);

    if (timerBar) timerBar.style.strokeDashoffset = offset;
    if (roleBar) roleBar.style.width = `${(timeLeft / 6) * 100}%`;
  }

  function appendChatMessage(msg) {
    const container = document.getElementById('chat-messages');
    const bubble = document.createElement('div');
    const isMine = msg.senderId === window.socketClient.playerId;

    if (msg.isSystem) {
      bubble.className = 'chat-bubble system';
      bubble.innerHTML = `<i class="fa-solid fa-bullhorn"></i> ${escapeHtml(msg.text)}`;
    } else {
      bubble.className = `chat-bubble ${isMine ? 'mine' : 'theirs'} ${msg.scope === 'mafia' ? 'mafia-scope' : ''} ${msg.scope === 'ghost' ? 'ghost-scope' : ''}`;
      const timeStr = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let scopeIcon = '';
      if (msg.scope === 'mafia') scopeIcon = '<i class="fa-solid fa-skull" style="color:var(--mafia-red)"></i>';
      if (msg.scope === 'ghost') scopeIcon = '<i class="fa-solid fa-ghost" style="color:#ab47bc"></i>';

      bubble.innerHTML = `
        <span class="chat-sender">${escapeHtml(msg.senderName)} ${scopeIcon}</span>
        <div class="chat-text">${escapeHtml(msg.text)}</div>
        <span class="chat-time">${timeStr}</span>
      `;
    }

    bubble.dataset.scope = msg.scope || 'all';

    if (currentChatTab === 'mafia' && msg.scope !== 'mafia' && !msg.isSystem) {
      bubble.style.display = 'none';
    } else if (currentChatTab === 'ghost' && msg.scope !== 'ghost' && !msg.isSystem) {
      bubble.style.display = 'none';
    } else if (currentChatTab === 'all' && (msg.scope === 'mafia' || msg.scope === 'ghost')) {
      bubble.style.display = 'none';
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  function filterChatMessages() {
    const bubbles = document.querySelectorAll('.chat-bubble');
    bubbles.forEach(b => {
      const scope = b.dataset.scope;
      const isSystem = b.classList.contains('system');
      if (isSystem) {
        b.style.display = 'block';
      } else if (currentChatTab === 'mafia') {
        b.style.display = scope === 'mafia' ? 'block' : 'none';
      } else if (currentChatTab === 'ghost') {
        b.style.display = scope === 'ghost' ? 'block' : 'none';
      } else {
        b.style.display = (scope === 'mafia' || scope === 'ghost') ? 'none' : 'block';
      }
    });

    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
  }

  function renderGameOver(state) {
    const win = state.winner;
    const titleEl = document.getElementById('victory-title');
    const reasonEl = document.getElementById('victory-reason');
    const iconEl = document.getElementById('victory-icon');
    const restartBtn = document.getElementById('btn-play-again');
    const restartWait = document.getElementById('waiting-restart-msg');

    if (win) {
      titleEl.textContent = win.title;
      reasonEl.textContent = win.reason;

      if (win.winner === 'mafia') {
        titleEl.style.color = 'var(--mafia-red)';
        iconEl.innerHTML = '<i class="fa-solid fa-skull-crossbones"></i>';
        iconEl.style.color = 'var(--mafia-red)';
      } else if (win.winner === 'maniac') {
        titleEl.style.color = 'var(--maniac-pink)';
        iconEl.innerHTML = '<i class="fa-solid fa-knife"></i>';
        iconEl.style.color = 'var(--maniac-pink)';
      } else if (win.winner === 'jester') {
        titleEl.style.color = '#ab47bc';
        iconEl.innerHTML = '<i class="fa-solid fa-masks-theater"></i>';
        iconEl.style.color = '#ab47bc';
      } else if (win.winner === 'lovers') {
        titleEl.style.color = '#ff4081';
        iconEl.innerHTML = '<i class="fa-solid fa-heart"></i>';
        iconEl.style.color = '#ff4081';
      } else {
        titleEl.style.color = '#00e676';
        iconEl.innerHTML = '<i class="fa-solid fa-trophy"></i>';
        iconEl.style.color = 'var(--gold-accent)';
      }
    }

    const isHost = state.hostId === window.socketClient.playerId;
    if (isHost) {
      restartBtn.style.display = 'inline-flex';
      restartWait.style.display = 'none';
    } else {
      restartBtn.style.display = 'none';
      restartWait.style.display = 'block';
    }

    // AI O'yin Tahlili & Sharhi (Post-Game AI Recap)
    const recapBox = document.getElementById('ai-recap-box');
    const recapText = document.getElementById('ai-recap-text');
    if (recapText) {
      if (state.aiRecap) {
        recapText.textContent = state.aiRecap;
      } else {
        recapText.textContent = "O'yin juda murosasiz kechdi. O'yinchilarning har bir intellektual yurishi va munozaralari o'yin yakuniga katta ta'sir ko'rsatdi.";
      }
      if (recapBox) recapBox.style.display = 'block';
    }

    const grid = document.getElementById('all-roles-grid');
    grid.innerHTML = '';

    state.players.forEach(p => {
      const avatarIcon = AVATARS.find(a => a.id === p.avatarIndex)?.icon || '👤';
      const card = document.createElement('div');
      card.className = 'result-role-card';

      let roleColor = '#b0bec5';
      let roleName = p.role?.toUpperCase() || 'FUQARO';

      if (p.role === 'mafia') roleColor = 'var(--mafia-red)';
      if (p.role === 'doctor') roleColor = 'var(--doctor-green)';
      if (p.role === 'detective') roleColor = 'var(--detective-blue)';
      if (p.role === 'mayor') roleColor = 'var(--mayor-gold)';
      if (p.role === 'maniac') roleColor = 'var(--maniac-pink)';
      if (p.role === 'jester') roleColor = '#ab47bc';

      let botBadgeHtml = '';
      if (p.isBot) {
        const pDesc = p.personality ? `${p.personality.icon} ${p.personality.name}` : 'AI Bot';
        botBadgeHtml = `<span style="font-size:10px; color:#60a5fa; display:block; margin-top:2px;">🤖 ${pDesc}</span>`;
      }

      card.innerHTML = `
        <div class="result-player-info">
          <span>${avatarIcon}</span>
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            ${botBadgeHtml}
          </div>
        </div>
        <span class="result-role-badge" style="background:${roleColor}25; color:${roleColor}; border:1px solid ${roleColor}">
          ${roleName} ${p.isAlive ? '🏆' : '💀'}
        </span>
      `;
      grid.appendChild(card);
    });
  }

  // 8. LEADERBOARD VA TOMOSHABIN YUKLASH
  function loadLeaderboardData() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:12px;">Yuklanmoqda...</div>';

    window.socketClient.getLeaderboard((res) => {
      if (res && res.success) {
        list.innerHTML = '';
        const players = Array.isArray(res.leaderboard) ? res.leaderboard : (res.leaderboard?.players || []);
        const season = res.leaderboard?.season;

        if (season) {
          const seasonBanner = document.createElement('div');
          seasonBanner.style.cssText = 'background: rgba(255, 42, 68, 0.15); border: 1px solid rgba(255, 42, 68, 0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 0.85rem; color: #ff5252; display: flex; align-items: center; justify-content: space-between;';
          seasonBanner.innerHTML = `<span><i class="fa-solid fa-trophy"></i> <strong>${escapeHtml(season.title)}</strong></span> <small style="color:var(--text-muted)">Tugash: ${season.endsAt}</small>`;
          list.appendChild(seasonBanner);
        }

        if (players.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'color:var(--text-muted); text-align:center; padding:16px;';
          empty.textContent = 'Hozircha reyting ma\'lumotlari yo\'q.';
          list.appendChild(empty);
          return;
        }

        players.forEach((player, idx) => {
          const rank = idx + 1;
          const avIcon = AVATARS.find(a => a.id === player.avatarIndex)?.icon || '👤';
          const tier = player.rankTier || { icon: '🥉', title: 'Bronza', color: '#cd7f32' };
          const row = document.createElement('div');
          row.className = 'leader-row';

          let rankBadge = `${rank}`;
          let rankClass = '';
          if (rank === 1) { rankBadge = '🥇'; rankClass = 'rank-1'; }
          if (rank === 2) { rankBadge = '🥈'; rankClass = 'rank-2'; }
          if (rank === 3) { rankBadge = '🥉'; rankClass = 'rank-3'; }

          row.innerHTML = `
            <div class="leader-info">
              <span class="leader-rank ${rankClass}">${rankBadge}</span>
              <span>${avIcon}</span>
              <strong>${escapeHtml(player.nickname)}</strong>
              <span style="font-size:0.75rem; padding:2px 6px; border-radius:10px; background:rgba(255,255,255,0.06); color:${tier.color}">${tier.icon} ${tier.title}</span>
            </div>
            <div class="leader-stats">
              <span class="leader-mmr">${player.mmr} MMR</span>
              <span class="leader-winrate">${player.winrate}% (${player.wins} yutgan)</span>
            </div>
          `;
          list.appendChild(row);
        });
      }
    });
  }

  function loadSpectatorRooms() {
    const grid = document.getElementById('spectator-rooms-grid');
    grid.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:12px;">Yuklanmoqda...</div>';

    fetch('/api/rooms').then(r => r.json()).then(res => {
      if (res && res.success) {
        grid.innerHTML = '';
        if (res.rooms.length === 0) {
          grid.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:14px;">Hozirda faol xonalar mavjud emas.</div>';
          return;
        }

        res.rooms.forEach(room => {
          const card = document.createElement('div');
          card.className = 'spec-room-card';
          card.innerHTML = `
            <div class="spec-room-info">
              <h4>${room.isPublic ? '🌐' : '🔒'} Xona: <strong>${room.code}</strong></h4>
              <div class="spec-room-meta">
                <span>Xost: ${escapeHtml(room.hostName)}</span> • 
                <span>O'yinchilar: ${room.playerCount}/16</span> • 
                <span>Faza: ${room.phase} (${room.round}-raund)</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-small btn-join-spectate" data-code="${room.code}">
              <i class="fa-solid fa-eye"></i> Kuzatish
            </button>
          `;

          card.querySelector('.btn-join-spectate').addEventListener('click', () => {
            window.sounds.playClick();
            window.socketClient.spectateRoom(room.code, (joinRes) => {
              if (joinRes && joinRes.success) {
                closeModal(spectatorModal);
                showToast(`Xonani tomosha qilmoqdasiz: ${room.code}`, 'info');
              } else {
                showToast(joinRes?.message || 'Xatolik', 'error');
              }
            });
          });

          grid.appendChild(card);
        });
      }
    });
  }

  // 9. ADMIN PANEL FUNKSIYALARI
  document.getElementById('btn-admin-login-submit').addEventListener('click', async () => {
    window.sounds.playClick();
    const pass = document.getElementById('admin-password-input').value.trim();
    if (!pass) return;

    const res = await window.socketClient.adminLogin(pass);
    if (res && res.success) {
      document.getElementById('admin-login-box').style.display = 'none';
      document.getElementById('admin-panel-content').style.display = 'block';
      showToast('Admin paneli ochildi!', 'success');
      loadAdminDashboard();
    } else {
      showToast(res?.message || 'Parol noto\'g\'ri!', 'error');
    }
  });

  async function loadAdminDashboard() {
    const data = await window.socketClient.adminGetDashboard();
    if (data && data.success) {
      document.getElementById('adm-rooms-count').textContent = data.stats.activeRooms;
      document.getElementById('adm-online-count').textContent = data.stats.onlineCount;
      document.getElementById('adm-reports-count').textContent = data.stats.pendingReports;
    }
    loadAdminRooms();
  }

  async function loadAdminRooms() {
    const list = document.getElementById('adm-rooms-list');
    list.innerHTML = 'Yuklanmoqda...';
    const data = await window.socketClient.adminGetRooms();
    if (data && data.success) {
      list.innerHTML = '';
      if (data.rooms.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted)">Faol xonalar yo\'q.</div>';
        return;
      }

      data.rooms.forEach(r => {
        const item = document.createElement('div');
        item.className = 'admin-item-card';
        item.innerHTML = `
          <div>
            <strong>${r.code}</strong> (Xost: ${escapeHtml(r.hostName)}) — ${r.playerCount} o'yinchi [${r.phase}]
          </div>
          <button class="btn btn-primary btn-small btn-adm-close-room" data-code="${r.code}">
            Yopish
          </button>
        `;

        item.querySelector('.btn-adm-close-room').addEventListener('click', async () => {
          if (confirm(`Rostdan ham ${r.code} xonasini yopmoqchimisiz?`)) {
            await window.socketClient.adminCloseRoom(r.code);
            showToast(`Xona yopildi: ${r.code}`, 'info');
            loadAdminRooms();
          }
        });

        list.appendChild(item);
      });
    }
  }

  async function loadAdminReports() {
    const list = document.getElementById('adm-reports-list');
    list.innerHTML = 'Yuklanmoqda...';
    const data = await window.socketClient.adminGetReports();
    if (data && data.success) {
      list.innerHTML = '';
      if (data.reports.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted)">Shikoyatlar yo\'q.</div>';
        return;
      }

      data.reports.forEach(rep => {
        const item = document.createElement('div');
        item.className = 'admin-item-card';
        item.innerHTML = `
          <div>
            <strong>${rep.reason}</strong>: ${escapeHtml(rep.details || 'Izohsiz')} <br>
            <small style="color:var(--text-dim)">ID: ${rep.reportedId} (Xona: ${rep.roomCode})</small>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-warning btn-small btn-adm-mute-user" data-uid="${rep.reportedId}">
              <i class="fa-solid fa-volume-xmark"></i> Mute (15d)
            </button>
            <button class="btn btn-primary btn-small btn-adm-ban-user" data-uid="${rep.reportedId}">
              <i class="fa-solid fa-ban"></i> Ban qilish
            </button>
            <button class="btn btn-secondary btn-small btn-adm-resolve-rep" data-repid="${rep.id}">
              <i class="fa-solid fa-check"></i> Hal qilindi
            </button>
          </div>
        `;

        item.querySelector('.btn-adm-mute-user').addEventListener('click', async () => {
          if (confirm(`Ushbu foydalanuvchini 15 daqiqaga ovozsiz qilmoqchimisiz?`)) {
            await window.socketClient.adminMuteUser(rep.reportedId, 15, rep.reason);
            showToast('Foydalanuvchi 15 daqiqaga ovozsiz qilindi', 'info');
            loadAdminReports();
          }
        });

        item.querySelector('.btn-adm-ban-user').addEventListener('click', async () => {
          if (confirm(`Ushbu foydalanuvchini bloklamoqchimisiz?`)) {
            await window.socketClient.adminBanUser(rep.reportedId, rep.reason);
            await window.socketClient.adminResolveReport(rep.id, 'banned');
            showToast('Foydalanuvchi bloklandi', 'success');
            loadAdminReports();
          }
        });

        item.querySelector('.btn-adm-resolve-rep').addEventListener('click', async () => {
          await window.socketClient.adminResolveReport(rep.id, 'resolved');
          showToast('Shikoyat yopildi', 'info');
          loadAdminReports();
        });

        list.appendChild(item);
      });
    }
  }

  // Admin tablari
  const tabRoomsBtn = document.getElementById('btn-adm-tab-rooms');
  const tabReportsBtn = document.getElementById('btn-adm-tab-reports');
  const tabBcastBtn = document.getElementById('btn-adm-tab-broadcast');

  const contentRooms = document.getElementById('adm-tab-rooms-content');
  const contentReports = document.getElementById('adm-tab-reports-content');
  const contentBcast = document.getElementById('adm-tab-broadcast-content');

  tabRoomsBtn.addEventListener('click', () => {
    tabRoomsBtn.classList.add('active');
    tabReportsBtn.classList.remove('active');
    tabBcastBtn.classList.remove('active');
    contentRooms.style.display = 'block';
    contentReports.style.display = 'none';
    contentBcast.style.display = 'none';
    loadAdminRooms();
  });

  tabReportsBtn.addEventListener('click', () => {
    tabReportsBtn.classList.add('active');
    tabRoomsBtn.classList.remove('active');
    tabBcastBtn.classList.remove('active');
    contentReports.style.display = 'block';
    contentRooms.style.display = 'none';
    contentBcast.style.display = 'none';
    loadAdminReports();
  });

  tabBcastBtn.addEventListener('click', () => {
    tabBcastBtn.classList.add('active');
    tabRoomsBtn.classList.remove('active');
    tabReportsBtn.classList.remove('active');
    contentBcast.style.display = 'block';
    contentRooms.style.display = 'none';
    contentReports.style.display = 'none';
  });

  document.getElementById('btn-adm-send-broadcast').addEventListener('click', async () => {
    const text = document.getElementById('adm-broadcast-text').value.trim();
    if (!text) return;

    await window.socketClient.adminBroadcast(text);
    showToast('E\'lon barcha o\'yinchilarga yuborildi!', 'success');
    document.getElementById('adm-broadcast-text').value = '';
  });

  // 10. PROFIL VA DO'STLAR YUKLASH
  function loadProfileData() {
    window.socketClient.getProfile((res) => {
      if (res && res.success) {
        const u = res.user;
        document.getElementById('profile-nickname').textContent = u.nickname;
        document.getElementById('profile-user-id').textContent = `ID: ${u.id}`;
        document.getElementById('profile-user-mmr').textContent = `MMR: ${u.mmr || 1000}`;
        document.getElementById('profile-big-avatar').textContent = AVATARS.find(a => a.id === u.avatarIndex)?.icon || '👤';

        document.getElementById('stat-games').textContent = u.stats.gamesPlayed || 0;
        document.getElementById('stat-wins').textContent = u.stats.wins || 0;

        const rate = u.stats.gamesPlayed ? Math.round((u.stats.wins / u.stats.gamesPlayed) * 100) : 0;
        document.getElementById('stat-winrate').textContent = `${rate}%`;

        let fav = '-';
        let maxCount = 0;
        Object.entries(u.stats.roleCounts || {}).forEach(([role, count]) => {
          if (count > maxCount) {
            maxCount = count;
            fav = role.toUpperCase();
          }
        });
        document.getElementById('stat-favorite-role').textContent = fav;

        document.getElementById('stat-mafia-wins').textContent = u.stats.mafiaWins || 0;
        document.getElementById('stat-citizen-wins').textContent = u.stats.citizenWins || 0;
        document.getElementById('stat-detective-finds').textContent = `${u.stats.detectiveFinds || 0} marta`;
        document.getElementById('stat-doctor-saves').textContent = `${u.stats.doctorSaves || 0} marta`;
      }
    });
  }

  function loadFriendsData() {
    const list = document.getElementById('friends-list-container');
    list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:10px;">Yuklanmoqda...</div>';

    window.socketClient.getFriends((res) => {
      if (res && res.success) {
        list.innerHTML = '';
        if (res.friends.length === 0) {
          list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:14px;">Hali do\'stlaringiz yo\'q.</div>';
          return;
        }

        res.friends.forEach(f => {
          const item = document.createElement('div');
          item.className = 'friend-item';
          const avIcon = AVATARS.find(a => a.id === f.avatarIndex)?.icon || '👤';

          item.innerHTML = `
            <div class="friend-item-info">
              <span class="${f.isOnline ? 'online-dot' : 'offline-dot'}" title="${f.isOnline ? 'Onlayn' : 'Oflayn'}"></span>
              <span>${avIcon}</span>
              <strong>${escapeHtml(f.nickname)}</strong>
              <small style="color:var(--gold-accent)">(${f.mmr} MMR)</small>
            </div>
            <button class="btn-small btn-invite-friend" data-fid="${f.id}">
              <i class="fa-solid fa-paper-plane"></i> Taklif
            </button>
          `;

          item.querySelector('.btn-invite-friend').addEventListener('click', () => {
            window.sounds.playClick();
            if (!currentRoomState) {
              showToast('Avval xona yarating yoki xonaga kiring!', 'error');
              return;
            }
            window.socketClient.inviteFriend(f.id);
            showToast(`${f.nickname}ga taklif yuborildi!`, 'success');
          });

          list.appendChild(item);
        });
      }
    });
  }

  document.getElementById('btn-add-friend-confirm').addEventListener('click', () => {
    window.sounds.playClick();
    const input = document.getElementById('add-friend-input');
    const val = input.value.trim();
    if (!val) return;

    window.socketClient.addFriend(val, (res) => {
      if (res && res.success) {
        showToast(`Do'st qo'shildi: ${res.friend.nickname}!`, 'success');
        input.value = '';
        loadFriendsData();
      } else {
        showToast(res?.message || 'Xatolik', 'error');
      }
    });
  });

  function loadAchievementsData() {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:10px;">Yuklanmoqda...</div>';

    window.socketClient.getProfile((res) => {
      if (res && res.success) {
        grid.innerHTML = '';
        const defs = res.achievementsDef || {};
        const myAch = res.user.achievements || [];

        Object.values(defs).forEach(def => {
          const isUnlocked = myAch.includes(def.id);
          const card = document.createElement('div');
          card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;

          card.innerHTML = `
            <div class="ach-icon">${def.icon}</div>
            <div class="ach-info">
              <h4>${def.title} ${isUnlocked ? '✅' : '🔒'}</h4>
              <p>${def.desc}</p>
            </div>
          `;
          grid.appendChild(card);
        });
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 10. TYPING STATUS YUBORISH
  let typingTimeout = null;
  const chatInputEl = document.getElementById('chat-input-text');
  if (chatInputEl) {
    chatInputEl.addEventListener('input', () => {
      if (!currentRoomState) return;
      window.socketClient.sendTypingStatus(currentRoomState.code, true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        if (currentRoomState) {
          window.socketClient.sendTypingStatus(currentRoomState.code, false);
        }
      }, 2500);
    });
  }

  // 11. AUTH MODAL (LOGIN / SIGN-UP / GOOGLE)
  const authModal = document.getElementById('auth-modal');
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const closeAuthModal = document.getElementById('close-auth-modal');
  const tabAuthLogin = document.getElementById('tab-auth-login');
  const tabAuthRegister = document.getElementById('tab-auth-register');
  const formAuthLogin = document.getElementById('form-auth-login');
  const formAuthRegister = document.getElementById('form-auth-register');
  const btnMafiaGoogle = document.getElementById('btn-mafia-google-login');

  if (btnOpenAuth) {
    btnOpenAuth.addEventListener('click', () => {
      window.sounds.playClick();
      openModal(authModal);
    });
  }

  if (closeAuthModal) {
    closeAuthModal.addEventListener('click', () => closeModal(authModal));
  }

  if (tabAuthLogin && tabAuthRegister) {
    tabAuthLogin.addEventListener('click', () => {
      window.sounds.playClick();
      tabAuthLogin.className = 'btn btn-small active';
      tabAuthRegister.className = 'btn btn-small btn-outline';
      formAuthLogin.style.display = 'flex';
      formAuthRegister.style.display = 'none';
      document.getElementById('auth-modal-title').textContent = 'Tizimga Kirish';
    });

    tabAuthRegister.addEventListener('click', () => {
      window.sounds.playClick();
      tabAuthRegister.className = 'btn btn-small active';
      tabAuthLogin.className = 'btn btn-small btn-outline';
      formAuthRegister.style.display = 'flex';
      formAuthLogin.style.display = 'none';
      document.getElementById('auth-modal-title').textContent = 'Ro\'yxatdan o\'tish';
    });
  }

  if (formAuthLogin) {
    formAuthLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-login-email').value.trim();
      const password = document.getElementById('auth-login-pass').value;

      window.socketClient.authLogin(email, password, (res) => {
        if (res && res.success) {
          showToast(`Xush kelibsiz, ${res.user.nickname}!`, 'success');
          document.getElementById('player-name-input').value = res.user.nickname;
          document.getElementById('header-auth-label').textContent = res.user.nickname;
          localStorage.setItem('mafia_user_email', res.user.email);
          localStorage.setItem('mafia_user_token', res.token);
          closeModal(authModal);
          window.socketClient.initUser(res.user.nickname, res.user.avatarIndex || selectedAvatarId);
        } else {
          showToast(res?.message || 'Kirishda xatolik', 'error');
        }
      });
    });
  }

  if (formAuthRegister) {
    formAuthRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      const nickname = document.getElementById('auth-reg-name').value.trim();
      const email = document.getElementById('auth-reg-email').value.trim();
      const password = document.getElementById('auth-reg-pass').value;

      window.socketClient.authRegister(email, password, nickname, selectedAvatarId, (res) => {
        if (res && res.success) {
          showToast(`Ro'yxatdan o'tdingiz, ${res.user.nickname}!`, 'success');
          document.getElementById('player-name-input').value = res.user.nickname;
          document.getElementById('header-auth-label').textContent = res.user.nickname;
          localStorage.setItem('mafia_user_email', res.user.email);
          localStorage.setItem('mafia_user_token', res.token);
          closeModal(authModal);
          window.socketClient.initUser(res.user.nickname, selectedAvatarId);
        } else {
          showToast(res?.message || 'Ro\'yxatdan o\'tishda xatolik', 'error');
        }
      });
    });
  }

  if (btnMafiaGoogle) {
    btnMafiaGoogle.addEventListener('click', () => {
      window.sounds.playClick();
      const googleEmail = `player_${Math.floor(1000 + Math.random() * 9000)}@gmail.com`;
      const googleName = `G_Player_${Math.floor(100 + Math.random() * 900)}`;

      window.socketClient.authGoogle(googleEmail, googleName, selectedAvatarId, `g_${Date.now()}`, (res) => {
        if (res && res.success) {
          showToast(`Google orqali kirdingiz: ${res.user.nickname}!`, 'success');
          document.getElementById('player-name-input').value = res.user.nickname;
          document.getElementById('header-auth-label').textContent = res.user.nickname;
          localStorage.setItem('mafia_user_email', res.user.email);
          localStorage.setItem('mafia_user_token', res.token);
          closeModal(authModal);
          window.socketClient.initUser(res.user.nickname, selectedAvatarId);
        } else {
          showToast(res?.message || 'Google bilan kirishda xatolik', 'error');
        }
      });
    });
  }

  // MOBIL O'YIN TABLARI (MAYDON <-> CHAT)
  const btnTabBoard = document.getElementById('btn-tab-board');
  const btnTabChat = document.getElementById('btn-tab-chat');
  const gameMainSplit = document.querySelector('.game-main-split');
  const mobileChatBadge = document.getElementById('mobile-chat-badge');
  let unreadMobileChatCount = 0;

  function switchToMobileBoard() {
    if (window.innerWidth <= 768 && btnTabBoard && btnTabChat && gameMainSplit) {
      btnTabBoard.classList.add('active');
      btnTabChat.classList.remove('active');
      gameMainSplit.classList.remove('mobile-show-chat');
    }
  }

  function switchToMobileChat() {
    if (window.innerWidth <= 768 && btnTabBoard && btnTabChat && gameMainSplit) {
      btnTabChat.classList.add('active');
      btnTabBoard.classList.remove('active');
      gameMainSplit.classList.add('mobile-show-chat');
      unreadMobileChatCount = 0;
      if (mobileChatBadge) mobileChatBadge.style.display = 'none';
      const chatContainer = document.getElementById('chat-messages');
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  if (btnTabBoard && btnTabChat) {
    btnTabBoard.addEventListener('click', () => {
      window.sounds.playClick();
      switchToMobileBoard();
    });

    btnTabChat.addEventListener('click', () => {
      window.sounds.playClick();
      switchToMobileChat();
    });
  }

  // Chat xabari kelganda mobil badge yangilash
  const origAppendChatMessage = appendChatMessage;
  appendChatMessage = function(msg) {
    origAppendChatMessage(msg);
    if (window.innerWidth <= 768 && gameMainSplit && !gameMainSplit.classList.contains('mobile-show-chat')) {
      unreadMobileChatCount++;
      if (mobileChatBadge) {
        mobileChatBadge.textContent = unreadMobileChatCount;
        mobileChatBadge.style.display = 'inline-block';
      }
    }
  };

  // VIRTUAL KEYBOARD AUTO-SCROLL (MOBILE ON-SCREEN KEYBOARD)
  if (window.visualViewport) {
    const handleViewportChange = () => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const chatMsgs = document.getElementById('chat-messages');
          if (chatMsgs && activeEl.id === 'chat-input-text') {
            chatMsgs.scrollTop = chatMsgs.scrollHeight;
          }
        }, 100);
      }
    };
    window.visualViewport.addEventListener('resize', handleViewportChange);
  }

  const mobileChatInput = document.getElementById('chat-input-text');
  if (mobileChatInput) {
    mobileChatInput.addEventListener('focus', () => {
      setTimeout(() => {
        const chatMsgs = document.getElementById('chat-messages');
        if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
        document.getElementById('chat-input-form')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 220);
    });
  }

  // PWA "BOSH EKRANGA QO'SHISH" (INSTALL PROMPT)
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const pwaBtn = document.getElementById('btn-pwa-install');
    if (pwaBtn) pwaBtn.style.display = 'inline-flex';
  });

  const pwaInstallBtn = document.getElementById('btn-pwa-install');
  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      window.sounds.playClick();
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          pwaInstallBtn.style.display = 'none';
          showToast('Ilova muvaffaqiyatli o\'rnatildi!', 'success');
        }
        deferredInstallPrompt = null;
      } else {
        showToast('Ilovani o\'rnatish uchun brauzeringiz menyusidan "Bosh ekranga qo\'shish" (Add to Home screen) ni tanlang.', 'info');
      }
    });
  }

  // SOZLAMALAR CHECKBOX-LARINI OSON BOSISH (TOUCH-FRIENDLY TOGGLE)
  document.querySelectorAll('.setting-item').forEach(item => {
    const toggle = item.querySelector('input[type="checkbox"]');
    if (toggle) {
      item.addEventListener('click', (e) => {
        if (e.target !== toggle && !e.target.closest('.toggle-switch')) {
          toggle.checked = !toggle.checked;
          toggle.dispatchEvent(new Event('change'));
        }
      });
    }
  });

  // ==========================================================================
  // PHASE 4: KUNLIK STREAK, TUTORIAL & MAXSUS QOIDALAR
  // ==========================================================================

  // 1. KUNLIK LOGIN STREAK TIZIMI
  function initDailyStreak() {
    window.socketClient.checkDailyStreak((res) => {
      if (!res) return;
      const streakDaysEl = document.getElementById('streak-count-days');
      const coinsEl = document.getElementById('streak-coins-display');
      const claimBtn = document.getElementById('btn-claim-daily-reward');

      if (streakDaysEl) streakDaysEl.textContent = `${res.streak || 1} kun`;
      if (coinsEl) coinsEl.textContent = `${res.coins || 100} Tanga`;

      if (claimBtn) {
        if (res.canClaimReward) {
          claimBtn.disabled = false;
          claimBtn.innerHTML = `<i class="fa-solid fa-gift"></i> ${window.i18n.t('claimReward') || 'Mukofotni olish'} (+${res.reward || 50})`;
        } else {
          claimBtn.disabled = true;
          claimBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${window.i18n.t('claimed') || 'Olingan'}`;
        }
      }
    });
  }

  const btnClaimReward = document.getElementById('btn-claim-daily-reward');
  if (btnClaimReward) {
    btnClaimReward.addEventListener('click', () => {
      window.sounds.playClick();
      window.socketClient.claimDailyReward((res) => {
        if (res && res.success) {
          if (window.sounds.playVictory) window.sounds.playVictory();
          const coinsAwardEl = document.getElementById('streak-coins-award');
          if (coinsAwardEl) coinsAwardEl.textContent = `+${res.reward} Tanga 💰`;
          const streakDaysEl = document.getElementById('streak-count-days');
          const coinsEl = document.getElementById('streak-coins-display');
          if (streakDaysEl) streakDaysEl.textContent = `${res.streak} kun`;
          if (coinsEl) coinsEl.textContent = `${res.coins} Tanga`;
          btnClaimReward.disabled = true;
          btnClaimReward.innerHTML = `<i class="fa-solid fa-check"></i> ${window.i18n.t('claimed') || 'Olingan'}`;
          openModal(streakRewardModal);
          showToast(`Tabriklaymiz! +${res.reward} tanga hisobingizga qo'shildi! 🔥`, 'success');
        } else {
          showToast(res?.error || 'Mukofot allaqachon olingan', 'warning');
        }
      });
    });
  }

  const btnCloseStreak = document.getElementById('btn-close-streak-reward');
  if (btnCloseStreak) {
    btnCloseStreak.addEventListener('click', () => {
      closeModal(streakRewardModal);
    });
  }

  // 2. TUTORIAL / PRACTICE MODE (O'RGANISH REJIMI)
  let currentTutorialStep = 1;
  const totalTutorialSteps = 6;

  function renderTutorialStep(step) {
    currentTutorialStep = step;
    
    // Step indikatorlarni yangilash
    for (let i = 1; i <= totalTutorialSteps; i++) {
      const stepEl = document.getElementById(`t-step-${i}`);
      if (stepEl) {
        stepEl.classList.toggle('active', i === step);
        stepEl.classList.toggle('completed', i < step);
      }
    }

    const prevBtn = document.getElementById('btn-tutorial-prev');
    const nextBtn = document.getElementById('btn-tutorial-next');
    const dialogText = document.getElementById('tutorial-dialog-text');
    const stage = document.getElementById('tutorial-interactive-stage');

    if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
    if (nextBtn) {
      if (step === totalTutorialSteps) {
        nextBtn.innerHTML = '<i class="fa-solid fa-award"></i> Yakunlash va 100 Tanga olish';
        nextBtn.className = 'btn btn-primary btn-glow';
      } else {
        nextBtn.innerHTML = 'Keyingisi <i class="fa-solid fa-arrow-right"></i>';
        nextBtn.className = 'btn btn-primary';
      }
    }

    if (step === 1) {
      dialogText.textContent = "Xush kelibsiz! Mafiya — bu psixologik va intellektual jamoaviy o'yin. Shaharda tinch fuqarolar va yashirin qotillar (Mafiya) bor. Tinch aholining maqsadi — munozara va ovoz berish orqali mafiyani topish; Mafiya esa tunda yashirincha tinch aholini yo'q qilishi kerak!";
      stage.innerHTML = `
        <div style="display:flex; justify-content:space-around; align-items:stretch; gap:12px; text-align:center;">
          <div style="background:rgba(0, 230, 118, 0.12); border:1px solid #00e676; border-radius:12px; padding:14px; flex:1;">
            <div style="font-size:38px;">👨‍👩‍👧‍👦</div>
            <strong style="color:#00e676; font-size:14px; display:block; margin:6px 0;">Tinch Aholi Jamoasi</strong>
            <p style="font-size:12px; color:#cbd5e1; margin:0; line-height:1.4;">Barcha mafiyalarni topib shahar sudida quvg'in qilish orqali g'alaba qozonadi.</p>
          </div>
          <div style="display:flex; align-items:center; font-size:22px; font-weight:800; color:#ffd700;">VS</div>
          <div style="background:rgba(255, 42, 68, 0.12); border:1px solid #ff2a44; border-radius:12px; padding:14px; flex:1;">
            <div style="font-size:38px;">🕶️</div>
            <strong style="color:#ff2a44; font-size:14px; display:block; margin:6px 0;">Mafiya Guruhi</strong>
            <p style="font-size:12px; color:#cbd5e1; margin:0; line-height:1.4;">Tunda tinch aholini ovlaydi va son jihatdan ularga tenglashganda g'alaba qiladi.</p>
          </div>
        </div>
      `;
    } else if (step === 2) {
      dialogText.textContent = "O'yinda har bir ishtirokchiga maxsus rol beriladi. Keling, eng asosiy rollarning noyob qobiliyatlari bilan tanishamiz:";
      stage.innerHTML = `
        <div class="t-stage-grid">
          <div class="t-role-card-mini">
            <div class="role-icon">🕶️</div>
            <span class="role-name" style="color:var(--mafia-red)">Mafiya</span>
            <p class="role-desc">Tunda uyg'onadi va jamoadoshlari bilan bitta qurbonni o'ldirishga nishonlaydi.</p>
          </div>
          <div class="t-role-card-mini">
            <div class="role-icon">👨‍⚕️</div>
            <span class="role-name" style="color:var(--doctor-green)">Shifokor</span>
            <p class="role-desc">Tunda 1 o'yinchini davolaydi. Agar uni mafiya o'qqa tutgan bo'lsa, u tirik qoladi!</p>
          </div>
          <div class="t-role-card-mini">
            <div class="role-icon">🕵️‍♂️</div>
            <span class="role-name" style="color:var(--detective-blue)">Komissar</span>
            <p class="role-desc">Tunda gumonlanuvchini tekshiradi va uning Mafiya ekanligini fosh qiladi.</p>
          </div>
          <div class="t-role-card-mini">
            <div class="role-icon">👨‍💼</div>
            <span class="role-name" style="color:#ffd700">Mayor (Hokim)</span>
            <p class="role-desc">Tinch aholi vakili. Kunduzgi umumiy ovoz berishda uning ovozi 2 ball hisoblanadi.</p>
          </div>
        </div>
      `;
    } else if (step === 3) {
      dialogText.textContent = "Tun cho'kdi 🌙. Tasavvur qiling: siz Mafiyasiz va bu kecha shahar ko'chalarida qurolingiz bilan chiqdingiz! Pastdagi o'yinchilardan birini bosing va nishonga oling:";
      stage.innerHTML = `
        <div style="text-align:center;">
          <div style="color:#94a3b8; font-size:12px; margin-bottom:12px;"><i class="fa-solid fa-crosshairs"></i> Qurbonni tanlang:</div>
          <div class="t-mock-player-list">
            <button type="button" class="t-mock-player-btn" data-target="Alisher (Bot)"><i class="fa-solid fa-user"></i> Alisher</button>
            <button type="button" class="t-mock-player-btn" data-target="Madina (Bot)"><i class="fa-solid fa-user"></i> Madina</button>
            <button type="button" class="t-mock-player-btn" data-target="Jasur (Bot)"><i class="fa-solid fa-user"></i> Jasur</button>
            <button type="button" class="t-mock-player-btn" data-target="Sardor (Bot)"><i class="fa-solid fa-user"></i> Sardor</button>
          </div>
          <div id="t-night-target-info" style="margin-top:14px; font-size:13px; color:#ffd700; min-height:20px;"></div>
        </div>
      `;

      stage.querySelectorAll('.t-mock-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.sounds.playGunshot) window.sounds.playGunshot();
          stage.querySelectorAll('.t-mock-player-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          const targetName = btn.dataset.target;
          const infoEl = document.getElementById('t-night-target-info');
          if (infoEl) infoEl.innerHTML = `🎯 <strong>${targetName}</strong> nishonga olindi! Mafiya o'z vazifasini bajardi. Keyingi bosqichga o'ting!`;
          dialogText.textContent = `Ajoyib nishon! Siz ${targetName}ni tanladingiz. Tong otdi deb hisoblaymiz, endi kunduzgi faza boshlanadi!`;
        });
      });
    } else if (step === 4) {
      dialogText.textContent = "Tong otdi ☀️! Tun qorong'uligi ketdi va barcha o'yinchilar umumiy chatda to'planishdi. Bu bosqichda hamma bir-birining gaplarini tahlil qiladi, yolg'onchilarni fosh qiladi:";
      stage.innerHTML = `
        <div style="background:rgba(0,0,0,0.4); border-radius:10px; padding:12px; border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:11px; color:#94a3b8; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:4px;">
            <i class="fa-solid fa-comments"></i> Jonli Kunduzgi Chat Namoyishi
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:13px; text-align:left;">
            <div style="color:#93c5fd;"><strong>🕵️ Komissar Farrux:</strong> Tunda Jasurni tekshirdim, u qizil rangda chiqdi! U MAFIYA!</div>
            <div style="color:#f87171;"><strong>🕶️ Jasur:</strong> Yolg'on! Men oddiy duradgorman, nega meni tuhmat qilyapsan?!</div>
            <div style="color:#e2e8f0;"><strong>👨‍👩‍👧 Madina:</strong> Men Komissarga ishonaman, Jasur doim birinchi bo'lib o'zini oqlashga tushadi!</div>
          </div>
        </div>
      `;
    } else if (step === 5) {
      dialogText.textContent = "Muhokama tugadi va shahar sudi boshlandi! Endi har bir o'yinchi shubhali shaxsni quvg'in qilish uchun ovoz beradi. Komissarning chaqirig'iga binoan shubhali Jasurga ovoz bering:";
      stage.innerHTML = `
        <div style="text-align:center;">
          <div style="color:#cbd5e1; font-size:13px; margin-bottom:12px;"><i class="fa-solid fa-scale-balanced"></i> Shahar sudi: Kimni shahar quvg'in qilsin?</div>
          <div class="t-mock-player-list">
            <button type="button" class="t-mock-player-btn" id="t-vote-alisher"><i class="fa-solid fa-vote-yea"></i> Alisher (0 ovoz)</button>
            <button type="button" class="t-mock-player-btn" id="t-vote-jasur" style="border-color:#ff5252;"><i class="fa-solid fa-skull"></i> Jasur (Gumonlanuvchi)</button>
            <button type="button" class="t-mock-player-btn" id="t-vote-madina"><i class="fa-solid fa-vote-yea"></i> Madina (0 ovoz)</button>
          </div>
          <div id="t-vote-feedback" style="margin-top:14px; font-size:13px; color:#00e676; min-height:24px;"></div>
        </div>
      `;

      const jasurBtn = document.getElementById('t-vote-jasur');
      if (jasurBtn) {
        jasurBtn.addEventListener('click', () => {
          if (window.sounds.playVote) window.sounds.playVote();
          jasurBtn.classList.add('selected');
          jasurBtn.innerHTML = '<i class="fa-solid fa-check"></i> Jasur (Siz ovoz berdingiz!)';
          const feedEl = document.getElementById('t-vote-feedback');
          if (feedEl) feedEl.innerHTML = `⚖️ Sud qarori: Jasur ko'pchilik ovoz bilan shahardan haydaldi. U haqiqatdan ham <strong>MAFIYA</strong> bo'lib chiqdi! Shahar qutqarildi! 🎉`;
          dialogText.textContent = "Ajoyib intuitsiya va to'g'ri qaror! Jasur jazolandi. Tinch aholi g'alabaga bir qadam yaqinlashdi! Oxirgi bosqichga o'ting.";
        });
      }
    } else if (step === 6) {
      dialogText.textContent = "TABRIKLAYMAN! Siz Mafiya o'yinining barcha asosiy tamoyillarini va fazalarini to'liq o'rganib chiqdingiz. Endi haqiqiy o'yinchilar bilan xona yarating yoki do'stlaringiz bilan qiziqarli janglarni boshlang!";
      stage.innerHTML = `
        <div style="text-align:center; padding:16px;">
          <div style="font-size:52px; animation:flamePulse 1.5s infinite;">🏆</div>
          <h3 style="color:#ffd700; margin:8px 0 4px; font-size:18px;">O'QUV KURSINI TUGATDINGIZ!</h3>
          <p style="color:#e2e8f0; font-size:13px; margin-bottom:14px;">Muvaffaqiyatli yakunlaganingiz uchun sizga maxsus bonus beriladi:</p>
          <div style="font-size:24px; font-weight:800; color:#ffd700; background:rgba(255,215,0,0.15); border:1px solid #ffd700; padding:10px; border-radius:12px; display:inline-block; margin-bottom:14px;">
            +100 Tanga Mukofot! 💰
          </div>
        </div>
      `;
    }
  }

  // Tutorial tugmalari
  const btnOpenTutorial = document.getElementById('btn-open-tutorial');
  if (btnOpenTutorial) {
    btnOpenTutorial.addEventListener('click', () => {
      openModal(tutorialModal);
      renderTutorialStep(1);
    });
  }

  document.getElementById('close-tutorial-modal')?.addEventListener('click', () => {
    closeModal(tutorialModal);
  });

  document.getElementById('btn-tutorial-prev')?.addEventListener('click', () => {
    window.sounds.playClick();
    if (currentTutorialStep > 1) {
      renderTutorialStep(currentTutorialStep - 1);
    }
  });

  document.getElementById('btn-tutorial-next')?.addEventListener('click', () => {
    window.sounds.playClick();
    if (currentTutorialStep < totalTutorialSteps) {
      renderTutorialStep(currentTutorialStep + 1);
    } else {
      // Yakunlash va mukofotni olish
      window.socketClient.completeTutorial((res) => {
        if (res && res.success) {
          if (window.sounds.playVictory) window.sounds.playVictory();
          const coinsEl = document.getElementById('streak-coins-display');
          if (coinsEl) coinsEl.textContent = `${res.coins || 200} Tanga`;
          showToast(`Tabriklaymiz! O'quv qo'llanmasi tugatildi va +${res.reward || 100} tanga berildi! 🎓`, 'success');
        } else {
          showToast("O'quv qo'llanmasi yakunlandi!", 'info');
        }
        closeModal(tutorialModal);
      });
    }
  });

  // Har bir qadamga to'g'ridan to'g'ri o'tish
  for (let i = 1; i <= 6; i++) {
    const sEl = document.getElementById(`t-step-${i}`);
    if (sEl) {
      sEl.addEventListener('click', () => {
        window.sounds.playClick();
        renderTutorialStep(i);
      });
    }
  }

  // 3. MAXSUS QOIDALAR MUHARRIRI (CUSTOM RULE EDITOR)
  function initCustomRuleEditor() {
    const btnOpenEditor = document.getElementById('btn-open-custom-rule-editor');
    if (btnOpenEditor) {
      btnOpenEditor.addEventListener('click', () => {
        openModal(customRulesModal);
        refreshSavedPresetsList();
      });
    }

    document.getElementById('close-custom-rules-modal')?.addEventListener('click', () => closeModal(customRulesModal));
    document.getElementById('btn-cancel-custom-rules')?.addEventListener('click', () => closeModal(customRulesModal));

    // Rollar hisoblagichlari sozlamalari
    function setupCounter(minusId, plusId, valId, min, max) {
      const minusBtn = document.getElementById(minusId);
      const plusBtn = document.getElementById(plusId);
      const valEl = document.getElementById(valId);
      if (!minusBtn || !plusBtn || !valEl) return;

      minusBtn.addEventListener('click', () => {
        window.sounds.playClick();
        let cur = parseInt(valEl.textContent, 10) || min;
        if (cur > min) {
          valEl.textContent = cur - 1;
        }
      });

      plusBtn.addEventListener('click', () => {
        window.sounds.playClick();
        let cur = parseInt(valEl.textContent, 10) || min;
        if (cur < max) {
          valEl.textContent = cur + 1;
        }
      });
    }

    setupCounter('cr-mafia-minus', 'cr-mafia-plus', 'cr-mafia-val', 1, 6);
    setupCounter('cr-doctor-minus', 'cr-doctor-plus', 'cr-doctor-val', 0, 3);
    setupCounter('cr-detective-minus', 'cr-detective-plus', 'cr-detective-val', 0, 3);
    setupCounter('cr-mayor-minus', 'cr-mayor-plus', 'cr-mayor-val', 0, 2);
    setupCounter('cr-maniac-minus', 'cr-maniac-plus', 'cr-maniac-val', 0, 2);
    setupCounter('cr-jester-minus', 'cr-jester-plus', 'cr-jester-val', 0, 2);

    // Vaqt slayderlari jonli qiymat ko'rsatish
    const nightRange = document.getElementById('cr-time-night');
    const nightVal = document.getElementById('cr-time-night-val');
    if (nightRange && nightVal) {
      nightRange.addEventListener('input', () => {
        nightVal.textContent = `${nightRange.value} soniya`;
      });
    }

    const discussRange = document.getElementById('cr-time-discuss');
    const discussVal = document.getElementById('cr-time-discuss-val');
    if (discussRange && discussVal) {
      discussRange.addEventListener('input', () => {
        discussVal.textContent = `${discussRange.value} soniya`;
      });
    }

    const voteRange = document.getElementById('cr-time-vote');
    const voteVal = document.getElementById('cr-time-vote-val');
    if (voteRange && voteVal) {
      voteRange.addEventListener('input', () => {
        voteVal.textContent = `${voteRange.value} soniya`;
      });
    }

    // Saqlangan to'plamlar ro'yxatini yangilash
    function refreshSavedPresetsList() {
      const selectEl = document.getElementById('select-saved-presets');
      if (!selectEl) return;
      selectEl.innerHTML = '<option value="">-- Saqlangan to\'plamni tanlang --</option>';

      window.socketClient.getPresets((res) => {
        if (res && res.success && Array.isArray(res.presets)) {
          res.presets.forEach(pr => {
            const opt = document.createElement('option');
            opt.value = pr.id;
            opt.textContent = pr.name;
            opt.dataset.settings = JSON.stringify(pr.settings);
            selectEl.appendChild(opt);
          });
        }
      });
    }

    // Saqlangan to'plam tanlanganda maydonlarni to'ldirish
    const selectSaved = document.getElementById('select-saved-presets');
    if (selectSaved) {
      selectSaved.addEventListener('change', () => {
        const selOption = selectSaved.options[selectSaved.selectedIndex];
        if (!selOption || !selOption.dataset.settings) return;
        try {
          const s = JSON.parse(selOption.dataset.settings);
          applySettingsToCustomInputs(s);
          const nameInput = document.getElementById('custom-rule-name-input');
          if (nameInput) nameInput.value = selOption.textContent;
          showToast(`"${selOption.textContent}" qoidalari yuklandi!`, 'info');
        } catch (e) {}
      });
    }

    // Tanlangan to'plamni o'chirish
    const btnDeletePreset = document.getElementById('btn-delete-saved-preset');
    if (btnDeletePreset) {
      btnDeletePreset.addEventListener('click', () => {
        const selOption = selectSaved.options[selectSaved.selectedIndex];
        if (!selOption || !selOption.value) {
          showToast("O'chirish uchun avval qoidalarni tanlang!", 'warning');
          return;
        }
        window.socketClient.deletePreset(selOption.value, (res) => {
          if (res && res.success) {
            showToast("Qoidalar to'plami o'chirildi!", 'info');
            refreshSavedPresetsList();
          }
        });
      });
    }

    function getCustomSettingsFromInputs() {
      return {
        mafiaCount: parseInt(document.getElementById('cr-mafia-val').textContent, 10) || 1,
        doctorCount: parseInt(document.getElementById('cr-doctor-val').textContent, 10) || 0,
        detectiveCount: parseInt(document.getElementById('cr-detective-val').textContent, 10) || 0,
        mayorCount: parseInt(document.getElementById('cr-mayor-val').textContent, 10) || 0,
        maniacCount: parseInt(document.getElementById('cr-maniac-val').textContent, 10) || 0,
        jesterCount: parseInt(document.getElementById('cr-jester-val').textContent, 10) || 0,
        hasDoctor: (parseInt(document.getElementById('cr-doctor-val').textContent, 10) || 0) > 0,
        hasDetective: (parseInt(document.getElementById('cr-detective-val').textContent, 10) || 0) > 0,
        hasMayor: (parseInt(document.getElementById('cr-mayor-val').textContent, 10) || 0) > 0,
        hasManiac: (parseInt(document.getElementById('cr-maniac-val').textContent, 10) || 0) > 0,
        hasJester: (parseInt(document.getElementById('cr-jester-val').textContent, 10) || 0) > 0,
        hasLovers: document.getElementById('cr-lovers-val').checked,
        nightTime: parseInt(document.getElementById('cr-time-night').value, 10) || 30,
        discussionTime: parseInt(document.getElementById('cr-time-discuss').value, 10) || 60,
        votingTime: parseInt(document.getElementById('cr-time-vote').value, 10) || 30
      };
    }

    function applySettingsToCustomInputs(s) {
      if (!s) return;
      if (s.mafiaCount !== undefined) document.getElementById('cr-mafia-val').textContent = s.mafiaCount;
      if (s.doctorCount !== undefined) document.getElementById('cr-doctor-val').textContent = s.doctorCount;
      else if (s.hasDoctor !== undefined) document.getElementById('cr-doctor-val').textContent = s.hasDoctor ? 1 : 0;
      
      if (s.detectiveCount !== undefined) document.getElementById('cr-detective-val').textContent = s.detectiveCount;
      else if (s.hasDetective !== undefined) document.getElementById('cr-detective-val').textContent = s.hasDetective ? 1 : 0;

      if (s.mayorCount !== undefined) document.getElementById('cr-mayor-val').textContent = s.mayorCount;
      else if (s.hasMayor !== undefined) document.getElementById('cr-mayor-val').textContent = s.hasMayor ? 1 : 0;

      if (s.maniacCount !== undefined) document.getElementById('cr-maniac-val').textContent = s.maniacCount;
      else if (s.hasManiac !== undefined) document.getElementById('cr-maniac-val').textContent = s.hasManiac ? 1 : 0;

      if (s.jesterCount !== undefined) document.getElementById('cr-jester-val').textContent = s.jesterCount;
      else if (s.hasJester !== undefined) document.getElementById('cr-jester-val').textContent = s.hasJester ? 1 : 0;

      if (s.hasLovers !== undefined) document.getElementById('cr-lovers-val').checked = !!s.hasLovers;

      if (s.nightTime !== undefined) {
        document.getElementById('cr-time-night').value = s.nightTime;
        document.getElementById('cr-time-night-val').textContent = `${s.nightTime} soniya`;
      }
      if (s.discussionTime !== undefined) {
        document.getElementById('cr-time-discuss').value = s.discussionTime;
        document.getElementById('cr-time-discuss-val').textContent = `${s.discussionTime} soniya`;
      }
      if (s.votingTime !== undefined) {
        document.getElementById('cr-time-vote').value = s.votingTime;
        document.getElementById('cr-time-vote-val').textContent = `${s.votingTime} soniya`;
      }
    }

    // Saqlash va Xonaga Qo'llash
    const btnApply = document.getElementById('btn-apply-custom-rules');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        window.sounds.playClick();
        const nameInput = document.getElementById('custom-rule-name-input');
        const presetName = (nameInput?.value.trim()) || 'Maxsus Qoidalar';
        const settings = getCustomSettingsFromInputs();

        // Xost bo'lsa xonaga yangilaymiz
        if (currentRoomState && currentRoomState.hostId === window.socketClient.playerId) {
          window.socketClient.updateSettings(settings);
          
          // Lobby sozlamalari UI sini ham sinxronlash
          const mafiaValLobby = document.getElementById('mafia-count-val');
          if (mafiaValLobby) mafiaValLobby.textContent = settings.mafiaCount;
          if (document.getElementById('setting-doctor')) document.getElementById('setting-doctor').checked = settings.hasDoctor;
          if (document.getElementById('setting-detective')) document.getElementById('setting-detective').checked = settings.hasDetective;
          if (document.getElementById('setting-mayor')) document.getElementById('setting-mayor').checked = settings.hasMayor;
          if (document.getElementById('setting-maniac')) document.getElementById('setting-maniac').checked = settings.hasManiac;
          if (document.getElementById('setting-jester')) document.getElementById('setting-jester').checked = settings.hasJester;
          if (document.getElementById('setting-lovers')) document.getElementById('setting-lovers').checked = settings.hasLovers;
          if (document.getElementById('time-night')) document.getElementById('time-night').value = settings.nightTime;
          if (document.getElementById('time-discuss')) document.getElementById('time-discuss').value = settings.discussionTime;
          if (document.getElementById('time-vote')) document.getElementById('time-vote').value = settings.votingTime;
        }

        // Presetni saqlash
        window.socketClient.savePreset(presetName, settings, (res) => {
          showToast(`"${presetName}" qoidalari xonaga muvaffaqiyatli qo'llandi!`, 'success');
          closeModal(customRulesModal);
        });
      });
    }

    // Qoidalar kodini nusxalash (Do'stlarga ulashish)
    const btnCopyCode = document.getElementById('btn-copy-rule-share-code');
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        window.sounds.playClick();
        const nameInput = document.getElementById('custom-rule-name-input');
        const presetName = (nameInput?.value.trim()) || 'Do\'stlar Ligasi';
        const settings = getCustomSettingsFromInputs();
        const code = window.socketClient.exportRulePresetCode(presetName, settings);

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            showToast("Qoidalar kodi nusxalandi! Do'stlaringizga yuboring 📋", 'success');
          }).catch(() => {
            prompt("Ushbu kodni nusxalab oling:", code);
          });
        } else {
          prompt("Ushbu kodni nusxalab oling:", code);
        }
      });
    }

    // Do'sti yuborgan qoidalar kodini import qilish
    const btnImport = document.getElementById('btn-import-rule-code');
    if (btnImport) {
      btnImport.addEventListener('click', () => {
        window.sounds.playClick();
        const inputEl = document.getElementById('input-import-rule-code');
        const code = inputEl?.value.trim();
        if (!code) {
          showToast("Iltimos, qoidalar kodini kiriting!", 'warning');
          return;
        }
        const imported = window.socketClient.importRulePresetCode(code);
        if (imported) {
          applySettingsToCustomInputs(imported.settings);
          const nameInput = document.getElementById('custom-rule-name-input');
          if (nameInput) nameInput.value = imported.name;
          showToast(`"${imported.name}" qoidalari muvaffaqiyatli import qilindi!`, 'success');
          inputEl.value = '';
        } else {
          showToast("Kiritilgan qoidalar kodi yaroqsiz!", 'danger');
        }
      });
    }
  }

  initApp();
  window.socketClient.init();
});
