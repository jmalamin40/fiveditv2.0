# Support Chat System Setup Guide

This document explains the complete support chat system that allows users to chat with admins in real-time.

## Overview

The chat system consists of:
1. **Database tables** for storing chat sessions and messages
2. **API endpoints** for both users and admins
3. **Frontend chat component** for users
4. **Admin chat interface** for managing conversations

## Database Setup

### Run Migration

The chat tables are included in the main migration script. Run:

```bash
cd api
npm run migrate
```

This will create:
- `chat_sessions` - Stores chat sessions with status tracking
- `chat_messages` - Stores all messages with sender type (user/admin)

## API Endpoints

### Public Endpoints (No Authentication)

- `POST /api/chat/sessions` - Create or get a chat session
- `POST /api/chat/messages` - Send a message as a user
- `GET /api/chat/sessions/:sessionId/messages` - Get messages for a session

### Admin Endpoints (JWT Required)

- `GET /api/chat/admin/sessions` - Get all chat sessions (with optional status filter)
- `GET /api/chat/admin/sessions/:sessionId/messages` - Get messages for a session (marks as read)
- `POST /api/chat/admin/messages` - Send a message as admin
- `PUT /api/chat/admin/sessions/:sessionId/status` - Update session status (active/closed/pending)
- `GET /api/chat/admin/unread-count` - Get count of unread user messages

## Frontend Chat Component

The user-facing chat component (`components/Chat.tsx`) has been updated to:
- Create/retrieve chat sessions using localStorage
- Send messages to the API
- Poll for new messages every 3 seconds when open
- Display messages with proper formatting

### Features:
- Persistent sessions (stored in localStorage)
- Real-time message polling
- Loading states
- Error handling

## Admin Chat Interface

The admin chat interface (`admin/src/components/ChatManager.tsx`) provides:
- List of all chat sessions
- Unread message count badge
- Real-time message polling (every 2 seconds)
- Status management (active/pending/closed)
- Message history viewing
- Ability to respond to users

### Features:
- Session list with status indicators
- Unread count badge
- Auto-refresh of sessions and messages
- Status management
- Clean, organized UI

## Usage

### For Users

1. Users can click the chat button on any page
2. A session is automatically created and stored in localStorage
3. Messages are sent to the API and stored in the database
4. Users can see admin responses in real-time (polled every 3 seconds)

### For Admins

1. Log into the admin panel
2. Navigate to the "Support Chat" tab
3. View all active conversations
4. Click on a session to view messages
5. Respond to users directly
6. Manage session status (active/pending/closed)

## Environment Variables

Make sure your API base URL is set correctly:

**Frontend (Next.js):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**Admin Panel:**
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

## Testing

1. **Start the API server:**
   ```bash
   cd api
   npm start
   ```

2. **Start the frontend:**
   ```bash
   npm run dev
   ```

3. **Start the admin panel:**
   ```bash
   cd admin
   npm run dev
   ```

4. **Test the flow:**
   - Open the website and send a message via the chat widget
   - Log into the admin panel
   - Navigate to Support Chat
   - You should see the conversation
   - Respond as admin
   - Check that the user sees the response

## Notes

- Messages are polled (not WebSocket) for simplicity
- Sessions persist across page refreshes using localStorage
- Admin messages are automatically marked as read when viewed
- Session status can be managed by admins
- Unread count updates every 5 seconds in admin panel

## Future Enhancements

Possible improvements:
- WebSocket support for true real-time communication
- File attachments
- Typing indicators
- Message search
- Chat history export
- Email notifications for new messages

