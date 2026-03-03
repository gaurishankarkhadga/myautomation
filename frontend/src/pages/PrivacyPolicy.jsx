import React from 'react';
import './PolicyPages.css';

const PrivacyPolicy = () => {
    return (
        <div className="policy-container">
            <div className="policy-content">
                <h1>Privacy Policy</h1>
                <p className="last-updated">Last Updated: March 1, 2026</p>

                <section>
                    <h2>1. Introduction</h2>
                    <p>
                        CreatorHub ("we," "our," or "us") is committed to protecting your privacy and being fully transparent about how we handle your data.
                        This Privacy Policy explicitly explains how we collect, use, disclose, and safeguard your
                        information when you use our creator management platform, including our Instagram and YouTube automation tools.
                    </p>
                    <p>
                        By accessing our Service and utilizing our YouTube integration features, you are agreeing to be bound by the
                        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer"> YouTube Terms of Service</a> and the
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"> Google Privacy Policy</a>.
                    </p>
                </section>

                <section>
                    <h2>2. Information We Collect</h2>

                    <h3>2.1 Account Information</h3>
                    <p>When you register for CreatorHub, we collect:</p>
                    <ul>
                        <li>Name and email address</li>
                        <li>Encrypted account passwords</li>
                        <li>Billing information (if applicable, processed securely via third-party providers)</li>
                        <li>Voluntary profile information (e.g., target niche, bios)</li>
                    </ul>

                    <h3>2.2 Meta / Instagram Data (Graph API)</h3>
                    <p>When you explicitly authorize connection to your Instagram account via the official Instagram Graph API, we collect:</p>
                    <ul>
                        <li>Instagram Username and Account ID</li>
                        <li>Public profile details (Bio, Profile Picture, Follower/Following counts)</li>
                        <li>Media content (Posts, Stories, Reels) and associated captions/hashtags</li>
                        <li>Engagement metrics (Likes, Comments, Shares, Saves)</li>
                        <li>Direct Messages (Only collected and processed if you explicitly enable the DM Automation feature)</li>
                        <li>OAuth Access Tokens (Stored securely to maintain API connection)</li>
                    </ul>

                    <h3>2.3 Google / YouTube Data (Google API Services)</h3>
                    <p>When you explicitly authorize connection to your YouTube channel, we access and collect:</p>
                    <ul>
                        <li>YouTube Channel ID, Title, and Custom URL</li>
                        <li>Public profile information (Channel description, Avatars/Thumbnails)</li>
                        <li>Channel Analytics (Subscriber count, Total view count, Video count)</li>
                        <li>Video Metadata (Titles, Descriptions, Statistics, Publishing dates)</li>
                        <li>Comments and your replies on your channel's videos</li>
                        <li>OAuth Access and Refresh Tokens (Stored securely to maintain API connection)</li>
                    </ul>
                    <div className="compliance-highlight">
                        <h4>Google API Services User Data Policy Compliance</h4>
                        <p>
                            <strong>CreatorHub's use and transfer to any other app of information received from Google APIs will strictly adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</strong>
                        </p>
                        <p>
                            We do not use Google Workspace APIs to develop, improve, or train generalized AI and/or machine learning models. User data retrieved via Google APIs is only used to provide the specific automation and analytics features displayed within the CreatorHub application.
                        </p>
                    </div>

                    <h3>2.4 Usage Information & Analytics</h3>
                    <p>To ensure platform stability and prevent abuse, we automatically collect:</p>
                    <ul>
                        <li>Device identifiers and IP addresses</li>
                        <li>Browser type, version, and operating system</li>
                        <li>App interaction data (clicks, feature usage patterns)</li>
                        <li>Error logs and crash reports</li>
                    </ul>
                </section>

                <section>
                    <h2>3. How We Use Your Information</h2>
                    <p>We process your data exclusively for the following purposes:</p>
                    <ul>
                        <li><strong>Core Services:</strong> To provide, operate, and maintain our automation tools (e.g., scheduling posts, executing auto-replies).</li>
                        <li><strong>Analytics:</strong> To aggregate your engagement data and provide you with actionable insights.</li>
                        <li><strong>AI Generation:</strong> To utilize AI (e.g., Google Gemini API) to generate context-aware, personalized comment replies or suggested content ideas strictly on your behalf. <em>Your specific user data is NOT used to train foundational AI models.</em></li>
                        <li><strong>Security:</strong> To detect, prevent, and address technical issues, unauthorized access, or fraudulent activity.</li>
                        <li><strong>Communication:</strong> To send critical service updates, security alerts, and support messages.</li>
                    </ul>
                </section>

                <section>
                    <h2>4. Data Sharing and Disclosure</h2>
                    <p><strong>We absolutely DO NOT sell your personal data to third parties.</strong> We only share information in the following limited circumstances:</p>
                    <ul>
                        <li><strong>With Your Consent:</strong> When you explicitly direct us to share data (e.g., utilizing a third-party affiliate integration).</li>
                        <li><strong>Service Providers:</strong> Trusted third-party vendors (like AWS/Render for database hosting, or Gemini for AI processing) who require access to operate the platform. These providers are strictly bound by confidentiality agreements.</li>
                        <li><strong>Legal Compliance:</strong> If required by law, subpoena, or reasonable requests from law enforcement to protect the rights, property, or safety of CreatorHub, our users, or the public.</li>
                        <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, user data may be transferred, provided the acquiring party agrees to respect this Privacy Policy.</li>
                    </ul>
                </section>

                <section>
                    <h2>5. Data Storage, Security, and Retention</h2>

                    <h3>5.1 Security Measures</h3>
                    <p>We implement industry-standard security measures to protect your data:</p>
                    <ul>
                        <li>All connections utilize HTTPS/SSL encryption (TLS 1.2+).</li>
                        <li>OAuth Tokens (Instagram & Google) are heavily encrypted at rest using AES-256 within our MongoDB databases.</li>
                        <li>Access to production databases is strictly limited to authorized personnel via secure authentication.</li>
                    </ul>

                    <h3>5.2 Data Retention</h3>
                    <ul>
                        <li><strong>Active Accounts:</strong> We retain your data as long as your account is active to provide the service.</li>
                        <li><strong>Revoked Access:</strong> If you disconnect a platform (e.g., YouTube), the associated OAuth tokens are immediately destroyed.</li>
                        <li><strong>Account Deletion:</strong> Upon requesting account deletion, all Personally Identifiable Information (PII) and connected platform data is permanently purged from our active databases within 30 days, and from secure backups within 90 days.</li>
                    </ul>
                </section>

                <section>
                    <h2>6. Your Rights & Data Revocation</h2>
                    <p>Depending on your location (GDPR, CCPA), you hold strict rights over your data. You may:</p>
                    <ul>
                        <li><strong>Access & Port:</strong> Request a complete export of the data we hold about you.</li>
                        <li><strong>Correct:</strong> Update inaccurate account information.</li>
                        <li><strong>Delete:</strong> Initiate complete data erasure via our <a href="/data-deletion">Data Deletion page</a>.</li>
                    </ul>

                    <h3>6.1 Revoking Third-Party Access</h3>
                    <p>You have full control to instantly sever CreatorHub's access to your social accounts at any time:</p>
                    <ul>
                        <li><strong>Google / YouTube:</strong> You may instantly revoke our app's access to your Google account via the <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">Google Security Settings page</a>. Doing so will immediately stop all YouTube automation.</li>
                        <li><strong>Meta / Instagram:</strong> You may revoke access via your Instagram App under Settings &gt; Security &gt; Apps and Websites.</li>
                    </ul>
                </section>

                <section>
                    <h2>7. Children's Privacy</h2>
                    <p>
                        Our service is strictly not intended for individuals under the age of 13.
                        We do not knowingly collect personal information from children. If we discover we have inadvertently collected such data, we will delete it immediately.
                    </p>
                </section>

                <section>
                    <h2>8. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy periodically to reflect changes in our practices, or updates to Meta or Google API requirements. We will prominently notify users of significant changes via email or an in-app alert. Continued use of the platform constitutes your acceptance of the revised policy.
                    </p>
                </section>

                <section>
                    <h2>9. Contact Us</h2>
                    <p>If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact our Data Protection Officer:</p>
                    <ul>
                        <li><strong>Email:</strong> privacy@creatorhub.com</li>
                        <li><strong>Data Deletion Workflow:</strong> <a href="/data-deletion">Submit a Deletion Request</a></li>
                    </ul>
                </section>

                <footer className="policy-footer">
                    <p><strong>CreatorHub</strong></p>
                    <p>Built for Creators. Designed for Compliance.</p>
                </footer>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
