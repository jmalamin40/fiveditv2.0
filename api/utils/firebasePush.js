/**
 * Firebase Cloud Messaging push notifications for chat.
 * Sends push when user sends message (notify admins) or admin sends message (notify user for that session).
 * Configure Firebase in admin panel (firebase_config table).
 */

const pool = require('../config/database');
const { defaultLogger } = require('../utils/logger');

let adminApp = null;

async function getFirebaseConfig() {
  const [rows] = await pool.execute(
    'SELECT is_enabled, service_account_json FROM firebase_config WHERE id = 1'
  );
  if (!rows.length || !rows[0].is_enabled || !rows[0].service_account_json) return null;
  try {
    return JSON.parse(rows[0].service_account_json);
  } catch (e) {
    defaultLogger.warn('Firebase push: invalid service_account_json', e.message);
    return null;
  }
}

function getAdminApp() {
  return adminApp;
}

async function initFirebase() {
  if (adminApp) return adminApp;
  const config = await getFirebaseConfig();
  if (!config) return null;
  try {
    const admin = require('firebase-admin');
    adminApp = admin.apps[0] || admin.initializeApp({ credential: admin.credential.cert(config) });
    defaultLogger.log('Firebase push: initialized');
    return adminApp;
  } catch (e) {
    defaultLogger.error('Firebase push: init failed', e.message);
    return null;
  }
}

/**
 * Get FCM tokens for recipient: 'admin' -> all admin tokens; 'user' -> tokens for session_id (user).
 */
async function getTokensForRecipient(recipientType, sessionId = null) {
  if (recipientType === 'admin') {
    const [rows] = await pool.execute(
      "SELECT token FROM fcm_tokens WHERE user_type = 'admin' AND token IS NOT NULL AND token != ''"
    );
    return rows.map((r) => r.token).filter(Boolean);
  }
  if (recipientType === 'user' && sessionId) {
    const [rows] = await pool.execute(
      "SELECT token FROM fcm_tokens WHERE user_type = 'user' AND session_id = ? AND token IS NOT NULL AND token != ''",
      [sessionId]
    );
    return rows.map((r) => r.token).filter(Boolean);
  }
  return [];
}

/**
 * Send push notification to recipient (admins or user for session).
 * recipientType: 'admin' | 'user', sessionId: required when recipientType === 'user'
 */
async function sendPushToRecipient(recipientType, sessionId, title, body) {
  const config = await getFirebaseConfig();
  if (!config) {
    defaultLogger.warn('Firebase push: skipped (not configured or disabled)');
    return;
  }
  const app = await initFirebase();
  if (!app) return;
  const tokens = await getTokensForRecipient(recipientType, sessionId);
  if (tokens.length === 0) {
    defaultLogger.warn('Firebase push: no tokens for', recipientType, sessionId || '');
    return;
  }
  try {
    let messaging;
    try {
      const { getMessaging } = require('firebase-admin/messaging');
      messaging = getMessaging(app);
    } catch (_) {
      const admin = require('firebase-admin');
      messaging = admin.messaging();
    }
    const message = {
      notification: {
        title: title || 'Support Chat',
        body: body || 'New message',
      },
      data: sessionId ? { sessionId, body: (body || '').substring(0, 100) } : { body: (body || '').substring(0, 100) },
      tokens,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };
    const res = await messaging.sendEachForMulticast(message);
    if (res.failureCount > 0) {
      defaultLogger.warn('Firebase push: some failures', res.successCount, res.failureCount);
    } else {
      defaultLogger.log('Firebase push: sent', res.successCount, recipientType);
    }
  } catch (e) {
    defaultLogger.error('Firebase push: send error', e.message);
  }
}

module.exports = {
  getFirebaseConfig,
  getAdminApp,
  initFirebase,
  getTokensForRecipient,
  sendPushToRecipient,
};
