import { useState, useEffect } from 'react';
import '../styles/BrandDeals.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function BrandDeals({ userId, token }) {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [status, setStatus] = useState('');
    const [pollingInterval, setPollingInterval] = useState(null);
    const [outreachLoading, setOutreachLoading] = useState(null);
    const [outreachTemplate, setOutreachTemplate] = useState(null);
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortBy, setSortBy] = useState('matchScore');

    useEffect(() => {
        if (userId) {
            fetchResults();
        }
        return () => {
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, [userId]);

    const fetchResults = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/instagram/brand-deals/results?userId=${userId}`);
            const data = await response.json();

            if (data.success && data.hasResults) {
                setResults(data);
                if (data.status === 'completed' || data.status === 'failed') {
                    if (pollingInterval) {
                        clearInterval(pollingInterval);
                        setPollingInterval(null);
                    }
                    setLoading(false);
                }
            }
        } catch (err) {
            console.error('Failed to fetch brand deal results:', err);
        }
    };

    const startAnalysis = async () => {
        try {
            setLoading(true);
            setStatus('Analyzing your content and searching for brand deals...');
            setOutreachTemplate(null);

            const response = await fetch(`${API_BASE_URL}/api/instagram/brand-deals/analyze?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await response.json();

            if (data.success) {
                setStatus('Analysis in progress — searching the web for brand deals...');

                // Poll for results every 5 seconds
                const interval = setInterval(fetchResults, 5000);
                setPollingInterval(interval);

                // Also check after 10s for quick results
                setTimeout(fetchResults, 10000);
            } else {
                setStatus(`Error: ${data.error}`);
                setLoading(false);
            }
        } catch (err) {
            setStatus(`Error: ${err.message}`);
            setLoading(false);
        }
    };

    const generateOutreach = async (brandName, brandCategory) => {
        try {
            setOutreachLoading(brandName);
            setOutreachTemplate(null);

            const response = await fetch(`${API_BASE_URL}/api/instagram/brand-deals/outreach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, brandName, brandCategory })
            });

            const data = await response.json();

            if (data.success) {
                setOutreachTemplate({ brandName, ...data.data });
            } else {
                setStatus(`Outreach error: ${data.error}`);
            }
        } catch (err) {
            setStatus(`Error: ${err.message}`);
        } finally {
            setOutreachLoading(null);
        }
    };

    const getMatchColor = (score) => {
        if (score >= 80) return '#00e676';
        if (score >= 60) return '#ffab40';
        if (score >= 40) return '#ffd740';
        return '#ff5252';
    };

    const getMatchLabel = (score) => {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Low';
    };

    const getCollabIcon = (type) => {
        const t = (type || '').toLowerCase();
        if (t.includes('sponsor')) return '💰';
        if (t.includes('affiliate')) return '🔗';
        if (t.includes('ambassador')) return '🏆';
        if (t.includes('gift')) return '🎁';
        if (t.includes('paid')) return '💵';
        return '🤝';
    };

    const timeAgo = (timestamp) => {
        if (!timestamp) return '';
        const now = new Date();
        const then = new Date(timestamp);
        const diff = Math.floor((now - then) / 1000);

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    // Filter and sort brand deals
    const getFilteredDeals = () => {
        if (!results?.brandDeals) return [];
        let deals = [...results.brandDeals];

        if (filterCategory !== 'all') {
            deals = deals.filter(d => (d.category || '').toLowerCase().includes(filterCategory.toLowerCase()));
        }

        deals.sort((a, b) => {
            if (sortBy === 'matchScore') return (b.matchScore || 0) - (a.matchScore || 0);
            if (sortBy === 'name') return (a.brandName || '').localeCompare(b.brandName || '');
            return 0;
        });

        return deals;
    };

    // Get unique categories for filter
    const getCategories = () => {
        if (!results?.brandDeals) return [];
        const cats = new Set(results.brandDeals.map(d => d.category).filter(Boolean));
        return [...cats];
    };

    const filteredDeals = getFilteredDeals();
    const categories = getCategories();

    return (
        <div className="brand-deals-section">
            <div className="brand-deals-header">
                <div className="brand-deals-title-row">
                    <h2>🤝 Brand Collaboration Finder</h2>
                    <div className="brand-deals-actions">
                        <button
                            onClick={startAnalysis}
                            disabled={loading}
                            className="btn-find-deals"
                        >
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    Analyzing...
                                </>
                            ) : results?.hasResults ? (
                                '🔄 Refresh Deals'
                            ) : (
                                '🔍 Find Brand Deals'
                            )}
                        </button>
                    </div>
                </div>
                <p className="brand-deals-desc">
                    AI-powered real-time brand deal discovery based on your content, engagement, and niche.
                </p>
            </div>

            {/* Status Message */}
            {loading && status && (
                <div className="brand-deals-loading">
                    <div className="loading-pulse"></div>
                    <p>{status}</p>
                    <p className="loading-sub">This usually takes 30-60 seconds. Searching the web for real brand programs...</p>
                </div>
            )}

            {/* Error State */}
            {results?.status === 'failed' && (
                <div className="brand-deals-error">
                    <p>❌ Analysis failed: {results.error}</p>
                    <button onClick={startAnalysis} className="btn-retry">Retry</button>
                </div>
            )}

            {/* Creator Profile Summary */}
            {results?.creatorProfile && results.status === 'completed' && (
                <div className="creator-profile-summary">
                    <div className="profile-summary-header">
                        <h3>📊 Your Creator Profile</h3>
                        <span className="analysis-time">
                            Analyzed {timeAgo(results.analysisTimestamp)}
                        </span>
                    </div>
                    <div className="profile-stats-grid">
                        <div className="profile-stat-card">
                            <span className="stat-value">{results.creatorProfile.followerCount?.toLocaleString()}</span>
                            <span className="stat-label">Followers</span>
                        </div>
                        <div className="profile-stat-card">
                            <span className="stat-value">{results.creatorProfile.engagementRate}%</span>
                            <span className="stat-label">Engagement</span>
                        </div>
                        <div className="profile-stat-card niche-card">
                            <span className="stat-value niche-value">{results.creatorProfile.niche}</span>
                            <span className="stat-label">Primary Niche</span>
                        </div>
                        <div className="profile-stat-card">
                            <span className="stat-value tier-value">{results.creatorProfile.followerTier}</span>
                            <span className="stat-label">Creator Tier</span>
                        </div>
                    </div>
                    {results.creatorProfile.subNiches?.length > 0 && (
                        <div className="sub-niches">
                            {results.creatorProfile.subNiches.map((niche, i) => (
                                <span key={i} className="niche-tag">{niche}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Filters & Sort */}
            {results?.brandDeals?.length > 0 && (
                <div className="brand-deals-filters">
                    <div className="filter-group">
                        <label>Category:</label>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Sort by:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="filter-select"
                        >
                            <option value="matchScore">Match Score</option>
                            <option value="name">Brand Name</option>
                        </select>
                    </div>
                    <span className="deals-count">{filteredDeals.length} deals found</span>
                </div>
            )}

            {/* Brand Deal Cards */}
            {filteredDeals.length > 0 && (
                <div className="brand-deals-grid">
                    {filteredDeals.map((deal, index) => (
                        <div
                            key={index}
                            className="brand-deal-card"
                            style={{ animationDelay: `${index * 0.08}s` }}
                        >
                            <div className="deal-card-header">
                                <div className="deal-brand-info">
                                    <span className="deal-collab-icon">{getCollabIcon(deal.collaborationType)}</span>
                                    <div>
                                        <h4 className="deal-brand-name">{deal.brandName}</h4>
                                        {deal.programName && (
                                            <span className="deal-program">{deal.programName}</span>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className="deal-match-score"
                                    style={{
                                        background: `linear-gradient(135deg, ${getMatchColor(deal.matchScore)}20, ${getMatchColor(deal.matchScore)}10)`,
                                        borderColor: `${getMatchColor(deal.matchScore)}40`
                                    }}
                                >
                                    <span
                                        className="match-number"
                                        style={{ color: getMatchColor(deal.matchScore) }}
                                    >
                                        {deal.matchScore}%
                                    </span>
                                    <span className="match-label" style={{ color: getMatchColor(deal.matchScore) }}>
                                        {getMatchLabel(deal.matchScore)}
                                    </span>
                                </div>
                            </div>

                            <div className="deal-card-body">
                                <div className="deal-meta">
                                    <span className="deal-category-tag">{deal.category}</span>
                                    <span className="deal-collab-type">{deal.collaborationType}</span>
                                </div>

                                {deal.description && (
                                    <p className="deal-description">{deal.description}</p>
                                )}

                                {deal.estimatedBudget && (
                                    <div className="deal-budget">
                                        <span className="budget-icon">💸</span>
                                        <span>{deal.estimatedBudget}</span>
                                    </div>
                                )}

                                {deal.whyItMatches && (
                                    <div className="deal-match-reason">
                                        <span className="match-icon">✨</span>
                                        <span>{deal.whyItMatches}</span>
                                    </div>
                                )}

                                {deal.requirements && (
                                    <div className="deal-requirements">
                                        <span className="req-icon">📋</span>
                                        <span>{deal.requirements}</span>
                                    </div>
                                )}
                            </div>

                            <div className="deal-card-footer">
                                {deal.applyUrl && (
                                    <a
                                        href={deal.applyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-apply"
                                    >
                                        Apply Now →
                                    </a>
                                )}
                                <button
                                    onClick={() => generateOutreach(deal.brandName, deal.category)}
                                    disabled={outreachLoading === deal.brandName}
                                    className="btn-outreach"
                                >
                                    {outreachLoading === deal.brandName ? 'Generating...' : '✉️ Generate Pitch'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* No Results State */}
            {!loading && results?.hasResults === false && (
                <div className="brand-deals-empty">
                    <div className="empty-icon">🔍</div>
                    <p>No brand deals analyzed yet.</p>
                    <p className="empty-sub">Click "Find Brand Deals" to discover collaboration opportunities tailored to your profile.</p>
                </div>
            )}

            {/* Outreach Template Modal */}
            {outreachTemplate && (
                <div className="outreach-modal-overlay" onClick={() => setOutreachTemplate(null)}>
                    <div className="outreach-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="outreach-modal-header">
                            <h3>✉️ Outreach Email for {outreachTemplate.brandName}</h3>
                            <button onClick={() => setOutreachTemplate(null)} className="btn-close-modal">✕</button>
                        </div>
                        <div className="outreach-modal-body">
                            <div className="outreach-field">
                                <label>Subject Line:</label>
                                <div className="outreach-content subject">{outreachTemplate.subject}</div>
                            </div>
                            <div className="outreach-field">
                                <label>Email Body:</label>
                                <div className="outreach-content body">{outreachTemplate.body}</div>
                            </div>
                        </div>
                        <div className="outreach-modal-footer">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(
                                        `Subject: ${outreachTemplate.subject}\n\n${outreachTemplate.body}`
                                    );
                                    setStatus('Email copied to clipboard!');
                                    setTimeout(() => setStatus(''), 3000);
                                }}
                                className="btn-copy-email"
                            >
                                📋 Copy to Clipboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Toast */}
            {!loading && status && (
                <div className="brand-deals-toast">
                    {status}
                </div>
            )}
        </div>
    );
}

export default BrandDeals;
