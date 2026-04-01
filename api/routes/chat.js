const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendPushToRecipient } = require('../utils/firebasePush');
const { encryptPassword } = require('../utils/encryption');
const { invalidateWebsiteKnowledgeCache } = require('../utils/aiSupportKnowledge');
const { DEFAULTS, getDefaultRoutesJson } = require('../utils/defaultAiPublicInfo');

async function ensureAiSupportConfigTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ai_support_config (
      id INT PRIMARY KEY DEFAULT 1,
      is_enabled BOOLEAN DEFAULT FALSE,
      provider VARCHAR(30) NOT NULL DEFAULT 'openai',
      api_base_url VARCHAR(500) NULL DEFAULT 'https://api.openai.com/v1',
      api_key_encrypted TEXT NULL,
      model VARCHAR(120) NULL DEFAULT 'gpt-4o-mini',
      system_prompt TEXT NULL,
      temperature DECIMAL(4,2) DEFAULT 0.70,
      max_tokens INT DEFAULT 300,
      include_catalog_knowledge BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    await pool.execute(
      'ALTER TABLE ai_support_config ADD COLUMN include_catalog_knowledge BOOLEAN NOT NULL DEFAULT TRUE'
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  await pool.execute(`
    INSERT INTO ai_support_config (id, is_enabled, provider, api_base_url, model, system_prompt, temperature, max_tokens, include_catalog_knowledge)
    VALUES (1, FALSE, 'openai', 'https://api.openai.com/v1', 'gpt-4o-mini', 'You are a support teammate for FivedIT. Sound natural and human: warm, clear, and concise - like a real person on the team, not a robot or a formal brochure.', 0.70, 300, TRUE)
    ON DUPLICATE KEY UPDATE id = id
  `);
}

async function ensureAiSupportPublicInfoTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ai_support_public_info (
      id INT PRIMARY KEY DEFAULT 1,
      public_site_url VARCHAR(500) NOT NULL DEFAULT 'https://fivedit.com',
      support_email VARCHAR(255) NOT NULL DEFAULT 'info@fivedit.com',
      support_phone_display VARCHAR(120) NULL,
      whatsapp_e164 VARCHAR(32) NULL,
      contact_page_path VARCHAR(200) NOT NULL DEFAULT '/contact',
      routes_json LONGTEXT NOT NULL,
      support_notes TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.execute(
    `INSERT INTO ai_support_public_info (id, public_site_url, support_email, support_phone_display, whatsapp_e164, contact_page_path, routes_json, support_notes)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [
      DEFAULTS.public_site_url,
      DEFAULTS.support_email,
      DEFAULTS.support_phone_display,
      DEFAULTS.whatsapp_e164,
      DEFAULTS.contact_page_path,
      getDefaultRoutesJson(),
      DEFAULTS.support_notes,
    ]
  );
}

// Generate UUID for session IDs
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Public: Create or get chat session
router.post('/sessions', async (req, res) => {
  try {
    const { sessionId, userIdentifier } = req.body;
    
    let session;
    
    if (sessionId) {
      // Get existing session
      const [sessions] = await pool.execute(
        'SELECT * FROM chat_sessions WHERE id = ?',
        [sessionId]
      );
      
      if (sessions.length > 0) {
        session = sessions[0];
      } else {
        return res.status(404).json({ error: 'Session not found' });
      }
    } else {
      // Create new session - mark as new traffic
      const newSessionId = generateUUID();
      await pool.execute(
        'INSERT INTO chat_sessions (id, user_identifier, status, is_new_traffic) VALUES (?, ?, ?, ?)',
        [newSessionId, userIdentifier || null, 'active', true]
      );
      
      const [sessions] = await pool.execute(
        'SELECT * FROM chat_sessions WHERE id = ?',
        [newSessionId]
      );
      session = sessions[0];
      
      // Notify admins about new traffic in real-time via Socket.IO
      // This will be handled by the socket handler when user connects
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error creating/getting session:', error);
    res.status(500).json({ error: 'Failed to create/get session' });
  }
});

// Public: Send message from user
router.post('/messages', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message || !message.trim()) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }
    
    // Verify session exists
    const [sessions] = await pool.execute(
      'SELECT * FROM chat_sessions WHERE id = ?',
      [sessionId]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Insert message
    const [result] = await pool.execute(
      'INSERT INTO chat_messages (session_id, message, sender_type) VALUES (?, ?, ?)',
      [sessionId, message.trim(), 'user']
    );
    
    // Update session last_message_at
    await pool.execute(
      'UPDATE chat_sessions SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sessionId]
    );
    
    // Get the created message
    const [messages] = await pool.execute(
      'SELECT * FROM chat_messages WHERE id = ?',
      [result.insertId]
    );
    
    res.json(messages[0]);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Public: Get messages for a session
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const [messages] = await pool.execute(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Public: Mark messages as read for a session
router.post('/sessions/:sessionId/mark-read', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Mark all admin messages as read for this session
    await pool.execute(
      'UPDATE chat_messages SET is_read = TRUE WHERE session_id = ? AND sender_type = ?',
      [sessionId, 'admin']
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Admin: Get all chat sessions with filtering and pagination
router.get('/admin/sessions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { 
      status, 
      online_status, 
      is_new_traffic, 
      has_unread,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;
    
    // Build WHERE conditions
    const whereConditions = [];
    const params = [];
    
    if (status) {
      whereConditions.push('cs.status = ?');
      params.push(status);
    }
    
    if (is_new_traffic === 'true') {
      whereConditions.push('cs.is_new_traffic = TRUE');
    }
    
    // Build base query with online status check
    let baseQuery = `
      SELECT 
        cs.*,
        COUNT(cm.id) as message_count,
        MAX(cm.created_at) as last_message_time,
        SUM(CASE WHEN cm.sender_type = 'user' AND cm.is_read = FALSE THEN 1 ELSE 0 END) as unread_count,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM user_online_status uos 
            WHERE uos.session_id = cs.id 
            AND uos.user_type = 'user' 
            AND TIMESTAMPDIFF(SECOND, uos.last_seen, NOW()) <= 30
          ) THEN TRUE 
          ELSE FALSE 
        END as is_online
      FROM chat_sessions cs
      LEFT JOIN chat_messages cm ON cs.id = cm.session_id
    `;
    
    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    baseQuery += ' GROUP BY cs.id';
    
    // Apply online status filter after grouping
    const havingParts = [];
    if (online_status === 'online') {
      havingParts.push('is_online = TRUE');
    } else if (online_status === 'offline') {
      havingParts.push('is_online = FALSE');
    }
    if (has_unread === 'true') {
      havingParts.push('unread_count > 0');
    }
    if (havingParts.length > 0) {
      baseQuery += ' HAVING ' + havingParts.join(' AND ');
    }
    
    // Order by
    baseQuery += ' ORDER BY cs.is_new_traffic DESC, cs.last_message_at DESC';
    
    // Get total count for pagination (same filters including HAVING)
    const countQuery = 'SELECT COUNT(*) as total FROM (' + baseQuery.replace(/\s+LIMIT\s+\?\s+OFFSET\s+\?/, '').replace(/\s+ORDER BY[\s\S]*$/, '') + ') _count';
    
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    // Apply pagination
    baseQuery += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);
    
    const [sessions] = await pool.execute(baseQuery, params);
    
    res.json({
      sessions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Admin: Get messages for a session
router.get('/admin/sessions/:sessionId/messages', authenticate, requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const [messages] = await pool.execute(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    
    // Mark messages as read
    await pool.execute(
      'UPDATE chat_messages SET is_read = TRUE WHERE session_id = ? AND sender_type = ?',
      [sessionId, 'user']
    );
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Admin: Send message as admin
router.post('/admin/messages', authenticate, requireAdmin, async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const adminId = req.user.id;
    
    if (!sessionId || !message || !message.trim()) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }
    
    // Verify session exists
    const [sessions] = await pool.execute(
      'SELECT * FROM chat_sessions WHERE id = ?',
      [sessionId]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Insert message
    const [result] = await pool.execute(
      'INSERT INTO chat_messages (session_id, message, sender_type, sender_id) VALUES (?, ?, ?, ?)',
      [sessionId, message.trim(), 'admin', adminId]
    );
    
    // Update session last_message_at and status
    await pool.execute(
      'UPDATE chat_sessions SET last_message_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
      ['active', sessionId]
    );
    
    // Get the created message
    const [messages] = await pool.execute(
      'SELECT * FROM chat_messages WHERE id = ?',
      [result.insertId]
    );
    
    res.json(messages[0]);
  } catch (error) {
    console.error('Error sending admin message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Admin: Update session status
router.put('/admin/sessions/:sessionId/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'closed', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await pool.execute(
      'UPDATE chat_sessions SET status = ? WHERE id = ?',
      [status, sessionId]
    );
    
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error updating session status:', error);
    res.status(500).json({ error: 'Failed to update session status' });
  }
});

// Admin: Get unread message count
router.get('/admin/unread-count', authenticate, requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.execute(
      `SELECT COUNT(*) as count 
       FROM chat_messages 
       WHERE sender_type = 'user' AND is_read = FALSE`
    );
    
    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Public: Update user online status (heartbeat)
router.post('/online-status', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Update or insert online status for user
    await pool.execute(
      `INSERT INTO user_online_status (session_id, user_type, last_seen, is_online)
       VALUES (?, 'user', CURRENT_TIMESTAMP, TRUE)
       ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP, is_online = TRUE`,
      [sessionId]
    );
    
    res.json({ success: true, online: true });
  } catch (error) {
    console.error('Error updating online status:', error);
    res.status(500).json({ error: 'Failed to update online status' });
  }
});

// Public: Get online status for a session
router.get('/sessions/:sessionId/online-status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get user online status (last 30 seconds = online)
    const [userStatus] = await pool.execute(
      `SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(SECOND, last_seen, NOW()) <= 30 THEN TRUE 
          ELSE FALSE 
        END as is_online,
        last_seen
       FROM user_online_status 
       WHERE session_id = ? AND user_type = 'user'
       ORDER BY last_seen DESC LIMIT 1`,
      [sessionId]
    );
    
    // Get admin online status (any admin online in last 30 seconds)
    const [adminStatus] = await pool.execute(
      `SELECT 
        COUNT(*) as online_count,
        MAX(last_seen) as last_seen
       FROM user_online_status 
       WHERE user_type = 'admin' 
       AND TIMESTAMPDIFF(SECOND, last_seen, NOW()) <= 30`
    );
    
    res.json({
      user: {
        is_online: userStatus.length > 0 ? userStatus[0].is_online : false,
        last_seen: userStatus.length > 0 ? userStatus[0].last_seen : null
      },
      admin: {
        is_online: adminStatus[0].online_count > 0,
        online_count: adminStatus[0].online_count,
        last_seen: adminStatus[0].last_seen
      }
    });
  } catch (error) {
    console.error('Error fetching online status:', error);
    res.status(500).json({ error: 'Failed to fetch online status' });
  }
});

// Admin: Update admin online status (heartbeat)
router.post('/admin/online-status', authenticate, requireAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;
    
    // Update or insert online status for admin
    await pool.execute(
      `INSERT INTO user_online_status (user_id, user_type, last_seen, is_online)
       VALUES (?, 'admin', CURRENT_TIMESTAMP, TRUE)
       ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP, is_online = TRUE`,
      [adminId]
    );
    
    res.json({ success: true, online: true });
  } catch (error) {
    console.error('Error updating admin online status:', error);
    res.status(500).json({ error: 'Failed to update online status' });
  }
});

// Public: Register FCM token for a chat session (user/customer)
router.post('/fcm-token', async (req, res) => {
  try {
    const { sessionId, token } = req.body;
    if (!sessionId || !token || typeof token !== 'string') {
      return res.status(400).json({ error: 'sessionId and token are required' });
    }
    const [sessions] = await pool.execute('SELECT id FROM chat_sessions WHERE id = ?', [sessionId]);
    if (sessions.length === 0) return res.status(404).json({ error: 'Session not found' });
    await pool.execute(
      `INSERT INTO fcm_tokens (session_id, user_type, token) VALUES (?, 'user', ?)
       ON DUPLICATE KEY UPDATE session_id = VALUES(session_id)`,
      [sessionId, token.substring(0, 500)]
    );
    console.log('User FCM token registered for session', sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Admin: Register FCM token for admin push
router.post('/admin/fcm-token', authenticate, requireAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }
    await pool.execute(
      `INSERT INTO fcm_tokens (admin_id, user_type, token) VALUES (?, 'admin', ?)
       ON DUPLICATE KEY UPDATE admin_id = VALUES(admin_id), session_id = NULL, user_type = 'admin'`,
      [adminId, token.substring(0, 500)]
    );
    console.log('Admin FCM token registered for admin_id', adminId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error registering admin FCM token:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Public: Get Firebase client config for FCM (if enabled) - used by chat widget to request permission and get token
router.get('/firebase-client-config', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT is_enabled, client_config_json, vapid_key FROM firebase_config WHERE id = 1'
    );
    if (!rows.length || !rows[0].is_enabled || !rows[0].client_config_json) {
      return res.json({ enabled: false });
    }
    const config = JSON.parse(rows[0].client_config_json || '{}');
    const vapidKey = (rows[0].vapid_key || '').trim().replace(/\s+/g, '') || null;
    res.json({ enabled: true, config, vapidKey });
  } catch (error) {
    res.json({ enabled: false });
  }
});

// Admin: Get Firebase config (for editing)
router.get('/admin/firebase-config', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT is_enabled, service_account_json, client_config_json, vapid_key FROM firebase_config WHERE id = 1'
    );
    if (!rows.length) {
      return res.json({ is_enabled: false, service_account_json: '', client_config_json: '', vapid_key: '' });
    }
    const r = rows[0];
    const vapidKey = (r.vapid_key || '').trim().replace(/\s+/g, '');
    res.json({
      is_enabled: !!r.is_enabled,
      service_account_json: r.service_account_json || '',
      client_config_json: r.client_config_json || '',
      vapid_key: vapidKey,
    });
  } catch (error) {
    console.error('Error fetching Firebase config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// Admin: Get AI support config (for editing)
router.get('/admin/ai-support-config', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureAiSupportConfigTable();
    const [rows] = await pool.execute(
      'SELECT is_enabled, provider, api_base_url, api_key_encrypted, model, system_prompt, temperature, max_tokens, include_catalog_knowledge FROM ai_support_config WHERE id = 1'
    );
    if (!rows.length) {
      return res.json({
        is_enabled: false,
        provider: 'openai',
        api_base_url: 'https://api.openai.com/v1',
        api_key: '',
        model: 'gpt-4o-mini',
        system_prompt: 'You are a support teammate for FivedIT. Sound natural and human: warm, clear, and concise - like a real person on the team, not a robot or a formal brochure.',
        temperature: 0.7,
        max_tokens: 300,
        include_catalog_knowledge: true,
      });
    }
    const r = rows[0];
    const providerSafe = (r.provider || 'openai').toLowerCase() === 'gemini' ? 'gemini' : 'openai';
    const defaultGeminiModel = 'gemini-2.5-flash';
    res.json({
      is_enabled: Boolean(r.is_enabled),
      provider: providerSafe,
      api_base_url: r.api_base_url || (providerSafe === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://api.openai.com/v1'),
      api_key: r.api_key_encrypted ? '********' : '',
      model: r.model || (providerSafe === 'gemini' ? defaultGeminiModel : 'gpt-4o-mini'),
      system_prompt: r.system_prompt || '',
      temperature: Number(r.temperature ?? 0.7),
      max_tokens: Number(r.max_tokens ?? 300),
      include_catalog_knowledge: r.include_catalog_knowledge == null ? true : Boolean(r.include_catalog_knowledge),
    });
  } catch (error) {
    console.error('Error fetching AI support config:', error);
    res.status(500).json({ error: 'Failed to fetch AI support config' });
  }
});

// Admin: Update AI support config
router.put('/admin/ai-support-config', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureAiSupportConfigTable();
    const {
      is_enabled,
      provider,
      api_base_url,
      api_key,
      model,
      system_prompt,
      temperature,
      max_tokens,
      include_catalog_knowledge,
    } = req.body || {};

    const [existing] = await pool.execute('SELECT api_key_encrypted FROM ai_support_config WHERE id = 1');
    let apiKeyToStore = null;
    if (typeof api_key === 'string' && api_key.trim() && api_key !== '********') {
      apiKeyToStore = encryptPassword(api_key.trim());
    } else if (existing.length > 0 && existing[0].api_key_encrypted) {
      apiKeyToStore = existing[0].api_key_encrypted;
    }

    const providerSafe = (provider || 'openai').toString().trim().toLowerCase() === 'gemini' ? 'gemini' : 'openai';
    const defaultBase = providerSafe === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta'
      : 'https://api.openai.com/v1';
    const defaultModel = providerSafe === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';

    await pool.execute(
      `INSERT INTO ai_support_config
       (id, is_enabled, provider, api_base_url, api_key_encrypted, model, system_prompt, temperature, max_tokens, include_catalog_knowledge)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_enabled = VALUES(is_enabled),
         provider = VALUES(provider),
         api_base_url = VALUES(api_base_url),
         api_key_encrypted = COALESCE(VALUES(api_key_encrypted), api_key_encrypted),
         model = VALUES(model),
         system_prompt = VALUES(system_prompt),
         temperature = VALUES(temperature),
         max_tokens = VALUES(max_tokens),
         include_catalog_knowledge = VALUES(include_catalog_knowledge),
         updated_at = CURRENT_TIMESTAMP`,
      [
        Boolean(is_enabled),
        providerSafe,
        (api_base_url || defaultBase).toString().trim() || defaultBase,
        apiKeyToStore,
        (model || defaultModel).toString().trim() || defaultModel,
        (system_prompt || '').toString(),
        Number.isFinite(Number(temperature)) ? Number(temperature) : 0.7,
        Number.isFinite(Number(max_tokens)) ? Number(max_tokens) : 300,
        include_catalog_knowledge == null ? true : Boolean(include_catalog_knowledge),
      ]
    );
    invalidateWebsiteKnowledgeCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating AI support config:', error);
    res.status(500).json({ error: 'Failed to update AI support config', details: error?.message || 'unknown error' });
  }
});

// Admin: Public site URL, support contact, and page routes for AI replies
router.get('/admin/ai-public-info', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureAiSupportPublicInfoTable();
    const [rows] = await pool.execute('SELECT * FROM ai_support_public_info WHERE id = 1');
    if (!rows.length) {
      return res.json({
        public_site_url: DEFAULTS.public_site_url,
        support_email: DEFAULTS.support_email,
        support_phone_display: DEFAULTS.support_phone_display,
        whatsapp_e164: DEFAULTS.whatsapp_e164,
        contact_page_path: DEFAULTS.contact_page_path,
        routes_json: getDefaultRoutesJson(),
        support_notes: DEFAULTS.support_notes,
      });
    }
    const r = rows[0];
    res.json({
      public_site_url: r.public_site_url || DEFAULTS.public_site_url,
      support_email: r.support_email || DEFAULTS.support_email,
      support_phone_display: r.support_phone_display || '',
      whatsapp_e164: r.whatsapp_e164 || '',
      contact_page_path: r.contact_page_path || DEFAULTS.contact_page_path,
      routes_json: r.routes_json || getDefaultRoutesJson(),
      support_notes: r.support_notes || '',
    });
  } catch (error) {
    console.error('Error fetching AI public info:', error);
    res.status(500).json({ error: 'Failed to fetch AI public info' });
  }
});

router.get('/admin/ai-public-builtin', authenticate, requireAdmin, async (req, res) => {
  res.json({
    public_site_url: DEFAULTS.public_site_url,
    support_email: DEFAULTS.support_email,
    support_phone_display: DEFAULTS.support_phone_display,
    whatsapp_e164: DEFAULTS.whatsapp_e164,
    contact_page_path: DEFAULTS.contact_page_path,
    routes_json: getDefaultRoutesJson(),
    support_notes: DEFAULTS.support_notes,
  });
});

router.put('/admin/ai-public-info', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureAiSupportPublicInfoTable();
    const {
      public_site_url,
      support_email,
      support_phone_display,
      whatsapp_e164,
      contact_page_path,
      routes_json,
      support_notes,
    } = req.body || {};

    let routesStr = typeof routes_json === 'string' ? routes_json.trim() : '';
    if (!routesStr) routesStr = getDefaultRoutesJson();
    let parsed;
    try {
      parsed = JSON.parse(routesStr);
    } catch {
      return res.status(400).json({ error: 'routes_json must be valid JSON' });
    }
    if (!Array.isArray(parsed)) {
      return res.status(400).json({ error: 'routes_json must be a JSON array of {path,title,hint}' });
    }
    for (const item of parsed) {
      if (!item || typeof item.path !== 'string' || !item.path.trim()) {
        return res.status(400).json({ error: 'Each route must have a non-empty path string' });
      }
    }

    const baseUrl = (public_site_url || DEFAULTS.public_site_url).toString().trim().replace(/\/$/, '');
    const email = (support_email || DEFAULTS.support_email).toString().trim();
    const phone = support_phone_display != null ? String(support_phone_display).trim() : '';
    const wa = whatsapp_e164 != null ? String(whatsapp_e164).replace(/\D/g, '') : '';
    const cpath = (contact_page_path || DEFAULTS.contact_page_path).toString().trim() || '/contact';
    const cpathNorm = cpath.startsWith('/') ? cpath : `/${cpath}`;
    const notes = support_notes != null ? String(support_notes).trim() : '';

    await pool.execute(
      `INSERT INTO ai_support_public_info
       (id, public_site_url, support_email, support_phone_display, whatsapp_e164, contact_page_path, routes_json, support_notes)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         public_site_url = VALUES(public_site_url),
         support_email = VALUES(support_email),
         support_phone_display = VALUES(support_phone_display),
         whatsapp_e164 = VALUES(whatsapp_e164),
         contact_page_path = VALUES(contact_page_path),
         routes_json = VALUES(routes_json),
         support_notes = VALUES(support_notes),
         updated_at = CURRENT_TIMESTAMP`,
      [baseUrl, email, phone || null, wa || null, cpathNorm, routesStr, notes || null]
    );
    invalidateWebsiteKnowledgeCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating AI public info:', error);
    res.status(500).json({ error: 'Failed to update AI public info', details: error?.message || 'unknown error' });
  }
});

// Admin: Update Firebase config
router.put('/admin/firebase-config', authenticate, requireAdmin, async (req, res) => {
  try {
    const { is_enabled, service_account_json, client_config_json, vapid_key } = req.body;
    const vapidKeyClean = typeof vapid_key === 'string' ? vapid_key.trim().replace(/\s+/g, '') : '';
    await pool.execute(
      `INSERT INTO firebase_config (id, is_enabled, service_account_json, client_config_json, vapid_key)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_enabled = VALUES(is_enabled),
         service_account_json = VALUES(service_account_json),
         client_config_json = VALUES(client_config_json),
         vapid_key = VALUES(vapid_key)`,
      [!!is_enabled, service_account_json || null, client_config_json || null, vapidKeyClean || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating Firebase config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Admin: Get online status for a session
router.get('/admin/sessions/:sessionId/online-status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get user online status (last 30 seconds = online)
    const [userStatus] = await pool.execute(
      `SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(SECOND, last_seen, NOW()) <= 30 THEN TRUE 
          ELSE FALSE 
        END as is_online,
        last_seen
       FROM user_online_status 
       WHERE session_id = ? AND user_type = 'user'
       ORDER BY last_seen DESC LIMIT 1`,
      [sessionId]
    );
    
    res.json({
      user: {
        is_online: userStatus.length > 0 ? userStatus[0].is_online : false,
        last_seen: userStatus.length > 0 ? userStatus[0].last_seen : null
      }
    });
  } catch (error) {
    console.error('Error fetching user online status:', error);
    res.status(500).json({ error: 'Failed to fetch online status' });
  }
});

module.exports = router;

