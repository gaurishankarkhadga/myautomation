import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ToastNotification, { useToasts } from './ToastNotification';
import '../styles/ChatHub.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ==================== SUGGESTED PROMPTS ====================
const SUGGESTED_PROMPTS = [
    { icon: '🚀', text: 'Turn on auto-reply for comments', label: 'Enable Replies' },
    { icon: '✉️', text: 'Enable smart DM auto-reply', label: 'Smart DMs' },
    { icon: '📊', text: "What's my current setup?", label: 'View Status' },
    { icon: '📦', text: 'Show my assets', label: 'My Assets' },
    { icon: '🤝', text: 'Find brand deals for me', label: 'Brand Deals' },
    { icon: '👤', text: 'Show my profile', label: 'My Profile' },
];

function ChatHub() {
    const navigate = useNavigate();

    // Auth state
    const [token, setToken] = useState('');
    const [userId, setUserId] = useState('');
    const [profile, setProfile] = useState(null);

    // Chat state
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Sidebar
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Connection states
    const [connections, setConnections] = useState({
        instagram: false,
        youtube: false
    });
    const [connectingPlatform, setConnectingPlatform] = useState(null);

    // Refs
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Toasts
    const { toasts, addToasts, removeToast } = useToasts();

    // ==================== AUTH CHECK + CONNECTION STATUS ====================
    useEffect(() => {
        const storedToken = localStorage.getItem('insta_token');
        const storedUserId = localStorage.getItem('insta_user_id');
        const ytChannelId = localStorage.getItem('yt_channel_id');

        // Check which platforms are connected
        setConnections({
            instagram: !!(storedToken && storedUserId),
            youtube: !!ytChannelId
        });

        if (storedToken && storedUserId) {
            setToken(storedToken);
            setUserId(storedUserId);
        } else if (ytChannelId) {
            // YouTube connected but no Instagram — still allow chat
            setUserId(ytChannelId);
        } else {
            navigate('/');
        }
    }, [navigate]);

    // ==================== LOAD PROFILE & HISTORY ====================
    useEffect(() => {
        if (token && userId) {
            fetchProfile();
            loadChatHistory();
        }
    }, [token, userId]);

    // ==================== AUTO-SCROLL ====================
    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // ==================== FETCH PROFILE ====================
    const fetchProfile = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/profile?token=${token}`);
            const data = await response.json();
            if (data.success) setProfile(data.data);
        } catch (err) {
            console.error('Profile fetch failed:', err);
        }
    };

    // ==================== LOAD CHAT HISTORY ====================
    const loadChatHistory = async () => {
        try {
            setLoadingHistory(true);
            const response = await fetch(`${API_BASE_URL}/api/chat/history/${userId}`);
            const data = await response.json();

            if (data.success && data.messages.length > 0) {
                setMessages(data.messages);
            }
        } catch (err) {
            console.error('Chat history load failed:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // ==================== SEND MESSAGE ====================
    const sendMessage = async (messageText) => {
        const text = messageText || inputValue.trim();
        if (!text || isTyping) return;

        // Add user message
        const userMessage = {
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, message: text, token })
            });

            const data = await response.json();

            // Add assistant message
            const assistantMessage = {
                role: 'assistant',
                content: data.response || 'Something went wrong. Please try again.',
                actions: data.actions || [],
                toasts: data.toasts || [],
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMessage]);

            // Show toast notifications
            if (data.toasts && data.toasts.length > 0) {
                addToasts(data.toasts);
            }
        } catch (err) {
            const errorMessage = {
                role: 'assistant',
                content: 'Oops! I had trouble connecting. Check if the server is running and try again. 🔌',
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
            inputRef.current?.focus();
        }
    };

    // ==================== HANDLE KEYPRESS ====================
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ==================== DISCONNECT ====================
    const handleDisconnect = () => {
        localStorage.removeItem('insta_token');
        localStorage.removeItem('insta_user_id');
        localStorage.removeItem('yt_channel_id');
        localStorage.removeItem('yt_channel_title');
        navigate('/');
    };

    // ==================== CONNECT PLATFORM ====================
    const handleConnectPlatform = async (platform) => {
        setConnectingPlatform(platform);
        try {
            const endpoint = platform === 'instagram' ? '/api/instagram/auth' : '/api/youtube/auth';
            const response = await fetch(`${API_BASE_URL}${endpoint}`);
            const data = await response.json();

            if (data.url || data.authUrl) {
                window.location.href = data.url || data.authUrl;
            } else {
                console.error(`No auth URL returned for ${platform}`);
            }
        } catch (err) {
            console.error(`Failed to connect ${platform}:`, err);
        } finally {
            setConnectingPlatform(null);
        }
    };

    // ==================== FORMAT MESSAGE CONTENT ====================
    const formatContent = (content) => {
        if (!content) return '';

        // Convert **bold** to <strong>
        let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Convert line breaks
        formatted = formatted.replace(/\n/g, '<br/>');

        return formatted;
    };

    // ==================== RENDER ====================
    return (
        <div className="chathub" id="chathub">
            {/* Toast Notifications */}
            <ToastNotification toasts={toasts} onRemove={removeToast} />

            {/* Sidebar Toggle (mobile) */}
            <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                id="sidebar-toggle"
            >
                {sidebarOpen ? '✕' : '☰'}
            </button>

            {/* Sidebar */}
            <aside className={`chathub-sidebar ${sidebarOpen ? 'open' : ''}`} id="chathub-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-icon">⚡</span>
                        <span className="logo-text">CreatorHub</span>
                    </div>
                </div>

                {/* Connected Account */}
                {profile && (
                    <div className="sidebar-profile" id="sidebar-profile">
                        {profile.profile_picture_url && (
                            <img
                                src={profile.profile_picture_url}
                                alt={profile.username}
                                className="sidebar-avatar"
                            />
                        )}
                        <div className="sidebar-profile-info">
                            <span className="sidebar-username">@{profile.username}</span>
                            <span className="sidebar-followers">
                                {profile.followers_count?.toLocaleString()} followers
                            </span>
                        </div>
                        <span className="sidebar-connected-badge">● Connected</span>
                    </div>
                )}

                {/* Connections */}
                <div className="sidebar-section">
                    <h3 className="sidebar-section-title">Connections</h3>

                    {/* Instagram */}
                    {connections.instagram ? (
                        <div className="sidebar-connection connected" id="conn-instagram">
                            <span className="conn-icon">📸</span>
                            <span className="conn-name">Instagram</span>
                            <span className="conn-status connected">● Connected</span>
                        </div>
                    ) : (
                        <button
                            className="sidebar-connect-btn instagram"
                            onClick={() => handleConnectPlatform('instagram')}
                            disabled={connectingPlatform === 'instagram'}
                            id="connect-instagram"
                        >
                            <span className="conn-icon">📸</span>
                            <span className="conn-name">{connectingPlatform === 'instagram' ? 'Connecting...' : 'Connect Instagram'}</span>
                        </button>
                    )}

                    {/* YouTube */}
                    {connections.youtube ? (
                        <div className="sidebar-connection connected" id="conn-youtube">
                            <span className="conn-icon">🎬</span>
                            <span className="conn-name">YouTube</span>
                            <span className="conn-status connected">● Connected</span>
                        </div>
                    ) : (
                        <button
                            className="sidebar-connect-btn youtube"
                            onClick={() => handleConnectPlatform('youtube')}
                            disabled={connectingPlatform === 'youtube'}
                            id="connect-youtube"
                        >
                            <span className="conn-icon">🎬</span>
                            <span className="conn-name">{connectingPlatform === 'youtube' ? 'Connecting...' : 'Connect YouTube'}</span>
                        </button>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="sidebar-section">
                    <h3 className="sidebar-section-title">Quick Actions</h3>
                    <button
                        className="sidebar-action-btn"
                        onClick={() => { sendMessage("What's my current setup?"); setSidebarOpen(false); }}
                        id="quick-status"
                    >
                        📊 View Status
                    </button>
                    <button
                        className="sidebar-action-btn"
                        onClick={() => { sendMessage("Show my assets"); setSidebarOpen(false); }}
                        id="quick-assets"
                    >
                        📦 My Assets
                    </button>
                    <button
                        className="sidebar-action-btn"
                        onClick={() => { sendMessage("Show my profile"); setSidebarOpen(false); }}
                        id="quick-profile"
                    >
                        👤 Profile
                    </button>
                </div>

                {/* Bottom Actions */}
                <div className="sidebar-bottom">
                    <button
                        className="sidebar-settings-btn"
                        onClick={() => navigate('/settings')}
                        id="btn-advanced-settings"
                    >
                        ⚙️ Advanced Settings
                    </button>
                    <button
                        className="sidebar-disconnect-btn"
                        onClick={handleDisconnect}
                        id="btn-disconnect"
                    >
                        🔌 Disconnect
                    </button>
                </div>
            </aside>

            {/* Overlay for mobile sidebar */}
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* Main Chat Area */}
            <main className="chathub-main" id="chathub-main">
                {/* Chat Header */}
                <header className="chat-header" id="chat-header">
                    <div className="chat-header-left">
                        <span className="chat-header-icon">⚡</span>
                        <div>
                            <h1 className="chat-header-title">CreatorHub AI</h1>
                            <span className="chat-header-subtitle">Your social media command center</span>
                        </div>
                    </div>
                    <div className="chat-header-right">
                        {profile && (
                            <span className="chat-header-user">@{profile.username}</span>
                        )}
                    </div>
                </header>

                {/* Messages Container */}
                <div className="chat-messages" id="chat-messages">
                    {/* Welcome Message (shown when no history) */}
                    {!loadingHistory && messages.length === 0 && (
                        <div className="chat-welcome" id="chat-welcome">
                            <div className="welcome-icon">⚡</div>
                            <h2 className="welcome-title">Welcome to CreatorHub AI</h2>
                            <p className="welcome-subtitle">
                                I'm your AI-powered social media assistant. Just tell me what you need — I'll handle everything behind the scenes.
                            </p>

                            {/* Suggested Prompts */}
                            <div className="suggested-prompts" id="suggested-prompts">
                                {SUGGESTED_PROMPTS.map((prompt, i) => (
                                    <button
                                        key={i}
                                        className="suggested-prompt-btn"
                                        onClick={() => sendMessage(prompt.text)}
                                        id={`suggested-prompt-${i}`}
                                    >
                                        <span className="prompt-icon">{prompt.icon}</span>
                                        <span className="prompt-label">{prompt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading History */}
                    {loadingHistory && (
                        <div className="chat-loading">
                            <div className="loading-dots">
                                <span></span><span></span><span></span>
                            </div>
                            <p>Loading your chat history...</p>
                        </div>
                    )}

                    {/* Message Bubbles */}
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`chat-message ${msg.role}`}
                            id={`message-${index}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="message-avatar">⚡</div>
                            )}
                            <div className="message-bubble">
                                <div
                                    className="message-content"
                                    dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                                />

                                {/* Action Results (inline badges) */}
                                {msg.actions && msg.actions.length > 0 && (
                                    <div className="message-actions">
                                        {msg.actions.map((action, i) => (
                                            <span
                                                key={i}
                                                className={`action-badge ${action.success ? 'action-success' : 'action-error'}`}
                                            >
                                                {action.success ? '✅' : '❌'} {action.intent?.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <span className="message-time">
                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    {isTyping && (
                        <div className="chat-message assistant" id="typing-indicator">
                            <div className="message-avatar">⚡</div>
                            <div className="message-bubble typing-bubble">
                                <div className="typing-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="chat-input-container" id="chat-input-container">
                    <div className="chat-input-wrapper">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Tell me what you need... (e.g., 'turn on auto-reply', 'add my course')"
                            className="chat-input"
                            id="chat-input"
                            rows={1}
                            disabled={isTyping}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={isTyping || !inputValue.trim()}
                            className="chat-send-btn"
                            id="chat-send-btn"
                        >
                            {isTyping ? (
                                <span className="send-loading">⏳</span>
                            ) : (
                                <span className="send-icon">➤</span>
                            )}
                        </button>
                    </div>
                    <p className="chat-input-hint">
                        Press Enter to send · Shift+Enter for new line
                    </p>
                </div>
            </main>
        </div>
    );
}

export default ChatHub;
