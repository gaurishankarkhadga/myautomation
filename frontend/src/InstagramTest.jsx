import { useState, useEffect } from 'react';
import './InstagramTest.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function InstagramTest() {
    const [token, setToken] = useState('');
    const [userId, setUserId] = useState('');
    const [profile, setProfile] = useState(null);
    const [media, setMedia] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Auto-reply state
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
    const [autoReplyDelay, setAutoReplyDelay] = useState(10);
    const [autoReplyMessage, setAutoReplyMessage] = useState('Thanks for your comment! 🙏');
    const [autoReplyLog, setAutoReplyLog] = useState([]);
    const [autoReplySaving, setAutoReplySaving] = useState(false);
    const [autoReplyStatus, setAutoReplyStatus] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tokenParam = params.get('token');
        const userIdParam = params.get('userId');
        const errorParam = params.get('error');

        if (errorParam) {
            setError(`OAuth Error: ${errorParam}`);
        } else if (tokenParam) {
            setToken(tokenParam);
            setUserId(userIdParam || '');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    useEffect(() => {
        if (token && userId) {
            fetchProfile();
            fetchAutoReplySettings();
            fetchAutoReplyLog();
        }
    }, [token, userId]);

    const handleConnect = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(`${API_BASE_URL}/api/instagram/auth`);
            const data = await response.json();

            if (data.success) {
                window.location.href = data.authUrl;
            } else {
                setError(data.error || 'Failed to get auth URL');
            }
        } catch (err) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfile = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(`${API_BASE_URL}/api/instagram/profile?token=${token}`);
            const data = await response.json();

            if (data.success) {
                setProfile(data.data);
            } else {
                setError(data.error || 'Failed to fetch profile');
            }
        } catch (err) {
            setError(`Profile fetch error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchMedia = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(`${API_BASE_URL}/api/instagram/media?token=${token}&limit=12`);
            const data = await response.json();

            if (data.success) {
                setMedia(data);
            } else {
                setError(data.error || 'Failed to fetch media');
            }
        } catch (err) {
            setError(`Media fetch error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // ==================== AUTO-REPLY FUNCTIONS ====================

    const fetchAutoReplySettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/auto-reply/settings?userId=${userId}`);
            const data = await response.json();

            if (data.success) {
                setAutoReplyEnabled(data.data.enabled);
                setAutoReplyDelay(data.data.delaySeconds);
                setAutoReplyMessage(data.data.message);
            }
        } catch (err) {
            console.error('Failed to fetch auto-reply settings:', err);
        }
    };

    const saveAutoReplySettings = async () => {
        try {
            setAutoReplySaving(true);
            setAutoReplyStatus('');

            const response = await fetch(`${API_BASE_URL}/api/instagram/auto-reply/settings?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    enabled: autoReplyEnabled,
                    delaySeconds: autoReplyDelay,
                    message: autoReplyMessage
                })
            });

            const data = await response.json();

            if (data.success) {
                setAutoReplyStatus('Settings saved successfully!');
                setTimeout(() => setAutoReplyStatus(''), 3000);
            } else {
                setAutoReplyStatus(`Error: ${data.error}`);
            }
        } catch (err) {
            setAutoReplyStatus(`Error: ${err.message}`);
        } finally {
            setAutoReplySaving(false);
        }
    };

    const fetchAutoReplyLog = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/auto-reply/log?limit=20`);
            const data = await response.json();

            if (data.success) {
                setAutoReplyLog(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch auto-reply log:', err);
        }
    };

    const clearAutoReplyLog = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/auto-reply/log`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                setAutoReplyLog([]);
                setAutoReplyStatus('Log cleared');
                setTimeout(() => setAutoReplyStatus(''), 2000);
            }
        } catch (err) {
            console.error('Failed to clear log:', err);
        }
    };

    const getStatusBadgeClass = (status) => {
        if (status === 'sent') return 'badge-success';
        if (status === 'pending') return 'badge-pending';
        if (status === 'failed') return 'badge-error';
        return '';
    };

    return (
        <div className="instagram-test">
            <div className="container">
                <h1>Instagram Graph API Test</h1>

                {error && (
                    <div className="error">
                        Error: {error}
                    </div>
                )}

                {!token ? (
                    <div className="connect-section">
                        <p>Connect your Instagram Professional account to test the API</p>
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? 'Connecting...' : 'Connect Instagram'}
                        </button>
                    </div>
                ) : (
                    <div className="data-section">
                        <div className="token-info">
                            <p><strong>Connected</strong></p>
                            <p className="user-id">User ID: {userId}</p>
                            <button onClick={() => { setToken(''); setProfile(null); setMedia(null); }} className="btn-secondary">
                                Disconnect
                            </button>
                        </div>

                        <div className="actions">
                            <button onClick={fetchProfile} disabled={loading} className="btn">
                                {loading ? 'Loading...' : 'Fetch Profile'}
                            </button>
                            <button onClick={fetchMedia} disabled={loading} className="btn">
                                {loading ? 'Loading...' : 'Fetch Media'}
                            </button>
                        </div>

                        {profile && (
                            <div className="profile-card">
                                <h2>Profile Data</h2>
                                <div className="profile-content">
                                    <img
                                        src={profile.profile_picture_url}
                                        alt={profile.username}
                                        className="profile-pic"
                                    />
                                    <div className="profile-info">
                                        <h3>@{profile.username}</h3>
                                        <p className="account-type">{profile.account_type}</p>
                                        {profile.biography && <p className="bio">{profile.biography}</p>}
                                        <div className="stats">
                                            <div className="stat">
                                                <strong>{profile.media_count}</strong>
                                                <span>Posts</span>
                                            </div>
                                            <div className="stat">
                                                <strong>{profile.followers_count?.toLocaleString()}</strong>
                                                <span>Followers</span>
                                            </div>
                                            <div className="stat">
                                                <strong>{profile.follows_count?.toLocaleString()}</strong>
                                                <span>Following</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ==================== AUTO-REPLY SECTION ==================== */}
                        <div className="auto-reply-section">
                            <div className="auto-reply-header">
                                <h2>⚡ Auto-Reply to Comments</h2>
                                <div className={`status-indicator ${autoReplyEnabled ? 'active' : 'inactive'}`}>
                                    {autoReplyEnabled ? '● Active' : '○ Inactive'}
                                </div>
                            </div>

                            <div className="auto-reply-settings">
                                <div className="setting-row">
                                    <label className="toggle-label">
                                        <span>Enable Auto-Reply</span>
                                        <div
                                            className={`toggle-switch ${autoReplyEnabled ? 'on' : ''}`}
                                            onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                                        >
                                            <div className="toggle-knob"></div>
                                        </div>
                                    </label>
                                </div>

                                <div className="setting-row">
                                    <label>
                                        <span>Reply Delay (seconds)</span>
                                        <div className="delay-input-group">
                                            <input
                                                type="range"
                                                min="5"
                                                max="300"
                                                value={autoReplyDelay}
                                                onChange={(e) => setAutoReplyDelay(parseInt(e.target.value))}
                                                className="delay-slider"
                                            />
                                            <span className="delay-value">{autoReplyDelay}s</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="setting-row">
                                    <label>
                                        <span>Reply Message</span>
                                        <textarea
                                            value={autoReplyMessage}
                                            onChange={(e) => setAutoReplyMessage(e.target.value)}
                                            placeholder="Enter your auto-reply message..."
                                            rows={3}
                                            maxLength={300}
                                            className="reply-textarea"
                                        />
                                        <span className="char-count">{autoReplyMessage.length}/300</span>
                                    </label>
                                </div>

                                <div className="setting-actions">
                                    <button
                                        onClick={saveAutoReplySettings}
                                        disabled={autoReplySaving || !autoReplyMessage.trim()}
                                        className="btn-save"
                                    >
                                        {autoReplySaving ? 'Saving...' : '💾 Save Settings'}
                                    </button>
                                    {autoReplyStatus && (
                                        <span className={`save-status ${autoReplyStatus.includes('Error') ? 'status-error' : 'status-success'}`}>
                                            {autoReplyStatus}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Auto-Reply Log */}
                            <div className="auto-reply-log">
                                <div className="log-header">
                                    <h3>📋 Reply Log</h3>
                                    <div className="log-actions">
                                        <button onClick={fetchAutoReplyLog} className="btn-small">
                                            🔄 Refresh
                                        </button>
                                        {autoReplyLog.length > 0 && (
                                            <button onClick={clearAutoReplyLog} className="btn-small btn-danger">
                                                🗑️ Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {autoReplyLog.length === 0 ? (
                                    <p className="log-empty">No auto-replies yet. Enable auto-reply and wait for comments on your posts.</p>
                                ) : (
                                    <div className="log-list">
                                        {autoReplyLog.map((entry, i) => (
                                            <div key={entry.commentId + '-' + i} className="log-entry">
                                                <div className="log-entry-top">
                                                    <span className="log-username">@{entry.commenterUsername}</span>
                                                    <span className={`log-status ${getStatusBadgeClass(entry.status)}`}>
                                                        {entry.status}
                                                    </span>
                                                </div>
                                                <p className="log-comment">💬 "{entry.commentText}"</p>
                                                <p className="log-reply">↩️ "{entry.replyText}"</p>
                                                {entry.error && <p className="log-error">❌ {entry.error}</p>}
                                                <span className="log-time">
                                                    {entry.repliedAt
                                                        ? `Replied: ${new Date(entry.repliedAt).toLocaleString()}`
                                                        : `Scheduled: ${new Date(entry.scheduledAt).toLocaleString()}`
                                                    }
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {media && (
                            <div className="media-section">
                                <h2>Media ({media.total})</h2>
                                <div className="media-summary">
                                    <span className="badge">{media.posts} Posts</span>
                                    <span className="badge">{media.reels} Reels</span>
                                </div>
                                <div className="media-grid">
                                    {media.data.map((item) => (
                                        <div key={item.id} className="media-item">
                                            <a href={item.permalink} target="_blank" rel="noopener noreferrer">
                                                <img
                                                    src={item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url}
                                                    alt={item.caption?.substring(0, 50) || 'Instagram post'}
                                                />
                                                <div className="media-overlay">
                                                    <span className="media-type">{item.media_type}</span>
                                                    <div className="media-stats">
                                                        <span>Likes: {item.like_count}</span>
                                                        <span>Comments: {item.comments_count}</span>
                                                    </div>
                                                </div>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default InstagramTest;
