import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Instagram, Youtube } from 'lucide-react';
import InstagramSettings from '../components/InstagramSettings';
import YouTubeSettings from '../components/YouTubeSettings';
import '../styles/AdvancedSettings.css';

function AdvancedSettings() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('instagram');

    // Automatically switch to the active platform if only one is connected
    useEffect(() => {
        const hasInsta = !!localStorage.getItem('insta_token');
        const hasYt = !!localStorage.getItem('yt_channel_id');

        if (hasYt && !hasInsta) {
            setActiveTab('youtube');
        } else if (hasInsta && !hasYt) {
            setActiveTab('instagram');
        }
    }, []);

    return (
        <div className="advanced-settings-page">
            <header className="settings-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/chat')}>
                        <ArrowLeft size={20} />
                        <span>Back to ChatHub</span>
                    </button>
                    <h1>Advanced Settings</h1>
                </div>
            </header>

            <main className="settings-content">
                <div className="settings-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'instagram' ? 'active' : ''}`}
                        onClick={() => setActiveTab('instagram')}
                    >
                        <Instagram size={18} />
                        <span>Instagram Automation</span>
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
                        onClick={() => setActiveTab('youtube')}
                    >
                        <Youtube size={18} />
                        <span>YouTube Automation</span>
                    </button>
                </div>

                <div className="tab-render-area">
                    {activeTab === 'instagram' && <InstagramSettings />}
                    {activeTab === 'youtube' && <YouTubeSettings />}
                </div>
            </main>
        </div>
    );
}

export default AdvancedSettings;
