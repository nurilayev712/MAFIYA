/**
 * Monitoring va Log Tizimi (Production Logger)
 */

const fs = require('fs');
const path = require('path');

// Sentry Error Monitoring integratsiyasi
let Sentry = null;
try {
  Sentry = require('@sentry/node');
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 1.0,
      release: 'mafiya@1.0.0'
    });
    console.log('[INFO] Sentry monitoring muvaffaqiyatli ishga tushdi');
  }
} catch (e) {
  // Sentry paketi mavjud bo'lmasa yoki xato bo'lsa mahalliy log ishlatiladi
}

const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const ERROR_LOG = path.join(LOG_DIR, 'error.log');
const APP_LOG = path.join(LOG_DIR, 'app.log');

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  return JSON.stringify({ timestamp, level, message, ...meta }) + '\n';
}

const logger = {
  info(message, meta = {}) {
    const logStr = formatLog('INFO', message, meta);
    console.log(`[INFO] ${message}`, Object.keys(meta).length ? meta : '');
    fs.appendFileSync(APP_LOG, logStr, 'utf8');
  },

  warn(message, meta = {}) {
    const logStr = formatLog('WARN', message, meta);
    console.warn(`[WARN] ${message}`, Object.keys(meta).length ? meta : '');
    fs.appendFileSync(APP_LOG, logStr, 'utf8');
  },

  error(message, error = null, meta = {}) {
    const errorDetails = error ? { errorMsg: error.message, stack: error.stack } : {};
    const logStr = formatLog('ERROR', message, { ...errorDetails, ...meta });
    console.error(`[ERROR] ${message}`, error || '');
    fs.appendFileSync(ERROR_LOG, logStr, 'utf8');

    // Sentry ga yuborish
    if (Sentry && process.env.SENTRY_DSN) {
      if (error instanceof Error) {
        Sentry.captureException(error, { extra: { message, ...meta } });
      } else {
        Sentry.captureMessage(`${message}: ${JSON.stringify(error || meta)}`, 'error');
      }
    }
  }
};

module.exports = logger;
