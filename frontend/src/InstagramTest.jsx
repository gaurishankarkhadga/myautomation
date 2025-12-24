import { useState, useEffect } from 'react';
import './InstagramTest.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
console.log(import.meta.env.VITE_API_BASE_URL);
function InstagramTest() {
    const [token, setToken] = useState('');
    const [userId, setUserId] = useState('');
    const [profile, setProfile] = useState(null);
    const [media, setMedia] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
        if (token) {
            fetchProfile();
        }
    }, [token]);

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
