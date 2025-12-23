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
            <div className="policy-content">
                <h1>Data Deletion Request</h1>
                <p className="last-updated">Last Updated: December 22, 2024</p>

                <section className="deletion-intro">
                    <p>
                        We respect your right to privacy and data control. This page allows you to
                        request deletion of all data associated with your CreatorHub account in
                        compliance with GDPR, CCPA, and Meta Platform Policies.
                    </p>
                </section>

                <section className="deletion-form-section">
                    <h2>Submit Deletion Request</h2>

                    {!submitted ? (
                        <form onSubmit={handleSubmit} className="deletion-form">
                            <div className="form-group">
                                <label htmlFor="email">Email Address:</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your.email@example.com"
                                    required
                                />
                                <small>Enter the email associated with your CreatorHub account</small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmationCode">Confirmation Code (Optional):</label>
                                <input
                                    type="text"
                                    id="confirmationCode"
                                    value={confirmationCode}
                                    onChange={(e) => setConfirmationCode(e.target.value)}
                                    placeholder="Enter code if provided"
                                />
                                <small>Leave blank for first-time requests</small>
                            </div>

                            <button type="submit" className="submit-btn">
                                Submit Deletion Request
                            </button>

                            <p className="form-note">
                                You will receive a verification email to confirm your request.
                            </p>
                        </form>
                    ) : (
                        <div className="success-message">
                            <h3>✓ Request Submitted Successfully</h3>
                            <p>
                                Your data deletion request has been received. Please check your email
                                for a verification link within 24 hours. Click the link to confirm
                                and begin the deletion process.
                            </p>
                            <p>
                                <strong>What happens next:</strong>
                            </p>
                            <ol>
                                <li>Verification email sent to {email}</li>
                                <li>Click verification link within 48 hours</li>
                                <li>Deletion process begins immediately</li>
                                <li>Confirmation email when complete</li>
                            </ol>
                        </div>
                    )}
                </section>

                <section>
                    <h2>What Data Will Be Deleted</h2>
                    <p>When you request deletion, we remove:</p>
                    <ul>
                        <li><strong>Account Information:</strong> Email, username, profile data</li>
                        <li><strong>Instagram Data:</strong> Connected account info, OAuth tokens (immediately revoked)</li>
                        <li><strong>Content:</strong> All scheduled posts, automation settings</li>
                        <li><strong>Analytics:</strong> All engagement data and insights</li>
                        <li><strong>Messages:</strong> Any DM templates or automation data</li>
                        <li><strong>Usage Logs:</strong> Activity logs and session data</li>
                    </ul>
                </section>

                <section>
                    <h2>Deletion Timeline</h2>
                    <ul>
                        <li><strong>Immediate:</strong> Instagram access tokens revoked, account access disabled</li>
                        <li><strong>Within 48 hours:</strong> Active data marked for deletion</li>
                        <li><strong>Within 30 days:</strong> All user data permanently deleted from production databases</li>
                        <li><strong>Within 90 days:</strong> All backup copies completely removed</li>
                    </ul>
                    <p className="note">
                        Legal requirements may necessitate retention of certain transaction records
                        for accounting purposes, though these will be anonymized.
                    </p>
                </section>

                <section>
                    <h2>Alternative Deletion Methods</h2>

                    <h3>Method 1: Through Your Account</h3>
                    <ol>
                        <li>Log into your CreatorHub account</li>
                        <li>Navigate to Settings → Account → Privacy & Data</li>
                        <li>Click "Delete My Account"</li>
                        <li>Confirm deletion and verify via email</li>
                    </ol>

                    <h3>Method 2: Email Request</h3>
                    <p>Send an email to: <strong>privacy@creatorhub.com</strong></p>
                    <p>Include in your email:</p>
                    <ul>
                        <li>Full name</li>
                        <li>Email address used for registration</li>
                        <li>Instagram username connected to CreatorHub</li>
                        <li>Subject line: "Data Deletion Request"</li>
                    </ul>

                    <h3>Method 3: Via Facebook/Instagram Settings</h3>
                    <ol>
                        <li>Go to Instagram Settings → Security → Apps and Websites</li>
                        <li>Find "CreatorHub" in your connected apps</li>
                        <li>Click "Remove"</li>
                        <li>Data deletion will be triggered automatically</li>
                    </ol>
                </section>

                <section>
                    <h2>Verification Process</h2>
                    <p>To protect your privacy and prevent unauthorized deletions:</p>
                    <ol>
                        <li>We send a verification link to your registered email</li>
                        <li>You must click the link within 48 hours to confirm</li>
                        <li>Once verified, deletion process begins immediately</li>
                        <li>You receive final confirmation when deletion is complete</li>
                    </ol>
                </section>

                <section>
                    <h2>Data We Must Retain</h2>
                    <p>Certain data may be retained for legal compliance:</p>
                    <ul>
                        <li>Transaction records (if you had paid subscriptions)</li>
                        <li>Records required by tax/accounting laws</li>
                        <li>Data involved in ongoing legal proceedings</li>
                    </ul>
                    <p>All retained data will be anonymized and securely stored.</p>
                </section>

                <section>
                    <h2>Your Rights Under GDPR & CCPA</h2>
                    <p>You have the right to:</p>
                    <ul>
                        <li><strong>Access:</strong> Request a copy of all data we hold about you</li>
                        <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
                        <li><strong>Erasure:</strong> Delete your data (this page)</li>
                        <li><strong>Portability:</strong> Export your data in machine-readable format</li>
                        <li><strong>Object:</strong> Object to certain data processing activities</li>
                        <li><strong>Restrict:</strong> Request restriction of processing</li>
                    </ul>
                </section>

                <section>
                    <h2>Instagram Platform Compliance</h2>
                    <p>This Data Deletion process complies with:</p>
                    <ul>
                        <li>Meta Platform Policy Section 3.14 (User Data Deletion)</li>
                        <li>Instagram Graph API Data Deletion Requirements</li>
                        <li>GDPR Article 17 (Right to Erasure)</li>
                        <li>CCPA Section 1798.105 (Consumer Right to Delete)</li>
                    </ul>
                </section>

                <section>
                    <h2>After Deletion</h2>
                    <p>Once deletion is complete:</p>
                    <ul>
                        <li>You cannot recover your account or data</li>
                        <li>You can create a new account with the same email</li>
                        <li>Your Instagram account remains unaffected</li>
                        <li>Scheduled posts will not be published</li>
                        <li>All automations will stop immediately</li>
                    </ul>
                </section>

                <section>
                    <h2>Need Help?</h2>
                    <p>For questions or assistance:</p>
                    <ul>
                        <li><strong>Email:</strong> privacy@creatorhub.com</li>
                        <li><strong>Response Time:</strong> Within 48 hours</li>
                        <li><strong>Privacy Policy:</strong> <a href="/privacy-policy">Read here</a></li>
                    </ul>
                </section>

                <footer className="policy-footer">
                    <p><strong>CreatorHub is committed to protecting your privacy and respecting your data rights.</strong></p>
                    <p>Empowering Creators with Automation</p>
                </footer>
            </div>
        </div>
    );
};

export default DataDeletion;
