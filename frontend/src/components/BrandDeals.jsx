import { useState, useEffect, useCallback } from 'react';
import '../styles/BrandDeals.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const PIPELINE_STAGES = ['all', 'discovered', 'saved', 'pitched', 'waiting', 'won', 'lost'];
const STAGE_LABELS = { all: 'All Deals', discovered: 'Discovered', saved: 'Saved', pitched: 'Pitched', waiting: 'Waiting', won: 'Won', lost: 'Lost' };
const STAGE_ICONS = { discovered: '🔍', saved: '⭐', pitched: '📨', waiting: '⏳', won: '🏆', lost: '❌' };
const STAGE_COLORS = { discovered: '#64b5f6', saved: '#ffd54f', pitched: '#ba68c8', waiting: '#ffab40', won: '#69f0ae', lost: '#ef5350' };

function BrandDeals({ userId, token }) {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [pollingId, setPollingId] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [expandedDeal, setExpandedDeal] = useState(null);
    const [pitchLoading, setPitchLoading] = useState(null);
    const [toast, setToast] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortBy, setSortBy] = useState('matchScore');

    useEffect(() => {
        if (userId) fetchResults();
        return () => { if (pollingId) clearInterval(pollingId); };
    }, [userId]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const fetchResults = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/brand-deals/results?userId=${userId}`);
            const data = await res.json();
            if (data.success && data.hasResults) {
                setResults(data);
                if (data.status === 'completed' || data.status === 'failed') {
                    if (pollingId) { clearInterval(pollingId); setPollingId(null); }
                    setLoading(false);
                }
            }
        } catch (err) { console.error('Fetch results error:', err); }
    }, [userId, pollingId]);

    const startAnalysis = async () => {
        setLoading(true);
        setStatusMsg('Analyzing your content and searching for brand deals...');
        setExpandedDeal(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/brand-deals/analyze?token=${token}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await res.json();
            if (data.success) {
                setStatusMsg('Searching the web for brand partnership programs...');
                const interval = setInterval(fetchResults, 5000);
                setPollingId(interval);
                setTimeout(fetchResults, 10000);
            } else { setStatusMsg(`Error: ${data.error}`); setLoading(false); }
        } catch (err) { setStatusMsg(`Error: ${err.message}`); setLoading(false); }
    };

    const generatePitch = async (brandName, category) => {
        setPitchLoading(brandName);
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/brand-deals/generate-pitch`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, brandName, brandCategory: category })
            });
            const data = await res.json();
            if (data.success) {
                await fetchResults(); // Refresh to get stored pitch
                showToast(`Pitch generated for ${brandName}!`);
            } else { showToast(`Error: ${data.error}`); }
        } catch (err) { showToast(`Error: ${err.message}`); }
        finally { setPitchLoading(null); }
    };

    const updateDealStatus = async (brandName, newStatus) => {
        try {
            await fetch(`${API_BASE_URL}/api/instagram/brand-deals/update-status`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, brandName, dealStatus: newStatus })
            });
            await fetchResults();
            showToast(`${brandName} → ${STAGE_LABELS[newStatus] || newStatus}`);
        } catch (err) { showToast(`Error: ${err.message}`); }
    };

    const saveNotes = async (brandName, notes) => {
        try {
            await fetch(`${API_BASE_URL}/api/instagram/brand-deals/save-notes`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, brandName, notes })
            });
            showToast('Notes saved');
        } catch (err) { showToast(`Error: ${err.message}`); }
    };

    const copyPitch = (deal) => {
        const text = `Subject: ${deal.pitch?.subject || ''}\n\n${deal.pitch?.body || ''}`;
        navigator.clipboard.writeText(text);
        showToast('Pitch copied to clipboard!');
    };

    const getMatchColor = (s) => s >= 80 ? '#69f0ae' : s >= 60 ? '#ffab40' : s >= 40 ? '#ffd740' : '#ef5350';
    const getMatchLabel = (s) => s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Fair' : 'Low';
    const getCollabIcon = (t) => {
        const l = (t || '').toLowerCase();
        return l.includes('sponsor') ? '💰' : l.includes('affiliate') ? '🔗' : l.includes('ambassador') ? '🏆' : l.includes('gift') ? '🎁' : l.includes('paid') ? '💵' : '🤝';
    };
    const timeAgo = (ts) => {
        if (!ts) return '';
        const d = Math.floor((Date.now() - new Date(ts)) / 1000);
        return d < 60 ? 'just now' : d < 3600 ? `${Math.floor(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`;
    };

    // Filter deals by tab and category
    const getVisibleDeals = () => {
        if (!results?.brandDeals) return [];
        let deals = [...results.brandDeals];
        if (activeTab !== 'all') deals = deals.filter(d => (d.dealStatus || 'discovered') === activeTab);
        if (filterCategory !== 'all') deals = deals.filter(d => (d.category || '').toLowerCase().includes(filterCategory.toLowerCase()));
        deals.sort((a, b) => sortBy === 'matchScore' ? (b.matchScore || 0) - (a.matchScore || 0) : (a.brandName || '').localeCompare(b.brandName || ''));
        return deals;
    };

    const getCounts = () => {
        if (!results?.brandDeals) return {};
        const counts = { all: results.brandDeals.length };
        PIPELINE_STAGES.slice(1).forEach(s => counts[s] = 0);
        results.brandDeals.forEach(d => { const s = d.dealStatus || 'discovered'; counts[s] = (counts[s] || 0) + 1; });
        return counts;
    };

    const getCategories = () => {
        if (!results?.brandDeals) return [];
        return [...new Set(results.brandDeals.map(d => d.category).filter(Boolean))];
    };

    const deals = getVisibleDeals();
    const counts = getCounts();
    const categories = getCategories();
    const kit = results?.mediaKit;

    return (
        <div className="bd-section">
            {/* Header */}
            <div className="bd-header">
                <div className="bd-header-top">
                    <div>
                        <h2 className="bd-title">🤝 Brand Deal Finder</h2>
                        <p className="bd-subtitle">AI discovers real brand deals · You manage the pipeline · All inside your platform</p>
                    </div>
                    <button onClick={startAnalysis} disabled={loading} className="bd-btn-primary">
                        {loading ? <><span className="bd-spinner"></span>Analyzing...</> : results?.hasResults ? '🔄 Refresh Deals' : '🔍 Find Brand Deals'}
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && statusMsg && (
                <div className="bd-loading">
                    <div className="bd-loading-pulse"></div>
                    <p className="bd-loading-text">{statusMsg}</p>
                    <p className="bd-loading-sub">Usually takes 30-60 seconds. Searching the web for real brand programs...</p>
                </div>
            )}

            {/* Error */}
            {results?.status === 'failed' && (
                <div className="bd-error">
                    <p>❌ Analysis failed: {results.error}</p>
                    <button onClick={startAnalysis} className="bd-btn-retry">Retry</button>
                </div>
            )}

            {/* Media Kit + Profile Summary */}
            {kit && results?.status === 'completed' && (
                <div className="bd-media-kit">
                    <div className="bd-kit-header">
                        <h3>📊 Your Media Kit</h3>
                        <span className="bd-kit-time">Updated {timeAgo(kit.generatedAt)}</span>
                    </div>
                    <div className="bd-kit-grid">
                        <div className="bd-kit-stat">
                            <span className="bd-kit-number">{kit.followers?.toLocaleString()}</span>
                            <span className="bd-kit-label">Followers</span>
                        </div>
                        <div className="bd-kit-stat">
                            <span className="bd-kit-number">{kit.engagementRate}%</span>
                            <span className="bd-kit-label">Engagement</span>
                        </div>
                        <div className="bd-kit-stat">
                            <span className="bd-kit-number bd-niche">{kit.niche}</span>
                            <span className="bd-kit-label">Niche</span>
                        </div>
                        <div className="bd-kit-stat">
                            <span className="bd-kit-number bd-tier">{kit.followerTier}</span>
                            <span className="bd-kit-label">Tier</span>
                        </div>
                        <div className="bd-kit-stat">
                            <span className="bd-kit-number">{kit.avgLikes}</span>
                            <span className="bd-kit-label">Avg Likes</span>
                        </div>
                        <div className="bd-kit-stat">
                            <span className="bd-kit-number">{kit.avgComments}</span>
                            <span className="bd-kit-label">Avg Comments</span>
                        </div>
                    </div>
                    {kit.topHashtags?.length > 0 && (
                        <div className="bd-kit-tags">
                            {kit.topHashtags.map((h, i) => <span key={i} className="bd-tag">{h}</span>)}
                        </div>
                    )}
                </div>
            )}

            {/* Pipeline Tabs */}
            {results?.brandDeals?.length > 0 && (
                <div className="bd-pipeline">
                    <div className="bd-tabs">
                        {PIPELINE_STAGES.map(stage => (
                            <button
                                key={stage}
                                className={`bd-tab ${activeTab === stage ? 'active' : ''}`}
                                onClick={() => setActiveTab(stage)}
                                style={activeTab === stage && stage !== 'all' ? { borderColor: STAGE_COLORS[stage] } : {}}
                            >
                                {stage !== 'all' && <span className="bd-tab-icon">{STAGE_ICONS[stage]}</span>}
                                {STAGE_LABELS[stage]}
                                {counts[stage] > 0 && <span className="bd-tab-count" style={stage !== 'all' ? { background: `${STAGE_COLORS[stage]}25`, color: STAGE_COLORS[stage] } : {}}>{counts[stage]}</span>}
                            </button>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="bd-filters">
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bd-select">
                            <option value="all">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bd-select">
                            <option value="matchScore">Match Score</option>
                            <option value="name">Brand Name</option>
                        </select>
                        <span className="bd-count">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            )}

            {/* Deal Cards */}
            {deals.length > 0 && (
                <div className="bd-deals-list">
                    {deals.map((deal, i) => {
                        const isExpanded = expandedDeal === deal.brandName;
                        const hasPitch = deal.pitch?.body;
                        const status = deal.dealStatus || 'discovered';

                        return (
                            <div key={i} className={`bd-card ${isExpanded ? 'expanded' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
                                {/* Card Main */}
                                <div className="bd-card-main" onClick={() => setExpandedDeal(isExpanded ? null : deal.brandName)}>
                                    <div className="bd-card-left">
                                        <span className="bd-card-icon">{getCollabIcon(deal.collaborationType)}</span>
                                        <div className="bd-card-info">
                                            <div className="bd-card-top-row">
                                                <h4 className="bd-brand-name">{deal.brandName}</h4>
                                                <span className="bd-status-badge" style={{ background: `${STAGE_COLORS[status]}20`, color: STAGE_COLORS[status], borderColor: `${STAGE_COLORS[status]}40` }}>
                                                    {STAGE_ICONS[status]} {STAGE_LABELS[status]}
                                                </span>
                                            </div>
                                            {deal.programName && <span className="bd-program">{deal.programName}</span>}
                                            <div className="bd-card-tags">
                                                <span className="bd-cat-tag">{deal.category}</span>
                                                <span className="bd-collab-tag">{deal.collaborationType}</span>
                                                {deal.estimatedBudget && <span className="bd-budget-tag">💸 {deal.estimatedBudget}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bd-card-right">
                                        <div className="bd-match" style={{ borderColor: `${getMatchColor(deal.matchScore)}40` }}>
                                            <span className="bd-match-num" style={{ color: getMatchColor(deal.matchScore) }}>{deal.matchScore}%</span>
                                            <span className="bd-match-label" style={{ color: getMatchColor(deal.matchScore) }}>{getMatchLabel(deal.matchScore)}</span>
                                        </div>
                                        <span className="bd-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                                    </div>
                                </div>

                                {/* Expanded Detail Panel */}
                                {isExpanded && (
                                    <div className="bd-detail">
                                        {/* Info Grid */}
                                        <div className="bd-detail-grid">
                                            {deal.description && (
                                                <div className="bd-detail-item">
                                                    <span className="bd-detail-icon">📝</span>
                                                    <div><strong>About</strong><p>{deal.description}</p></div>
                                                </div>
                                            )}
                                            {deal.whyItMatches && (
                                                <div className="bd-detail-item highlight">
                                                    <span className="bd-detail-icon">✨</span>
                                                    <div><strong>Why You Match</strong><p>{deal.whyItMatches}</p></div>
                                                </div>
                                            )}
                                            {deal.requirements && (
                                                <div className="bd-detail-item">
                                                    <span className="bd-detail-icon">📋</span>
                                                    <div><strong>Requirements</strong><p>{deal.requirements}</p></div>
                                                </div>
                                            )}
                                            {deal.contactEmail && (
                                                <div className="bd-detail-item">
                                                    <span className="bd-detail-icon">📧</span>
                                                    <div><strong>Contact Email</strong><p className="bd-email">{deal.contactEmail}</p></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pitch Section */}
                                        <div className="bd-pitch-section">
                                            <div className="bd-pitch-header">
                                                <h5>✉️ Your Pitch</h5>
                                                {!hasPitch ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); generatePitch(deal.brandName, deal.category); }}
                                                        disabled={pitchLoading === deal.brandName}
                                                        className="bd-btn-pitch"
                                                    >
                                                        {pitchLoading === deal.brandName ? <><span className="bd-spinner-sm"></span>Generating...</> : '🤖 Generate AI Pitch'}
                                                    </button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); copyPitch(deal); }} className="bd-btn-copy">
                                                        📋 Copy Pitch
                                                    </button>
                                                )}
                                            </div>
                                            {hasPitch && (
                                                <div className="bd-pitch-content">
                                                    <div className="bd-pitch-subject"><strong>Subject:</strong> {deal.pitch.subject}</div>
                                                    <div className="bd-pitch-body">{deal.pitch.body}</div>
                                                </div>
                                            )}
                                            {!hasPitch && <p className="bd-pitch-empty">Click "Generate AI Pitch" to create a personalized outreach email for this brand.</p>}
                                        </div>

                                        {/* Notes */}
                                        <div className="bd-notes-section">
                                            <h5>📝 Your Notes</h5>
                                            <textarea
                                                className="bd-notes-input"
                                                placeholder="Add personal notes about this deal..."
                                                defaultValue={deal.notes || ''}
                                                onBlur={(e) => saveNotes(deal.brandName, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="bd-actions">
                                            {status === 'discovered' && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'saved'); }} className="bd-btn-action save">⭐ Save Deal</button>
                                                    <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'skipped'); }} className="bd-btn-action skip">Skip</button>
                                                </>
                                            )}
                                            {status === 'saved' && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'pitched'); }} className="bd-btn-action pitched">📨 Mark as Pitched</button>
                                                    <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'discovered'); }} className="bd-btn-action back">← Back to Discovered</button>
                                                </>
                                            )}
                                            {status === 'pitched' && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'waiting'); }} className="bd-btn-action waiting">⏳ Waiting for Response</button>
                                                    <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'saved'); }} className="bd-btn-action back">← Back to Saved</button>
                                                </>
                                            )}
                                            {status === 'waiting' && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'won'); }} className="bd-btn-action won">🏆 Deal Won!</button>
                                                    <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'lost'); }} className="bd-btn-action lost">❌ Deal Lost</button>
                                                </>
                                            )}
                                            {(status === 'won' || status === 'lost' || status === 'skipped') && (
                                                <button onClick={(e) => { e.stopPropagation(); updateDealStatus(deal.brandName, 'discovered'); }} className="bd-btn-action back">↩ Move to Discovered</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty States */}
            {!loading && results?.hasResults === false && (
                <div className="bd-empty">
                    <div className="bd-empty-icon">🔍</div>
                    <p>No brand deals found yet.</p>
                    <p className="bd-empty-sub">Click "Find Brand Deals" to discover collaboration opportunities matched to your profile.</p>
                </div>
            )}
            {!loading && results?.hasResults && deals.length === 0 && activeTab !== 'all' && (
                <div className="bd-empty">
                    <p>No deals in "{STAGE_LABELS[activeTab]}" stage.</p>
                    <p className="bd-empty-sub">Move deals through the pipeline by expanding a deal and using the action buttons.</p>
                </div>
            )}

            {/* Toast */}
            {toast && <div className="bd-toast">{toast}</div>}
        </div>
    );
}

export default BrandDeals;
