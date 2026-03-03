import React from 'react';
import './PolicyPages.css';

const TermsAndConditions = () => {
    return (
        <div className="policy-container">
            <div className="policy-content">
                <h1>Terms and Conditions</h1>
                <p className="last-updated">Last Updated: March 1, 2026</p>

                <section>
                    <h2>1. Acceptance of Terms</h2>
                    <p>
                        By accessing and using CreatorHub ("Service," "Platform"), you confirm that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree, please discontinue use immediately.
                    </p>
                    <p>
                        CreatorHub heavily relies on third-party API Services. By utilizing our YouTube integration features, you are explicitly agreeing to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>. Similarly, by utilizing Instagram features, you agree to the Meta Platform Terms.
                    </p>
                </section>

                <section>
                    <h2>2. Service Description</h2>
                    <p>CreatorHub provides an AI-powered automation suite designed for digital creators, including but not limited to:</p>
                    <ul>
                        <li>Instagram and YouTube content scheduling</li>
                        <li>Automated comment reply generation and moderation</li>
                        <li>Direct Message automation</li>
                        <li>Channel analytics and engagement insights</li>
                        <li>AI-powered content assistance using Google Gemini</li>
                    </ul>
                </section>

                <section>
                    <h2>3. Eligibility and Account Responsibilities</h2>
                    <p>To use CreatorHub, you must:</p>
                    <ul>
                        <li>Be at least 13 years old.</li>
                        <li>Own, or have explicit legal authorization to manage, the connected Instagram and/or YouTube accounts.</li>
                        <li>Provide accurate registration information and keep your credentials secure.</li>
                    </ul>
                    <p><strong>Security:</strong> You are entirely responsible for all activities occurring under your account. Notify us immediately of any unauthorized access.</p>
                </section>

                <section>
                    <h2>4. Platform Integrations (Meta & Google)</h2>

                    <h3>4.1 Authorization & Compliance</h3>
                    <p>By connecting your Instagram or YouTube account, you:</p>
                    <ul>
                        <li>Authorize our application to access your data via official APIs.</li>
                        <li>Strictly agree to follow <a href="https://help.instagram.com/581066165581870" target="_blank" rel="noopener noreferrer">Instagram's Community Guidelines</a> and <a href="https://www.youtube.com/howyoutubeworks/policies/community-guidelines/" target="_blank" rel="noopener noreferrer">YouTube's Community Guidelines</a>.</li>
                        <li>Understand that these platforms may change their API rules, which could disrupt our Service without notice.</li>
                    </ul>

                    <h3>4.2 Content Ownership</h3>
                    <p>
                        You retain full ownership of all intellectual property rights to the content you create and post through our Service. You grant us a limited, worldwide, non-exclusive license strictly to process, translate (via AI), store, and publish this content to your connected platforms strictly on your behalf.
                    </p>
                </section>

                <section>
                    <h2>5. Acceptable Use Policy</h2>
                    <p>You agree to use CreatorHub legally and ethically. You strictly may <strong>NOT</strong>:</p>
                    <ul>
                        <li>Use the automation tools to spam, harass, defraud, or abuse other users on <i>any</i> platform.</li>
                        <li>Post illegal, highly offensive, or hateful content.</li>
                        <li>Use our service to artificially inflate engagement metrics (e.g., buying fake likes/subscribers via our endpoints).</li>
                        <li>Attempt to reverse-engineer, hack, or disrupt CreatorHub's infrastructure.</li>
                    </ul>
                    <p><strong>Immediate Termination:</strong> Violating this Acceptable Use Policy will result in an immediate, unappealable ban from CreatorHub.</p>
                </section>

                <section>
                    <h2>6. Disclaimers and Assumption of Risk</h2>
                    <p>CreatorHub provides powerful automation tools, but you use them entirely at your own risk.</p>
                    <ul>
                        <li><strong>Platform Bans:</strong> We formulate our API calls to be compliant, but we <strong>do not guarantee</strong> your account will not face restrictions. CreatorHub is not liable if Instagram or YouTube restricts, shadow-bans, or terminates your account due to your use of automation.</li>
                        <li><strong>AI Generation:</strong> AI generated replies or content (via Gemini) may occasionally produce inaccurate or undesirable outputs. You are responsible for reviewing automated actions.</li>
                        <li><strong>Service Availability:</strong> The Service is provided "AS IS." We do not guarantee 100% uptime due to reliance on third-party APIs.</li>
                    </ul>
                </section>

                <section>
                    <h2>7. Limitation of Liability</h2>
                    <p>To the maximum extent permitted by applicable law:</p>
                    <ul>
                        <li>CreatorHub (and its creators) shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.</li>
                        <li>We are entirely free from liability regarding data loss, revenue loss, or reputational damage stemming from a social media platform banning your account.</li>
                        <li>Our total cumulative liability to you for any claims is strictly limited to the amount you paid us (if any) in the past 12 months.</li>
                    </ul>
                </section>

                <section>
                    <h2>8. Indemnification</h2>
                    <p>
                        You agree to defend, indemnify, and hold harmless CreatorHub and its affiliates from any claims, damages, obligations, losses, liabilities, costs, or debt arising from:
                    </p>
                    <ul>
                        <li>Your violation of these Terms or any third-party platform's terms.</li>
                        <li>Your violation of any third-party right, including copyright or privacy rights.</li>
                        <li>Any claim that your content caused damage to a third party.</li>
                    </ul>
                </section>

                <section>
                    <h2>9. Account Termination</h2>
                    <p>We reserve the right to suspend or terminate your access to the Service at any time, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
                </section>

                <section>
                    <h2>10. Governing Law</h2>
                    <p>
                        These Terms shall be governed and construed in accordance with the laws of your jurisdiction, without regard to its conflict of law provisions. Any disputes will be handled in a competent court in that jurisdiction.
                    </p>
                </section>

                <section>
                    <h2>11. Contact Details</h2>
                    <p>For inquiries regarding these Terms & Conditions:</p>
                    <ul>
                        <li><strong>Email:</strong> legal@creatorhub.com</li>
                        <li><strong>Privacy Concerns:</strong> See our <a href="/privacy-policy">Privacy Policy</a></li>
                    </ul>
                </section>

                <div className="acceptance-notice">
                    <p>
                        <strong>
                            By registering an account and utilizing CreatorHub's API connections, you legally bind yourself to these Terms and Conditions.
                        </strong>
                    </p>
                </div>

                <footer className="policy-footer">
                    <p><strong>CreatorHub</strong></p>
                    <p>Empowering Creators with AI automation.</p>
                </footer>
            </div>
        </div>
    );
};

export default TermsAndConditions;
