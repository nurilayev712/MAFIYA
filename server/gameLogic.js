/**
 * Mafiya o'yini - Kengaytirilgan Rollar va Qoidalar
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

const PHASES = {
  LOBBY: 'lobby',
  ROLE_REVEAL: 'role_reveal',
  NIGHT: 'night',
  DAY_ANNOUNCE: 'day_announce',
  DAY_DISCUSSION: 'day_discussion',
  DAY_VOTING: 'day_voting',
  GAME_OVER: 'game_over'
};

/**
 * Rollarni tasodifiy taqsimlaydi va sevishganlar juftligini belgilaydi
 */
function assignRoles(players, settings) {
  const count = players.length;
  let mafiaCount = parseInt(settings.mafiaCount, 10) || 1;
  const doctorCount = settings.doctorCount !== undefined ? parseInt(settings.doctorCount, 10) : (settings.hasDoctor ? 1 : 0);
  const detectiveCount = settings.detectiveCount !== undefined ? parseInt(settings.detectiveCount, 10) : (settings.hasDetective ? 1 : 0);
  const mayorCount = settings.mayorCount !== undefined ? parseInt(settings.mayorCount, 10) : (settings.hasMayor ? 1 : 0);
  const maniacCount = settings.maniacCount !== undefined ? parseInt(settings.maniacCount, 10) : (settings.hasManiac ? 1 : 0);
  const jesterCount = settings.jesterCount !== undefined ? parseInt(settings.jesterCount, 10) : (settings.hasJester ? 1 : 0);
  const hasLovers = Boolean(settings.hasLovers);

  // Mafiya chegarasi
  const maxMafia = Math.max(1, Math.floor((count - 1) / 2));
  if (mafiaCount > maxMafia) mafiaCount = maxMafia;

  const roleDeck = [];

  for (let i = 0; i < mafiaCount && roleDeck.length < count; i++) roleDeck.push(ROLES.MAFIA);
  for (let i = 0; i < doctorCount && roleDeck.length < count; i++) roleDeck.push(ROLES.DOCTOR);
  for (let i = 0; i < detectiveCount && roleDeck.length < count; i++) roleDeck.push(ROLES.DETECTIVE);
  for (let i = 0; i < mayorCount && roleDeck.length < count; i++) roleDeck.push(ROLES.MAYOR);
  for (let i = 0; i < maniacCount && roleDeck.length < count; i++) roleDeck.push(ROLES.MANIAC);
  for (let i = 0; i < jesterCount && roleDeck.length < count; i++) roleDeck.push(ROLES.JESTER);

  while (roleDeck.length < count) {
    roleDeck.push(ROLES.CITIZEN);
  }

  // Shuffle
  for (let i = roleDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roleDeck[i], roleDeck[j]] = [roleDeck[j], roleDeck[i]];
  }

  // Sevishganlar juftligini tanlash (agar yoqilgan bo'lsa va o'yinchilar >= 4 ta bo'lsa)
  let loverPair = null;
  if (hasLovers && players.length >= 4) {
    const indices = [];
    while (indices.length < 2) {
      const r = Math.floor(Math.random() * players.length);
      if (!indices.includes(r)) indices.push(r);
    }
    loverPair = [players[indices[0]].id, players[indices[1]].id];
  }

  const assigned = {};
  players.forEach((player, idx) => {
    const isLover = loverPair && loverPair.includes(player.id);
    const partnerId = isLover ? (loverPair[0] === player.id ? loverPair[1] : loverPair[0]) : null;

    assigned[player.id] = {
      role: roleDeck[idx],
      isAlive: true,
      killedBy: null,
      deathPhase: null,
      isLover,
      loverPartnerId: partnerId
    };
  });

  return { assigned, loverPair };
}

/**
 * G'olibni aniqlash
 */
function checkWinner(playersState, context = {}) {
  // Agar Jester kunduzi linch qilingan bo'lsa, u darhol g'olib!
  const jesterId = context.jesterLynchWinnerId || (context.lastLynchResult?.role === ROLES.JESTER ? context.lastLynchResult.eliminatedId : null);
  if (jesterId) {
    const jesterPlayer = playersState[jesterId];
    return {
      winner: 'jester',
      winnerPlayerId: jesterId,
      title: 'Masharaboz (Jester) g\'alaba qozondi! 🃏',
      reason: 'U hammani aldab, o\'zini muvaffaqiyatli qatl ettirdi va o\'yinda g\'olib chiqdi!'
    };
  }

  let aliveMafia = 0;
  let aliveCitizens = 0;
  let aliveManiac = 0;
  let aliveTotal = 0;
  let alivePlayers = [];

  for (const [id, state] of Object.entries(playersState)) {
    if (state.isAlive) {
      aliveTotal++;
      alivePlayers.push(id);
      if (state.role === ROLES.MAFIA) aliveMafia++;
      else if (state.role === ROLES.MANIAC) aliveManiac++;
      else if (state.role !== ROLES.JESTER) aliveCitizens++;
    }
  }

  // Sevishganlar g'alabasi (agar faqat 2 sevishgan tirik qolgan bo'lsa)
  if (aliveTotal === 2) {
    const p1 = playersState[alivePlayers[0]];
    const p2 = playersState[alivePlayers[1]];
    if (p1 && p2 && p1.isLover && p1.loverPartnerId === alivePlayers[1]) {
      return {
        winner: 'lovers',
        title: 'Sevishganlar Juftligi g\'alaba qozondi! 💖',
        reason: 'Ular barcha sinovlardan o\'tib, birgalikda omon qolishdi!'
      };
    }
  }

  // Maniac g'alabasi (agar faqat maniac va yana 1 kishi yoki faqat maniac qolsa, mafiya yo'q)
  if (aliveManiac > 0 && aliveMafia === 0 && aliveCitizens <= 1) {
    return {
      winner: 'maniac',
      title: 'Qonxo\'r Maniac g\'alaba qozondi! 🩸',
      reason: 'U shahar ustidan yakka hukmronlik o\'rnatdi!'
    };
  }

  // Mafiya g'alabasi (agar tirik mafiyalar soni qolgan barcha tiriklardan teng yoki ko'p bo'lsa va maniac yo'q bo'lsa)
  if (aliveMafia > 0 && aliveMafia >= (aliveTotal - aliveMafia) && aliveManiac === 0) {
    return {
      winner: 'mafia',
      title: 'Mafiya g\'alaba qozondi! 🎩',
      reason: 'Mafiya shaharni to\'liq o\'z nazoratiga oldi!'
    };
  }

  // Tinch aholi g'alabasi (barcha mafiya va maniac yo'q qilinsa)
  if (aliveMafia === 0 && aliveManiac === 0) {
    return {
      winner: 'citizens',
      title: 'Tinch aholi g\'alaba qozondi! 🏆',
      reason: 'Barcha qotillar va mafiyalar yo\'q qilindi, shahar tinchlikka erishdi!'
    };
  }

  return null;
}

/**
 * Tungi harakatlar hisobi
 */
function resolveNight(nightActions, playersState) {
  // nightActions:
  //   mafiaVotes: { [targetId]: count }
  //   maniacTarget: targetId
  //   doctorTarget: targetId
  //   detectiveTarget: targetId
  let mafiaKillId = null;
  let maniacKillId = null;
  let savedByDoctor = false;
  const killedList = [];

  // 1. Mafiya nishoni
  if (nightActions.mafiaVotes) {
    let maxVotes = 0;
    let candidates = [];
    for (const [targetId, count] of Object.entries(nightActions.mafiaVotes)) {
      if (count > maxVotes) {
        maxVotes = count;
        candidates = [targetId];
      } else if (count === maxVotes) {
        candidates.push(targetId);
      }
    }
    if (candidates.length > 0) {
      mafiaKillId = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  // 2. Maniac nishoni
  if (nightActions.maniacTarget && playersState[nightActions.maniacTarget]?.isAlive) {
    maniacKillId = nightActions.maniacTarget;
  }

  // 3. Shifokor davolashi
  const docTarget = nightActions.doctorTarget;

  if (mafiaKillId && mafiaKillId === docTarget) {
    savedByDoctor = true;
    mafiaKillId = null; // Saqlandi
  }

  if (maniacKillId && maniacKillId === docTarget) {
    savedByDoctor = true;
    maniacKillId = null; // Saqlandi
  }

  // O'ldirishlar
  if (mafiaKillId && playersState[mafiaKillId]) {
    playersState[mafiaKillId].isAlive = false;
    playersState[mafiaKillId].killedBy = 'mafia';
    playersState[mafiaKillId].deathPhase = 'night';
    killedList.push({ id: mafiaKillId, by: 'mafia' });
  }

  if (maniacKillId && playersState[maniacKillId] && playersState[maniacKillId].isAlive) {
    playersState[maniacKillId].isAlive = false;
    playersState[maniacKillId].killedBy = 'maniac';
    playersState[maniacKillId].deathPhase = 'night';
    killedList.push({ id: maniacKillId, by: 'maniac' });
  }

  // Sevishganlar zanjiri (Chain death)
  killedList.forEach(k => {
    const victim = playersState[k.id];
    if (victim && victim.isLover && victim.loverPartnerId) {
      const partner = playersState[victim.loverPartnerId];
      if (partner && partner.isAlive) {
        partner.isAlive = false;
        partner.killedBy = 'broken_heart';
        partner.deathPhase = 'night';
        killedList.push({ id: victim.loverPartnerId, by: 'broken_heart' });
      }
    }
  });

  return {
    killedList,
    savedByDoctor
  };
}

/**
 * Kunduzgi ovoz berish natijasi (Mayor ovozi x2 bo'ladi)
 */
function resolveDayVote(votes, playersState) {
  // votes: { [voterId]: targetId }
  const counts = {};
  let skipCount = 0;

  for (const [voterId, targetId] of Object.entries(votes)) {
    if (!targetId) continue;
    const voterState = playersState[voterId];
    // Mayor ovozi 2 ball!
    const weight = (voterState && voterState.role === ROLES.MAYOR) ? 2 : 1;

    if (targetId === 'skip') {
      skipCount += weight;
    } else {
      counts[targetId] = (counts[targetId] || 0) + weight;
    }
  }

  let maxVotes = 0;
  let eliminatedId = null;
  let isTie = false;

  for (const [targetId, count] of Object.entries(counts)) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedId = targetId;
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  }

  if (skipCount >= maxVotes || isTie || !eliminatedId) {
    return {
      eliminatedId: null,
      isTie,
      voteCounts: counts,
      skipCount
    };
  }

  const elimState = playersState[eliminatedId];
  if (elimState) {
    elimState.isAlive = false;
    elimState.killedBy = 'vote';
    elimState.deathPhase = 'day';
  }

  // Sevishganlar zanjiri
  let loverDiedId = null;
  if (elimState && elimState.isLover && elimState.loverPartnerId) {
    const partner = playersState[elimState.loverPartnerId];
    if (partner && partner.isAlive) {
      partner.isAlive = false;
      partner.killedBy = 'broken_heart';
      partner.deathPhase = 'day';
      loverDiedId = elimState.loverPartnerId;
    }
  }

  return {
    eliminatedId,
    role: elimState?.role,
    loverDiedId,
    isTie: false,
    voteCounts: counts,
    skipCount
  };
}

/**
 * O'yin yakunida AI tomonidan qisqa, qiziqarli tahlil (Post-game Recap) yaratish
 * 2-4 jumlada: kimdan dastlab shubhalanildi, ovoz berishdagi burilish va g'alaba omili.
 */
function generateAIRecap(winResult, players = [], playersState = {}, matchHistory = {}) {
  const winner = winResult?.winner || 'citizens';
  const events = matchHistory?.events || [];
  
  // Asosiy ishtirokchilar
  const mafias = players.filter(p => playersState[p.id]?.role === 'mafia').map(p => p.name);
  const doctors = players.filter(p => playersState[p.id]?.role === 'doctor').map(p => p.name);
  const detectives = players.filter(p => playersState[p.id]?.role === 'detective').map(p => p.name);
  const maniacs = players.filter(p => playersState[p.id]?.role === 'maniac').map(p => p.name);
  const jesters = players.filter(p => playersState[p.id]?.role === 'jester').map(p => p.name);

  // Hodisalardan burilish nuqtalarini aniqlash
  const docSaves = events.filter(e => e.type === 'doctor_saved');
  const detFinds = events.filter(e => e.type === 'detective_found');
  const lynches = events.filter(e => e.type === 'lynch');
  const mafiaLynched = lynches.filter(l => l.wasMafia);
  const innocentLynched = lynches.filter(l => !l.wasMafia && l.role !== 'jester');

  let s1 = "";
  let s2 = "";
  let s3 = "";

  if (winner === 'citizens') {
    if (docSaves.length > 0) {
      s1 = `O'yin boshidanoq Shifokor (${doctors[0] || 'shahar shifokori'})ning kechasi fuqaroni o'limdan asrab qolgani mafiya rejasiga jiddiy zarba berdi.`;
    } else if (mafias.length > 0) {
      s1 = `Dastlabki raundlarda shahar ahli sarosimaga tushdi, biroq mafiya (${mafias.slice(0, 2).join(' va ')})ning shubhali harakatlari tez orada e'tiborni tortdi.`;
    } else {
      s1 = `O'yin juda keskin kurashlar bilan boshlandi va dastlabki shubhalar bir necha faol o'yinchilar atrofida aylandi.`;
    }

    if (detFinds.length > 0) {
      s2 = `Burilish nuqtasi Komissar (${detectives[0] || 'detektiv'})ning tunda olib borgan aniq tekshiruvi bo'ldi — jinoyatchining niqobi yirtildi.`;
    } else if (mafiaLynched.length > 0) {
      s2 = `Hal qiluvchi ovoz berishda ko'pchilik birlashib, mafiya a'zosi (${mafiaLynched[0].eliminated})ni sud qarori bilan chetlatdi.`;
    } else {
      s2 = `Kunduzgi muhokamalarda fuqarolar o'zaro ishonchni tiklab, xatolarga yo'l qo'ymadilar.`;
    }

    s3 = `Natijada Tinch aholi mantiqiy fikrlash va kuchli jamoaviy birdamlik evaziga barcha dushmanlarni bartaraf etib, haqli g'alabaga erishdi! 🏆`;
  } else if (winner === 'mafia') {
    s1 = `Mafiya jamoasi (${mafias.slice(0, 2).join(' va ') || 'Don'}) birinchi tundan boshlab sovuqqonlik bilan nishonlarni yo'q qildi va shahar ahlini mohirlik bilan chalg'itdi.`;
    
    if (innocentLynched.length > 0) {
      s2 = `O'yindagi asosiy burilish fuqarolarning shubha ostida o'z begunoh sherigi (${innocentLynched[0].eliminated})ni ovoz berishda chiqarib yuborishi bo'ldi.`;
    } else {
      s2 = `Kunduzgi bahslarda mafiya a'zolari o'zlarini beg'ubor fuqaro qilib ko'rsatib, e'tiborni boshqa odamlarga qaratishga muvaffaq bo'lishdi.`;
    }

    s3 = `Shahar o'ziga kelguniga qadar kuchlar tenglashdi va Mafiya butun shahar ustidan o'zining qat'iy nazoratini o'rnatdi! 🎩`;
  } else if (winner === 'maniac') {
    s1 = `Shahar mafiya va fuqarolar o'rtasidagi nizo bilan ovora bo'lib turganda, soya ortidagi Manyak (${maniacs[0] || 'qotil'}) har kecha o'zining qonli izini qoldirdi.`;
    s2 = `Hech kim uni payqamadi va har ikki tomon bir-birini ayblab, haqiqiy qotilga qo'l bermay turib unga yo'l ochib berdi.`;
    s3 = `Tong yorishganda barcha raqiblar maydondan chetlatilgan, faqat yovvoyi Manyak maydonda yagona omon qoluvchi mutlaq g'olib sifatida tantana qildi! 🩸`;
  } else if (winner === 'jester') {
    s1 = `Masharaboz (${jesters[0] || 'Jester'}) o'yin boshidanoq ataylab shubhali harakatlar qilib, butun shaharning g'azabini o'ziga jalb etdi.`;
    s2 = `Fuqarolar uni 'aniq mafiya' degan qat'iy ishonch bilan bitta ovozdan osishga qaror qildilar — biroq bu uning puxta rejalashtirilgan eng katta tuzog'i edi!`;
    s3 = `Linch sudi hukmi ijro etilgach, Masharaboz qah-qaha otib barchani lol qoldirdi va o'yinning yagona daho g'olibi bo'ldi! 🃏`;
  } else if (winner === 'lovers') {
    s1 = `O'yin davomida har ikki jabhada ayovsiz jang ketdi, biroq maxfiy Sevishganlar juftligi har qanday zarbadan bir-birlarini himoya qilib keldilar.`;
    s2 = `Xavfli daqiqalarda ular o'z sirlarini saqlab qolishdi va shaharning barcha fitnalaridan omon o'tishdi.`;
    s3 = `Shafqatsiz o'yinda yovuzlik ham, adolat ham emas, balki sof Muhabbat barcha to'siqlarni yengib chiqdi! 💖`;
  } else {
    s1 = `Ushbu o'yin kutilmagan burilishlar va dramatik qarorlarga boy tarzda kechdi.`;
    s2 = `O'yinchilar oxirgi nafasgacha o'z nuqtai nazarlarini himoya qilishdi.`;
    s3 = `Adolat va mantiq sinovida g'olib bo'lgan tomonni chin yurakdan tabriklaymiz! 🌟`;
  }

  return `${s1} ${s2} ${s3}`;
}

module.exports = {
  ROLES,
  ROLE_INFO,
  PHASES,
  assignRoles,
  checkWinner,
  resolveNight,
  resolveDayVote,
  generateAIRecap
};
