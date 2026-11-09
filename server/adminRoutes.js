/**
 * Admin API Marshrutlari — Xonalar, Shikoyatlar, Foydalanuvchilarni boshqarish
 */

const express = require('express');
const router = express.Router();
const db = require('./db');
const { signToken, verifyToken, verifyAdminKey } = require('./security');
const logger = require('./logger');

// Admin Auth Middleware
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Avtorizatsiya talab qilinadi' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || !decoded.isAdmin) {
    return res.status(403).json({ success: false, message: 'Ruxsat berilmagan' });
  }

  req.admin = decoded;
  next();
}

module.exports = function (gameManager, io, onlineUserIds) {
  // Admin Login
  router.post('/login', (req, res) => {
    const { key } = req.body;
    if (!verifyAdminKey(key)) {
      logger.warn('Failed admin login attempt', { ip: req.ip });
      return res.status(401).json({ success: false, message: 'Admin maxfiy paroli noto\'g\'ri!' });
    }

    const token = signToken({ isAdmin: true, role: 'superadmin' }, '24h');
    logger.info('Admin logged in successfully', { ip: req.ip });
    res.json({ success: true, token });
  });

  // Admin Dashboard Statistikasi
  router.get('/dashboard', requireAdminAuth, (req, res) => {
    const totalUsers = Object.keys(db.getLeaderboard(1000)).length;
    const activeRooms = gameManager.rooms.size;
    const onlineCount = onlineUserIds.size;
    const pendingReports = db.getReports().filter(r => r.status === 'pending').length;

    res.json({
      success: true,
      stats: {
        activeRooms,
        onlineCount,
        totalUsers,
        pendingReports
      }
    });
  });

  // Faol xonalar
  router.get('/rooms', requireAdminAuth, (req, res) => {
    const rooms = gameManager.getPublicRoomsList();
    res.json({ success: true, rooms });
  });

  // Xonani majburiy yopish
  router.post('/room/close', requireAdminAuth, (req, res) => {
    const { roomCode } = req.body;
    const room = gameManager.getRoom(roomCode);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Xona topilmadi' });
    }

    room.broadcastChatMessage({
      senderName: 'ADMINISTRATOR',
      text: 'Ushbu xona moderator tomonidan to\'xtatildi.',
      isSystem: true,
      scope: 'all'
    });

    gameManager.removeRoom(roomCode);
    res.json({ success: true, message: `Xona (${roomCode}) yopildi` });
  });

  // Shikoyatlar (Reports)
  router.get('/reports', requireAdminAuth, (req, res) => {
    res.json({ success: true, reports: db.getReports() });
  });

  router.post('/report/resolve', requireAdminAuth, (req, res) => {
    const { reportId, action } = req.body;
    db.resolveReport(reportId, action || 'resolved');
    res.json({ success: true });
  });

  // Foydalanuvchini bloklash (Ban)
  router.post('/user/ban', requireAdminAuth, (req, res) => {
    const { userId, reason } = req.body;
    db.banUser(userId, reason);
    logger.warn(`User ${userId} banned by admin`, { reason });

    // Agar o'yinchi xonada bo'lsa, uni uzamiz
    for (const [sId, s] of io.of("/").sockets) {
      if (s.userId === userId) {
        s.emit('user_banned', { reason });
        s.disconnect(true);
      }
    }

    res.json({ success: true, message: `Foydalanuvchi (${userId}) bloklandi` });
  });

  router.post('/user/unban', requireAdminAuth, (req, res) => {
    const { userId } = req.body;
    db.unbanUser(userId);
    res.json({ success: true, message: `Foydalanuvchi (${userId}) blokdan chiqarildi` });
  });

  // Foydalanuvchini ovozsiz qilish (Mute)
  router.post('/user/mute', requireAdminAuth, (req, res) => {
    const { userId, durationMinutes, reason } = req.body;
    const dur = parseInt(durationMinutes, 10) || 15;
    const result = db.muteUser(userId, dur, reason || 'Moderator tomonidan sukutga olindi');
    logger.warn(`User ${userId} muted for ${dur} minutes`, { reason });

    // Foydalanuvchiga ogohlantirish yuborish
    for (const [sId, s] of io.of("/").sockets) {
      if (s.userId === userId) {
        s.emit('user_muted', {
          durationMinutes: dur,
          reason: reason || 'Moderator tomonidan sukutga olindi'
        });
      }
    }

    res.json({ success: true, message: `Foydalanuvchi (${userId}) ${dur} daqiqaga ovozsiz qilindi` });
  });

  // Foydalanuvchidan mute ni yechish (Unmute)
  router.post('/user/unmute', requireAdminAuth, (req, res) => {
    const { userId } = req.body;
    db.unmuteUser(userId);
    for (const [sId, s] of io.of("/").sockets) {
      if (s.userId === userId) {
        s.emit('user_unmuted', { message: 'Ovozsiz rejim bekor qilindi.' });
      }
    }
    res.json({ success: true, message: `Foydalanuvchi (${userId}) ovozsiz rejimdan chiqarildi` });
  });

  // Ovozli cheklanganlar ro'yxati
  router.get('/muted', requireAdminAuth, (req, res) => {
    res.json({ success: true, mutedUsers: db.getMutedUsers() });
  });

  // Hammaga global xabar (Broadcast Announcement)
  router.post('/broadcast', requireAdminAuth, (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false });

    io.emit('system_announcement', {
      title: '📢 ADMINISTRATSIYA E\'LONI',
      message
    });

    logger.info('Global announcement sent', { message });
    res.json({ success: true });
  });

  return router;
};
