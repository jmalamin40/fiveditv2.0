import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, User, Bot, CheckCircle, XCircle, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://api.fivedit.com';
const SOCKET_PATH = '/api/socket.io';

// Beep sound notification function
const playBeepSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Beep frequency (Hz)
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    console.error('Error playing beep sound:', error);
  }
};

interface ChatSession {
  id: string;
  user_identifier: string | null;
  status: 'active' | 'closed' | 'pending';
  message_count: number;
  unread_count: number;
  last_message_time: string | null;
  last_message_at: string;
  created_at: string;
}

interface ChatMessage {
  id: number;
  session_id: string;
  message: string;
  sender_type: 'user' | 'admin';
  sender_id: number | null;
  is_read: boolean;
  created_at: string;
}

interface ChatManagerProps {
  token: string;
}

export default function ChatManager({ token }: ChatManagerProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userOnlineStatus, setUserOnlineStatus] = useState<{ [sessionId: string]: boolean }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedSessionRef = useRef<string | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!token) {
      setConnectionError('Authentication token is missing');
      setIsLoadingSessions(false);
      return;
    }

    try {
      const socketOptions = {
        path: SOCKET_PATH,
        transports: ['websocket', 'polling'],
        auth: {
          token: token
        },
        namespace: 'api'
      };
      
      console.log('Connecting to Socket.IO:', SOCKET_URL, 'with path:', SOCKET_PATH);
      const socket = io(SOCKET_URL, socketOptions);

      socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Admin socket connected');
      setIsConnected(true);
      setIsLoadingSessions(false);
      
      // Connect as admin
      socket.emit('admin:connect', { token });
      
      // If a session was selected before reconnection, reload its messages
      // Use ref to get current value without dependency
      if (selectedSessionRef.current) {
        setTimeout(() => {
          socket.emit('admin:session:load', { sessionId: selectedSessionRef.current });
        }, 500); // Small delay to ensure admin:connect completes
      }
    });

    socket.on('disconnect', () => {
      console.log('Admin socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsLoadingSessions(false);
      setIsConnected(false);
      setConnectionError('Failed to connect to chat server. Please check if the API server is running.');
    });

    // Receive sessions list
    socket.on('sessions:list', (sessionsList: ChatSession[]) => {
      setSessions(sessionsList);
      
      // If a session was selected, reload its messages after receiving sessions list
      // This handles the case when admin reconnects after page refresh
      // Use ref to get current value without dependency
      if (selectedSessionRef.current && socket.connected) {
        setTimeout(() => {
          socket.emit('admin:session:load', { sessionId: selectedSessionRef.current });
        }, 300);
      }
    });

    // Receive session update
    socket.on('session:updated', (session: ChatSession) => {
      setSessions(prev => {
        const index = prev.findIndex(s => s.id === session.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = session;
          return updated;
        }
        return [session, ...prev];
      });
    });

    // Receive messages history
    socket.on('messages:history', (messagesList: ChatMessage[]) => {
      setMessages(messagesList);
      setIsLoading(false);
      scrollToBottom();
      
      // Reset unread count for the selected session since messages are now loaded (marked as read)
      if (selectedSessionRef.current) {
        setSessions(prev => {
          const index = prev.findIndex(s => s.id === selectedSessionRef.current);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              unread_count: 0
            };
            return updated;
          }
          return prev;
        });
      }
    });

    // Receive new message
    socket.on('message:new', (message: ChatMessage) => {
      // Play beep sound for incoming messages (only from users, not from admin themselves)
      if (message.sender_type === 'user') {
        playBeepSound();
      }
      
      // Update messages if this is for the currently selected session
      // Use ref to get current value without dependency
      if (message.session_id === selectedSessionRef.current) {
        setMessages(prev => {
          // Check if message already exists (prevent duplicates)
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
        // Always scroll to bottom when new message arrives for selected session
        scrollToBottom();
      }
      
      // Always update the session list to reflect new message
      setSessions(prev => {
        const index = prev.findIndex(s => s.id === message.session_id);
        if (index >= 0) {
          const updated = [...prev];
          const currentUnread = updated[index].unread_count || 0;
          updated[index] = {
            ...updated[index],
            message_count: updated[index].message_count + 1,
            last_message_at: message.created_at,
            last_message_time: message.created_at,
            // Increment unread count if message is from user
            unread_count: message.sender_type === 'user' ? currentUnread + 1 : currentUnread
          };
          // Move updated session to top
          const session = updated.splice(index, 1)[0];
          return [session, ...updated];
        }
        return prev;
      });
    });

    // Receive unread count
    socket.on('unread:count', (data: { count: number }) => {
      setUnreadCount(data.count);
    });

    // User connected/disconnected
    socket.on('user:connected', ({ sessionId }: { sessionId: string }) => {
      setUserOnlineStatus(prev => ({ ...prev, [sessionId]: true }));
    });

    socket.on('user:disconnected', ({ sessionId }: { sessionId: string }) => {
      setUserOnlineStatus(prev => ({ ...prev, [sessionId]: false }));
    });

    // Error handling
    socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error);
    });

    // Send heartbeat every 15 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 15000);

      return () => {
        socket.disconnect();
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      };
    } catch (error) {
      console.error('Error initializing socket:', error);
      setConnectionError('Failed to initialize chat connection');
      setIsLoadingSessions(false);
    }
  }, [token]);
  
  // Update ref when selectedSession changes
  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  // Update user online status based on sessions
  useEffect(() => {
    // Initialize online status for all sessions (default to false, will be updated by socket events)
    const statusMap: { [sessionId: string]: boolean } = {};
    sessions.forEach(session => {
      statusMap[session.id] = userOnlineStatus[session.id] || false;
    });
    setUserOnlineStatus(prev => ({ ...prev, ...statusMap }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  // Load messages when session is selected or when reconnected
  useEffect(() => {
    if (selectedSession && socketRef.current && isConnected) {
      // Clear existing messages first to show loading state
      setMessages([]);
      setIsLoading(true);
      
      // Request messages for the selected session
      socketRef.current.emit('admin:session:load', { sessionId: selectedSession });
    } else if (!selectedSession) {
      // Clear messages when no session is selected
      setMessages([]);
      setIsLoading(false);
    }
  }, [selectedSession, isConnected]);

  const scrollToBottom = () => {
    // Use requestAnimationFrame and setTimeout to ensure DOM is fully updated before scrolling
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 50);
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedSession || isLoading || !socketRef.current || !isConnected) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      socketRef.current.emit('admin:message:send', {
        sessionId: selectedSession,
        message: messageText
      });
      setIsLoading(false);
      // Note: scrollToBottom will be called automatically when message arrives via socket
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleStatusChange = async (sessionId: string, status: 'active' | 'closed' | 'pending') => {
    if (!socketRef.current || !isConnected) return;

    try {
      socketRef.current.emit('admin:session:status', { sessionId, status });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'closed':
        return <XCircle size={14} className="text-gray-500" />;
      case 'pending':
        return <Clock size={14} className="text-yellow-500" />;
      default:
        return null;
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'No messages';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  return (
    <div className="chat-manager">
      <div className="chat-header">
        <div className="flex items-center space-x-2">
          <MessageCircle size={24} />
          <h1>Support Chat</h1>
          {unreadCount > 0 && (
            <span className="badge badge-error">{unreadCount}</span>
          )}
        </div>
      </div>

      <div className="chat-layout">
        {/* Sessions List */}
        <div className="sessions-panel">
          <div className="sessions-header">
            <h2>Conversations</h2>
            <button 
              onClick={() => {
                if (socketRef.current && isConnected) {
                  socketRef.current.emit('admin:connect', { token });
                }
              }} 
              className="btn-sm"
            >
              Refresh
            </button>
          </div>
          
          {connectionError ? (
            <div className="error-state">
              <p>{connectionError}</p>
              <button 
                onClick={() => {
                  setConnectionError(null);
                  setIsLoadingSessions(true);
                  if (socketRef.current) {
                    socketRef.current.connect();
                  }
                }} 
                className="btn-sm"
              >
                Retry Connection
              </button>
            </div>
          ) : isLoadingSessions ? (
            <div className="loading-state">Connecting to chat...</div>
          ) : !isConnected ? (
            <div className="loading-state">Reconnecting...</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">No conversations yet</div>
          ) : (
            <div className="sessions-list">
              {sessions.map((session) => {
                const unreadCount = session.unread_count || 0;
                const isOnline = userOnlineStatus[session.id] === true;
                const hasUnread = unreadCount > 0;
                
                return (
                  <div
                    key={session.id}
                    className={`session-item ${selectedSession === session.id ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                    onClick={() => setSelectedSession(session.id)}
                  >
                    <div className="session-header">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {getStatusIcon(session.status)}
                        <span className="session-id" title={session.user_identifier || `Session ${session.id}`}>
                          {session.user_identifier || `Session ${session.id.substring(0, 8)}`}
                        </span>
                        {hasUnread && (
                          <span className="unread-badge">{unreadCount}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isOnline !== undefined && (
                          <div className="flex items-center space-x-1" title={isOnline ? 'Online' : 'Offline'}>
                            <div className={`online-indicator ${isOnline ? 'online' : 'offline'}`}></div>
                            <span className="online-text">{isOnline ? 'Online' : 'Offline'}</span>
                          </div>
                        )}
                        <span className="session-time">
                          {formatTime(session.last_message_at)}
                        </span>
                      </div>
                    </div>
                    <div className="session-meta">
                      <div className="flex items-center space-x-2">
                        <span className="session-status">{session.status}</span>
                        {hasUnread && (
                          <span className="unread-flag" title={`${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`}>
                            ●
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {hasUnread && (
                          <span className="unread-count-text">{unreadCount} unread</span>
                        )}
                        <span className="session-count">{session.message_count} total</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          {selectedSession ? (
            <>
              <div className="chat-header-bar">
                <div className="flex items-center space-x-2">
                  <User size={20} />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3>{selectedSessionData?.user_identifier || `Session ${selectedSession.substring(0, 8)}`}</h3>
                      {selectedSession && userOnlineStatus[selectedSession] !== undefined && (
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${userOnlineStatus[selectedSession] ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <span className="text-xs text-gray-500">
                            {userOnlineStatus[selectedSession] ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {selectedSessionData?.status} • {selectedSessionData?.message_count} messages
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedSessionData?.status || 'active'}
                    onChange={(e) => handleStatusChange(selectedSession, e.target.value as 'active' | 'closed' | 'pending')}
                    className="select-sm"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="messages-container">
                {isLoading && messages.length === 0 ? (
                  <div className="loading-state">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map((message) => {
                    const isAdmin = message.sender_type === 'admin';
                    const timestamp = new Date(message.created_at);
                    return (
                      <div
                        key={message.id}
                        className={`message ${isAdmin ? 'message-admin' : 'message-user'}`}
                      >
                        <div className="message-icon">
                          {isAdmin ? <Bot size={16} /> : <User size={16} />}
                        </div>
                        <div className="message-content">
                          <p>{message.message}</p>
                          <span className="message-time">
                            {timestamp.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                {isLoading && (
                  <div className="message message-admin">
                    <div className="message-icon">
                      <Bot size={16} />
                    </div>
                    <div className="message-content">
                      <div className="loading-dots">Sending...</div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  disabled={isLoading || selectedSessionData?.status === 'closed'}
                  className="chat-input"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading || selectedSessionData?.status === 'closed'}
                  className="btn-primary"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="empty-chat-state">
              <MessageCircle size={48} className="text-gray-400" />
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .chat-manager {
          padding: 2rem;
          height: calc(100vh - 4rem);
          display: flex;
          flex-direction: column;
        }

        .chat-header {
          margin-bottom: 1.5rem;
        }

        .chat-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .badge-error {
          background-color: #ef4444;
          color: white;
        }

        .chat-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 1.5rem;
          flex: 1;
          min-height: 0;
        }

        .sessions-panel {
          background: white;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sessions-header {
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sessions-header h2 {
          font-size: 1rem;
          font-weight: 600;
        }

        .sessions-list {
          flex: 1;
          overflow-y: auto;
        }

        .session-item {
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .session-item:hover {
          background-color: #f9fafb;
        }

        .session-item.active {
          background-color: #eff6ff;
          border-left: 3px solid #3b82f6;
        }

        .session-item.has-unread {
          background-color: #fef3c7;
          font-weight: 500;
        }

        .session-item.has-unread.active {
          background-color: #dbeafe;
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .session-id {
          font-weight: 600;
          font-size: 0.875rem;
        }

        .session-time {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .session-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .session-status {
          text-transform: capitalize;
        }

        .online-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .online-indicator.online {
          background-color: #10b981;
          box-shadow: 0 0 4px rgba(16, 185, 129, 0.5);
        }

        .online-indicator.offline {
          background-color: #9ca3af;
        }

        .online-text {
          font-size: 0.7rem;
          color: #6b7280;
          font-weight: 500;
        }

        .unread-badge {
          background-color: #ef4444;
          color: white;
          border-radius: 10px;
          padding: 0.125rem 0.375rem;
          font-size: 0.7rem;
          font-weight: 600;
          min-width: 18px;
          text-align: center;
          line-height: 1.2;
        }

        .unread-flag {
          color: #ef4444;
          font-size: 0.75rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .unread-count-text {
          color: #ef4444;
          font-weight: 600;
          font-size: 0.75rem;
        }

        .chat-area {
          background: white;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-header-bar {
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chat-header-bar h3 {
          font-size: 1rem;
          font-weight: 600;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .message {
          display: flex;
          gap: 0.75rem;
          max-width: 70%;
        }

        .message-admin {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .message-user {
          align-self: flex-start;
        }

        .message-icon {
          width: 2rem;
          height: 2rem;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .message-admin .message-icon {
          background-color: #3b82f6;
          color: white;
        }

        .message-user .message-icon {
          background-color: #e5e7eb;
          color: #374151;
        }

        .message-content {
          background: #f3f4f6;
          padding: 0.75rem;
          border-radius: 0.5rem;
        }

        .message-admin .message-content {
          background: #3b82f6;
          color: white;
        }

        .message-content p {
          margin: 0;
          font-size: 0.875rem;
        }

        .message-time {
          font-size: 0.75rem;
          opacity: 0.7;
          margin-top: 0.25rem;
          display: block;
        }

        .chat-input-area {
          padding: 1rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 0.5rem;
        }

        .chat-input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }

        .chat-input:focus {
          outline: none;
          border-color: #3b82f6;
          ring: 2px;
          ring-color: #3b82f6;
        }

        .btn-primary {
          padding: 0.75rem 1rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: 0.5rem 0.75rem;
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .btn-sm:hover {
          background-color: #e5e7eb;
        }

        .select-sm {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .empty-state, .loading-state {
          padding: 2rem;
          text-align: center;
          color: #6b7280;
        }

        .error-state {
          padding: 2rem;
          text-align: center;
          color: #991b1b;
          background: #fee2e2;
          border-radius: 0.5rem;
          margin: 1rem;
        }

        .error-state p {
          margin-bottom: 1rem;
        }

        .empty-chat-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
        }

        .loading-dots {
          display: flex;
          gap: 0.25rem;
        }

        .loading-dots::after {
          content: '...';
          animation: dots 1.5s steps(4, end) infinite;
        }

        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }
      `}</style>
    </div>
  );
}

