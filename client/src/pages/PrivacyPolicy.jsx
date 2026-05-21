import LegalPageLayout from '../components/layout/LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="Data Protection & User Privacy at Vedhunt"
      lastUpdated="May 2024"
    >
      <div className="space-y-8">
        <section>
          <p>
            Vedhunt InfoTech ("we," "our," or "us") is committed to protecting the privacy and security of our clients, partners, and visitors. We collect and process information only to deliver better services, enhance user experience, and fulfill our contractual and legal obligations.
          </p>
          <p className="mt-4">
            This Privacy Policy explains how we handle, store, and safeguard your personal and business information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">1. Scope of This Policy</h2>
          <p>This policy applies to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Visitors to our website (www.vedhunt.in)</li>
            <li>Registered users of the Vedhunt Client Portal</li>
            <li>Clients and partners using our services, including website and app development, digital marketing, automation, analytics, accounting, and reporting solutions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">2. Information We Collect</h2>
          <h3 className="text-lg font-bold text-app-text mt-4 mb-2">a) Information You Provide Voluntarily</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your name, business name, job title, email address, and contact number.</li>
            <li>Project briefs, files, and data shared for development, automation, or analysis.</li>
            <li>Login credentials (username, email) for secure access to our client portal.</li>
            <li>Communication history (emails, chat, forms, or tickets) for support purposes.</li>
          </ul>

          <h3 className="text-lg font-bold text-app-text mt-6 mb-2">b) Information Collected Automatically</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Device information (browser, operating system, IP address).</li>
            <li>Session data (pages visited, duration, and referral sources).</li>
            <li>Cookies or analytics data to understand how our services are used.</li>
          </ul>

          <h3 className="text-lg font-bold text-app-text mt-6 mb-2">c) Information from Third Parties</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Integrated tools (Google Ads, Power BI, LinkedIn, Meta Business Suite).</li>
            <li>Authorized partners or analytics services that help us optimize performance.</li>
          </ul>
          
          <div className="mt-4 p-4 bg-primary/10 text-app-text rounded-xl border border-primary/20">
            <p className="font-semibold">💡 We do not collect unnecessary personal data, and we never sell, trade, or rent your information.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">3. Purpose of Data Collection</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Providing and maintaining our services and client portal.</li>
            <li>Communicating updates, deliverables, and project progress.</li>
            <li>Improving our systems, dashboards, and user experience.</li>
            <li>Responding to support requests or technical inquiries.</li>
            <li>Fulfilling contractual and billing obligations.</li>
            <li>Ensuring compliance with data protection and security standards.</li>
          </ul>
          <p className="mt-4">All data collected is used solely to serve our clients better — not for unsolicited marketing or unrelated activities.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">4. Legal Basis for Processing</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Contractual necessity:</strong> To deliver agreed services.</li>
            <li><strong>Legitimate interest:</strong> To maintain and improve service quality.</li>
            <li><strong>Consent:</strong> For communications like newsletters or feedback (optional).</li>
            <li><strong>Legal obligation:</strong> To comply with applicable data protection laws.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">5. Data Storage and Retention</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your information is stored securely on encrypted servers and trusted cloud platforms.</li>
            <li>Access is restricted to authorized Vedhunt personnel only.</li>
            <li>We retain personal data only as long as required for the purpose it was collected, after which it is securely deleted or anonymized.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">6. Data Security</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>End-to-end SSL encryption on all Vedhunt websites and portals.</li>
            <li>Multi-factor authentication for internal accounts.</li>
            <li>Firewall and malware protection via enterprise-grade security systems.</li>
            <li>Encrypted data transfers through secure protocols (HTTPS, sFTP).</li>
            <li>Strict confidentiality agreements with all employees and contractors.</li>
            <li>Regular audits and data recovery backups.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">7. Data Sharing and Disclosure</h2>
          <p className="mb-4">Vedhunt InfoTech does not sell, rent, or lease personal data under any circumstance. We may share information only with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Internal teams and authorized partners directly involved in service delivery.</li>
            <li>Third-party vendors providing infrastructure, analytics, or email communication tools — all bound by confidentiality and data protection agreements.</li>
            <li>Government authorities or regulators, but only when legally required.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">8. Cookies and Tracking Technologies</h2>
          <p className="mb-4">We use cookies and analytics tools (e.g., Google Analytics, Meta Pixel) to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Improve website functionality and user experience.</li>
            <li>Measure performance of marketing campaigns.</li>
            <li>Recognize returning visitors and personalize content.</li>
          </ul>
          <p className="mt-4">You can manage or disable cookies through your browser settings. Some functions may not work properly if cookies are disabled.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">9. Contact Us</h2>
          <p className="mb-4">If you have any questions or concerns regarding this Privacy Policy or how your information is handled, please contact:</p>
          <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-xl border border-slate-100 dark:border-app-border space-y-2">
            <p><strong>Email:</strong> <a href="mailto:info@vedhunt.in" className="text-primary hover:underline">info@vedhunt.in</a></p>
            <p><strong>Phone:</strong> +91 86524 10289</p>
            <p><strong>Address:</strong> Vedhunt InfoTech, Pune, Maharashtra, India</p>
          </div>
        </section>
      </div>
    </LegalPageLayout>
  );
}
