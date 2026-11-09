/**
 * Xavfsizlik, JWT tokenlar va Rate Limiting (Anti-Spam / Anti-Flood)
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_7122_mafia';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin7122';

// Rate Limiter xotira hisoblagichi
const rateLimits = new Map(); // key -> { count, lastReset }

function checkRateLimit(key, maxRequests = 4, windowSeconds = 1) {
  const now = Date.now();
  let record = rateLimits.get(key);

  if (!record || now - record.lastReset > windowSeconds * 1000) {
    record = { count: 1, lastReset: now };
    rateLimits.set(key, record);
    return true;
  }

  record.count++;
  if (record.count > maxRequests) {
    return false; // Limitdan oshdi!
  }

  return true;
}

function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function verifyAdminKey(key) {
  return key === ADMIN_SECRET_KEY;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
}

// Xavfsiz HTTP headerlar middleware
function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

// HTTPS ga majburiy yo'naltirish (Production rejimida)
function httpsRedirectMiddleware(req, res, next) {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
}

module.exports = {
  checkRateLimit,
  signToken,
  verifyToken,
  verifyAdminKey,
  hashPassword,
  verifyPassword,
  securityHeadersMiddleware,
  httpsRedirectMiddleware,
  ADMIN_SECRET_KEY
};
