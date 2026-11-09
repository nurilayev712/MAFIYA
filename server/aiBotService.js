/**
 * AI Bot Service — Claude API va Aqlli Shaxsiyatlar Dvigateli
 */
require('dotenv').config();
const { ROLES } = require('./gameLogic');

const BOT_PERSONALITIES = {
  shubhachi: {
    id: 'shubhachi',
    name: 'Shubhachi',
    icon: '🕵️‍♂️',
    desc: 'Hammadan shubhalanadi, har bir harakatni tekshirmoqchi bo\'ladi'
  },
  sokin: {
    id: 'sokin',
    name: 'Sokin',
    icon: '🧘',
    desc: 'Kamgap, muvozanatli, hissiyotlarga berilmaydi, faktlarga tayanadi'
  },
  hazilkash: {
    id: 'hazilkash',
    name: 'Hazilkash',
    icon: '😂',
    desc: 'Hazil aralashtirib gapiradi, vaziyatni yumshatadi yoki chalg\'itadi'
  },
  tajovuzkor: {
    id: 'tajovuzkor',
    name: 'Qat\'iy / Tajovuzkor',
    icon: '⚡',
    desc: 'To\'g\'ridan-to\'g\'ri ayblaydi, qat\'iy ovoz talab qiladi, o\'zini qattiq himoya qiladi'
  },
  mantiqchi: {
    id: 'mantiqchi',
    name: 'Mantiqchi / Analitik',
    icon: '🧠',
    desc: 'O\'tgan voqealarni, kim kimga ovoz berganini mantiqiy hisob-kitob qiladi'
  }
};

const PERSONALITY_KEYS = Object.keys(BOT_PERSONALITIES);

class AIBotService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
  }

  getRandomPersonality() {
    const key = PERSONALITY_KEYS[Math.floor(Math.random() * PERSONALITY_KEYS.length)];
    return BOT_PERSONALITIES[key];
  }

  /**
   * Claude API yoki Dinamik O'zbek Tili Dvigateli orqali nutq yaratish
   */
  async generateSpeech({ bot, room, isDirectReply = false, replyingTo = null }) {
    const botState = room.playersState[bot.id];
    if (!botState || !botState.isAlive) return null;

    const role = botState.role;
    const personality = bot.personality ? bot.personality.id : 'mantiqchi';
    const difficulty = room.settings.botDifficulty || 'medium';

    const alivePlayers = room.players.filter(p => room.playersState[p.id]?.isAlive);
    const aliveOthers = alivePlayers.filter(p => p.id !== bot.id);
    const recentChat = (room.chatHistory || []).slice(-6);

    // 1. Agar Anthropic API kaliti mavjud bo'lsa Claude orqali
    if (this.apiKey) {
      try {
        const prompt = this.buildClaudePrompt({
          bot,
          role,
          personality,
          difficulty,
          alivePlayers,
          aliveOthers,
          recentChat,
          isDirectReply,
          replyingTo
        });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 150,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.content && data.content[0]?.text) {
            return data.content[0].text.trim().replace(/^["']|["']$/g, '');
          }
        }
      } catch (err) {
        // Fallback
      }
    }

    // 2. Dinamik Kontekstli Dvigatel (Smart Rule & Personality Based)
    return this.generateSmartFallbackSpeech({
      bot,
      role,
      personality,
      difficulty,
      aliveOthers,
      recentChat,
      isDirectReply,
      replyingTo
    });
  }

  buildClaudePrompt({ bot, role, personality, difficulty, alivePlayers, aliveOthers, recentChat, isDirectReply, replyingTo }) {
    return `Siz "Mafiya" onlayn ko'p o'yinchili o'yinidagi AI o'yinchisisiz.
Ismingiz: ${bot.name}
Maxfiy Rolingiz: ${role} (Eslatma: Rolingizni sir tuting!)
Shaxsiyatingiz: ${personality}
Qiyinlik darajasi: ${difficulty}
Tirik o'yinchilar ro'yxati: ${alivePlayers.map(p => p.name).join(', ')}
Oxirgi chat xabarlari:
${recentChat.map(m => `${m.senderName}: ${m.text}`).join('\n')}

QOIDALAR:
1. Rolingizni hech qachon oshkor qilmang (agar Jester bo'lsangiz odamlarni o'zingizga qaratish uchun shubhali gapiring).
2. Agar MAFIYA bo'lsangiz: o'zingizni begunoh fuqaro qilib ko'rsating, yolg'on gapiring, shubhani ${aliveOthers[0]?.name || 'boshqa o\'yinchi'}ga burishga harakat qiling, mafiya sheriklaringizni aslo sotmang!
3. Agar sizni ayblashsa yoki ismingiz tilga olinsa, o'z shaxsiyatingizga (${personality}) mos ravishda qat'iy himoyalaning!
4. Javobingiz o'zbek tilida, so'zlashuv uslubida, tabiiy, 1 yoki 2 ta qisqa jumla bo'lsin. Hech qanday qo'shimcha izohsiz faqat aytadigan gapingizni yozing.`;
  }

  generateSmartFallbackSpeech({ bot, role, personality, difficulty, aliveOthers, recentChat, isDirectReply, replyingTo }) {
    const randomTarget = aliveOthers.length > 0
      ? aliveOthers[Math.floor(Math.random() * aliveOthers.length)]
      : null;
    const targetName = randomTarget ? randomTarget.name : 'kimdir';

    // A) Agar bot bevosita ayblangan bo'lsa (Himoyalanish)
    if (isDirectReply && replyingTo) {
      const accuser = replyingTo;
      switch (personality) {
        case 'shubhachi':
          return `Nega aynan menga yopishyapsan, ${accuser}? O'zing e'tiborni chalg'itish uchun meni nishonga olyapsan deb o'ylayman!`;
        case 'sokin':
          return `Xotirjam bo'laylik, ${accuser}. Men oddiy fuqaroman, shoshilinch xulosa chiqarish faqat mafiyaga foyda keltiradi.`;
        case 'hazilkash':
          return `Oho, ${accuser}, meni bunchalik yaxshi ko'rishingizni bilmagandim 😂 Menda hech qanday qurol yo'q, tinchlaning!`;
        case 'tajovuzkor':
          return `Sen o'zingni kim deb o'ylayapsan, ${accuser}?! Daliling bo'lmasa gapirma, balki haqiqiy mafiya sensan!`;
        case 'mantiqchi':
        default:
          return `Agar men mafiya bo'lganimda o'tgan tunda bunday harakat qilmagan bo'lardim. ${accuser}ning menga qarshi dalili juda zaif.`;
      }
    }

    // B) MAFIYA roli uchun aldamchi nutq
    if (role === ROLES.MAFIA) {
      const mafiaDeflections = [
        `Menga ${targetName}ning o'zini tutishi g'alati tuyulyapti. Nega u bir chetda jim kuzatib o'tiribdi?`,
        `Men oddiy shahar fuqarosiman, komissar kechasi meni bemalol tekshirsin, shunda ishonasizlar!`,
        `Kelinglar, shubhali harakat qilayotgan ${targetName}ga e'tibor qarataylik, u e'tiborni boshqalarga burmoqchi.`,
        `Bugun xato qilsak mafiya yutadi, shuning uchun men ${targetName}dan shubhalanyapman.`
      ];
      return mafiaDeflections[Math.floor(Math.random() * mafiaDeflections.length)];
    }

    // C) JESTER roli (Linch qilinish uchun chaqiriq)
    if (role === ROLES.JESTER) {
      const jesterBait = [
        `Ha, mayli, xohlasangiz menga ovoz bering! O'lsam kim yutishini ko'ramiz 😉`,
        `Menga ovoz berishingizdan qo'rqmayman, balki men chindan ham shaharni qutqaruvchisidirman? Yoki aksi...`,
        `Mening mafiya ekanligimga kim kafolat beradi? Kelinglar, sinab ko'ringlar!`
      ];
      return jesterBait[Math.floor(Math.random() * jesterBait.length)];
    }

    // D) Shaxsiyatga qarab oddiy nutq
    switch (personality) {
      case 'shubhachi':
        return `Menga bu yerda hech kim ishonarli ko'rinmayapti. Ayniqsa ${targetName}ning so'nggi gapi juda shubhali tuyuldi...`;

      case 'sokin':
        return `Kelinglar, shoshilmaylik. Har bir o'yinchining so'zlarini eshitib ko'raylik, shundagina xato qilmaymiz.`;

      case 'hazilkash':
        return `Shaharda havo biroz sovuq, kimdir kechasi derazani ochiq qoldirgan ko'rinadi 😂 Ehtiyot bo'linglar!`;

      case 'tajovuzkor':
        return `Vaqt ketmoqda! ${targetName} o'zini oqlasin, aks holda men unga ovoz berish tarafdoriman!`;

      case 'mantiqchi':
      default:
        return `O'tgan tunda shifokor faol bo'lgan ko'rinadi. Kim ${targetName} haqida nima deb o'ylaydi? Mantiqan uning harakati tushunarsiz.`;
    }
  }

  /**
   * Mantiqiy Ovoz Berish Qarori
   */
  decideVote({ bot, room, alivePlayers }) {
    const botState = room.playersState[bot.id];
    if (!botState) return 'skip';

    const role = botState.role;
    const targets = alivePlayers.filter(p => p.id !== bot.id);
    if (targets.length === 0) return 'skip';

    // Agar Mafiya bo'lsa — hech qachon mafiya sherigiga ovoz bermaydi
    if (role === ROLES.MAFIA) {
      const nonMafiaTargets = targets.filter(p => room.playersState[p.id]?.role !== ROLES.MAFIA);
      if (nonMafiaTargets.length > 0) {
        // Mavjud ovozlardan ko'proq ovoz olganiga ergashish
        const currentVotes = room.votes || {};
        const voteCounts = {};
        for (const voter in currentVotes) {
          const t = currentVotes[voter];
          if (t && t !== 'skip') voteCounts[t] = (voteCounts[t] || 0) + 1;
        }

        // Agar fuqarolardan kimdir ko'p ovoz olayotgan bo'lsa, o'shanga qo'shiladi
        let bestTarget = nonMafiaTargets[0].id;
        let maxV = -1;
        for (const t of nonMafiaTargets) {
          const v = voteCounts[t.id] || 0;
          if (v > maxV) {
            maxV = v;
            bestTarget = t.id;
          }
        }
        return bestTarget;
      }
    }

    // Agar Komissar bo'lsa va mafiya topgan bo'lsa
    if (role === ROLES.DETECTIVE && room.nightActions.detectiveResult?.isMafia) {
      const foundMafiaId = room.nightActions.detectiveTarget;
      if (targets.some(t => t.id === foundMafiaId)) {
        return foundMafiaId;
      }
    }

    // Oddiy mantiqiy hisoblash (Chatda eng ko'p nomi chiqqan yoki random shubhali)
    if (Math.random() > 0.15) {
      const chosen = targets[Math.floor(Math.random() * targets.length)];
      return chosen.id;
    }

    return 'skip';
  }
}

module.exports = {
  AIBotService: new AIBotService(),
  BOT_PERSONALITIES
};
