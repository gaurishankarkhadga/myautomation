import { useState, useEffect } from 'react';
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
const SOURCE_CONFIG = {
    cj: { label: 'CJ Affiliate', color: '#64b5f6', icon: '🔵' },
    impact: { label: 'Impact', color: '#ce93d8', icon: '🟣' },
    manual: { label: 'Manual', color: '#a5d6a7', icon: '📌' }
};

function BrandDeals({ userId, token }) {
    const [view, setView] = useState('marketplace');
    const [campaigns, setCampaigns] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [applyingId, setApplyingId] = useState(null);
    const [pitchData, setPitchData] = useState({});
    const [pitchLoading, setPitchLoading] = useState(null);
    const [matchData, setMatchData] = useState({});
    const [personalNotes, setPersonalNotes] = useState({});
    const [toast, setToast] = useState('');
    const [filterNiche, setFilterNiche] = useState('all');
    const [filterComp, setFilterComp] = useState('all');
    const [filterSource, setFilterSource] = useState('all');
    const [syncing, setSyncing] = useState(false);
    const [syncStats, setSyncStats] = useState(null);

    useEffect(() => {
        fetchCampaigns();
        fetchSyncStats();
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
            if (data.success) {
                let filtered = data.campaigns || [];
                if (filterSource !== 'all') filtered = filtered.filter(c => c.source === filterSource);
                setCampaigns(filtered);
            }
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

    const fetchSyncStats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/campaigns/cj-stats`);
            const data = await res.json();
            if (data.success) setSyncStats(data.stats);
        } catch (e) { /* ignore */ }
    };

    useEffect(() => { fetchCampaigns(); }, [filterNiche, filterComp, filterSource]);

    // Sync all CJ deals
    const syncCJDeals = async () => {
        setSyncing(true);
        showToast('Syncing deals from CJ Affiliate...');
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/campaigns/sync-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${data.message}`);
                await fetchCampaigns();
                await fetchSyncStats();
            } else {
                showToast(`❌ Sync failed: ${data.error}`);
            }
        } catch (e) { showToast(`❌ Sync error: ${e.message}`); }
        setSyncing(false);
    };

    // Get match score for a campaign
    const getMatchScore = async (campId) => {
        if (matchData[campId]) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/campaigns/${campId}/match-score?token=${token}&userId=${userId}`);
            const data = await res.json();
            if (data.success) setMatchData(prev => ({ ...prev, [campId]: { score: data.matchScore, reasons: data.matchReasons } }));
        } catch (e) { console.error('Match score error:', e); }
    };

    // Generate pitch
    const generatePitch = async (campId) => {
        setPitchLoading(campId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/instagram/campaigns/${campId}/generate-pitch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, token })
            });
            const data = await res.json();
            if (data.success) { setPitchData(prev => ({ ...prev, [campId]: data.pitch })); showToast('AI pitch generated!'); }
            else showToast(`Error: ${data.error}`);
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
            } else showToast(`Error: ${data.error}`);
        } catch (e) { showToast(`Error: ${e.message}`); }
        setApplyingId(null);
    };

    const hasApplied = (campId) => applications.some(a => a.campaign?.id === campId);
    const niches = [...new Set(campaigns.map(c => c.targetNiche).filter(Boolean))];

    const formatBudget = (c) => {
        if (!c.budgetMin && !c.budgetMax) return c.epc || 'Commission-based';
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
            {/* Header */}
            <div className="mp-header">
                <div className="mp-header-top">
                    <div>
                        <h2 className="mp-title">🤝 Brand Deal Marketplace</h2>
                        <p className="mp-subtitle">
                            Real deals from CJ Affiliate · AI match scoring · One-click apply
                            {syncStats && <span className="mp-stats-mini"> — {syncStats.cj} CJ deals, {syncStats.manual} manual</span>}
                        </p>
                    </div>
                    <div className="mp-header-actions">
                        <button onClick={syncCJDeals} disabled={syncing} className="mp-sync-btn">
                            {syncing ? <><span className="mp-spinner-sm"></span> Syncing...</> : '🔄 Sync CJ Deals'}
                        </button>
                        <button onClick={() => setView('marketplace')} className={`mp-view-btn ${view === 'marketplace' ? 'active' : ''}`}>
                            🏪 Campaigns
                        </button>
                        <button onClick={() => { setView('applications'); fetchApplications(); }} className={`mp-view-btn ${view === 'applications' ? 'active' : ''}`}>
                            📋 My Applications {applications.length > 0 && <span className="mp-badge">{applications.length}</span>}
                        </button>
                    </div>
                </div>
            </div>

            {/* MARKETPLACE VIEW */}
            {view === 'marketplace' && (
                <>
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
                        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="mp-select">
                            <option value="all">All Sources</option>
                            <option value="cj">🔵 CJ Affiliate</option>
                            <option value="impact">🟣 Impact</option>
                            <option value="manual">📌 Manual</option>
                        </select>
                        <span className="mp-total">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
                    </div>

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
                                const src = SOURCE_CONFIG[camp.source] || SOURCE_CONFIG.manual;

                                return (
                                    <div key={camp._id} className={`mp-card ${isExpanded ? 'expanded' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
                                        <div className="mp-card-header" onClick={() => {
                                            setExpandedId(isExpanded ? null : camp._id);
                                            if (!isExpanded && userId && token) getMatchScore(camp._id);
                                        }}>
                                            <div className="mp-card-left">
                                                <div className="mp-brand-icon">{COMP_ICONS[camp.compensationType] || '🤝'}</div>
                                                <div className="mp-card-info">
                                                    <div className="mp-card-row1">
                                                        <h4 className="mp-brand-name">{camp.brandName}</h4>
                                                        <span className="mp-source-badge" style={{ background: `${src.color}15`, color: src.color, borderColor: `${src.color}30` }}>
                                                            {src.icon} {src.label}
                                                        </span>
                                                        {applied && <span className="mp-applied-badge">✅ Applied</span>}
                                                        {dl && <span className={`mp-deadline ${dl === 'Expired' ? 'expired' : ''}`}>⏰ {dl}</span>}
                                                    </div>
                                                    <p className="mp-campaign-title">{camp.title}</p>
                                                    <div className="mp-tags">
                                                        <span className="mp-niche-tag">{camp.targetNiche}</span>
                                                        <span className="mp-comp-tag">{COMP_ICONS[camp.compensationType]} {camp.compensationType}</span>
                                                        <span className="mp-budget-tag">💸 {formatBudget(camp)}</span>
                                                        {camp.epc && <span className="mp-epc-tag">📊 EPC: {camp.epc}</span>}
                                                        {camp.networkRank && <span className="mp-rank-tag">🏆 {camp.networkRank}</span>}
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

                                        {isExpanded && (
                                            <div className="mp-detail">
                                                <div className="mp-info-grid">
                                                    {camp.description && (
                                                        <div className="mp-info-item">
                                                            <span className="mp-info-icon">📝</span>
                                                            <div><strong>About This Program</strong><p>{camp.description}</p></div>
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
                                                    {camp.programUrl && (
                                                        <div className="mp-info-item">
                                                            <span className="mp-info-icon">🔗</span>
                                                            <div>
                                                                <strong>Program Link</strong>
                                                                <p><a href={camp.programUrl} target="_blank" rel="noopener noreferrer" className="mp-program-link">{camp.programUrl.substring(0, 60)}...</a></p>
                                                            </div>
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
                                                            {match.reasons.map((r, j) => <li key={j}>✓ {r}</li>)}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Apply Section */}
                                                {!applied ? (
                                                    <div className="mp-apply-section">
                                                        <h5>✉️ Apply to This Program</h5>

                                                        {/* Real program link for CJ deals */}
                                                        {camp.source === 'cj' && camp.programUrl && (
                                                            <a href={camp.programUrl} target="_blank" rel="noopener noreferrer" className="mp-btn-join-program">
                                                                🔗 Join Program on CJ Affiliate →
                                                            </a>
                                                        )}

                                                        <div className="mp-pitch-area">
                                                            {!pitch ? (
                                                                <button onClick={(e) => { e.stopPropagation(); generatePitch(camp._id); }} disabled={pitchLoading === camp._id} className="mp-btn-pitch">
                                                                    {pitchLoading === camp._id ? <><span className="mp-spinner-sm"></span> Generating AI pitch...</> : '🤖 Generate AI Pitch'}
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

                                                        <textarea
                                                            className="mp-note-input"
                                                            placeholder="Add a personal note (optional)..."
                                                            value={personalNotes[camp._id] || ''}
                                                            onChange={(e) => setPersonalNotes(prev => ({ ...prev, [camp._id]: e.target.value }))}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />

                                                        <button onClick={(e) => { e.stopPropagation(); submitApplication(camp._id); }} disabled={applyingId === camp._id} className="mp-btn-apply">
                                                            {applyingId === camp._id ? <><span className="mp-spinner-sm"></span> Submitting...</> : '🚀 Submit Application'}
                                                        </button>
                                                        <p className="mp-apply-note">AI auto-generates pitch + media kit + selects your best posts</p>
                                                    </div>
                                                ) : (
                                                    <div className="mp-already-applied">
                                                        <span>✅ Already applied</span>
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
                            <p>No campaigns available</p>
                            <p className="mp-empty-sub">Click "Sync CJ Deals" to fetch real brand programs from CJ Affiliate</p>
                            <button onClick={syncCJDeals} disabled={syncing} className="mp-btn-browse">
                                {syncing ? 'Syncing...' : '🔄 Sync CJ Deals Now'}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* MY APPLICATIONS VIEW */}
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
                                                        <span className="mp-app-budget">{COMP_ICONS[app.campaign.compensationType]} ${app.campaign.budgetMin}-${app.campaign.budgetMax}</span>
                                                    )}
                                                    <span className="mp-app-time">Applied {timeAgo(app.appliedAt)}</span>
                                                </div>
                                            </div>
                                            <div className="mp-app-right">
                                                <div className="mp-app-score" style={{ color: getMatchColor(app.matchScore) }}>{app.matchScore}% match</div>
                                                <span className="mp-app-status" style={{ background: `${st.color}15`, color: st.color, borderColor: `${st.color}30` }}>
                                                    {st.icon} {st.label}
                                                </span>
                                            </div>
                                        </div>
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
                            <p className="mp-empty-sub">Browse campaigns and apply to start your deal pipeline</p>
                            <button onClick={() => setView('marketplace')} className="mp-btn-browse">Browse Campaigns →</button>
                        </div>
                    )}
                </div>
            )}

            {toast && <div className="mp-toast">{toast}</div>}
        </div>
    );
}

export default BrandDeals;
