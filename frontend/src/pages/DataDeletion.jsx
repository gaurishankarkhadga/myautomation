import React, { useState } from 'react';
import './PolicyPages.css';

const DataDeletion = () => {
    const [email, setEmail] = useState('');
    const [confirmationCode, setConfirmationCode] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // TODO: Connect to backend API
        // const response = await fetch('/api/data-deletion/request', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ email, confirmationCode })
        // });

        setSubmitted(true);
    };

    return (
        <div className="policy-container">
            <div className="policy-content data-deletion-page">
                <div className="deletion-header">
                    <h1>Data Deletion Request</h1>
                    <p className="subtitle">Take complete control over your data. Request account deletion and data removal.</p>
                </div>

                <div className="alert-box info-alert">
                    <div>
                        <h3>Important Information</h3>
                        <p>
                            Deleting your account is permanent and cannot be undone. All your automation
                            settings, analytics, connected accounts, and user data will be permanently
                            removed from our active databases within 30 days.
                        </p>
                    </div>
                </div>

                <div className="deletion-timeline">
                    <h3>Deletion Timeline</h3>
                    <ul>
                        <li><strong>Immediate:</strong> Access to account revoked, automations stopped.</li>
                        <li><strong>Within 30 Days:</strong> Data permanently removed from active databases.</li>
                        <li><strong>Within 90 Days:</strong> Data purged from all backups.</li>
                    </ul>
                </div>

                <div className="request-form-section">
                    <h2>Submit Request</h2>

                    {!submitted ? (
                        <form onSubmit={handleSubmit} className="deletion-form">
                            <div className="form-group">
                                <label htmlFor="email">Account Email Address *</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your registered email"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmationCode">Confirmation Code (Optional)</label>
                                <input
                                    type="text"
                                    id="confirmationCode"
                                    value={confirmationCode}
                                    onChange={(e) => setConfirmationCode(e.target.value)}
                                    placeholder="Enter code if provided"
                                />
                            </div>

                            <button type="submit" className="submit-btn">
                                Request Data Deletion
                            </button>
                        </form>
                    ) : (
                        <div className="success-message">
                            <h3>✓ Request Submitted Successfully</h3>
                            <p>
                                We have received your data deletion request. Our team will process this
                                within 48 hours. You will receive a confirmation email once your data
                                has been fully removed.
                            </p>
                        </div>
                    )}
                </div>

                <div className="alternative-methods">
                    <h2>Alternative: Disconnect Only</h2>
                    <p>
                        If you simply want to stop CreatorHub from accessing your social media accounts without deleting your CreatorHub account, you can revoke access directly from the platforms:
                    </p>
                    <div className="disconnect-instructions">
                        <h3>Disconnect Google / YouTube:</h3>
                        <ol>
                            <li>Go to your <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">Google Security Settings</a>.</li>
                            <li>Find "CreatorHub" in the list of third-party apps with account access.</li>
                            <li>Select it and click <strong>"Remove Access"</strong>.</li>
                        </ol>
                        <p><em>Revoking access will immediately stop all YouTube automations.</em></p>

                        <h3>Disconnect Meta / Instagram:</h3>
                        <ol>
                            <li>Go to your Instagram App or web browser.</li>
                            <li>Navigate to <strong>Settings &gt; Security &gt; Apps and Websites</strong>.</li>
                            <li>Find "CreatorHub" under Active apps and click <strong>"Remove"</strong>.</li>
                        </ol>
                    </div>
                </div>

                <section>
                    <h2>What Data Will Be Deleted</h2>
                    <p>When you request complete deletion via the form above, we remove:</p>
                    <ul>
                        <li><strong>Account Information:</strong> Email, username, passwords.</li>
                        <li><strong>Platform Data:</strong> Connected Instagram/YouTube IDs and all stored OAuth tokens.</li>
                        <li><strong>Content:</strong> Scheduled posts, AI settings, generated personas.</li>
                        <li><strong>Analytics:</strong> Aggregated campaign data and usage logs.</li>
                    </ul>
                </section>

                <footer className="policy-footer">
                    <p><strong>CreatorHub</strong></p>
                    <p>Committed to data privacy and user control.</p>
                </footer>
            </div>
        </div>
    );
};

export default DataDeletion;
