import React from 'react';
import '../styles/Instagram.css';

const InstaProfile = ({ profile, onDisconnect }) => {
    if (!profile) return null;

    return (
        <div className="instagram-status connected">
            <div className="profile-header">
                <img
                    src={profile.profile_picture_url}
                    alt={profile.username}
                    className="profile-pic"
                />
                <div className="profile-info">
                    <h2>@{profile.username}</h2>
                    <p className="account-type">{profile.account_type}</p>
                    {profile.biography && <p className="bio">{profile.biography}</p>}
                </div>
            </div>

            <div className="stats">
                <div className="stat">
                    <span className="stat-value">{profile.media_count}</span>
                    <span className="stat-label">Posts</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{profile.followers_count?.toLocaleString()}</span>
                    <span className="stat-label">Followers</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{profile.follows_count?.toLocaleString()}</span>
                    <span className="stat-label">Following</span>
                </div>
            </div>

            <button onClick={onDisconnect} className="btn-disconnect">
                Disconnect Instagram
            </button>
        </div>
    );
};

export default InstaProfile;
