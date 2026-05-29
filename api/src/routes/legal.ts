import { Hono } from 'hono';

const legalRoutes = new Hono();

const EFFECTIVE_DATE = '29 May 2026';
const COMPANY_NAME = 'Šmídl Online (Jan Šmídl)';
const CONTACT_EMAIL = 'privacy@spicypick.com';
const APP_NAME = 'SpicyPick';
const APP_URL = 'https://spicypick.app';

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — SpicyPick</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a2e;line-height:1.6}
    h1{color:#e94560}h2{color:#1a1a2e;border-bottom:1px solid #eee;padding-bottom:8px}a{color:#e94560}
    table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}
  </style>
</head>
<body>
<h1>Privacy Policy</h1>
<p><strong>Effective date:</strong> ${EFFECTIVE_DATE} &nbsp;|&nbsp; <strong>Last updated:</strong> ${EFFECTIVE_DATE}</p>
<p>${APP_NAME} ("we", "us", "our") operates the ${APP_NAME} mobile application and related services at <a href="${APP_URL}">${APP_URL}</a>. This Privacy Policy explains how we collect, use, and protect your personal data in accordance with the EU General Data Protection Regulation (GDPR) and applicable Czech law.</p>

<h2>1. Who We Are</h2>
<p>${COMPANY_NAME}, Czech Republic<br>Contact: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

<h2>2. Data We Collect</h2>
<ul>
  <li><strong>Account data:</strong> email address, username, password hash (bcrypt), registration date.</li>
  <li><strong>Profile data:</strong> display name, avatar, preferred language, XP/level, streak.</li>
  <li><strong>Usage data:</strong> daily votes, scenario interactions, challenge participation, guild/league data.</li>
  <li><strong>Premium/billing data:</strong> subscription status, purchase receipt metadata (via RevenueCat — no raw card data).</li>
  <li><strong>Technical data:</strong> device type, OS version, app version, IP address (rate-limiting), session identifiers.</li>
  <li><strong>Crash data:</strong> stack traces, error messages via Sentry (no email/content).</li>
  <li><strong>Analytics events:</strong> screen views, feature usage — anonymised via PostHog.</li>
</ul>

<h2>3. How We Use Your Data</h2>
<table>
  <tr><th>Purpose</th><th>Legal basis (GDPR Art.)</th></tr>
  <tr><td>Providing the service (auth, gameplay, notifications)</td><td>Contract — Art. 6(1)(b)</td></tr>
  <tr><td>Processing premium subscription</td><td>Contract — Art. 6(1)(b)</td></tr>
  <tr><td>Transactional emails (welcome, password reset)</td><td>Contract — Art. 6(1)(b)</td></tr>
  <tr><td>Improving the product (crash analysis, analytics)</td><td>Legitimate interest — Art. 6(1)(f)</td></tr>
  <tr><td>Compliance &amp; abuse prevention</td><td>Legal obligation — Art. 6(1)(c)</td></tr>
</table>

<h2>4. Third-Party Services</h2>
<ul>
  <li><strong>PostHog</strong> (posthog.com) — product analytics; anonymised usage events. <a href="https://posthog.com/privacy">Privacy Policy</a></li>
  <li><strong>Sentry</strong> (sentry.io) — crash reporting &amp; error monitoring. <a href="https://sentry.io/privacy/">Privacy Policy</a></li>
  <li><strong>RevenueCat</strong> (revenuecat.com) — in-app purchase &amp; subscription management. <a href="https://www.revenuecat.com/privacy">Privacy Policy</a></li>
  <li><strong>Resend</strong> (resend.com) — transactional email delivery. <a href="https://resend.com/legal/privacy-policy">Privacy Policy</a></li>
</ul>
<p>We do not sell your personal data to third parties.</p>

<h2>5. Data Retention</h2>
<ul>
  <li>Account data: until deletion + 30 days (backup purge).</li>
  <li>Crash data: 90 days (Sentry default).</li>
  <li>Analytics events: 12 months rolling.</li>
  <li>Purchase receipts: 7 years (tax/legal requirement).</li>
</ul>

<h2>6. Your Rights (GDPR)</h2>
<ul>
  <li><strong>Access</strong> — request a copy of your data.</li>
  <li><strong>Portability</strong> — export via <em>Settings → Export my data</em> (JSON/CSV).</li>
  <li><strong>Rectification</strong> — correct data via profile settings.</li>
  <li><strong>Erasure</strong> — delete account via <em>Settings → Delete account</em> or email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</li>
  <li><strong>Restriction / Objection</strong> — contact us to restrict or object to processing.</li>
  <li><strong>Lodge a complaint</strong> — Úřad pro ochranu osobních údajů: <a href="https://www.uoou.cz">uoou.cz</a>.</li>
</ul>
<p>Requests answered within 30 days: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>7. Data Security</h2>
<p>Passwords hashed with bcrypt. Data in transit protected by TLS 1.2+. Refresh tokens hashed (SHA-256) in database. Short-lived JWT access tokens (15 min).</p>

<h2>8. International Transfers</h2>
<p>Primary servers in EU (Hetzner, Germany). Third-party processors may process data in the US under Standard Contractual Clauses (SCCs) or EU–US Data Privacy Framework adequacy decision.</p>

<h2>9. Children</h2>
<p>${APP_NAME} is not directed to children under 13. We do not knowingly collect data from children. Contact us to have any such data removed.</p>

<h2>10. Changes</h2>
<p>Material changes notified via in-app message or email at least 7 days before taking effect.</p>

<h2>11. Contact</h2>
<p>${COMPANY_NAME}, Czech Republic<br>Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</body>
</html>`;

const TERMS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service — SpicyPick</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a2e;line-height:1.6}
    h1{color:#e94560}h2{color:#1a1a2e;border-bottom:1px solid #eee;padding-bottom:8px}a{color:#e94560}
  </style>
</head>
<body>
<h1>Terms of Service</h1>
<p><strong>Effective date:</strong> ${EFFECTIVE_DATE} &nbsp;|&nbsp; <strong>Last updated:</strong> ${EFFECTIVE_DATE}</p>
<p>These Terms govern your use of ${APP_NAME} ("Service"), operated by ${COMPANY_NAME}, Czech Republic ("we", "us"). By using ${APP_NAME} you agree to these Terms.</p>

<h2>1. Eligibility</h2>
<p>You must be at least 13 years old. By using the Service you confirm you meet this requirement.</p>

<h2>2. Accounts</h2>
<ul>
  <li>Provide accurate registration information and keep it updated.</li>
  <li>You are responsible for all activity under your account.</li>
  <li>Do not share your account or create accounts on behalf of others without authorisation.</li>
</ul>

<h2>3. User-Submitted Content</h2>
<p>Users may submit scenario suggestions. By submitting you:</p>
<ul>
  <li>Grant us a worldwide, royalty-free, perpetual licence to use, display, modify, and distribute your submission within ${APP_NAME}.</li>
  <li>Represent that you own or have the right to submit the content.</li>
  <li>Understand that submissions are reviewed by AI moderation and editorial team before publication; we may reject any submission.</li>
</ul>

<h2>4. Prohibited Content &amp; Conduct</h2>
<p>You may not:</p>
<ul>
  <li>Submit spam, duplicate scenarios, or mass unsolicited messages.</li>
  <li>Submit sexually explicit, pornographic, or adult content.</li>
  <li>Harass, bully, threaten, or defame other users.</li>
  <li>Incite hatred or discrimination based on race, ethnicity, religion, gender, sexual orientation, disability, or nationality.</li>
  <li>Distribute malware or attempt unauthorised access to our systems.</li>
  <li>Manipulate leaderboards, votes, or XP through automation or exploits.</li>
  <li>Violate any applicable law or third-party rights.</li>
</ul>
<p>Violations may result in content removal, suspension, or permanent ban.</p>

<h2>5. Premium Subscription</h2>
<ul>
  <li><strong>SpicyPick Premium</strong> is an optional paid subscription (ad-free, exclusive content, enhanced features).</li>
  <li>Billing is processed by Apple App Store / Google Play via RevenueCat. Store terms apply.</li>
  <li>Subscriptions auto-renew unless cancelled at least 24 hours before renewal. Manage in your App Store / Google Play account.</li>
  <li>Refunds are handled by Apple or Google according to their refund policies.</li>
  <li>We reserve the right to modify Premium features with reasonable notice.</li>
</ul>

<h2>6. Intellectual Property</h2>
<p>${APP_NAME}, its logo, design, scenarios authored by us, and all related software are owned by ${COMPANY_NAME}. You may not copy, modify, or distribute them without written permission.</p>

<h2>7. Disclaimers</h2>
<p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION. SCENARIOS ARE FOR ENTERTAINMENT PURPOSES ONLY.</p>

<h2>8. Limitation of Liability</h2>
<p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PRECEDING 12 MONTHS, OR EUR 50, WHICHEVER IS GREATER. NOTHING HEREIN LIMITS LIABILITY FOR DEATH OR PERSONAL INJURY CAUSED BY NEGLIGENCE, OR ANY LIABILITY THAT CANNOT BE LIMITED UNDER CZECH OR EU LAW.</p>

<h2>9. Governing Law &amp; Disputes</h2>
<p>These Terms are governed by Czech law. EU consumers retain the right to bring proceedings in their country of residence. EU ODR platform: <a href="https://ec.europa.eu/consumers/odr">ec.europa.eu/consumers/odr</a>.</p>

<h2>10. Changes</h2>
<p>Material changes notified via in-app notification or email at least 7 days before taking effect. Continued use = acceptance.</p>

<h2>11. Termination</h2>
<p>You may delete your account via app settings at any time. We may terminate accounts for violations. Upon termination your licence ends immediately.</p>

<h2>12. Contact</h2>
<p>Questions: <a href="mailto:legal@spicypick.com">legal@spicypick.com</a><br>${COMPANY_NAME}, Czech Republic</p>
</body>
</html>`;

legalRoutes.get('/privacy', (c) => {
  return c.html(PRIVACY_HTML, 200, {
    'Cache-Control': 'public, max-age=86400',
  });
});

legalRoutes.get('/terms', (c) => {
  return c.html(TERMS_HTML, 200, {
    'Cache-Control': 'public, max-age=86400',
  });
});

export default legalRoutes;
