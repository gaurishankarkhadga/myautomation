import React, { useState, useEffect } from 'react';
import './SimpleTest.css';

function SimpleTest() {
    const [profile, setProfile] = useState(null);
    const [media, setMedia] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [userId, setUserId] = useState(null);

    // Check if we got redirected back with token
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('access_token');
        const id = params.get('user_id');
        const errorParam = params.get('error');

        if (errorParam) {
            setError(decodeURIComponent(errorParam));
        } else if (token && id) {
            setAccessToken(token);
            setUserId(id);
            fetchProfile(token, id);
        }
    }, []);

    const fetchProfile = async (token, id) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`http://localhost:5000/api/instagram-test/profile?access_token=${token}&user_id=${id}`);
            const data = await response.json();

            if (data.success) {
                setProfile(data.profile);
                setMedia(data.media);
            } else {
                setError(data.error || 'Failed to fetch profile');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        // Redirect to backend OAuth route
        window.location.href = 'http://localhost:5000/api/instagram-test/auth';
    };

    return (
        <div className="simple-test-container">
            <div className="test-card">
                <h1>📸 Instagram Graph API Test</h1>
                <p className="subtitle">Simple test to check if your Graph API credentials are working</p>

                {!accessToken && !error && (
                    <div className="connect-section">
                        <button onClick={handleConnect} className="connect-btn">
                            Connect Instagram
                        </button>
                        <p className="note">Click to test Instagram Graph API connection</p>
                    </div>
                )}

                {loading && (
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Fetching Instagram data...</p>
                    </div>
                )}

                {error && (
                    <div className="error-box">
                        <h3>❌ Error</h3>
                        <p>{error}</p>
                        <button onClick={() => window.location.href = '/'} className="retry-btn">
                            Try Again
                        </button>
                    </div>
                )}

                {profile && (
                    <div className="success-section">
                        <div className="success-badge">
                            <h2>✅ Graph API is Working!</h2>
                        </div>

                        <div className="profile-card">
                            <h3>📊 Profile Information</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <span className="label">User ID:</span>
                                    <span className="value">{profile.id}</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Username:</span>
                                    <span className="value">@{profile.username}</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Account Type:</span>
                                    <span className="value">{profile.account_type || 'Personal'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Media Count:</span>
                                    <span className="value">{profile.media_count || 0}</span>
                                </div>
                            </div>
                        </div>

                        {media.length > 0 && (
                            <div className="media-section">
                                <h3>🖼️ Recent Media ({media.length})</h3>
                                <div className="media-grid">
                                    {media.map((item) => (
                                        <div key={item.id} className="media-item">
                                            <img
                                                src={item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url}
                                                alt={item.caption || 'Instagram post'}
                                            />
                                            <p className="media-type">{item.media_type}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="token-info">
                            <h4>🔑 Access Token (Long-lived)</h4>
                            <code>{accessToken.substring(0, 40)}...</code>
                            <p className="note">Token saved! You can now build more features.</p>
                        </div>

                        <button onClick={() => window.location.href = '/'} className="retry-btn">
                            Test Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SimpleTest;
