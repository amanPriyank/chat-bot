import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { 
  Send, 
  Plus, 
  MessageCircle, 
  Clock, 
  User,
  Bot,
  Trash2,
  Edit3,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

const ChatInterface = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat sessions
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/chat/sessions');
      setSessions(response.data.data.chats);
      
      // If no current session and sessions exist, load the first one
      if (!currentSession && response.data.data.chats.length > 0) {
        loadSession(response.data.data.chats[0].sessionId);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast.error('Failed to load chat sessions');
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/chat/sessions/${sessionId}`);
      setCurrentSession(response.data.data);
      setMessages(response.data.data.messages);
      setShowSessions(false);
    } catch (error) {
      console.error('Error loading session:', error);
      toast.error('Failed to load chat session');
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/chat/sessions', {
        title: `Chat ${new Date().toLocaleDateString()}`
      });
      
      const newSession = response.data.data;
      setSessions([newSession, ...sessions]);
      setCurrentSession(newSession);
      setMessages(newSession.messages);
      setShowSessions(false);
      toast.success('New chat session created');
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create new chat session');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentSession) return;

    const userMessage = {
      sender: 'user',
      content: newMessage,
      timestamp: new Date(),
      messageType: 'text'
    };

    // Add user message immediately for better UX
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setSending(true);

    try {
      const response = await axios.post(`/api/chat/sessions/${currentSession.sessionId}/messages`, {
        content: newMessage,
        messageType: 'text'
      });

      // Add assistant response
      setMessages(prev => [...prev, response.data.data.assistantMessage]);
      
      // Update current session with new messages
      setCurrentSession(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage, response.data.data.assistantMessage]
      }));

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Remove the user message if it failed
      setMessages(prev => prev.filter(msg => msg !== userMessage));
    } finally {
      setSending(false);
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await axios.delete(`/api/chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(session => session.sessionId !== sessionId));
      
      if (currentSession?.sessionId === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      
      toast.success('Chat session deleted');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete chat session');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading && !currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-secondary-50">
      {/* Sessions Sidebar */}
      <div className={`w-80 bg-white border-r border-secondary-200 flex flex-col ${showSessions ? 'block' : 'hidden'} lg:block`}>
        <div className="p-4 border-b border-secondary-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-secondary-900">Chat Sessions</h2>
            <button
              onClick={createNewSession}
              disabled={loading}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2 p-3 bg-primary-50 rounded-lg">
            <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-900">{user?.name}</p>
              <p className="text-xs text-secondary-500">Online</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-secondary-400 mb-2" />
              <p className="text-sm text-secondary-500">No chat sessions yet</p>
              <button
                onClick={createNewSession}
                className="mt-2 text-sm text-primary-600 hover:text-primary-700"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            <div className="p-2">
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    currentSession?.sessionId === session.sessionId
                      ? 'bg-primary-50 border border-primary-200'
                      : 'hover:bg-secondary-50'
                  }`}
                  onClick={() => loadSession(session.sessionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-900 truncate">
                        {session.title}
                      </p>
                      <p className="text-xs text-secondary-500">
                        {session.messages.length} messages
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.sessionId);
                      }}
                      className="p-1 text-secondary-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-secondary-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowSessions(!showSessions)}
                className="lg:hidden p-2 text-secondary-600 hover:text-secondary-900"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              
              {currentSession ? (
                <div>
                  <h1 className="text-lg font-semibold text-secondary-900">
                    {currentSession.title}
                  </h1>
                  <p className="text-sm text-secondary-500">
                    Fundobaba Loan Assistant
                  </p>
                </div>
              ) : (
                <div>
                  <h1 className="text-lg font-semibold text-secondary-900">
                    Fundobaba Chat Assistant
                  </h1>
                  <p className="text-sm text-secondary-500">
                    Get help with your pay-day loan queries
                  </p>
                </div>
              )}
            </div>

            {currentSession && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-sm text-secondary-500">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>Online</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentSession ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <h3 className="text-lg font-medium text-secondary-900 mb-2">
                  Welcome to Fundobaba Chat Assistant
                </h3>
                <p className="text-secondary-600 mb-4">
                  Start a new chat to get help with your pay-day loan queries
                </p>
                <button
                  onClick={createNewSession}
                  className="btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Chat
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${
                    message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                      message.sender === 'user' 
                        ? 'bg-primary-600' 
                        : 'bg-secondary-600'
                    }`}>
                      {message.sender === 'user' ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    
                    <div className={`rounded-lg px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white border border-secondary-200 text-secondary-900'
                    }`}>
                      <div className="whitespace-pre-wrap text-sm">
                        {message.content}
                      </div>
                      <div className={`text-xs mt-1 ${
                        message.sender === 'user' 
                          ? 'text-primary-100' 
                          : 'text-secondary-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-xs lg:max-w-md">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-white border border-secondary-200 rounded-lg px-4 py-2">
                      <div className="flex items-center space-x-1">
                        <div className="animate-bounce">●</div>
                        <div className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</div>
                        <div className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        {currentSession && (
          <div className="bg-white border-t border-secondary-200 p-4">
            <div className="flex items-end space-x-2">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows="1"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface; 