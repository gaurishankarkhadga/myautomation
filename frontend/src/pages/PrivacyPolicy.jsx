import React from 'react';
import './PolicyPages.css';

const PrivacyPolicy = () => {
    return (
        <div className="policy-container">
            <div className="policy-content">
                <h1>Privacy Policy</h1>
                <p className="last-updated">Last Updated: December 22, 2024</p>

                <section>
                    <h2>1. Introduction</h2>
                    <p>
                        CreatorHub ("we," "our," or "us") is committed to protecting your privacy.
                        This Privacy Policy explains how we collect, use, disclose, and safeguard your
                        information when you use our Instagram automation platform.
                    </p>
                </section>

                <section>
                    <h2>2. Information We Collect</h2>

                    <h3>2.1 Account Information</h3>
                    <ul>
                        <li>Name and email address</li>
                        <li>Username and password (encrypted)</li>
                        <li>Profile information you provide</li>
                    </ul>

                    <h3>2.2 Instagram Data</h3>
                    <p>When you connect your Instagram account, we collect:</p>
                    <ul>
                        <li>Instagram username and user ID</li>
                        <li>Profile information (bio, profile picture)</li>
                        <li>Account metrics (followers, following, posts)</li>
                        <li>Media content (posts, stories, reels)</li>
                        <li>Engagement data (likes, comments, shares)</li>
                        <li>Direct messages (only if DM automation is enabled)</li>
                    </ul>

                    <h3>2.3 Usage Information</h3>
                    <ul>
                        <li>Device information and IP address</li>
                        <li>Browser type and version</li>
                        <li>Usage patterns and analytics</li>
                        <li>Log files and error reports</li>
                    </ul>
                </section>

                <section>
                    <h2>3. How We Use Your Information</h2>
                    <p>We use your information to:</p>
                    <ul>
                        <li>Provide and maintain our automation services</li>
                        <li>Schedule and publish content to Instagram</li>
                        <li>Analyze engagement metrics and provide insights</li>
                        <li>Automate Instagram interactions (DMs, stories, etc.)</li>
                        <li>Improve our platform and user experience</li>
                        <li>Communicate with you about service updates</li>
                        <li>Ensure platform security and prevent fraud</li>
                        <li>Comply with legal obligations</li>
                    </ul>
                </section>

                <section>
                    <h2>4. Data Storage and Security</h2>

                    <h3>4.1 Storage</h3>
                    <ul>
                        <li>Data stored in encrypted MongoDB databases</li>
                        <li>Instagram credentials encrypted using AES-256</li>
                        <li>Cloud infrastructure with industry-standard security</li>
                    </ul>

                    <h3>4.2 Security Measures</h3>
                    <ul>
                        <li>HTTPS/SSL encrypted data transmission</li>
                        <li>JWT token-based authentication</li>
                        <li>Regular security audits</li>
                        <li>Limited employee access to user data</li>
                        <li>Automated backup systems</li>
                    </ul>
                </section>

                <section>
                    <h2>5. Data Sharing</h2>
                    <p><strong>We DO NOT sell your data.</strong> We may share information only in these cases:</p>
                    <ul>
                        <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
                        <li><strong>Service Providers:</strong> Trusted partners who help operate our platform (hosting, analytics)</li>
                        <li><strong>Legal Requirements:</strong> When required by law or to protect rights and safety</li>
                        <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets</li>
                    </ul>
                </section>

                <section>
                    <h2>6. Instagram Platform Compliance</h2>
                    <p>We comply with:</p>
                    <ul>
                        <li>Meta Platform Terms and Policies</li>
                        <li>Instagram API Terms of Use</li>
                        <li>Facebook Platform Policies</li>
                        <li>Data Protection Regulations (GDPR, CCPA)</li>
                    </ul>
                </section>

                <section>
                    <h2>7. Your Rights</h2>
                    <p>You have the right to:</p>
                    <ul>
                        <li><strong>Access:</strong> Request a copy of your data</li>
                        <li><strong>Correction:</strong> Update or correct your information</li>
                        <li><strong>Deletion:</strong> Request deletion via <a href="/data-deletion">Data Deletion page</a></li>
                        <li><strong>Portability:</strong> Export your data in readable format</li>
                        <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
                        <li><strong>Revoke Access:</strong> Disconnect Instagram anytime</li>
                    </ul>
                </section>

                <section>
                    <h2>8. Data Retention</h2>
                    <ul>
                        <li>Account data retained while your account is active</li>
                        <li>Deleted data removed within 30 days</li>
                        <li>Backup copies removed within 90 days</li>
                        <li>Legal requirements may require longer retention</li>
                    </ul>
                </section>

                <section>
                    <h2>9. Cookies and Tracking</h2>
                    <p>We use cookies for:</p>
                    <ul>
                        <li>Authentication and session management</li>
                        <li>User preferences and settings</li>
                        <li>Analytics and performance monitoring</li>
                        <li>Security and fraud prevention</li>
                    </ul>
                    <p>You can control cookies through your browser settings.</p>
                </section>

                <section>
                    <h2>10. Third-Party Services</h2>
                    <p>We use third-party services that may collect data:</p>
                    <ul>
                        <li>Instagram Graph API (Meta)</li>
                        <li>Cloud hosting providers</li>
                        <li>Analytics services</li>
                        <li>Payment processors (if applicable)</li>
                    </ul>
                    <p>These services have their own privacy policies.</p>
                </section>

                <section>
                    <h2>11. Children's Privacy</h2>
                    <p>
                        Our service is not intended for users under 13 years of age.
                        We do not knowingly collect data from children under 13.
                    </p>
                </section>

                <section>
                    <h2>12. International Users</h2>
                    <p>
                        If you access our service from outside your jurisdiction, your data
                        may be transferred and processed in different countries. We ensure
                        appropriate safeguards are in place.
                    </p>
                </section>

                <section>
                    <h2>13. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy periodically. We will notify you
                        of significant changes via email or platform notification. Continued
                        use after changes constitutes acceptance.
                    </p>
                </section>

                <section>
                    <h2>14. Contact Us</h2>
                    <p>For privacy questions or requests:</p>
                    <ul>
                        <li><strong>Email:</strong> privacy@creatorhub.com</li>
                        <li><strong>Data Deletion:</strong> <a href="/data-deletion">Submit Request</a></li>
                        <li><strong>Response Time:</strong> Within 48 hours</li>
                    </ul>
                </section>

                <footer className="policy-footer">
                    <p><strong>CreatorHub</strong></p>
                    <p>Empowering Creators with Automation</p>
                </footer>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
