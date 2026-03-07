import React, { useState } from 'react';
import { Instagram, Youtube, Zap } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import '../styles/Connect.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function Connect() {
    const [loadingInsta, setLoadingInsta] = useState(false);
    const [loadingYT, setLoadingYT] = useState(false);
    const [error, setError] = useState('');

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
                setLoadingInsta(false);
            }
        } catch (err) {
            setError(`Connection error: ${err.message}`);
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
                setLoadingYT(false);
            }
        } catch (err) {
            setError(`Connection error: ${err.message}`);
            setLoadingYT(false);
        }
    };

    return (
        <div className="connect-page">
            <div className="connect-glass-panel">
                <div className="connect-brand">
                    <Zap size={36} strokeWidth={2} />
                    <h1>CreatorHub</h1>
                </div>
                <h2>Start Automating</h2>
                <p className="connect-subtitle">
                    Connect your social accounts to unlock your AI-powered management command center.
                </p>

                {error && <div className="connect-error">{error}</div>}

                <div className="connect-actions">
                    <button
                        className="connect-btn insta-btn"
                        onClick={handleConnectInstagram}
                        disabled={loadingInsta || loadingYT}
                    >
                        <Instagram size={20} />
                        <span>{loadingInsta ? 'Connecting...' : 'Connect Instagram'}</span>
                    </button>

                    <button
                        className="connect-btn yt-btn"
                        onClick={handleConnectYouTube}
                        disabled={loadingInsta || loadingYT}
                    >
                        <Youtube size={20} />
                        <span>{loadingYT ? 'Connecting...' : 'Connect YouTube'}</span>
                    </button>
                </div>
            </div>

            <footer className="connect-footer">
                <a href="/privacy-policy">Privacy Policy</a>
                <a href="/terms-and-conditions">Terms & Conditions</a>
                <a href="/data-deletion">Data Deletion</a>
            </footer>
        </div>
    );
}

export default Connect;
