import React, { useState, useEffect } from 'react';
import { analyticsService } from '../services/instagram';
import '../styles/Analytics.css';

const AnalyticsDashboard = () => {
    const [overview, setOverview] = useState(null);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadOverview();
    }, []);

    const loadOverview = async () => {
        try {
            const response = await analyticsService.getOverview();
            setOverview(response.overview);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            await analyticsService.syncInsights();
            await loadOverview();
            alert('Insights synced successfully!');
        } catch (error) {
            alert('Failed to sync: ' + error.error);
        } finally {
            setSyncing(false);
        }
    };

    if (!overview) {
        return <div className="loading">Loading analytics...</div>;
    }

    return (
        <div className="analytics-dashboard">
            <div className="dashboard-header">
                <h1>Analytics</h1>
                <button onClick={handleSync} disabled={syncing} className="btn-sync">
                    {syncing ? 'Syncing...' : 'Sync Latest Data'}
                </button>
            </div>

            <div className="metrics-grid">
                <div className="metric-card">
                    <h3>Followers</h3>
                    <p className="metric-value">{overview.currentFollowers?.toLocaleString()}</p>
                </div>
                <div className="metric-card">
                    <h3>Total Posts</h3>
                    <p className="metric-value">{overview.totalPosts}</p>
                </div>
                <div className="metric-card">
                    <h3>Impressions</h3>
                    <p className="metric-value">{overview.latestMetrics?.impressions?.toLocaleString() || '0'}</p>
                </div>
                <div className="metric-card">
                    <h3>Reach</h3>
                    <p className="metric-value">{overview.latestMetrics?.reach?.toLocaleString() || '0'}</p>
                </div>
                <div className="metric-card">
                    <h3>Profile Views</h3>
                    <p className="metric-value">{overview.latestMetrics?.profileViews?.toLocaleString() || '0'}</p>
                </div>
                <div className="metric-card">
                    <h3>Website Clicks</h3>
                    <p className="metric-value">{overview.latestMetrics?.websiteClicks?.toLocaleString() || '0'}</p>
                </div>
            </div>

            {overview.weeklyGrowth && overview.weeklyGrowth.length > 0 && (
                <div className="growth-section">
                    <h2>7-Day Follower Growth</h2>
                    <div className="growth-chart">
                        {overview.weeklyGrowth.map((data, idx) => (
                            <div key={idx} className="growth-bar">
                                <div className="bar" style={{ height: `${(data.followers / overview.currentFollowers) * 100}%` }}></div>
                                <span className="date">{new Date(data.date).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;
