import { useState, useEffect, useCallback } from 'react';
import '../styles/BrandDeals.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const STATUS_MAP = {
    pending: { label: 'Pending', icon: '⏳', color: '#ffab40' },
    reviewed: { label: 'Reviewed', icon: '👀', color: '#64b5f6' },
    accepted: { label: 'Accepted', icon: '🎉', color: '#69f0ae' },
    rejected: { label: 'Rejected', icon: '❌', color: '#ef5350' },
    withdrawn: { label: 'Withdrawn', icon: '↩', color: '#9e9e9e' }
};
const COMP_ICONS = { paid: '💰', product: '🎁', affiliate: '🔗', hybrid: '💎' };

function BrandDeals({ userId, token }) {
    // State
    const [view, setView] = useState('marketplace');           // 'marketplace' | 'applications'
    const [campaigns, setCampaigns] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [applyingId, setApplyingId] = useState(null);        // campaign ID being applied to
    const [pitchData, setPitchData] = useState({});             // { campId: { subject, body } }
    const [pitchLoading, setPitchLoading] = useState(null);
    const [matchData, setMatchData] = useState({});             // { campId: { score, reasons } }
    const [personalNotes, setPersonalNotes] = useState({});
    const [toast, setToast] = useState('');
    const [filterNiche, setFilterNiche] = useState('all');
    const [filterComp, setFilterComp] = useState('all');

    // Load data
    useEffect(() => {
        fetchCampaigns();
        if (userId) fetchApplications();
    }, [userId]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3500);
    };

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterNiche !== 'all') params.set('niche', filterNiche);
            if (filterComp !== 'all') params.set('compensationType', filterComp);
            const res = await fetch(`${API_BASE_URL}/api/instagram/campaigns?${params}`);
            const data = await res.json();
            if (data.success) setCampaigns(data.campaigns || []);
        } catch (e) { console.error('Fetch campaigns error:', e); }
        setLoading(false);
    };

    const fetchApplications = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/my-applications?userId=${userId}`);
            const data = await res.json();
            if (data.success) setApplications(data.applications || []);
        } catch (e) { console.error('Fetch applications error:', e); }
    };

    // Re-fetch when filters change
    useEffect(() => { fetchCampaigns(); }, [filterNiche, filterComp]);

    // Get match score for a campaign
    const getMatchScore = async (campId) => {
        if (matchData[campId]) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/campaigns/${campId}/match-score?token=${token}&userId=${userId}`);
            const data = await res.json();
            if (data.success) setMatchData(prev => ({ ...prev, [campId]: { score: data.matchScore, reasons: data.matchReasons } }));
        } catch (e) { console.error('Match score error:', e); }
    };

    // Generate pitch for a campaign
    const generatePitch = async (campId) => {
        setPitchLoading(campId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/campaigns/${campId}/generate-pitch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, token })
            });
            const data = await res.json();
            if (data.success) {
                setPitchData(prev => ({ ...prev, [campId]: data.pitch }));
                showToast('AI pitch generated!');
            } else {
                showToast(`Error: ${data.error}`);
            }
        } catch (e) { showToast(`Error: ${e.message}`); }
        setPitchLoading(null);
    };

    // Submit application
    const submitApplication = async (campId) => {
        setApplyingId(campId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/campaigns/${campId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, token, personalNote: personalNotes[campId] || '' })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Application submitted! Match score: ${data.application.matchScore}%`);
                setExpandedId(null);
                await fetchApplications();
            } else {
                showToast(`Error: ${data.error}`);
            }
        } catch (e) { showToast(`Error: ${e.message}`); }
        setApplyingId(null);
    };

    // Check if already applied to a campaign
    const hasApplied = (campId) => applications.some(a => a.campaign?.id === campId);

    // Get unique niches for filter
    const niches = [...new Set(campaigns.map(c => c.targetNiche).filter(Boolean))];

    // Helpers
    const formatBudget = (c) => {
        if (!c.budgetMin && !c.budgetMax) return 'Negotiable';
        if (c.budgetMin && c.budgetMax) return `$${c.budgetMin.toLocaleString()} – $${c.budgetMax.toLocaleString()}`;
        if (c.budgetMax) return `Up to $${c.budgetMax.toLocaleString()}`;
        return `From $${c.budgetMin.toLocaleString()}`;
    };
    const timeAgo = (ts) => {
        if (!ts) return '';
        const d = Math.floor((Date.now() - new Date(ts)) / 1000);
        return d < 60 ? 'just now' : d < 3600 ? `${Math.floor(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`;
    };
    const daysLeft = (deadline) => {
        if (!deadline) return '';
        const d = Math.ceil((new Date(deadline) - Date.now()) / (1000 * 60 * 60 * 24));
        return d <= 0 ? 'Expired' : d === 1 ? '1 day left' : `${d} days left`;
    };
    const getMatchColor = (s) => s >= 80 ? '#69f0ae' : s >= 60 ? '#ffab40' : s >= 40 ? '#ffd740' : '#ef5350';

    return (
        <div className="mp-section">
            {/* ---- Header ---- */}
            <div className="mp-header">
                <div className="mp-header-top">
                    <div>
                        <h2 className="mp-title">🤝 Brand Deal Marketplace</h2>
                        <p className="mp-subtitle">Real campaigns · One-click apply with AI pitch · Track every application</p>
                    </div>
                    <div className="mp-header-actions">
                        <button
                            onClick={() => setView('marketplace')}
                            className={`mp-view-btn ${view === 'marketplace' ? 'active' : ''}`}
                        >🏪 Campaigns</button>
                        <button
                            onClick={() => { setView('applications'); fetchApplications(); }}
                            className={`mp-view-btn ${view === 'applications' ? 'active' : ''}`}
                        >📋 My Applications {applications.length > 0 && <span className="mp-badge">{applications.length}</span>}</button>
                    </div>
                </div>
            </div>

            {/* =============== MARKETPLACE VIEW =============== */}
            {view === 'marketplace' && (
                <>
                    {/* Filters */}
                    <div className="mp-filters">
                        <select value={filterNiche} onChange={e => setFilterNiche(e.target.value)} className="mp-select">
                            <option value="all">All Niches</option>
                            {niches.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <select value={filterComp} onChange={e => setFilterComp(e.target.value)} className="mp-select">
                            <option value="all">All Types</option>
                            <option value="paid">💰 Paid</option>
                            <option value="product">🎁 Product</option>
                            <option value="affiliate">🔗 Affiliate</option>
                            <option value="hybrid">💎 Hybrid</option>
                        </select>
                        <span className="mp-total">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} available</span>
                    </div>

                    {/* Campaign Cards */}
                    {loading ? (
                        <div className="mp-loading">
                            <div className="mp-loading-pulse"></div>
                            <p>Loading campaigns...</p>
                        </div>
                    ) : campaigns.length > 0 ? (
                        <div className="mp-campaigns">
                            {campaigns.map((camp, i) => {
                                const isExpanded = expandedId === camp._id;
                                const applied = hasApplied(camp._id);
                                const match = matchData[camp._id];
                                const pitch = pitchData[camp._id];
                                const dl = daysLeft(camp.applicationDeadline);

                                return (
                                    <div key={camp._id} className={`mp-card ${isExpanded ? 'expanded' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                        {/* Card Header */}
                                        <div className="mp-card-header" onClick={() => {
                                            setExpandedId(isExpanded ? null : camp._id);
                                            if (!isExpanded && userId && token) getMatchScore(camp._id);
                                        }}>
                                            <div className="mp-card-left">
                                                <div className="mp-brand-icon">{COMP_ICONS[camp.compensationType] || '🤝'}</div>
                                                <div className="mp-card-info">
                                                    <div className="mp-card-row1">
                                                        <h4 className="mp-brand-name">{camp.brandName}</h4>
                                                        {applied && <span className="mp-applied-badge">✅ Applied</span>}
                                                        {dl && <span className={`mp-deadline ${dl === 'Expired' ? 'expired' : ''}`}>⏰ {dl}</span>}
                                                    </div>
                                                    <p className="mp-campaign-title">{camp.title}</p>
                                                    <div className="mp-tags">
                                                        <span className="mp-niche-tag">{camp.targetNiche}</span>
                                                        <span className="mp-comp-tag">{COMP_ICONS[camp.compensationType]} {camp.compensationType}</span>
                                                        <span className="mp-budget-tag">💸 {formatBudget(camp)}</span>
                                                        {camp.minFollowers > 0 && <span className="mp-follower-tag">👥 {(camp.minFollowers / 1000).toFixed(0)}K+</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mp-card-right">
                                                {match && (
                                                    <div className="mp-match-badge" style={{ borderColor: `${getMatchColor(match.score)}40` }}>
                                                        <span className="mp-match-score" style={{ color: getMatchColor(match.score) }}>{match.score}%</span>
                                                        <span className="mp-match-label">match</span>
                                                    </div>
                                                )}
                                                <span className="mp-expand">{isExpanded ? '▲' : '▼'}</span>
                                            </div>
                                        </div>

                                        {/* Expanded Detail */}
                                        {isExpanded && (
                                            <div className="mp-detail">
                                                {/* Campaign Info */}
                                                <div className="mp-info-grid">
                                                    {camp.description && (
                                                        <div className="mp-info-item">
                                                            <span className="mp-info-icon">📝</span>
                                                            <div><strong>About This Campaign</strong><p>{camp.description}</p></div>
                                                        </div>
                                                    )}
                                                    {camp.deliverables && (
                                                        <div className="mp-info-item">
                                                            <span className="mp-info-icon">📦</span>
                                                            <div><strong>Deliverables</strong><p>{camp.deliverables}</p></div>
                                                        </div>
                                                    )}
                                                    {camp.requirements && (
                                                        <div className="mp-info-item">
                                                            <span className="mp-info-icon">📋</span>
                                                            <div><strong>Requirements</strong><p>{camp.requirements}</p></div>
                                                        </div>
                                                    )}
                                                    {camp.guidelines && (
                                                        <div className="mp-info-item">
                                                            <span className="mp-info-icon">🎯</span>
                                                            <div><strong>Content Guidelines</strong><p>{camp.guidelines}</p></div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Match Score */}
                                                {match && (
                                                    <div className="mp-match-section">
                                                        <div className="mp-match-header">
                                                            <h5>🎯 Your Match Score: <span style={{ color: getMatchColor(match.score) }}>{match.score}%</span></h5>
                                                        </div>
                                                        <div className="mp-match-bar-track">
                                                            <div className="mp-match-bar-fill" style={{ width: `${match.score}%`, background: getMatchColor(match.score) }}></div>
                                                        </div>
                                                        <ul className="mp-match-reasons">
                                                            {match.reasons.map((r, i) => <li key={i}>✓ {r}</li>)}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Apply Section (only if not already applied) */}
                                                {!applied ? (
                                                    <div className="mp-apply-section">
                                                        <h5>✉️ Apply to This Campaign</h5>

                                                        {/* Generate Pitch */}
                                                        <div className="mp-pitch-area">
                                                            {!pitch ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); generatePitch(camp._id); }}
                                                                    disabled={pitchLoading === camp._id}
                                                                    className="mp-btn-pitch"
                                                                >
                                                                    {pitchLoading === camp._id
                                                                        ? <><span className="mp-spinner-sm"></span> Generating AI pitch...</>
                                                                        : '🤖 Generate AI Pitch'}
                                                                </button>
                                                            ) : (
                                                                <div className="mp-pitch-preview">
                                                                    <div className="mp-pitch-subject"><strong>Subject:</strong> {pitch.subject}</div>
                                                                    <div className="mp-pitch-body">{pitch.body}</div>
                                                                    <button onClick={() => {
                                                                        navigator.clipboard.writeText(`Subject: ${pitch.subject}\n\n${pitch.body}`);
                                                                        showToast('Pitch copied!');
                                                                    }} className="mp-btn-copy">📋 Copy Pitch</button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Personal Note */}
                                                        <textarea
                                                            className="mp-note-input"
                                                            placeholder="Add a personal note to your application (optional)..."
                                                            value={personalNotes[camp._id] || ''}
                                                            onChange={(e) => setPersonalNotes(prev => ({ ...prev, [camp._id]: e.target.value }))}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />

                                                        {/* Submit Button */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); submitApplication(camp._id); }}
                                                            disabled={applyingId === camp._id}
                                                            className="mp-btn-apply"
                                                        >
                                                            {applyingId === camp._id
                                                                ? <><span className="mp-spinner-sm"></span> Submitting application...</>
                                                                : '🚀 Submit Application'}
                                                        </button>
                                                        <p className="mp-apply-note">AI will auto-generate your pitch, media kit, and select your best posts.</p>
                                                    </div>
                                                ) : (
                                                    <div className="mp-already-applied">
                                                        <span>✅ You've already applied to this campaign</span>
                                                        <button onClick={() => setView('applications')} className="mp-btn-view-app">View Application →</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mp-empty">
                            <div className="mp-empty-icon">🏪</div>
                            <p>No campaigns available right now</p>
                            <p className="mp-empty-sub">New brand deal campaigns are added regularly. Check back soon!</p>
                        </div>
                    )}
                </>
            )}

            {/* =============== MY APPLICATIONS VIEW =============== */}
            {view === 'applications' && (
                <div className="mp-applications">
                    <h3 className="mp-apps-title">Your Applications ({applications.length})</h3>

                    {applications.length > 0 ? (
                        <div className="mp-apps-list">
                            {applications.map((app, i) => {
                                const st = STATUS_MAP[app.applicationStatus] || STATUS_MAP.pending;
                                return (
                                    <div key={app.id} className="mp-app-card" style={{ animationDelay: `${i * 0.05}s` }}>
                                        <div className="mp-app-main">
                                            <div className="mp-app-left">
                                                <div className="mp-app-brand">
                                                    <h4>{app.campaign?.brandName || 'Unknown Brand'}</h4>
                                                    <p>{app.campaign?.title || 'Campaign'}</p>
                                                </div>
                                                <div className="mp-app-meta">
                                                    {app.campaign && (
                                                        <span className="mp-app-budget">
                                                            {COMP_ICONS[app.campaign.compensationType]} ${app.campaign.budgetMin}-${app.campaign.budgetMax}
                                                        </span>
                                                    )}
                                                    <span className="mp-app-time">Applied {timeAgo(app.appliedAt)}</span>
                                                </div>
                                            </div>
                                            <div className="mp-app-right">
                                                <div className="mp-app-score" style={{ color: getMatchColor(app.matchScore) }}>
                                                    {app.matchScore}% match
                                                </div>
                                                <span className="mp-app-status" style={{
                                                    background: `${st.color}15`,
                                                    color: st.color,
                                                    borderColor: `${st.color}30`
                                                }}>
                                                    {st.icon} {st.label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Pitch Preview */}
                                        {app.pitch?.body && (
                                            <div className="mp-app-pitch">
                                                <details>
                                                    <summary>View your pitch</summary>
                                                    <div className="mp-app-pitch-content">
                                                        <p className="mp-app-pitch-sub"><strong>Subject:</strong> {app.pitch.subject}</p>
                                                        <p className="mp-app-pitch-body">{app.pitch.body}</p>
                                                    </div>
                                                </details>
                                            </div>
                                        )}

                                        {/* Match Reasons */}
                                        {app.matchReasons?.length > 0 && (
                                            <div className="mp-app-reasons">
                                                {app.matchReasons.map((r, j) => <span key={j} className="mp-reason-tag">✓ {r}</span>)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mp-empty">
                            <div className="mp-empty-icon">📋</div>
                            <p>No applications yet</p>
                            <p className="mp-empty-sub">Browse campaigns and apply to start building your deal pipeline.</p>
                            <button onClick={() => setView('marketplace')} className="mp-btn-browse">Browse Campaigns →</button>
                        </div>
                    )}
                </div>
            )}

            {/* Toast */}
            {toast && <div className="mp-toast">{toast}</div>}
        </div>
    );
}

export default BrandDeals;
