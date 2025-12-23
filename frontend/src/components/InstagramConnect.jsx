import React, { useState, useEffect } from 'react';
import { instagramService } from '../services/instagram';
import '../styles/Instagram.css';

const InstagramConnect = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = async () => {
        try {
            const response = await instagramService.getProfile();
            if (response.success) {
                setIsConnected(true);
                setProfile(response.profile);
            }
        } catch (error) {
            setIsConnected(false);
        }
    };

    const handleConnect = async () => {
        try {
            setLoading(true);
            const { authUrl } = await instagramService.getAuthUrl();
            window.location.href = authUrl;
        } catch (error) {
            alert('Failed to initiate Instagram connection: ' + error.error);
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await instagramService.disconnect();
            setIsConnected(false);
            setProfile(null);
            alert('Instagram disconnected successfully');
        } catch (error) {
            alert('Failed to disconnect: ' + error.error);
        }
    };

    if (isConnected && profile) {
        return (
            <div className="instagram-status connected">
                <div className="profile-header">
                    <img src={profile.profilePicture} alt={profile.username} className="profile-pic" />
                    <div className="profile-info">
                        <h2>@{profile.username}</h2>
                        <p className="account-type">{profile.accountType} Account</p>
                    </div>
                </div>
                <div className="stats">
                    <div className="stat">
                        <span className="stat-value">{profile.followersCount?.toLocaleString()}</span>
                        <span className="stat-label">Followers</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value">{profile.followingCount?.toLocaleString()}</span>
                        <span className="stat-label">Following</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value">{profile.mediaCount}</span>
                        <span className="stat-label">Posts</span>
                    </div>
                </div>
                <button onClick={handleDisconnect} className="btn-disconnect">
                    Disconnect Instagram
                </button>
            </div>
        );
    }

    return (
        <div className="instagram-status disconnected">
            <div className="connect-card">
                <h2>Connect Your Instagram</h2>
                <p>Connect your Instagram Business or Creator account to start automating</p>
                <button onClick={handleConnect} disabled={loading} className="btn-connect">
                    {loading ? 'Connecting...' : 'Connect Instagram'}
                </button>
                <p className="note">Requires Business or Creator account</p>
            </div>
        </div>
    );
};

export default InstagramConnect;
