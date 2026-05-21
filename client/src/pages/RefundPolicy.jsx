import LegalPageLayout from '../components/layout/LegalPageLayout';

export default function RefundPolicy() {
  return (
    <LegalPageLayout
      title="Refund & Billing Policy"
      description="Payments, Refunds & Service Terms at Vedhunt"
      lastUpdated="May 2024"
    >
      <div className="space-y-8">
        <section>
          <p>
            At Vedhunt InfoTech, we are committed to delivering high-quality, customized solutions that add measurable value to our clients’ businesses. Our services are intellectual and time-based, meaning they involve professional expertise, research, planning, and effort invested from the moment a project begins.
          </p>
          <p className="mt-4">
            For this reason, our billing and refund policy is designed to maintain fairness, transparency, and mutual respect between Vedhunt InfoTech and our clients.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">1. Scope</h2>
          <p className="mb-4">This policy applies to all professional services offered by Vedhunt InfoTech, including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Website & App Development</li>
            <li>Digital Marketing & Social Media Management</li>
            <li>Automation (SQL / Power BI / Python)</li>
            <li>MIS & Reporting Services</li>
            <li>Accounting & Financial Services</li>
            <li>Data Analytics, AI, and Consulting Projects</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">2. Billing Terms</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-app-text mb-2">1. Quotation & Agreement</h3>
              <p>Every project or engagement is initiated after a written quotation, proposal, or agreement is mutually approved. The scope of work, timeline, and payment schedule are clearly defined before commencement.</p>
            </div>
            <div>
              <h3 className="font-bold text-app-text mb-2">2. Advance Payment</h3>
              <p>Projects typically begin with an advance payment (as mentioned in the quotation or agreement). The advance is considered a confirmation of engagement and allocation of dedicated resources.</p>
            </div>
            <div>
              <h3 className="font-bold text-app-text mb-2">3. Milestone-Based Billing</h3>
              <p>Depending on the project type, billing may occur at key milestones, deliverable completion, or on a monthly retainer basis. All invoices are shared electronically, inclusive of applicable taxes (GST or others).</p>
            </div>
            <div>
              <h3 className="font-bold text-app-text mb-2">4. Accepted Payment Methods</h3>
              <ul className="list-disc pl-6">
                <li>Bank Transfer (NEFT / RTGS / IMPS)</li>
                <li>UPI / Payment Gateway</li>
                <li>International Wire Transfer (for overseas clients)</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">3. No Refund Policy</h2>
          <p className="font-bold text-app-text mb-4">Vedhunt InfoTech follows a strict No Refund Policy for all its professional services.</p>
          <p className="mb-4">This is because our services involve significant intellectual effort, skilled manpower, and time investments that begin immediately upon project initiation.</p>
          <p className="mb-4">We do not offer refunds for:</p>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>Projects where any stage of design, development, or setup has commenced.</li>
            <li>Completed milestones, approved deliverables, or ongoing work-in-progress.</li>
            <li>Retainer, subscription, or maintenance plans once service has started.</li>
            <li>Third-party costs (e.g., domain, hosting, ad spend, software licenses, API integrations).</li>
          </ul>
          
          <div className="bg-primary/10 p-6 rounded-xl border border-primary/20">
            <h3 className="font-bold text-app-text mb-2">Our Commitment</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Every project is executed with clear communication and transparency.</li>
              <li>In case of any dissatisfaction, Vedhunt will work collaboratively to review, revise, or realign deliverables within the agreed scope.</li>
              <li>If a delay or issue arises due to our side, we will rectify or adjust timelines — instead of processing refunds — ensuring that our clients always receive complete value for their investment.</li>
            </ul>
            <p className="mt-4 font-semibold text-primary">💬 Our priority is long-term client satisfaction, not one-time transactions.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">4. Project Cancellation</h2>
          <p className="mb-4">Clients may request cancellation by written notice (email to info@vedhunt.in). In such cases:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Work completed up to the date of cancellation will be billed in full.</li>
            <li>Advance payments already received are non-refundable, as resources and time are already allocated.</li>
            <li>If any external vendor costs have been incurred (e.g., ads, hosting, tools), these will also be chargeable.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4">5. Contact for Billing Support</h2>
          <p className="mb-4">For any billing, payment, or cancellation-related queries, please reach out to:</p>
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
