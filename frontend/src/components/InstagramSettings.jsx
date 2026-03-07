import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import InstaProfile from './InstaProfile';
import BrandDeals from './BrandDeals';
import ToastNotification, { useToasts } from './ToastNotification';
import './InstagramSettings.css';



// #this is done by me

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function InstagramSettings() {
    const [token, setToken] = useState('');
    const [userId, setUserId] = useState('');
    const [profile, setProfile] = useState(null);
    const [media, setMedia] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingInsta, setLoadingInsta] = useState(false);
    const [loadingYT, setLoadingYT] = useState(false);
    const [error, setError] = useState('');

    const { toasts, addToast, removeToast } = useToasts();

    // Comment auto-reply state
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
    const [autoReplyDelay, setAutoReplyDelay] = useState(10);
    const [autoReplyMessage, setAutoReplyMessage] = useState('Thanks for your comment! 🙏');
    const [autoReplyLog, setAutoReplyLog] = useState([]);
    const [autoReplySaving, setAutoReplySaving] = useState(false);
    const [autoReplyStatus, setAutoReplyStatus] = useState('');
    const [replyMode, setReplyMode] = useState('reply_only');
    const [viralTagEnabled, setViralTagEnabled] = useState(false);

    // DM auto-reply state
    const [dmAutoReplyEnabled, setDmAutoReplyEnabled] = useState(false);
    const [dmAutoReplyDelay, setDmAutoReplyDelay] = useState(10);
    const [dmAutoReplyMessage, setDmAutoReplyMessage] = useState('Thanks for reaching out! I will get back to you shortly.');
    const [dmAutoReplyLog, setDmAutoReplyLog] = useState([]);
    const [dmAutoReplySaving, setDmAutoReplySaving] = useState(false);
    const [dmAutoReplyStatus, setDmAutoReplyStatus] = useState('');
    const [dmReplyMode, setDmReplyMode] = useState('static');
    const [storyMentionEnabled, setStoryMentionEnabled] = useState(false);
    const [storyMentionMessage, setStoryMentionMessage] = useState('Thank you so much for the mention! ❤️');
    const [inboxTriageEnabled, setInboxTriageEnabled] = useState(false);

    // Creator assets state
    const [creatorAssets, setCreatorAssets] = useState([]);
    const [showAssetForm, setShowAssetForm] = useState(false);
    const [assetSaving, setAssetSaving] = useState(false);
    const [editingAssetId, setEditingAssetId] = useState(null);
    const [assetForm, setAssetForm] = useState({
        type: 'product',
        title: '',
        description: '',
        url: '',
        imageUrl: '',
        price: '',
        tags: '',
        isDefault: false,
        priority: 0
    });

    // Webhook subscription state
    const [webhookStatus, setWebhookStatus] = useState('');
    const [webhookLoading, setWebhookLoading] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tokenParam = params.get('token');
        const userIdParam = params.get('userId');
        const errorParam = params.get('error');

        if (errorParam) {
            setError(`OAuth Error: ${errorParam}`);
        } else if (tokenParam && userIdParam) {
            // Save to localStorage
            localStorage.setItem('insta_token', tokenParam);
            localStorage.setItem('insta_user_id', userIdParam);

            setToken(tokenParam);
            setUserId(userIdParam);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            // Check localStorage
            const storedToken = localStorage.getItem('insta_token');
            const storedUserId = localStorage.getItem('insta_user_id');

            if (storedToken && storedUserId) {
                setToken(storedToken);
                setUserId(storedUserId);
            }
        }
    }, []);

    useEffect(() => {
        if (token && userId) {
            fetchProfile();
            fetchAutoReplySettings();
            fetchAutoReplyLog();
            fetchDmAutoReplySettings();
            fetchDmAutoReplyLog();
            fetchCreatorAssets();
        }
    }, [token, userId]);

    const handleConnect = async () => {
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

    const handleConnectYouTube = async () => {
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

    const handleDisconnect = () => {
        setToken('');
        setUserId('');
        setProfile(null);
        setMedia(null);
        localStorage.removeItem('insta_token');
        localStorage.removeItem('insta_user_id');
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

    // ==================== WEBHOOK SUBSCRIPTION ====================

    const subscribeWebhooks = async () => {
        try {
            setWebhookLoading(true);

            const response = await fetch(`${API_BASE_URL}/api/instagram/subscribe-webhooks?token=${token}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                addToast({ type: 'success', title: 'Success', message: 'Webhooks subscribed successfully! Comments & DM events will now be received.' });
            } else {
                addToast({ type: 'error', title: 'Error', message: data.error || data.message });
            }
        } catch (err) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setWebhookLoading(false);
        }
    };

    // ==================== COMMENT AUTO-REPLY FUNCTIONS ====================

    const fetchAutoReplySettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/auto-reply/settings?userId=${userId}`);
            const data = await response.json();

            if (data.success) {
                setAutoReplyEnabled(data.data.enabled);
                setAutoReplyDelay(data.data.delaySeconds);
                setAutoReplyMessage(data.data.message);
                setReplyMode(data.data.replyMode || 'reply_only');
                setViralTagEnabled(data.data.viralTagEnabled || false);
            }
        } catch (err) {
            console.error('Failed to fetch auto-reply settings:', err);
        }
    };

    const saveAutoReplySettings = async () => {
        try {
            setAutoReplySaving(true);

            const response = await fetch(`${API_BASE_URL}/api/instagram/auto-reply/settings?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    enabled: autoReplyEnabled,
                    delaySeconds: autoReplyDelay,
                    message: autoReplyMessage,
                    replyMode: replyMode,
                    viralTagEnabled
                })
            });

            const data = await response.json();

            if (data.success) {
                addToast({ type: 'success', title: 'Saved', message: 'Settings saved successfully!' });
            } else {
                addToast({ type: 'error', title: 'Error', message: data.error });
            }
        } catch (err) {
            addToast({ type: 'error', title: 'Error', message: err.message });
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
                addToast({ type: 'info', title: 'Cleared', message: 'Log cleared' });
            }
        } catch (err) {
            console.error('Failed to clear log:', err);
        }
    };

    // ==================== DM AUTO-REPLY FUNCTIONS ====================

    const fetchDmAutoReplySettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/dm-auto-reply/settings?userId=${userId}`);
            const data = await response.json();

            if (data.success) {
                setDmAutoReplyEnabled(data.data.enabled);
                setDmAutoReplyDelay(data.data.delaySeconds);
                setDmAutoReplyMessage(data.data.message);
                setDmReplyMode(data.data.replyMode || 'static');
                setStoryMentionEnabled(data.data.storyMentionEnabled || false);
                setStoryMentionMessage(data.data.storyMentionMessage || 'Thank you so much for the mention! ❤️');
                setInboxTriageEnabled(data.data.inboxTriageEnabled || false);
            }
        } catch (err) {
            console.error('Failed to fetch DM auto-reply settings:', err);
        }
    };

    const saveDmAutoReplySettings = async () => {
        try {
            setDmAutoReplySaving(true);

            const response = await fetch(`${API_BASE_URL}/api/instagram/dm-auto-reply/settings?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    enabled: dmAutoReplyEnabled,
                    delaySeconds: dmAutoReplyDelay,
                    message: dmAutoReplyMessage,
                    replyMode: dmReplyMode,
                    storyMentionEnabled,
                    storyMentionMessage,
                    inboxTriageEnabled
                })
            });

            const data = await response.json();

            if (data.success) {
                addToast({ type: 'success', title: 'Saved', message: 'DM auto-reply settings saved!' });
            } else {
                addToast({ type: 'error', title: 'Error', message: data.error });
            }
        } catch (err) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setDmAutoReplySaving(false);
        }
    };

    const fetchDmAutoReplyLog = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/dm-auto-reply/log?limit=20`);
            const data = await response.json();

            if (data.success) {
                setDmAutoReplyLog(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch DM auto-reply log:', err);
        }
    };

    const clearDmAutoReplyLog = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/dm-auto-reply/log`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                setDmAutoReplyLog([]);
                addToast({ type: 'info', title: 'Cleared', message: 'DM log cleared' });
            }
        } catch (err) {
            console.error('Failed to clear DM log:', err);
        }
    };

    const getStatusBadgeClass = (status) => {
        if (status === 'sent') return 'badge-success';
        if (status === 'pending') return 'badge-pending';
        if (status === 'failed') return 'badge-error';
        return '';
    };

    const getActionBadge = (action) => {
        if (action === 'hidden') return { icon: '🛡️', text: 'Hidden', className: 'badge-hidden' };
        if (action === 'skipped') return { icon: '⏭️', text: 'Skipped', className: 'badge-skipped' };
        return { icon: '💬', text: 'Replied', className: 'badge-replied' };
    };

    const getAssetTypeIcon = (type) => {
        const icons = { product: '📦', link: '🔗', course: '📚', image: '🖼️', service: '⚙️', ebook: '📖', merch: '👕' };
        return icons[type] || '📎';
    };

    const getReplyTypeLabel = (type) => {
        const labels = { text: '💬 Text', text_with_link: '🔗 Text + Link', image: '🖼️ Image', product_recommendation: '📦 Product' };
        return labels[type] || '💬 Text';
    };

    // ==================== CREATOR ASSETS FUNCTIONS ====================

    const fetchCreatorAssets = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/creator-assets?userId=${userId}`);
            const data = await response.json();
            if (data.success) setCreatorAssets(data.data);
        } catch (err) {
            console.error('Failed to fetch assets:', err);
        }
    };

    const resetAssetForm = () => {
        setAssetForm({ type: 'product', title: '', description: '', url: '', imageUrl: '', price: '', tags: '', isDefault: false, priority: 0 });
        setEditingAssetId(null);
        setShowAssetForm(false);
    };

    const saveAsset = async () => {
        if (!assetForm.title.trim()) return;
        try {
            setAssetSaving(true);
            const payload = {
                ...assetForm,
                userId,
                tags: assetForm.tags ? assetForm.tags.split(',').map(t => t.trim()).filter(Boolean) : []
            };

            let response;
            if (editingAssetId) {
                response = await fetch(`${API_BASE_URL}/api/instagram/creator-assets/${editingAssetId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await fetch(`${API_BASE_URL}/api/instagram/creator-assets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await response.json();
            if (data.success) {
                fetchCreatorAssets();
                resetAssetForm();
            }
        } catch (err) {
            console.error('Failed to save asset:', err);
        } finally {
            setAssetSaving(false);
        }
    };

    const editAsset = (asset) => {
        setAssetForm({
            type: asset.type,
            title: asset.title,
            description: asset.description || '',
            url: asset.url || '',
            imageUrl: asset.imageUrl || '',
            price: asset.price || '',
            tags: (asset.tags || []).join(', '),
            isDefault: asset.isDefault || false,
            priority: asset.priority || 0
        });
        setEditingAssetId(asset._id);
        setShowAssetForm(true);
    };

    const deleteAsset = async (assetId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/creator-assets/${assetId}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) fetchCreatorAssets();
        } catch (err) {
            console.error('Failed to delete asset:', err);
        }
    };

    const toggleAssetActive = async (asset) => {
        try {
            await fetch(`${API_BASE_URL}/api/instagram/creator-assets/${asset._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !asset.isActive })
            });
            fetchCreatorAssets();
        } catch (err) {
            console.error('Failed to toggle asset:', err);
        }
    };

    return (
        <div className="instagram-settings-tab">
            <ToastNotification toasts={toasts} onRemove={removeToast} />
            <div className="container">
                {error && (
                    <div className="error">
                        Error: {error}
                    </div>
                )}

                {!token ? (
                    <div className="connect-section" style={{ textAlign: 'center', padding: '40px' }}>
                        <h2>Not Connected</h2>
                        <p>Connect your Instagram account in the ChatHub to access these settings.</p>
                    </div>
                ) : (
                    <div className="data-section">
                        <div className="token-info">
                            <div className="token-main">
                                <p><strong>Instagram Connected</strong></p>
                                <p className="user-id">User ID: {userId}</p>
                            </div>
                            <div className="token-actions">
                                <button onClick={handleDisconnect} className="btn-secondary">
                                    Disconnect
                                </button>
                            </div>
                        </div>

                        {/* ==================== WEBHOOK SUBSCRIPTION ==================== */}
                        <div className="webhook-section">
                            <div className="webhook-header">
                                <h2>📡 Webhook Subscription</h2>
                                <p className="webhook-desc">Subscribe to receive comment and DM events from Instagram. This is required before auto-reply can work.</p>
                            </div>
                            <div className="webhook-actions">
                                <button
                                    onClick={subscribeWebhooks}
                                    disabled={webhookLoading}
                                    className="btn-webhook"
                                >
                                    {webhookLoading ? 'Subscribing...' : '🔔 Subscribe to Webhooks'}
                                </button>
                            </div>
                        </div>

                        <div className="actions">
                            <button onClick={fetchProfile} disabled={loading} className="btn">
                                {loading ? 'Loading...' : 'Fetch Profile'}
                            </button>
                            <button onClick={fetchMedia} disabled={loading} className="btn">
                                {loading ? 'Loading...' : 'Fetch Media'}
                            </button>
                        </div>

                        <InstaProfile
                            profile={profile}
                            onDisconnect={handleDisconnect}
                        />

                        {/* ==================== COMMENT AUTO-REPLY SECTION ==================== */}
                        <div className="auto-reply-section">
                            <div className="auto-reply-header">
                                <h2>💬 Auto-Reply to Comments</h2>
                                <div className={`status-indicator ${autoReplyEnabled ? 'active' : 'inactive'}`}>
                                    {autoReplyEnabled ? '● Active' : '○ Inactive'}
                                </div>
                            </div>

                            <div className="auto-reply-settings">
                                {/* Mode Selector */}
                                <div className="mode-selector">
                                    <label className="mode-label">Reply Mode</label>
                                    <div className="mode-cards">
                                        <div
                                            className={`mode-card ${replyMode === 'reply_only' ? 'active' : ''}`}
                                            onClick={() => setReplyMode('reply_only')}
                                        >
                                            <span className="mode-icon">💬</span>
                                            <span className="mode-name">Reply Only</span>
                                            <span className="mode-desc">Reply to all comments</span>
                                        </div>
                                        <div
                                            className={`mode-card ${replyMode === 'reply_and_hide' ? 'active' : ''}`}
                                            onClick={() => setReplyMode('reply_and_hide')}
                                        >
                                            <span className="mode-icon">🛡️</span>
                                            <span className="mode-name">Smart Hide</span>
                                            <span className="mode-desc">AI hides spam/toxic</span>
                                        </div>
                                        <div
                                            className={`mode-card ${replyMode === 'ai_smart' ? 'active' : ''}`}
                                            onClick={() => setReplyMode('ai_smart')}
                                        >
                                            <span className="mode-icon">🤖</span>
                                            <span className="mode-name">AI Smart</span>
                                            <span className="mode-desc">Persona-based replies</span>
                                        </div>
                                    </div>
                                    {replyMode === 'reply_and_hide' && (
                                        <p className="mode-info">AI automatically detects spam & toxic comments and hides them. Genuine comments get a reply.</p>
                                    )}
                                    {replyMode === 'ai_smart' && (
                                        <p className="mode-info">Short, human-like replies based on your creator persona. Random 10-50s delay for natural timing.</p>
                                    )}
                                </div>

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
                                            placeholder="Leave empty to use AI-generated reply..."
                                            rows={3}
                                            maxLength={300}
                                            className="reply-textarea"
                                        />
                                        <span className="char-count">{autoReplyMessage.length}/300</span>
                                    </label>
                                </div>

                                <div className="dm-divider"></div>

                                <h3>🚀 Viral Tag Auto-Reply (AI)</h3>
                                <p className="mode-info">Automatically reply 24h later to users who tag you in a viral comment section to engage fans naturally.</p>
                                <div className="setting-row">
                                    <label className="toggle-label">
                                        <span>Enable Viral Tag Replies</span>
                                        <div className={`toggle-switch ${viralTagEnabled ? 'on' : ''}`} onClick={() => setViralTagEnabled(!viralTagEnabled)}>
                                            <div className="toggle-knob"></div>
                                        </div>
                                    </label>
                                </div>

                                <div className="setting-actions">
                                    <button
                                        onClick={saveAutoReplySettings}
                                        disabled={autoReplySaving}
                                        className="btn-save"
                                    >
                                        {autoReplySaving ? 'Saving...' : '💾 Save Settings'}
                                    </button>
                                </div>
                            </div>

                            {/* Comment Auto-Reply Log */}
                            <div className="auto-reply-log">
                                <div className="log-header">
                                    <h3>📋 Comment Reply Log</h3>
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
                                    <p className="log-empty">No comment auto-replies yet. Enable auto-reply and wait for comments on your posts.</p>
                                ) : (
                                    <div className="log-list">
                                        {autoReplyLog.map((entry, i) => {
                                            const actionBadge = getActionBadge(entry.action);
                                            return (
                                                <div key={entry.commentId + '-' + i} className="log-entry">
                                                    <div className="log-entry-top">
                                                        <span className="log-username">@{entry.commenterUsername}</span>
                                                        <div className="log-badges">
                                                            <span className={`log-action ${actionBadge.className}`}>
                                                                {actionBadge.icon} {actionBadge.text}
                                                            </span>
                                                            <span className={`log-status ${getStatusBadgeClass(entry.status)}`}>
                                                                {entry.status}
                                                            </span>
                                                        </div>
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
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ==================== DM AUTO-REPLY SECTION ==================== */}
                        <div className="auto-reply-section dm-section">
                            <div className="auto-reply-header">
                                <h2>✉️ AI-Powered DM Auto-Reply</h2>
                                <div className={`status-indicator ${dmAutoReplyEnabled ? 'active' : 'inactive'}`}>
                                    {dmAutoReplyEnabled ? '● Active' : '○ Inactive'}
                                </div>
                            </div>

                            <p className="dm-note">AI-powered auto-reply to DMs. Responds naturally as YOU — can share your products, links, and courses based on what the user needs.</p>

                            <div className="auto-reply-settings">
                                <div className="mode-selector">
                                    <label className="mode-label">DM Reply Mode</label>
                                    <div className="mode-cards">
                                        <div className={`mode-card ${dmReplyMode === 'static' ? 'active' : ''}`} onClick={() => setDmReplyMode('static')}>
                                            <span className="mode-icon">💬</span>
                                            <span className="mode-name">Static</span>
                                            <span className="mode-desc">Fixed message</span>
                                        </div>
                                        <div className={`mode-card ${dmReplyMode === 'ai_smart' ? 'active' : ''}`} onClick={() => setDmReplyMode('ai_smart')}>
                                            <span className="mode-icon">🤖</span>
                                            <span className="mode-name">AI Smart</span>
                                            <span className="mode-desc">Mimics your style</span>
                                        </div>
                                        <div className={`mode-card ${dmReplyMode === 'ai_with_assets' ? 'active' : ''}`} onClick={() => setDmReplyMode('ai_with_assets')}>
                                            <span className="mode-icon">🎯</span>
                                            <span className="mode-name">AI + Assets</span>
                                            <span className="mode-desc">Share products & links</span>
                                        </div>
                                    </div>
                                    {dmReplyMode === 'ai_smart' && (
                                        <p className="mode-info">🤖 AI researches your online presence and mimics your exact communication style.</p>
                                    )}
                                    {dmReplyMode === 'ai_with_assets' && (
                                        <p className="mode-info">🎯 AI detects what users want and shares your products, links & courses. Set default assets for random DMs below.</p>
                                    )}
                                </div>

                                <div className="setting-row">
                                    <label className="toggle-label">
                                        <span>Enable DM Auto-Reply</span>
                                        <div className={`toggle-switch ${dmAutoReplyEnabled ? 'on' : ''}`} onClick={() => setDmAutoReplyEnabled(!dmAutoReplyEnabled)}>
                                            <div className="toggle-knob"></div>
                                        </div>
                                    </label>
                                </div>

                                <div className="setting-row">
                                    <label>
                                        <span>Reply Delay (seconds)</span>
                                        <div className="delay-input-group">
                                            <input type="range" min="5" max="300" value={dmAutoReplyDelay} onChange={(e) => setDmAutoReplyDelay(parseInt(e.target.value))} className="delay-slider" />
                                            <span className="delay-value">{dmAutoReplyDelay}s</span>
                                        </div>
                                    </label>
                                </div>

                                {dmReplyMode === 'static' && (
                                    <div className="setting-row">
                                        <label>
                                            <span>DM Reply Message</span>
                                            <textarea value={dmAutoReplyMessage} onChange={(e) => setDmAutoReplyMessage(e.target.value)} placeholder="Your static reply message..." rows={3} maxLength={1000} className="reply-textarea" />
                                            <span className="char-count">{dmAutoReplyMessage.length}/1000</span>
                                        </label>
                                    </div>
                                )}

                                <div className="dm-divider"></div>

                                <h3>📸 Story Mentions</h3>
                                <p className="mode-info">Automatically send a short thank-you message when someone mentions you in their story.</p>
                                <div className="setting-row">
                                    <label className="toggle-label">
                                        <span>Log Story Mentions & Auto-Reply</span>
                                        <div className={`toggle-switch ${storyMentionEnabled ? 'on' : ''}`} onClick={() => setStoryMentionEnabled(!storyMentionEnabled)}>
                                            <div className="toggle-knob"></div>
                                        </div>
                                    </label>
                                </div>

                                {storyMentionEnabled && (
                                    <div className="setting-row">
                                        <label>
                                            <span>Story Mention Reply Message</span>
                                            <input type="text" value={storyMentionMessage} onChange={(e) => setStoryMentionMessage(e.target.value)} placeholder="Thank you so much for the mention! ❤️" maxLength={200} className="reply-input" />
                                        </label>
                                    </div>
                                )}

                                <div className="dm-divider"></div>

                                <h3>📥 Inbox Zero AI Triage</h3>
                                <p className="mode-info">Automatically categorize DMs with priority tags (Collab, Fan Mail, etc.) using Gemini AI.</p>
                                <div className="setting-row">
                                    <label className="toggle-label">
                                        <span>Enable AI Triage</span>
                                        <div className={`toggle-switch ${inboxTriageEnabled ? 'on' : ''}`} onClick={() => setInboxTriageEnabled(!inboxTriageEnabled)}>
                                            <div className="toggle-knob"></div>
                                        </div>
                                    </label>
                                </div>

                                <div className="setting-actions">
                                    <button onClick={saveDmAutoReplySettings} disabled={dmAutoReplySaving} className="btn-save">
                                        {dmAutoReplySaving ? 'Saving...' : '💾 Save DM Settings'}
                                    </button>
                                </div>
                            </div>

                            {/* Creator Assets Manager */}
                            {dmReplyMode === 'ai_with_assets' && (
                                <div className="assets-section">
                                    <div className="assets-header">
                                        <h3>📦 Your Products, Links & Courses</h3>
                                        <button onClick={() => { resetAssetForm(); setShowAssetForm(!showAssetForm); }} className="btn-small btn-add-asset">
                                            {showAssetForm ? '✕ Cancel' : '+ Add Asset'}
                                        </button>
                                    </div>
                                    <p className="assets-desc">Add your products, links, and courses. AI will share them based on user intent. Mark as "Default" for random DMs.</p>

                                    {showAssetForm && (
                                        <div className="asset-form">
                                            <div className="asset-form-grid">
                                                <div className="form-group">
                                                    <label>Type</label>
                                                    <select value={assetForm.type} onChange={e => setAssetForm({ ...assetForm, type: e.target.value })}>
                                                        <option value="product">📦 Product</option>
                                                        <option value="link">🔗 Link</option>
                                                        <option value="course">📚 Course</option>
                                                        <option value="image">🖼️ Image</option>
                                                        <option value="service">⚙️ Service</option>
                                                        <option value="ebook">📖 E-Book</option>
                                                        <option value="merch">👕 Merch</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>Title *</label>
                                                    <input type="text" value={assetForm.title} onChange={e => setAssetForm({ ...assetForm, title: e.target.value })} placeholder="My Fitness E-Book" maxLength={200} />
                                                </div>
                                                <div className="form-group form-full">
                                                    <label>Description</label>
                                                    <input type="text" value={assetForm.description} onChange={e => setAssetForm({ ...assetForm, description: e.target.value })} placeholder="12-week transformation guide" maxLength={500} />
                                                </div>
                                                <div className="form-group">
                                                    <label>URL</label>
                                                    <input type="url" value={assetForm.url} onChange={e => setAssetForm({ ...assetForm, url: e.target.value })} placeholder="https://..." />
                                                </div>
                                                <div className="form-group">
                                                    <label>Image URL</label>
                                                    <input type="url" value={assetForm.imageUrl} onChange={e => setAssetForm({ ...assetForm, imageUrl: e.target.value })} placeholder="https://...image.jpg" />
                                                </div>
                                                <div className="form-group">
                                                    <label>Price</label>
                                                    <input type="text" value={assetForm.price} onChange={e => setAssetForm({ ...assetForm, price: e.target.value })} placeholder="$29.99" />
                                                </div>
                                                <div className="form-group">
                                                    <label>Tags (comma separated)</label>
                                                    <input type="text" value={assetForm.tags} onChange={e => setAssetForm({ ...assetForm, tags: e.target.value })} placeholder="fitness, workout, ebook" />
                                                </div>
                                                <div className="form-group form-inline">
                                                    <label className="toggle-label">
                                                        <span>Default (send on random DMs)</span>
                                                        <div className={`toggle-switch ${assetForm.isDefault ? 'on' : ''}`} onClick={() => setAssetForm({ ...assetForm, isDefault: !assetForm.isDefault })}>
                                                            <div className="toggle-knob"></div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                            <button onClick={saveAsset} disabled={assetSaving || !assetForm.title.trim()} className="btn-save">
                                                {assetSaving ? 'Saving...' : editingAssetId ? '✏️ Update Asset' : '➕ Add Asset'}
                                            </button>
                                        </div>
                                    )}

                                    {creatorAssets.length === 0 ? (
                                        <p className="log-empty">No assets yet. Add your products, links, and courses for AI to share in DMs.</p>
                                    ) : (
                                        <div className="asset-list">
                                            {creatorAssets.map(asset => (
                                                <div key={asset._id} className={`asset-card ${!asset.isActive ? 'asset-inactive' : ''}`}>
                                                    <div className="asset-card-top">
                                                        <span className="asset-type-icon">{getAssetTypeIcon(asset.type)}</span>
                                                        <div className="asset-info">
                                                            <span className="asset-title">{asset.title}</span>
                                                            {asset.description && <span className="asset-desc">{asset.description}</span>}
                                                        </div>
                                                        <div className="asset-badges">
                                                            {asset.isDefault && <span className="badge-default">⭐ Default</span>}
                                                            <span className={`badge-type badge-${asset.type}`}>{asset.type}</span>
                                                        </div>
                                                    </div>
                                                    {asset.url && <span className="asset-url">🔗 {asset.url}</span>}
                                                    {asset.price && <span className="asset-price">💰 {asset.price}</span>}
                                                    {asset.tags && asset.tags.length > 0 && (
                                                        <div className="asset-tags">
                                                            {asset.tags.map((tag, ti) => <span key={ti} className="asset-tag">{tag}</span>)}
                                                        </div>
                                                    )}
                                                    <div className="asset-actions">
                                                        <button onClick={() => toggleAssetActive(asset)} className="btn-tiny">{asset.isActive ? '🟢 Active' : '⏸️ Paused'}</button>
                                                        <button onClick={() => editAsset(asset)} className="btn-tiny">✏️ Edit</button>
                                                        <button onClick={() => deleteAsset(asset._id)} className="btn-tiny btn-danger">🗑️</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* DM Auto-Reply Log */}
                            <div className="auto-reply-log">
                                <div className="log-header">
                                    <h3>📋 DM Reply Log</h3>
                                    <div className="log-actions">
                                        <button onClick={fetchDmAutoReplyLog} className="btn-small">🔄 Refresh</button>
                                        {dmAutoReplyLog.length > 0 && (
                                            <button onClick={clearDmAutoReplyLog} className="btn-small btn-danger">🗑️ Clear</button>
                                        )}
                                    </div>
                                </div>
                                {dmAutoReplyLog.length === 0 ? (
                                    <p className="log-empty">No DM auto-replies yet. Enable auto-reply and wait for incoming messages.</p>
                                ) : (
                                    <div className="log-list">
                                        {dmAutoReplyLog.map((entry, i) => (
                                            <div key={entry.senderId + '-' + i} className="log-entry">
                                                <div className="log-entry-top">
                                                    <span className="log-username">Sender: {entry.senderId}</span>
                                                    <div className="log-badges">
                                                        {entry.replyType && entry.replyType !== 'text' && (
                                                            <span className="log-reply-type">{getReplyTypeLabel(entry.replyType)}</span>
                                                        )}
                                                        <span className={`log-status ${getStatusBadgeClass(entry.status)}`}>{entry.status}</span>
                                                    </div>
                                                </div>
                                                <p className="log-comment">📩 "{entry.messageText}"</p>
                                                <p className="log-reply">↩️ "{entry.replyText}"</p>
                                                {entry.assetsShared && entry.assetsShared.length > 0 && (
                                                    <div className="log-assets-shared">
                                                        {entry.assetsShared.map((a, ai) => (
                                                            <span key={ai} className="log-asset-badge">{getAssetTypeIcon(a.assetType)} {a.assetTitle}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {entry.error && <p className="log-error">❌ {entry.error}</p>}
                                                <span className="log-time">
                                                    {entry.repliedAt ? `Replied: ${new Date(entry.repliedAt).toLocaleString()}` : `Scheduled: ${new Date(entry.scheduledAt).toLocaleString()}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>






                        {/* ==================== BRAND DEALS SECTION ==================== */}
                        <BrandDeals userId={userId} token={token} />

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
        </div >
    );
}

export default InstagramSettings;
