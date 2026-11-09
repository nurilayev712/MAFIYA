/**
 * Ko'p tillilik (i18n) lug'ati - O'zbek, Rus, Ingliz
 */

const TRANSLATIONS = {
  uz: {
    gameTitle: "MAFIYA",
    gameSubtitle: "Shahar uyquga ketganda, kimningdir so'nggi nafasiga guvoh bo'lasiz...",
    quickMatch: "Tasodifiy o'yin",
    createRoom: "Xona yaratish",
    joinWithCode: "Kod bilan kirish",
    enterNickname: "Taxallus (Ism)",
    chooseAvatar: "Qahramon avatari",
    rules: "Qoidalar",
    profile: "Profil & Statistika",
    friends: "Do'stlar",
    achievements: "Yutuqlar",
    telegramLogin: "Telegram orqali kirish",
    lobbyTitle: "O'yin Lobbisi",
    players: "O'yinchilar",
    roomSettings: "O'yin sozlamalari",
    startGame: "O'yinni boshlash",
    addBot: "+ Bot qo'shish",
    waitingHost: "Xost o'yinni boshlashini kuting...",
    roleRevealTitle: "MAXFIY ROLINGIZ",
    nightPhase: "TUN FAZASI",
    nightSub: "Shahar sokin uyquga ketdi...",
    dayDiscussion: "KUNDUZGI MUHOKAMA",
    dayVoting: "OVOZ BERISH",
    publicChat: "Umumiy Chat",
    mafiaChat: "Mafiya Chati",
    ghostChat: "👻 Arvohlar Chati",
    skipVote: "Hech kimga ovoz bermaslik (Skip)",
    playAgain: "Yana o'ynash",
    leaveHome: "Bosh sahifaga",
    copyCode: "Nusxalash",
    shareLink: "Ulashish",
    openRoom: "Ochiq xona (Global)",
    closedRoom: "Yopiq xona (Parolli)",
    roomPassword: "Xona paroli (ixtiyoriy)"
  },
  ru: {
    gameTitle: "МАФИЯ",
    gameSubtitle: "Когда город засыпает, просыпаются те, кто жаждет крови...",
    quickMatch: "Быстрая игра",
    createRoom: "Создать комнату",
    joinWithCode: "Войти по коду",
    enterNickname: "Никнейм (Имя)",
    chooseAvatar: "Аватар героя",
    rules: "Правила",
    profile: "Профиль и статистика",
    friends: "Друзья",
    achievements: "Достижения",
    telegramLogin: "Войти через Telegram",
    lobbyTitle: "Лобби игры",
    players: "Игроки",
    roomSettings: "Настройки игры",
    startGame: "Начать игру",
    addBot: "+ Добавить бота",
    waitingHost: "Ожидайте запуска игры хостом...",
    roleRevealTitle: "ВАША ТАЙНАЯ РОЛЬ",
    nightPhase: "ФАЗА НОЧИ",
    nightSub: "Город погрузился в глубокий сон...",
    dayDiscussion: "ДНЕВНОЕ ОБСУЖДЕНИЕ",
    dayVoting: "ГОЛОСОВАНИЕ",
    publicChat: "Общий чат",
    mafiaChat: "Чат Мафии",
    ghostChat: "👻 Чат Призраков",
    skipVote: "Пропустить голос (Skip)",
    playAgain: "Играть снова",
    leaveHome: "На главную",
    copyCode: "Копировать",
    shareLink: "Поделиться",
    openRoom: "Открытая комната",
    closedRoom: "Закрытая комната",
    roomPassword: "Пароль комнаты (опционально)"
  },
  en: {
    gameTitle: "MAFIA",
    gameSubtitle: "When the city falls asleep, shadows come alive...",
    quickMatch: "Quick Match",
    createRoom: "Create Room",
    joinWithCode: "Join with Code",
    enterNickname: "Nickname",
    chooseAvatar: "Character Avatar",
    rules: "Rules",
    profile: "Profile & Stats",
    friends: "Friends",
    achievements: "Achievements",
    telegramLogin: "Login with Telegram",
    lobbyTitle: "Game Lobby",
    players: "Players",
    roomSettings: "Room Settings",
    startGame: "Start Game",
    addBot: "+ Add Bot",
    waitingHost: "Waiting for host to start...",
    roleRevealTitle: "YOUR SECRET ROLE",
    nightPhase: "NIGHT PHASE",
    nightSub: "The city has fallen asleep...",
    dayDiscussion: "DAY DISCUSSION",
    dayVoting: "VOTING PHASE",
    publicChat: "Public Chat",
    mafiaChat: "Mafia Chat",
    ghostChat: "👻 Ghost Chat",
    skipVote: "Skip Vote",
    playAgain: "Play Again",
    leaveHome: "Home Screen",
    copyCode: "Copy Code",
    shareLink: "Share Link",
    openRoom: "Public Room",
    closedRoom: "Private Room",
    roomPassword: "Room Password (optional)"
  }
};

class I18n {
  constructor() {
    this.lang = localStorage.getItem('mafia_lang') || 'uz';
  }

  setLang(lang) {
    if (TRANSLATIONS[lang]) {
      this.lang = lang;
      localStorage.setItem('mafia_lang', lang);
      this.updateDOM();
    }
  }

  t(key) {
    return TRANSLATIONS[this.lang]?.[key] || TRANSLATIONS['uz']?.[key] || key;
  }

  updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.t(key);
      }
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (key) {
        el.placeholder = this.t(key);
      }
    });
  }
}

window.i18n = new I18n();
