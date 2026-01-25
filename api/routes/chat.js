const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

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
      // Create new session
      const newSessionId = generateUUID();
      await pool.execute(
        'INSERT INTO chat_sessions (id, user_identifier, status) VALUES (?, ?, ?)',
        [newSessionId, userIdentifier || null, 'active']
      );
      
      const [sessions] = await pool.execute(
        'SELECT * FROM chat_sessions WHERE id = ?',
        [newSessionId]
      );
      session = sessions[0];
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

// Admin: Get all chat sessions
router.get('/admin/sessions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        cs.*,
        COUNT(cm.id) as message_count,
        MAX(cm.created_at) as last_message_time
      FROM chat_sessions cs
      LEFT JOIN chat_messages cm ON cs.id = cm.session_id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE cs.status = ?';
      params.push(status);
    }
    
    query += ' GROUP BY cs.id ORDER BY cs.last_message_at DESC';
    
    const [sessions] = await pool.execute(query, params);
    
    res.json(sessions);
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

