import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, User, Bot, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { fetchChatSessions, getFirebaseConfig, updateFirebaseConfig, getFirebaseClientConfig, registerAdminFcmToken, type ChatSessionsFilters, type FirebaseConfig } from '../api';

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
  is_new_traffic?: boolean;
  is_online?: boolean;
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
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [trafficFilter, setTrafficFilter] = useState<'all' | 'new'>('all');
  const [unreadFilter, setUnreadFilter] = useState<'all' | 'unread'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [firebaseConfigOpen, setFirebaseConfigOpen] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>({ is_enabled: false, service_account_json: '', client_config_json: '', vapid_key: '' });
  const [firebaseConfigSaving, setFirebaseConfigSaving] = useState(false);
  const [firebaseConfigSaveMessage, setFirebaseConfigSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedSessionRef = useRef<string | null>(null);
  const sessionsListRef = useRef<HTMLDivElement>(null);

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

    // New traffic session created
    socket.on('session:new-traffic', (newSession: ChatSession) => {
      // Add new session to the top of the list
      setSessions(prev => {
        // Check if session already exists
        const exists = prev.some(s => s.id === newSession.id);
        if (exists) {
          // Update existing session
          return prev.map(s => s.id === newSession.id ? { ...newSession, is_new_traffic: true } : s);
        }
        // Add new session at the top
        return [{ ...newSession, is_new_traffic: true }, ...prev];
      });
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

  // Load sessions from API with filters
  const loadSessions = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!token) return;
    
    try {
      setIsLoadingMore(true);
      const filters: ChatSessionsFilters = {
        page,
        limit: 20,
        online_status: onlineFilter !== 'all' ? onlineFilter : undefined,
        is_new_traffic: trafficFilter === 'new' ? true : undefined,
        has_unread: unreadFilter === 'unread' ? true : undefined
      };
      
      const response = await fetchChatSessions(token, filters);
      
      if (append) {
        setSessions(prev => [...prev, ...response.sessions]);
      } else {
        setSessions(response.sessions);
      }
      
      setHasMore(response.pagination.hasMore);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingMore(false);
      setIsLoadingSessions(false);
    }
  }, [token, onlineFilter, trafficFilter, unreadFilter]);

  // Load initial sessions and reload when filters change
  useEffect(() => {
    setCurrentPage(1);
    setHasMore(true);
    setIsLoadingSessions(true);
    loadSessions(1, false);
  }, [onlineFilter, trafficFilter, unreadFilter, loadSessions]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!sessionsListRef.current || isLoadingMore || !hasMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = sessionsListRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (isNearBottom) {
      loadSessions(currentPage + 1, true);
    }
  }, [currentPage, hasMore, isLoadingMore, loadSessions]);

  // Attach scroll listener
  useEffect(() => {
    const listElement = sessionsListRef.current;
    if (listElement) {
      listElement.addEventListener('scroll', handleScroll);
      return () => listElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Load Firebase config
  useEffect(() => {
    if (!token) return;
    getFirebaseConfig(token).then(setFirebaseConfig).catch(() => {});
  }, [token]);

  // Register FCM token for admin push notifications (when Firebase is enabled)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.fivedit.com/api';
    getFirebaseClientConfig()
      .then((data) => {
        if (cancelled || !data.enabled || !data.config || !data.vapidKey) return;
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
        const swUrl = `${window.location.origin}/firebase-messaging-sw.js?api=${encodeURIComponent(apiBase)}`;
        return navigator.serviceWorker.register(swUrl).then((reg) => (reg as unknown as { ready: Promise<ServiceWorkerRegistration> }).ready).then(() => {
          if (cancelled) return;
          // Give SW time to fetch config and init Firebase
          return new Promise<void>((resolve) => setTimeout(resolve, 1500));
        }).then(() => {
          if (cancelled) return;
          return import('firebase/app').then(({ initializeApp }) => {
            return import('firebase/messaging').then(({ getMessaging, getToken }) => {
              const app = initializeApp(data.config!);
              const messaging = getMessaging(app);
              return getToken(messaging, { vapidKey: data.vapidKey! });
            });
          });
        }).then((fcmToken) => {
          if (cancelled || !fcmToken) return;
          return registerAdminFcmToken(token, fcmToken);
        });
      })
      .then(() => { if (!cancelled) { /* registered */ } })
      .catch((err) => { if (!cancelled) console.error('FCM token registration failed:', err); });
    return () => { cancelled = true; };
  }, [token]);

  const handleSaveFirebaseConfig = async () => {
    if (!token) return;
    setFirebaseConfigSaveMessage(null);
    setFirebaseConfigSaving(true);
    try {
      await updateFirebaseConfig(token, firebaseConfig);
      setFirebaseConfigSaveMessage({ type: 'success', text: 'Push notification settings saved.' });
    } catch {
      setFirebaseConfigSaveMessage({ type: 'error', text: 'Failed to save. Check service account and try again.' });
    } finally {
      setFirebaseConfigSaving(false);
    }
  };

  return (
    <div className="chat-manager">
      <div className="chat-header">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <MessageCircle size={26} className="chat-header-icon" />
            <h1>Support Chat</h1>
            {unreadCount > 0 && (
              <span className="badge badge-error">{unreadCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Push notifications (Firebase) config - collapsible */}
      <div className="firebase-config-card">
        <button
          type="button"
          className="firebase-config-toggle"
          onClick={() => setFirebaseConfigOpen(!firebaseConfigOpen)}
        >
          <Bell size={20} />
          <span>Push notifications (Firebase)</span>
          {firebaseConfig.is_enabled && <span className="firebase-enabled-badge">On</span>}
          {firebaseConfigOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {firebaseConfigOpen && (
          <div className="firebase-config-body">
            <label className="firebase-config-label">
              <input
                type="checkbox"
                checked={firebaseConfig.is_enabled}
                onChange={(e) => setFirebaseConfig(c => ({ ...c, is_enabled: e.target.checked }))}
              />
              Enable push notifications
            </label>
            <label className="firebase-config-label">Service account JSON (backend)</label>
            <textarea
              className="firebase-config-textarea"
              value={firebaseConfig.service_account_json}
              onChange={(e) => setFirebaseConfig(c => ({ ...c, service_account_json: e.target.value }))}
              placeholder='Paste Firebase service account JSON (from Project settings → Service accounts)'
              rows={4}
            />
            <label className="firebase-config-label">Client config JSON (for chat widget)</label>
            <textarea
              className="firebase-config-textarea"
              value={firebaseConfig.client_config_json}
              onChange={(e) => setFirebaseConfig(c => ({ ...c, client_config_json: e.target.value }))}
              placeholder='Paste Firebase web app config: { "apiKey": "...", "projectId": "...", ... }'
              rows={3}
            />
            <label className="firebase-config-label">VAPID key (Web Push certificate from Firebase Console → Project settings → Cloud Messaging)</label>
            <input
              type="text"
              className="firebase-config-textarea"
              value={firebaseConfig.vapid_key ?? ''}
              onChange={(e) => setFirebaseConfig(c => ({ ...c, vapid_key: e.target.value }))}
              placeholder="e.g. Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            {firebaseConfigSaveMessage && (
              <p className={`firebase-config-msg ${firebaseConfigSaveMessage.type}`}>
                {firebaseConfigSaveMessage.text}
              </p>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveFirebaseConfig}
              disabled={firebaseConfigSaving}
            >
              {firebaseConfigSaving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        )}
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
          
          {/* Filter Options */}
          <div className="filter-section">
            <div className="filter-group">
              <label className="filter-label">Online Status:</label>
              <select 
                value={onlineFilter} 
                onChange={(e) => setOnlineFilter(e.target.value as 'all' | 'online' | 'offline')}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Traffic:</label>
              <select 
                value={trafficFilter} 
                onChange={(e) => setTrafficFilter(e.target.value as 'all' | 'new')}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="new">New Traffic</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Unread:</label>
              <select 
                value={unreadFilter} 
                onChange={(e) => setUnreadFilter(e.target.value as 'all' | 'unread')}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="unread">Unread only</option>
              </select>
            </div>
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
            <div className="empty-state">No conversations match the selected filters</div>
          ) : (
            <div className="sessions-list" ref={sessionsListRef}>
              {sessions.map((session) => {
                const unreadCount = session.unread_count || 0;
                // Use is_online from API if available, otherwise fall back to userOnlineStatus
                const isOnline = session.is_online !== undefined ? session.is_online : (userOnlineStatus[session.id] === true);
                const hasUnread = unreadCount > 0;
                const isNewTraffic = session.is_new_traffic === true;
                
                return (
                  <div
                    key={session.id}
                    className={`session-item ${selectedSession === session.id ? 'active' : ''} ${hasUnread ? 'has-unread' : ''} ${isNewTraffic ? 'new-traffic' : ''}`}
                    onClick={() => {
                      setSelectedSession(session.id);
                      // Mark as no longer new traffic when clicked
                      if (isNewTraffic) {
                        setSessions(prev => prev.map(s => 
                          s.id === session.id ? { ...s, is_new_traffic: false } : s
                        ));
                      }
                    }}
                  >
                    <div className="session-header">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {isNewTraffic && (
                          <span className="new-traffic-badge" title="New Traffic">NEW</span>
                        )}
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
          padding: 1.5rem 2rem;
          height: calc(100vh - 4rem);
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        }

        .chat-header {
          margin-bottom: 1rem;
        }

        .chat-header h1 {
          font-size: 1.625rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #0f172a;
        }

        .chat-header-icon {
          color: #3b82f6;
        }

        .firebase-config-card {
          background: white;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          margin-bottom: 1rem;
          overflow: hidden;
        }

        .firebase-config-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1.25rem;
          background: #f8fafc;
          border: none;
          cursor: pointer;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #334155;
          transition: background 0.2s;
        }

        .firebase-config-toggle:hover {
          background: #f1f5f9;
        }

        .firebase-enabled-badge {
          margin-left: auto;
          margin-right: 0.5rem;
          padding: 0.2rem 0.5rem;
          background: #22c55e;
          color: white;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .firebase-config-body {
          padding: 1.25rem 1.5rem;
          border-top: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .firebase-config-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #475569;
        }

        .firebase-config-label input[type="checkbox"] {
          margin-right: 0.5rem;
        }

        .firebase-config-textarea {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          font-family: ui-monospace, monospace;
          resize: vertical;
        }

        .firebase-config-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .firebase-config-msg {
          font-size: 0.875rem;
          margin: 0;
        }

        .firebase-config-msg.success { color: #16a34a; }
        .firebase-config-msg.error { color: #dc2626; }

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
          grid-template-columns: 320px 1fr;
          gap: 1.25rem;
          flex: 1;
          min-height: 0;
        }

        .sessions-panel {
          background: white;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sessions-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafbfc;
        }

        .sessions-header h2 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
        }

        .filter-section {
          padding: 0.875rem 1.25rem;
          border-bottom: 1px solid #e2e8f0;
          background-color: #f8fafc;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          white-space: nowrap;
        }

        .filter-select {
          padding: 0.375rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background-color: white;
          color: #374151;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .filter-select:hover {
          border-color: #9ca3af;
        }

        .filter-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .sessions-list {
          flex: 1;
          overflow-y: auto;
          max-height: calc(100vh - 300px);
        }

        .loading-more,
        .no-more {
          padding: 1rem;
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .loading-more {
          color: #3b82f6;
        }

        .session-item {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background-color 0.15s, border-color 0.15s;
        }

        .session-item:hover {
          background-color: #f8fafc;
        }

        .session-item.active {
          background-color: #eff6ff;
          border-left: 4px solid #3b82f6;
        }

        .session-item.has-unread {
          background-color: #fffbeb;
          font-weight: 500;
        }

        .session-item.has-unread.active {
          background-color: #dbeafe;
        }

        .session-item.new-traffic {
          background-color: #fffbeb;
          border-left: 4px solid #f59e0b;
        }

        .session-item.new-traffic.active {
          background-color: #fffbeb;
          border-left: 4px solid #f59e0b;
        }

        .new-traffic-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.125rem 0.375rem;
          background-color: #f59e0b;
          color: white;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-right: 0.25rem;
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
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-header-bar {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafbfc;
        }

        .chat-header-bar h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: #fafbfc;
        }

        .message {
          display: flex;
          gap: 0.75rem;
          max-width: 75%;
          align-items: flex-end;
        }

        .message-admin {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .message-user {
          align-self: flex-start;
        }

        .message-icon {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .message-admin .message-icon {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.3);
        }

        .message-user .message-icon {
          background: #e2e8f0;
          color: #64748b;
        }

        .message-content {
          background: #f1f5f9;
          padding: 0.75rem 1rem;
          border-radius: 1rem 1rem 1rem 0.25rem;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }

        .message-admin .message-content {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border-radius: 1rem 1rem 0.25rem 1rem;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
        }

        .message-content p {
          margin: 0;
          font-size: 0.9375rem;
          line-height: 1.45;
        }

        .message-time {
          font-size: 0.7rem;
          opacity: 0.85;
          margin-top: 0.35rem;
          display: block;
        }

        .chat-input-area {
          padding: 1rem 1.25rem;
          border-top: 1px solid #e2e8f0;
          display: flex;
          gap: 0.75rem;
          background: white;
        }

        .chat-input {
          flex: 1;
          padding: 0.75rem 1rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.75rem;
          font-size: 0.9375rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .chat-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .btn-primary {
          padding: 0.75rem 1.25rem;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          border-radius: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.05);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: 0.5rem 0.875rem;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
        }

        .btn-sm:hover {
          background: #e2e8f0;
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
          color: #64748b;
          background: #f8fafc;
          gap: 0.75rem;
        }

        .empty-chat-state p {
          font-size: 0.9375rem;
          font-weight: 500;
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

