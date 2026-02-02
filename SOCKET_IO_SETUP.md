# Socket.IO Chat Implementation Guide

The chat system has been migrated from HTTP polling to Socket.IO for real-time communication.

## What Changed

### Before (HTTP Polling)
- Messages polled every 3 seconds
- Online status checked every 5-10 seconds
- High server load from constant requests
- Delayed message delivery

### After (Socket.IO)
- Real-time message delivery
- Instant online status updates
- Lower server load
- Better user experience

## Installation

### 1. Install Dependencies

**API Server:**
```bash
cd api
npm install socket.io
```

**Frontend (Next.js):**
```bash
npm install socket.io-client
```

**Admin Panel:**
```bash
cd admin
npm install socket.io-client
```

### 2. Start the Server

```bash
cd api
npm start
# or for development
npm run dev
```

The Socket.IO server will start on the same port as the API (default: 3004).

## Socket Events

### User Events

**Connect:**
```javascript
socket.emit('user:connect', { sessionId: 'session-id' });
```

**Send Message:**
```javascript
socket.emit('message:send', { message: 'Hello!' });
```

**Heartbeat:**
```javascript
socket.emit('heartbeat');
```

**Listen for:**
- `messages:history` - Initial message history
- `message:new` - New message received
- `admins:active` - Active admins list
- `error` - Error messages

### Admin Events

**Connect:**
```javascript
socket.emit('admin:connect', { token: 'jwt-token' });
```

**Send Message:**
```javascript
socket.emit('admin:message:send', { 
  sessionId: 'session-id', 
  message: 'Hello!' 
});
```

**Load Session Messages:**
```javascript
socket.emit('admin:session:load', { sessionId: 'session-id' });
```

**Update Session Status:**
```javascript
socket.emit('admin:session:status', { 
  sessionId: 'session-id', 
  status: 'active' | 'closed' | 'pending' 
});
```

**Listen for:**
- `sessions:list` - All chat sessions
- `session:updated` - Session updated
- `messages:history` - Message history for selected session
- `message:new` - New message received
- `unread:count` - Unread message count
- `user:connected` - User connected
- `user:disconnected` - User disconnected
- `error` - Error messages

## Environment Variables

### Frontend (Next.js)
```env
NEXT_PUBLIC_API_URL=http://localhost:3004/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3004
```

### Admin Panel
```env
VITE_API_BASE_URL=http://localhost:3004/api
VITE_SOCKET_URL=http://localhost:3004
```

### API Server
```env
PORT=3004
API_BASE_URL=http://localhost:3004
JWT_SECRET=your-secret-key
```

## Features

### Real-time Messaging
- Messages appear instantly for both users and admins
- No polling delays
- Automatic reconnection on disconnect

### Online Status
- Real-time online/offline status
- Automatic updates when users connect/disconnect
- Heartbeat every 15 seconds to maintain status

### Admin Features
- See all sessions in real-time
- Receive notifications when users connect
- Instant message delivery
- Real-time unread count updates

## Architecture

### Server Side (`api/socket/socketHandler.js`)
- Handles all socket connections
- Manages user and admin rooms
- Updates database in real-time
- Broadcasts events to relevant clients

### Client Side
- **User Chat** (`components/Chat.tsx`): Connects as user with session ID
- **Admin Chat** (`admin/src/components/ChatManager.tsx`): Connects as admin with JWT token

## Connection Flow

### User Connection:
1. User opens chat widget
2. Gets/creates session ID from localStorage
3. Connects to Socket.IO server
4. Emits `user:connect` with session ID
5. Receives message history and active admins
6. Starts sending heartbeat every 15 seconds

### Admin Connection:
1. Admin logs into admin panel
2. Connects to Socket.IO server with JWT token
3. Emits `admin:connect` with token
4. Receives all sessions list and unread count
5. Starts sending heartbeat every 15 seconds

## Error Handling

- Automatic reconnection on disconnect
- Error events for failed operations
- Connection status indicators in UI
- Graceful fallback for connection issues

## Performance Benefits

- **Reduced Server Load**: No constant HTTP polling
- **Lower Latency**: Instant message delivery
- **Better Scalability**: WebSocket connections are more efficient
- **Real-time Updates**: All changes reflected immediately

## Testing

1. **Start API server:**
   ```bash
   cd api
   npm start
   ```

2. **Open user website** and test chat widget

3. **Open admin panel** in another browser/incognito

4. **Send messages** from both sides - they should appear instantly

5. **Check online status** - should update in real-time

## Troubleshooting

### Connection Issues
- Check if Socket.IO server is running
- Verify CORS settings in `api/server.js`
- Check browser console for connection errors
- Ensure firewall allows WebSocket connections

### Messages Not Appearing
- Check socket connection status
- Verify session ID is valid
- Check server logs for errors
- Ensure database connection is working

### Admin Authentication Fails
- Verify JWT token is valid
- Check token expiration
- Ensure admin role in database

## Migration Notes

- HTTP endpoints still exist for backward compatibility
- Socket.IO is the primary communication method
- Old polling code has been removed from components
- Database schema remains unchanged


