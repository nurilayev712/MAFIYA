/**
 * Chat moderatsiyasi - nojo'ya va haqoratli so'zlarni avtomatik filtrlash
 */

const BAD_WORDS = [
  // O'zbekcha
  'ahmoq', 'itvachcha', 'jalap', 'shilta', 'it', 'haromi', 'padar', 'chmo', 'dalbayob', 'onangni', 'sikay', 'sikey', 'qotoq', 'kut', 'yebsan', 'am',
  // Ruscha
  'blya', 'blyad', 'suka', 'nahuy', 'pohuy', 'pizda', 'pidor', 'ebat', 'yeat', 'gandon', 'mudak', 'chmo', 'zalupa',
  // Inglizcha
  'fuck', 'bitch', 'shit', 'asshole', 'cunt', 'dick', 'pussy', 'bastard', 'fucker', 'retard'
];

// Regex yaratish
const regexPatterns = BAD_WORDS.map(word => {
  return new RegExp(`\\b${word}\\b`, 'gi');
});

function filterChatMessage(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;

  regexPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, (match) => '*'.repeat(match.length));
  });

  return cleaned;
}

function analyzeChatMessage(text) {
  if (!text || typeof text !== 'string') {
    return { cleaned: '', hasAbuse: false, matches: [] };
  }
  let cleaned = text;
  const matches = [];

  regexPatterns.forEach(pattern => {
    const found = text.match(pattern);
    if (found && found.length > 0) {
      matches.push(...found);
      cleaned = cleaned.replace(pattern, (match) => '*'.repeat(match.length));
    }
  });

  return {
    cleaned,
    hasAbuse: matches.length > 0,
    matches
  };
}

module.exports = {
  filterChatMessage,
  analyzeChatMessage,
  BAD_WORDS
};
