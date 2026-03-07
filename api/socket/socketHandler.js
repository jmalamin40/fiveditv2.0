const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { sendPushToRecipient } = require('../utils/firebasePush');

// Store active connections
const activeUsers = new Map(); // sessionId -> socketId
const activeAdmins = new Map(); // adminId -> socketId
const socketToSession = new Map(); // socketId -> sessionId
const socketToAdmin = new Map(); // socketId -> adminId

// Generate UUID for session IDs
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Authenticate socket connection for admin
function authenticateAdmin(socket, token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

// Update online status in database
async function updateOnlineStatus(userId, userType, sessionId = null) {
  try {
    if (userType === 'admin') {
      await pool.execute(
        `INSERT INTO user_online_status (user_id, user_type, last_seen, is_online)
         VALUES (?, 'admin', CURRENT_TIMESTAMP, TRUE)
         ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP, is_online = TRUE`,
        [userId]
      );
    } else {
      await pool.execute(
        `INSERT INTO user_online_status (session_id, user_type, last_seen, is_online)
         VALUES (?, 'user', CURRENT_TIMESTAMP, TRUE)
         ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP, is_online = TRUE`,
        [sessionId]
      );
    }
  } catch (error) {
    console.error('Error updating online status:', error);
  }
}

// Remove online status
async function removeOnlineStatus(userId, userType, sessionId = null) {
  try {
    if (userType === 'admin') {
      await pool.execute(
        `UPDATE user_online_status SET is_online = FALSE WHERE user_id = ? AND user_type = 'admin'`,
        [userId]
      );
    } else {
      await pool.execute(
        `UPDATE user_online_status SET is_online = FALSE WHERE session_id = ? AND user_type = 'user'`,
        [sessionId]
      );
    }
  } catch (error) {
    console.error('Error removing online status:', error);
  }
}

// Get active admins
async function getActiveAdmins() {
  try {
    // Use GROUP BY to ensure unique admins even if multiple status entries exist
    const [admins] = await pool.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.profile_picture,
        MAX(uos.last_seen) as last_seen
      FROM users u
      INNER JOIN user_online_status uos ON u.id = uos.user_id
      WHERE u.role = 'admin'
      AND uos.user_type = 'admin'
      AND uos.is_online = TRUE
      AND TIMESTAMPDIFF(SECOND, uos.last_seen, NOW()) <= 30
      GROUP BY u.id, u.name, u.email, u.profile_picture
      ORDER BY last_seen DESC`
    );
    
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3004}`;
    const formattedAdmins = admins.map(admin => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      profile_picture: admin.profile_picture 
        ? (admin.profile_picture.startsWith('http') 
            ? admin.profile_picture 
            : `${baseUrl}/uploads/profiles/${admin.profile_picture}`)
        : null,
      last_seen: admin.last_seen
    }));
    
    // Deduplicate by ID (safety check in case GROUP BY didn't work)
    const uniqueAdmins = formattedAdmins.filter((admin, index, self) => 
      index === self.findIndex(a => a.id === admin.id)
    );
    
    return uniqueAdmins;
  } catch (error) {
    console.error('Error fetching active admins:', error);
    return [];
  }
}

function setupSocketHandlers(io) {
  console.log('Setting up Socket.IO handlers on path:', io._opts.path);
  
  // Log connection attempts
  io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection error:', err.req?.url, err.message);
  });
  
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    console.log('  - Handshake URL:', socket.handshake.url);
    console.log('  - Handshake path:', socket.handshake.path);
    console.log('  - Transport:', socket.conn.transport.name);

    // User connects with session
    socket.on('user:connect', async (data) => {
      try {
        const { sessionId } = data;
        
        if (!sessionId) {
          socket.emit('error', { message: 'Session ID required' });
          return;
        }

        // Verify session exists
        const [sessions] = await pool.execute(
          'SELECT * FROM chat_sessions WHERE id = ?',
          [sessionId]
        );

        if (sessions.length === 0) {
          socket.emit('error', { message: 'Invalid session' });
          return;
        }

        // Store connection
        activeUsers.set(sessionId, socket.id);
        socketToSession.set(socket.id, sessionId);
        socket.join(`session:${sessionId}`);

        // Update online status
        await updateOnlineStatus(null, 'user', sessionId);

        // Load and send existing messages
        const [messages] = await pool.execute(
          'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
          [sessionId]
        );
        socket.emit('messages:history', messages);

        // Calculate and send unread count (messages from admin that user hasn't seen)
        // For user, we consider messages unread if they were sent while chat was closed
        // We'll track this by checking if messages exist that user hasn't viewed
        const [unreadResult] = await pool.execute(
          `SELECT COUNT(*) as count 
           FROM chat_messages 
           WHERE session_id = ? AND sender_type = 'admin' AND is_read = FALSE`,
          [sessionId]
        );
        socket.emit('unread:count', { count: unreadResult[0].count });

        // Send active admins list
        const activeAdminsList = await getActiveAdmins();
        socket.emit('admins:active', { count: activeAdminsList.length, admins: activeAdminsList });

        // Check if this is a new session (new traffic)
        const [sessionData] = await pool.execute(
          'SELECT is_new_traffic FROM chat_sessions WHERE id = ?',
          [sessionId]
        );
        
        const isNewTraffic = sessionData.length > 0 && sessionData[0].is_new_traffic;
        
        // If it's new traffic, notify admins and mark session as no longer new
        if (isNewTraffic) {
          // Get full session data with message count
          const [newSession] = await pool.execute(
            `SELECT 
              cs.*,
              COUNT(cm.id) as message_count,
              MAX(cm.created_at) as last_message_time,
              SUM(CASE WHEN cm.sender_type = 'user' AND cm.is_read = FALSE THEN 1 ELSE 0 END) as unread_count
            FROM chat_sessions cs
            LEFT JOIN chat_messages cm ON cs.id = cm.session_id
            WHERE cs.id = ?
            GROUP BY cs.id`,
            [sessionId]
          );
          
          // Emit new traffic event to admins
          io.to('admins').emit('session:new-traffic', newSession[0]);
          
          // Mark session as no longer new traffic
          await pool.execute(
            'UPDATE chat_sessions SET is_new_traffic = FALSE WHERE id = ?',
            [sessionId]
          );
        }
        
        // Notify admins of new user connection
        io.to('admins').emit('user:connected', { sessionId });

        console.log(`User connected: session ${sessionId}${isNewTraffic ? ' (NEW TRAFFIC)' : ''}`);
      } catch (error) {
        console.error('Error in user:connect:', error);
        socket.emit('error', { message: 'Connection failed' });
      }
    });

    // Admin connects with token
    socket.on('admin:connect', async (data) => {
      try {
        const { token } = data;
        const admin = authenticateAdmin(socket, token);

        if (!admin) {
          socket.emit('error', { message: 'Authentication failed' });
          socket.disconnect();
          return;
        }

        // Store connection
        activeAdmins.set(admin.id, socket.id);
        socketToAdmin.set(socket.id, admin.id);
        socket.join('admins');

        // Update online status
        await updateOnlineStatus(admin.id, 'admin');

        // Load and send all sessions with unread count and new traffic flag
        const [sessions] = await pool.execute(
          `SELECT 
            cs.*,
            COUNT(cm.id) as message_count,
            MAX(cm.created_at) as last_message_time,
            SUM(CASE WHEN cm.sender_type = 'user' AND cm.is_read = FALSE THEN 1 ELSE 0 END) as unread_count
          FROM chat_sessions cs
          LEFT JOIN chat_messages cm ON cs.id = cm.session_id
          GROUP BY cs.id 
          ORDER BY cs.is_new_traffic DESC, cs.last_message_at DESC`
        );
        socket.emit('sessions:list', sessions);

        // Send unread count
        const [unreadResult] = await pool.execute(
          `SELECT COUNT(*) as count 
           FROM chat_messages 
           WHERE sender_type = 'user' AND is_read = FALSE`
        );
        socket.emit('unread:count', { count: unreadResult[0].count });

        // Broadcast admin online status
        const activeAdminsList = await getActiveAdmins();
        io.emit('admins:active', { count: activeAdminsList.length, admins: activeAdminsList });

        console.log(`Admin connected: ${admin.id}`);
      } catch (error) {
        console.error('Error in admin:connect:', error);
        socket.emit('error', { message: 'Connection failed' });
      }
    });

    // User sends message
    socket.on('message:send', async (data) => {
      try {
        const sessionId = socketToSession.get(socket.id);
        if (!sessionId) {
          socket.emit('error', { message: 'Not connected to a session' });
          return;
        }

        const { message } = data;
        if (!message || !message.trim()) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        // Save message to database
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

        const newMessage = messages[0];

        // Send to user
        socket.emit('message:new', newMessage);

        // Send to all admins
        io.to('admins').emit('message:new', newMessage);

        // Push notification to admins
        sendPushToRecipient('admin', null, 'New chat message', message.trim().substring(0, 100)).catch(() => {});

        // Update sessions list for admins
        const [sessions] = await pool.execute(
          `SELECT 
            cs.*,
            COUNT(cm.id) as message_count,
            MAX(cm.created_at) as last_message_time,
            SUM(CASE WHEN cm.sender_type = 'user' AND cm.is_read = FALSE THEN 1 ELSE 0 END) as unread_count
          FROM chat_sessions cs
          LEFT JOIN chat_messages cm ON cs.id = cm.session_id
          WHERE cs.id = ?
          GROUP BY cs.id`,
          [sessionId]
        );
        io.to('admins').emit('session:updated', sessions[0]);

        console.log(`Message sent by user in session ${sessionId}`);
      } catch (error) {
        console.error('Error in message:send:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Admin sends message
    socket.on('admin:message:send', async (data) => {
      try {
        const adminId = socketToAdmin.get(socket.id);
        if (!adminId) {
          socket.emit('error', { message: 'Not authenticated as admin' });
          return;
        }

        const { sessionId, message } = data;
        if (!sessionId || !message || !message.trim()) {
          socket.emit('error', { message: 'Session ID and message required' });
          return;
        }

        // Verify session exists
        const [sessions] = await pool.execute(
          'SELECT * FROM chat_sessions WHERE id = ?',
          [sessionId]
        );

        if (sessions.length === 0) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Save message to database
        const [result] = await pool.execute(
          'INSERT INTO chat_messages (session_id, message, sender_type, sender_id) VALUES (?, ?, ?, ?)',
          [sessionId, message.trim(), 'admin', adminId]
        );

        // Update session
        await pool.execute(
          'UPDATE chat_sessions SET last_message_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
          ['active', sessionId]
        );

        // Mark user messages as read
        await pool.execute(
          'UPDATE chat_messages SET is_read = TRUE WHERE session_id = ? AND sender_type = ?',
          [sessionId, 'user']
        );

        // Get the created message
        const [messages] = await pool.execute(
          'SELECT * FROM chat_messages WHERE id = ?',
          [result.insertId]
        );

        const newMessage = messages[0];

        // Send to admin
        socket.emit('message:new', newMessage);

        // Send to user in that session
        io.to(`session:${sessionId}`).emit('message:new', newMessage);

        // Push notification to user
        sendPushToRecipient('user', sessionId, 'Support replied', message.trim().substring(0, 100)).catch(() => {});

        // Update unread count for user (admin messages are unread until user opens chat)
        const [userUnreadResult] = await pool.execute(
          `SELECT COUNT(*) as count 
           FROM chat_messages 
           WHERE session_id = ? AND sender_type = 'admin' AND is_read = FALSE`,
          [sessionId]
        );
        io.to(`session:${sessionId}`).emit('unread:count', { count: userUnreadResult[0].count });

        // Update sessions list for admins
        const [updatedSessions] = await pool.execute(
          `SELECT 
            cs.*,
            COUNT(cm.id) as message_count,
            MAX(cm.created_at) as last_message_time,
            SUM(CASE WHEN cm.sender_type = 'user' AND cm.is_read = FALSE THEN 1 ELSE 0 END) as unread_count
          FROM chat_sessions cs
          LEFT JOIN chat_messages cm ON cs.id = cm.session_id
          WHERE cs.id = ?
          GROUP BY cs.id`,
          [sessionId]
        );
        io.to('admins').emit('session:updated', updatedSessions[0]);

        // Update unread count
        const [unreadResult] = await pool.execute(
          `SELECT COUNT(*) as count 
           FROM chat_messages 
           WHERE sender_type = 'user' AND is_read = FALSE`
        );
        io.to('admins').emit('unread:count', { count: unreadResult[0].count });

        console.log(`Message sent by admin ${adminId} to session ${sessionId}`);
      } catch (error) {
        console.error('Error in admin:message:send:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Admin requests session messages
    socket.on('admin:session:load', async (data) => {
      try {
        const adminId = socketToAdmin.get(socket.id);
        if (!adminId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { sessionId } = data;
        const [messages] = await pool.execute(
          'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
          [sessionId]
        );

        // Mark messages as read
        await pool.execute(
          'UPDATE chat_messages SET is_read = TRUE WHERE session_id = ? AND sender_type = ?',
          [sessionId, 'user']
        );

        socket.emit('messages:history', messages);

        // Update unread count
        const [unreadResult] = await pool.execute(
          `SELECT COUNT(*) as count 
           FROM chat_messages 
           WHERE sender_type = 'user' AND is_read = FALSE`
        );
        io.to('admins').emit('unread:count', { count: unreadResult[0].count });

        // Update session with new unread count (should be 0 after marking as read)
        const [updatedSessions] = await pool.execute(
          `SELECT 
            cs.*,
            COUNT(cm.id) as message_count,
            MAX(cm.created_at) as last_message_time,
            SUM(CASE WHEN cm.sender_type = 'user' AND cm.is_read = FALSE THEN 1 ELSE 0 END) as unread_count
          FROM chat_sessions cs
          LEFT JOIN chat_messages cm ON cs.id = cm.session_id
          WHERE cs.id = ?
          GROUP BY cs.id`,
          [sessionId]
        );
        io.to('admins').emit('session:updated', updatedSessions[0]);
      } catch (error) {
        console.error('Error in admin:session:load:', error);
        socket.emit('error', { message: 'Failed to load messages' });
      }
    });

    // Admin updates session status
    socket.on('admin:session:status', async (data) => {
      try {
        const adminId = socketToAdmin.get(socket.id);
        if (!adminId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { sessionId, status } = data;
        if (!['active', 'closed', 'pending'].includes(status)) {
          socket.emit('error', { message: 'Invalid status' });
          return;
        }

        await pool.execute(
          'UPDATE chat_sessions SET status = ? WHERE id = ?',
          [status, sessionId]
        );

        const [sessions] = await pool.execute(
          `SELECT 
            cs.*,
            COUNT(cm.id) as message_count,
            MAX(cm.created_at) as last_message_time,
            SUM(CASE WHEN cm.sender_type = 'user' AND cm.is_read = FALSE THEN 1 ELSE 0 END) as unread_count
          FROM chat_sessions cs
          LEFT JOIN chat_messages cm ON cs.id = cm.session_id
          WHERE cs.id = ?
          GROUP BY cs.id`,
          [sessionId]
        );
        io.to('admins').emit('session:updated', sessions[0]);
      } catch (error) {
        console.error('Error in admin:session:status:', error);
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Heartbeat for online status
    socket.on('heartbeat', async () => {
      const sessionId = socketToSession.get(socket.id);
      const adminId = socketToAdmin.get(socket.id);

      if (sessionId) {
        await updateOnlineStatus(null, 'user', sessionId);
      } else if (adminId) {
        await updateOnlineStatus(adminId, 'admin');
        
        // Broadcast updated admin list
        const activeAdminsList = await getActiveAdmins();
        io.emit('admins:active', { count: activeAdminsList.length, admins: activeAdminsList });
      }
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
      const sessionId = socketToSession.get(socket.id);
      const adminId = socketToAdmin.get(socket.id);

      if (sessionId) {
        activeUsers.delete(sessionId);
        socketToSession.delete(socket.id);
        await removeOnlineStatus(null, 'user', sessionId);
        io.to('admins').emit('user:disconnected', { sessionId });
        console.log(`User disconnected: session ${sessionId}`);
      } else if (adminId) {
        activeAdmins.delete(adminId);
        socketToAdmin.delete(socket.id);
        await removeOnlineStatus(adminId, 'admin');
        
        // Broadcast updated admin list
        const activeAdminsList = await getActiveAdmins();
        io.emit('admins:active', { count: activeAdminsList.length, admins: activeAdminsList });
        console.log(`Admin disconnected: ${adminId}`);
      }
    });
  });
}

module.exports = { setupSocketHandlers };

