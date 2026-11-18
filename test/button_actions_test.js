const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');

console.log('========================================================');
console.log('   MAFIYA — O\'YINGA KIRISH TUGMALARI VA OQIMLAR TESTI  ');
console.log('========================================================\n');

// 1. DOM HTML elementlar mavjudligini tekshirish
const htmlPath = path.join(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const requiredElements = [
  { id: 'btn-quick-match', label: 'Tasodifiy o\'yin (MMR) tugmasi' },
  { id: 'btn-show-create-modal', label: 'Xona yaratish tugmasi' },
  { id: 'btn-show-join-modal', label: 'Kod bilan kirish tugmasi' },
  { id: 'btn-navbar-play', label: 'Desktop Navbar O\'ynash CTA tugmasi' },
  { id: 'btn-mobile-quick-play', label: 'Mobil Navbar O\'ynash CTA tugmasi' },
  { id: 'm-btn-quick-play', label: 'Mobil Drawer O\'ynash CTA tugmasi' },
  { id: 'btn-confirm-create', label: 'Modal ichidagi Xona yaratish tasdiq tugmasi' },
  { id: 'btn-confirm-join', label: 'Modal ichidagi Xonaga qo\'shilish tasdiq tugmasi' },
  { id: 'player-name-input', label: 'Taxallus (Ism) kiritish maydoni' }
];

console.log('--- 1-BOSQICH: HTML Elementlar va Tugmalar Mavjudligi ---');
for (const item of requiredElements) {
  if (htmlContent.includes(`id="${item.id}"`)) {
    console.log(`✓ [HTML] ${item.label} (#${item.id}) mavjud.`);
  } else {
    console.error(`✗ [HTML XATO] ${item.label} (#${item.id}) topilmadi!`);
    process.exit(1);
  }
}

// 2. JS app.js dagi hodisalar va himoyalangan funksiyalar tekshiruvi
console.log('\n--- 2-BOSQICH: JS Hodisa va Handlerlar Tekshiruvi ---');
const appJsPath = path.join(__dirname, '../js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

const requiredJsHandlers = [
  'handleNavbarPlayAction',
  'handleQuickMatchAction',
  'handleShowCreateModalAction',
  'handleConfirmCreateRoomAction',
  'handleShowJoinModalAction',
  'handleConfirmJoinRoomAction',
  'highlightPlayerNameInput'
];

for (const handler of requiredJsHandlers) {
  if (appJsContent.includes(handler)) {
    console.log(`✓ [JS] Funksiya / Handler ${handler}() mavjud.`);
  } else {
    console.error(`✗ [JS XATO] ${handler}() topilmadi!`);
    process.exit(1);
  }
}

// 3. Server bilan Socket.io orqali to'g'ridan-to'g'ri o'yin boshlash sinovlari
console.log('\n--- 3-BOSQICH: Server Socket.io Harakatlari Sinovi ---');

const socket = io('http://localhost:7122', {
  transports: ['websocket', 'polling'],
  timeout: 5000
});

socket.on('connect', () => {
  console.log('✓ [Socket] Serverga muvaffaqiyatli ulandi, socket ID:', socket.id);

  // A. Quick Match sinovi
  socket.emit('quick_match', {
    playerName: 'TestPlayer1',
    avatarIndex: 2,
    playerId: `p_test_${Date.now()}`
  }, (quickRes) => {
    if (quickRes && quickRes.success && quickRes.roomCode) {
      console.log(`✓ [Quick Match] Muvaffaqiyatli! Xona kodi: ${quickRes.roomCode}`);
    } else {
      console.error('✗ [Quick Match XATO]:', quickRes);
      process.exit(1);
    }

    // B. Create Room sinovi
    const socket2 = io('http://localhost:7122', { transports: ['websocket'] });
    socket2.on('connect', () => {
      socket2.emit('create_room', {
        playerName: 'HostPlayer2',
        avatarIndex: 1,
        isPublic: true,
        password: '',
        playerId: `p_host_${Date.now()}`
      }, (createRes) => {
        if (createRes && createRes.success && createRes.roomCode) {
          console.log(`✓ [Create Room] Muvaffaqiyatli! Xona kodi: ${createRes.roomCode}`);
          
          // C. Join Room sinovi
          const socket3 = io('http://localhost:7122', { transports: ['websocket'] });
          socket3.on('connect', () => {
            socket3.emit('join_room', {
              roomCode: createRes.roomCode,
              playerName: 'GuestPlayer3',
              avatarIndex: 3,
              password: '',
              playerId: `p_guest_${Date.now()}`
            }, (joinRes) => {
              if (joinRes && joinRes.success) {
                console.log(`✓ [Join Room] Muvaffaqiyatli! Xonaga qo'shildi: ${createRes.roomCode}`);
                console.log('\n========================================================');
                console.log('🎉 BARCHA O\'YINGA KIRISH TUGMALARI VA OQIMLARI 100% ISHLAMOQDA!');
                console.log('========================================================');
                socket.disconnect();
                socket2.disconnect();
                socket3.disconnect();
                process.exit(0);
              } else {
                console.error('✗ [Join Room XATO]:', joinRes);
                process.exit(1);
              }
            });
          });
        } else {
          console.error('✗ [Create Room XATO]:', createRes);
          process.exit(1);
        }
      });
    });
  });
});

socket.on('connect_error', (err) => {
  console.error('✗ [Socket Ulanish Xatosi]:', err.message);
  process.exit(1);
});
