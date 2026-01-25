'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, X, Bot, User } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fivedit.com/api';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://api.fivedit.com';
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

interface Message {
  id: number | string;
  message: string;
  sender_type: 'user' | 'admin';
  created_at: string;
}

interface ChatSession {
  id: string;
  status: string;
}

interface ActiveAdmin {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  last_seen: string;
}

interface ActiveAdminsResponse {
  count: number;
  admins: ActiveAdmin[];
}

const Chat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [activeAdmins, setActiveAdmins] = useState<ActiveAdmin[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize session and connect to socket
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Get or create session from localStorage
        let storedSessionId = localStorage.getItem('chat_session_id');
        
        if (!storedSessionId) {
          // Create new session via HTTP (one-time setup)
          const response = await fetch(`${API_BASE_URL}/chat/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIdentifier: null })
          });
          
          if (response.ok) {
            const session: ChatSession = await response.json();
            storedSessionId = session.id;
            localStorage.setItem('chat_session_id', storedSessionId);
          }
        }
        
        if (storedSessionId) {
          setSessionId(storedSessionId);
          
          // Connect to Socket.IO
          const socketOptions = {
            path: SOCKET_PATH,
            transports: ['websocket', 'polling']
          };
          console.log('Connecting to Socket.IO:', SOCKET_URL, 'with path:', SOCKET_PATH);
          const socket = io(SOCKET_URL, socketOptions);
          
          socketRef.current = socket;
          
          // Connection events
          socket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
            setIsInitializing(false);
            
            // Connect user with session
            socket.emit('user:connect', { sessionId: storedSessionId });
          });
          
          socket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
          });
          
          socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setIsInitializing(false);
          });
          
          // Receive messages
          socket.on('messages:history', (messages: Message[]) => {
            setMessages(messages);
            scrollToBottom();
          });
          
          socket.on('message:new', (message: Message) => {
            // Play beep sound for incoming messages from admin
            if (message.sender_type === 'admin') {
              playBeepSound();
            }
            setMessages(prev => [...prev, message]);
            scrollToBottom();
          });
          
          // Receive active admins
          socket.on('admins:active', (data: ActiveAdminsResponse) => {
            // Deduplicate admins by ID to prevent showing duplicates
            const uniqueAdmins = data.admins.filter((admin, index, self) => 
              index === self.findIndex(a => a.id === admin.id)
            );
            setActiveAdmins(uniqueAdmins);
            setIsAdminOnline(uniqueAdmins.length > 0);
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
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        setIsInitializing(false);
      }
    };

    initializeChat();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !sessionId || !socketRef.current || !isConnected) return;

    const messageText = text.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Send message via socket
      socketRef.current.emit('message:send', { message: messageText });
      setIsLoading(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      // Show error message to user
      const errorMessage: Message = {
        id: Date.now().toString(),
        message: 'Sorry, I\'m having trouble connecting. Please try again later.',
        sender_type: 'admin',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
        aria-label="Open chat"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-80 h-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col">
          {/* Chat Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Bot size={20} />
                <div className="flex flex-col">
                  <span className="font-semibold">Support Chat</span>
                  <div className="flex items-center space-x-1 text-xs opacity-90">
                    <div className={`w-2 h-2 rounded-full ${isAdminOnline ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    <span>{isAdminOnline ? `${activeAdmins.length} Admin${activeAdmins.length !== 1 ? 's' : ''} online` : 'Admin offline'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {activeAdmins.length > 0 && (
              <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-blue-500">
                <span className="text-xs opacity-90">Active support:</span>
                <div className="flex items-center space-x-1">
                  {activeAdmins.slice(0, 5).map((admin) => (
                    <div
                      key={admin.id}
                      className="w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-gray-300"
                      title={admin.name}
                    >
                      {admin.profile_picture ? (
                        <img
                          src={admin.profile_picture}
                          alt={admin.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                  {activeAdmins.length > 5 && (
                    <span className="text-xs opacity-75">+{activeAdmins.length - 5}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isInitializing ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-gray-500 text-sm">Loading chat...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-center text-gray-500">
                  <Bot size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Start a conversation!</p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.sender_type === 'user';
                const timestamp = new Date(message.created_at);
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg ${
                        isUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {!isUser && <Bot size={16} className="mt-0.5 flex-shrink-0" />}
                        {isUser && <User size={16} className="mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className="text-sm">{message.message}</p>
                          <p className={`text-xs mt-1 ${isUser ? 'opacity-70' : 'opacity-60'}`}>
                            {timestamp.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 max-w-xs px-3 py-2 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Bot size={16} />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading || !sessionId || !isConnected}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || !sessionId || !isConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-lg transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default Chat;
