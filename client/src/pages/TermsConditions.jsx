import LegalPageLayout from '../components/layout/LegalPageLayout';

export default function TermsConditions() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      description="Website Usage Rules & Policies at Vedhunt"
      lastUpdated="May 2024"
    >
      <div className="space-y-8">
        <section>
          <p>
            Welcome to Vedhunt InfoTech (“Company,” “we,” “our,” or “us”). By accessing our website www.vedhunt.in, using our services, or accessing the Vedhunt Client Portal, you agree to comply with and be bound by these Terms & Conditions.
          </p>
          <p className="mt-4">
            Please read them carefully before using any of our services. If you do not agree to these Terms, you may not access or use our website or services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">1. Legal Entity & Applicability</h2>
          <p className="mb-4">Vedhunt InfoTech is an Information Technology and Business Process Solutions provider operating under Indian law. These Terms govern:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The use of our website and digital platforms.</li>
            <li>The engagement of our services, including website/app development, digital marketing, automation, analytics, MIS reporting, and accounting-related solutions.</li>
            <li>Access to the Vedhunt Client Portal and any associated systems.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">2. Acceptance of Terms</h2>
          <p className="mb-4">By using this website, registering for services, or signing a project agreement, you acknowledge that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You have read, understood, and agreed to these Terms.</li>
            <li>You are authorized to act on behalf of the entity you represent (if applicable).</li>
            <li>You consent to the collection and processing of data as per our Privacy Policy.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">3. Services Overview</h2>
          <p className="mb-4">Vedhunt InfoTech provides:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Website & App Development</li>
            <li>Digital Marketing and Social Media Management</li>
            <li>Automation (SQL, Power BI, Python) and Data Analytics</li>
            <li>MIS & Reporting Services</li>
            <li>Accounting & Financial Analytics</li>
            <li>Business Process Optimization and Consultation</li>
          </ul>
          <p className="mt-4">Each service may have its own scope, deliverables, timelines, and payment terms defined in a separate agreement or proposal.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">4. Intellectual Property Rights</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Ownership of Work:</strong> All source code, designs, documents, dashboards, and related deliverables created by Vedhunt InfoTech remain the company’s intellectual property until full payment is received. Upon payment completion, ownership of final deliverables transfers to the client, excluding pre-existing code, frameworks, or proprietary tools.</li>
            <li><strong>Trademarks and Branding:</strong> Vedhunt InfoTech trademarks, logos, and brand assets cannot be used without prior written consent.</li>
            <li><strong>Client Data:</strong> Client-provided content and data remain the property of the client. Vedhunt only uses such data to deliver services or as legally required.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">5. Confidentiality</h2>
          <p className="mb-4">Both Vedhunt InfoTech and the Client agree to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Maintain strict confidentiality of all proprietary, personal, and business data shared during the engagement.</li>
            <li>Use such information solely for the purpose of project execution.</li>
            <li>Prevent unauthorized access, duplication, or disclosure.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">6. Warranties and Limitations</h2>
          <p className="mb-4">Vedhunt InfoTech provides services on a best-effort and professional basis, without guaranteeing outcomes beyond the defined scope.</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>We do not warrant uninterrupted, error-free, or 100% bug-free services.</li>
            <li>We are not responsible for issues caused by third-party tools, hosting providers, APIs, or client-side data errors.</li>
          </ul>
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/10 text-slate-800 dark:text-app-text rounded-xl border border-red-100 dark:border-red-900/20">
            <p><strong>Limitation of Liability:</strong> To the fullest extent permitted by law, Vedhunt InfoTech’s liability for any damages (direct, indirect, incidental, or consequential) shall not exceed the total fees paid by the client for the specific service within the last 6 months.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">7. Contact Information</h2>
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
