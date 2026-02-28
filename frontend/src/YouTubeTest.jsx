import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './YouTubeTest.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function YouTubeTest() {
    const [channelId, setChannelId] = useState('');
    const [channelTitle, setChannelTitle] = useState('');
    const [profile, setProfile] = useState(null);
    const [videos, setVideos] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingInsta, setLoadingInsta] = useState(false);
    const [loadingYT, setLoadingYT] = useState(false);
    const [error, setError] = useState('');

    // Auto-reply state (mirroring Instagram)
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
    const [autoReplyDelay, setAutoReplyDelay] = useState(10);
    const [autoReplyMessage, setAutoReplyMessage] = useState('Thanks for your comment! 🙏');
    const [autoReplyLog, setAutoReplyLog] = useState([]);
    const [autoReplySaving, setAutoReplySaving] = useState(false);
    const [autoReplyStatus, setAutoReplyStatus] = useState('');
    const [replyMode, setReplyMode] = useState('reply_only');
    const [pollingActive, setPollingActive] = useState(false);

    // Manual reply state
    const [replyText, setReplyText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [replySending, setReplySending] = useState(false);

    // Load from URL params or localStorage on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const channelParam = params.get('channelId');
        const titleParam = params.get('channelTitle');
        const errorParam = params.get('error');

        if (errorParam) {
            setError(`OAuth Error: ${errorParam} — ${params.get('message') || ''}`);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (channelParam) {
            localStorage.setItem('yt_channel_id', channelParam);
            if (titleParam) localStorage.setItem('yt_channel_title', titleParam);

            setChannelId(channelParam);
            setChannelTitle(titleParam || '');
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            const storedChannelId = localStorage.getItem('yt_channel_id');
            const storedTitle = localStorage.getItem('yt_channel_title');

            if (storedChannelId) {
                setChannelId(storedChannelId);
                setChannelTitle(storedTitle || '');
            }
        }
    }, []);

    // Fetch data when connected
    useEffect(() => {
        if (channelId) {
            fetchProfile();
            fetchVideos();
            fetchAutoReplySettings();
            fetchAutoReplyLog();
        }
    }, [channelId]);

    // ==================== OAUTH ====================

    const handleConnect = async () => {
        try {
            setLoadingYT(true);
            setError('');

            const response = await fetch(`${API_BASE_URL}/api/youtube/auth`);
            const data = await response.json();

            if (data.success) {
                window.location.href = data.authUrl;
            } else {
                setError(data.error || 'Failed to get auth URL');
            }
        } catch (err) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setLoadingYT(false);
        }
    };

    const handleConnectInstagram = async () => {
        try {
            setLoadingInsta(true);
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
            setLoadingInsta(false);
        }
    };

    const handleDisconnect = () => {
        setChannelId('');
        setChannelTitle('');
        setProfile(null);
        setVideos([]);
        setComments([]);
        setSelectedVideo(null);
        localStorage.removeItem('yt_channel_id');
        localStorage.removeItem('yt_channel_title');
    };

    // ==================== DATA FETCHING ====================

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/youtube/profile?channelId=${channelId}`);
            const data = await response.json();

            if (data.success) {
                setProfile(data.data);
            } else {
                setError(data.error || 'Failed to fetch channel profile');
            }
        } catch (err) {
            setError(`Profile fetch error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchVideos = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/youtube/videos?channelId=${channelId}&limit=12`);
            const data = await response.json();

            if (data.success) {
                setVideos(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch videos:', err);
        }
    };

    const fetchComments = async (videoId) => {
        try {
            setSelectedVideo(videoId);
            setComments([]);

            const response = await fetch(`${API_BASE_URL}/api/youtube/comments/${videoId}?channelId=${channelId}`);
            const data = await response.json();

            if (data.success) {
                setComments(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch comments:', err);
        }
    };

    // ==================== MANUAL REPLY ====================

    const sendReply = async (parentId) => {
        if (!replyText.trim()) return;

        try {
            setReplySending(true);

            const response = await fetch(`${API_BASE_URL}/api/youtube/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId,
                    parentId,
                    text: replyText
                })
            });

            const data = await response.json();

            if (data.success) {
                setReplyText('');
                setReplyingTo(null);
                // Refresh comments
                if (selectedVideo) fetchComments(selectedVideo);
            } else {
                setError(data.error || 'Failed to send reply');
            }
        } catch (err) {
            setError(`Reply error: ${err.message}`);
        } finally {
            setReplySending(false);
        }
    };

    // ==================== COMMENT MODERATION ====================

    const moderateComment = async (commentId, action) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/youtube/moderate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, commentId, action })
            });

            const data = await response.json();

            if (data.success) {
                // Refresh comments after moderation
                if (selectedVideo) fetchComments(selectedVideo);
            } else {
                setError(data.error || 'Failed to moderate comment');
            }
        } catch (err) {
            setError(`Moderation error: ${err.message}`);
        }
    };

    // ==================== AUTO-REPLY FUNCTIONS ====================

    const fetchAutoReplySettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/youtube/auto-reply/settings?channelId=${channelId}`);
            const data = await response.json();

            if (data.success) {
                setAutoReplyEnabled(data.data.enabled);
                setAutoReplyDelay(data.data.delaySeconds);
                setAutoReplyMessage(data.data.message);
                setReplyMode(data.data.replyMode || 'reply_only');
                setPollingActive(data.pollingActive || false);
            }
        } catch (err) {
            console.error('Failed to fetch auto-reply settings:', err);
        }
    };

    const saveAutoReplySettings = async () => {
        try {
            setAutoReplySaving(true);
            setAutoReplyStatus('');

            const response = await fetch(`${API_BASE_URL}/api/youtube/auto-reply/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId,
                    enabled: autoReplyEnabled,
                    delaySeconds: autoReplyDelay,
                    message: autoReplyMessage,
                    replyMode: replyMode
                })
            });

            const data = await response.json();

            if (data.success) {
                setAutoReplyStatus('Settings saved successfully!');
                setPollingActive(autoReplyEnabled);
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
            const response = await fetch(`${API_BASE_URL}/api/youtube/auto-reply/log?limit=20`);
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
            const response = await fetch(`${API_BASE_URL}/api/youtube/auto-reply/log`, {
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

    // ==================== HELPERS ====================

    const getStatusBadgeClass = (status) => {
        if (status === 'sent') return 'yt-badge-success';
        if (status === 'pending') return 'yt-badge-pending';
        if (status === 'failed') return 'yt-badge-error';
        return '';
    };

    const getActionBadge = (action) => {
        if (action === 'hidden') return { icon: '🛡️', text: 'Hidden', className: 'yt-badge-hidden' };
        if (action === 'skipped') return { icon: '⏭️', text: 'Skipped', className: 'yt-badge-skipped' };
        return { icon: '💬', text: 'Replied', className: 'yt-badge-replied' };
    };

    const formatCount = (count) => {
        const num = parseInt(count);
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return count;
    };

    const formatDuration = (duration) => {
        if (!duration) return '';
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return '';
        const h = match[1] ? match[1] + ':' : '';
        const m = match[2] ? match[2].padStart(2, '0') : '00';
        const s = match[3] ? match[3].padStart(2, '0') : '00';
        return `${h}${m}:${s}`;
    };

    // ==================== RENDER ====================

    return (
        <div className="yt-dashboard">
            <div className="yt-container">
                {/* Header */}
                <div className="yt-header">
                    <div className="yt-header-content">
                        <div className="yt-logo">
                            <svg viewBox="0 0 90 20" className="yt-logo-svg">
                                <path d="M27.97 3.12a3.57 3.57 0 00-2.54-2.53C23.36 0 14.39 0 14.39 0S5.42 0 3.36.59A3.57 3.57 0 00.82 3.12C.2 5.17.2 10 .2 10s0 4.83.62 6.88a3.57 3.57 0 002.54 2.53c2.06.59 10.03.59 10.03.59s8.97 0 11.04-.59a3.57 3.57 0 002.54-2.53c.62-2.05.62-6.88.62-6.88s0-4.83-.62-6.88z" fill="#FF0000" />
                                <path d="M11.5 14.29l6.73-4.29-6.73-4.29v8.58z" fill="#fff" />
                            </svg>
                            <h1>YouTube Automation</h1>
                        </div>
                        <div className="yt-header-actions">
                            {channelId && (
                                <button onClick={handleDisconnect} className="yt-btn-disconnect">
                                    Disconnect
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="yt-error">
                        ⚠️ {error}
                        <button className="yt-error-close" onClick={() => setError('')}>✕</button>
                    </div>
                )}

                {/* Connect Section */}
                {!channelId ? (
                    <div className="yt-connect-section">
                        <div className="yt-connect-card">
                            <div className="yt-connect-icon">
                                <svg viewBox="0 0 90 20" className="yt-connect-logo">
                                    <path d="M27.97 3.12a3.57 3.57 0 00-2.54-2.53C23.36 0 14.39 0 14.39 0S5.42 0 3.36.59A3.57 3.57 0 00.82 3.12C.2 5.17.2 10 .2 10s0 4.83.62 6.88a3.57 3.57 0 002.54 2.53c2.06.59 10.03.59 10.03.59s8.97 0 11.04-.59a3.57 3.57 0 002.54-2.53c.62-2.05.62-6.88.62-6.88s0-4.83-.62-6.88z" fill="#FF0000" />
                                    <path d="M11.5 14.29l6.73-4.29-6.73-4.29v8.58z" fill="#fff" />
                                </svg>
                            </div>
                            <h1>Start Automating</h1>
                            <p>Connect your social accounts to unlock AI-powered management</p>
                            <div className="yt-dual-connect-actions">
                                <button
                                    onClick={handleConnect}
                                    disabled={loadingInsta || loadingYT}
                                    className="yt-btn-connect"
                                >
                                    {loadingYT ? '...' : (
                                        <>
                                            <span className="btn-icon">📺</span>
                                            Connect YouTube
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleConnectInstagram}
                                    disabled={loadingInsta || loadingYT}
                                    className="yt-btn-instagram-connect"
                                >
                                    {loadingInsta ? '...' : (
                                        <>
                                            <span className="btn-icon">📸</span>
                                            Connect Instagram
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="yt-main-content">
                        {/* Channel Profile */}
                        {profile && (
                            <div className="yt-profile-card">
                                <div className="yt-profile-header">
                                    <img
                                        src={profile.thumbnailUrl}
                                        alt={profile.title}
                                        className="yt-profile-avatar"
                                    />
                                    <div className="yt-profile-info">
                                        <h2>{profile.title}</h2>
                                        {profile.customUrl && <span className="yt-profile-handle">{profile.customUrl}</span>}
                                        <p className="yt-profile-desc">{profile.description?.substring(0, 150)}{profile.description?.length > 150 ? '...' : ''}</p>
                                    </div>
                                </div>
                                <div className="yt-profile-stats">
                                    <div className="yt-stat">
                                        <span className="yt-stat-value">{formatCount(profile.subscriberCount)}</span>
                                        <span className="yt-stat-label">Subscribers</span>
                                    </div>
                                    <div className="yt-stat">
                                        <span className="yt-stat-value">{formatCount(profile.videoCount)}</span>
                                        <span className="yt-stat-label">Videos</span>
                                    </div>
                                    <div className="yt-stat">
                                        <span className="yt-stat-value">{formatCount(profile.viewCount)}</span>
                                        <span className="yt-stat-label">Total Views</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Polling Status */}
                        {pollingActive && (
                            <div className="yt-polling-banner">
                                <span className="yt-polling-dot"></span>
                                Comment polling is active — checking for new comments every 60s
                            </div>
                        )}

                        {/* ==================== AUTO-REPLY SECTION ==================== */}
                        <div className="yt-auto-reply-section">
                            <div className="yt-section-header">
                                <h2>💬 Comment Auto-Reply</h2>
                                <div className={`yt-status-indicator ${autoReplyEnabled ? 'active' : 'inactive'}`}>
                                    {autoReplyEnabled ? '● Active' : '○ Inactive'}
                                </div>
                            </div>

                            <p className="yt-section-note">
                                YouTube uses polling (every 60s) to detect new comments — no webhooks needed. Auto-reply will start when you save with auto-reply enabled.
                            </p>

                            <div className="yt-settings-grid">
                                {/* Mode Selector */}
                                <div className="yt-mode-selector">
                                    <label className="yt-label">Reply Mode</label>
                                    <div className="yt-mode-cards">
                                        <div
                                            className={`yt-mode-card ${replyMode === 'reply_only' ? 'active' : ''}`}
                                            onClick={() => setReplyMode('reply_only')}
                                        >
                                            <span className="yt-mode-icon">💬</span>
                                            <span className="yt-mode-name">Reply Only</span>
                                            <span className="yt-mode-desc">Reply to all comments</span>
                                        </div>
                                        <div
                                            className={`yt-mode-card ${replyMode === 'reply_and_hide' ? 'active' : ''}`}
                                            onClick={() => setReplyMode('reply_and_hide')}
                                        >
                                            <span className="yt-mode-icon">🛡️</span>
                                            <span className="yt-mode-name">Smart Hide</span>
                                            <span className="yt-mode-desc">AI hides spam/toxic</span>
                                        </div>
                                        <div
                                            className={`yt-mode-card ${replyMode === 'ai_smart' ? 'active' : ''}`}
                                            onClick={() => setReplyMode('ai_smart')}
                                        >
                                            <span className="yt-mode-icon">🤖</span>
                                            <span className="yt-mode-name">AI Smart</span>
                                            <span className="yt-mode-desc">Persona-based replies</span>
                                        </div>
                                    </div>
                                    {replyMode === 'reply_and_hide' && (
                                        <p className="yt-mode-info">AI automatically detects spam & toxic comments and removes them. Genuine comments get a reply.</p>
                                    )}
                                    {replyMode === 'ai_smart' && (
                                        <p className="yt-mode-info">Short, human-like replies powered by AI. Random 10-50s delay for natural timing.</p>
                                    )}
                                </div>

                                {/* Enable Toggle */}
                                <div className="yt-setting-row">
                                    <label className="yt-toggle-label">
                                        <span>Enable Auto-Reply</span>
                                        <div
                                            className={`yt-toggle ${autoReplyEnabled ? 'on' : ''}`}
                                            onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                                        >
                                            <div className="yt-toggle-knob"></div>
                                        </div>
                                    </label>
                                </div>

                                {/* Delay Slider */}
                                <div className="yt-setting-row">
                                    <label>
                                        <span>Reply Delay (seconds)</span>
                                        <div className="yt-delay-group">
                                            <input
                                                type="range"
                                                min="5"
                                                max="300"
                                                value={autoReplyDelay}
                                                onChange={(e) => setAutoReplyDelay(parseInt(e.target.value))}
                                                className="yt-slider"
                                            />
                                            <span className="yt-delay-value">{autoReplyDelay}s</span>
                                        </div>
                                    </label>
                                </div>

                                {/* Reply Message */}
                                <div className="yt-setting-row">
                                    <label>
                                        <span>Reply Message</span>
                                        <textarea
                                            value={autoReplyMessage}
                                            onChange={(e) => setAutoReplyMessage(e.target.value)}
                                            placeholder="Leave empty to use AI-generated reply..."
                                            rows={3}
                                            maxLength={300}
                                            className="yt-textarea"
                                        />
                                        <span className="yt-char-count">{autoReplyMessage.length}/300</span>
                                    </label>
                                </div>

                                {/* Save Button */}
                                <div className="yt-setting-actions">
                                    <button
                                        onClick={saveAutoReplySettings}
                                        disabled={autoReplySaving}
                                        className="yt-btn-save"
                                    >
                                        {autoReplySaving ? 'Saving...' : '💾 Save Settings'}
                                    </button>
                                    {autoReplyStatus && (
                                        <span className={`yt-save-status ${autoReplyStatus.includes('Error') ? 'error' : 'success'}`}>
                                            {autoReplyStatus}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Auto-Reply Log */}
                            <div className="yt-log-section">
                                <div className="yt-log-header">
                                    <h3>📋 Comment Reply Log</h3>
                                    <div className="yt-log-actions">
                                        <button onClick={fetchAutoReplyLog} className="yt-btn-small">
                                            🔄 Refresh
                                        </button>
                                        {autoReplyLog.length > 0 && (
                                            <button onClick={clearAutoReplyLog} className="yt-btn-small yt-btn-danger">
                                                🗑️ Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {autoReplyLog.length === 0 ? (
                                    <p className="yt-log-empty">No auto-replies yet. Enable auto-reply and wait for comments on your videos.</p>
                                ) : (
                                    <div className="yt-log-list">
                                        {autoReplyLog.map((entry, i) => {
                                            const actionBadge = getActionBadge(entry.action);
                                            return (
                                                <div key={entry.commentId + '-' + i} className="yt-log-entry">
                                                    <div className="yt-log-top">
                                                        <span className="yt-log-username">{entry.commenterName}</span>
                                                        <div className="yt-log-badges">
                                                            <span className={`yt-log-action ${actionBadge.className}`}>
                                                                {actionBadge.icon} {actionBadge.text}
                                                            </span>
                                                            <span className={`yt-log-status ${getStatusBadgeClass(entry.status)}`}>
                                                                {entry.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="yt-log-comment">💬 "{entry.commentText}"</p>
                                                    <p className="yt-log-reply">↩️ "{entry.replyText}"</p>
                                                    {entry.error && <p className="yt-log-error">❌ {entry.error}</p>}
                                                    <span className="yt-log-time">
                                                        {entry.repliedAt
                                                            ? `Replied: ${new Date(entry.repliedAt).toLocaleString()}`
                                                            : `Scheduled: ${new Date(entry.scheduledAt).toLocaleString()}`
                                                        }
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ==================== VIDEOS SECTION ==================== */}
                        {videos.length > 0 && (
                            <div className="yt-videos-section">
                                <div className="yt-section-header">
                                    <h2>🎬 Recent Videos</h2>
                                    <button onClick={fetchVideos} className="yt-btn-small">🔄 Refresh</button>
                                </div>

                                <div className="yt-video-grid">
                                    {videos.map((video) => (
                                        <div
                                            key={video.id}
                                            className={`yt-video-card ${selectedVideo === video.id ? 'selected' : ''}`}
                                            onClick={() => fetchComments(video.id)}
                                        >
                                            <div className="yt-video-thumb">
                                                <img src={video.thumbnailUrl} alt={video.title} />
                                                <span className="yt-video-duration">{formatDuration(video.duration)}</span>
                                            </div>
                                            <div className="yt-video-info">
                                                <h4>{video.title}</h4>
                                                <div className="yt-video-stats">
                                                    <span>👁 {formatCount(video.viewCount)}</span>
                                                    <span>👍 {formatCount(video.likeCount)}</span>
                                                    <span>💬 {formatCount(video.commentCount)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ==================== COMMENTS SECTION ==================== */}
                        {selectedVideo && (
                            <div className="yt-comments-section">
                                <div className="yt-section-header">
                                    <h2>💬 Comments</h2>
                                    <button onClick={() => fetchComments(selectedVideo)} className="yt-btn-small">🔄 Refresh</button>
                                </div>

                                {comments.length === 0 ? (
                                    <p className="yt-log-empty">No comments yet on this video.</p>
                                ) : (
                                    <div className="yt-comments-list">
                                        {comments.map((comment) => (
                                            <div key={comment.commentId} className="yt-comment-card">
                                                <div className="yt-comment-header">
                                                    <img src={comment.authorProfileUrl} alt="" className="yt-comment-avatar" />
                                                    <div className="yt-comment-meta">
                                                        <span className="yt-comment-author">{comment.authorName}</span>
                                                        <span className="yt-comment-date">{new Date(comment.publishedAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="yt-comment-actions">
                                                        <button
                                                            className="yt-btn-tiny"
                                                            onClick={() => setReplyingTo(replyingTo === comment.commentId ? null : comment.commentId)}
                                                            title="Reply"
                                                        >
                                                            ↩️
                                                        </button>
                                                        <button
                                                            className="yt-btn-tiny yt-btn-warn"
                                                            onClick={() => moderateComment(comment.commentId, 'heldForReview')}
                                                            title="Hold for Review"
                                                        >
                                                            ⏸️
                                                        </button>
                                                        <button
                                                            className="yt-btn-tiny yt-btn-danger"
                                                            onClick={() => moderateComment(comment.commentId, 'rejected')}
                                                            title="Reject"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="yt-comment-text">{comment.text}</p>
                                                <div className="yt-comment-footer">
                                                    <span>👍 {comment.likeCount}</span>
                                                    <span>💬 {comment.totalReplyCount} replies</span>
                                                </div>

                                                {/* Inline Reply Form */}
                                                {replyingTo === comment.commentId && (
                                                    <div className="yt-reply-form">
                                                        <input
                                                            type="text"
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder="Write a reply..."
                                                            className="yt-reply-input"
                                                            onKeyDown={(e) => e.key === 'Enter' && sendReply(comment.commentId)}
                                                        />
                                                        <button
                                                            onClick={() => sendReply(comment.commentId)}
                                                            disabled={replySending || !replyText.trim()}
                                                            className="yt-btn-reply"
                                                        >
                                                            {replySending ? '...' : 'Reply'}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Existing Replies */}
                                                {comment.replies && comment.replies.length > 0 && (
                                                    <div className="yt-replies-list">
                                                        {comment.replies.map((reply) => (
                                                            <div key={reply.commentId} className="yt-reply-item">
                                                                <span className="yt-reply-author">{reply.authorName}</span>
                                                                <p className="yt-reply-text">{reply.text}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default YouTubeTest;
