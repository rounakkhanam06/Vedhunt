import React from 'react';
import AgreementHeader from './AgreementHeader';
import { formatDateDDMMMYYYY } from '../../utils/formatDate';

const AgreementTemplate = ({ client }) => {
  const details = client?.agreementDetails || {};
  const agreementDate = formatDateDDMMMYYYY(details.agreementDate) || '[Agreement Date]';
  const effectiveDate = formatDateDDMMMYYYY(details.effectiveDate) || '[Effective Date]';
  const domain = details.domain || '[Domain Name]';
  const serviceName = details.serviceName || '[Service Name]';
  const monthlyFee = details.monthlyFee || 0;
  const gstAmount = details.gstAmount || 0;
  const totalPayable = details.totalPayable || 0;

  const renderPlatforms = () => {
    if (details.platforms && details.platforms.length > 0) {
      return (
        <ul className="list-disc pl-8 mb-4">
          {details.platforms.map((platform, i) => (
            <li key={i}>{platform}</li>
          ))}
        </ul>
      );
    }
    return <p className="mb-4 text-red-500">[Platforms Missing]</p>;
  };

  const renderDeliverables = () => {
    return (
      <ul className="list-disc pl-8 mb-4">
        <li>Campaign strategy aligned to the Client's objective of driving website purchases (ROAS-driven).</li>
        <li>Meta Pixel & Conversions API (CAPI) setup and Google conversion tracking implementation, with test events removed before go-live.</li>
        <li>Daily monitoring and optimization of live campaigns across Meta and Google.</li>
        <li>Access to a live excel performance dashboard tracking Spend, Results, ROAS, and campaign-level metrics.</li>
        <li>Monthly performance summary covering month-on-month growth, platform comparison, and creative performance (static vs. video script).</li>
        {details.deliverables && details.deliverables.map((item, i) => (
          <li key={i}><span className="bg-yellow-100">{item}</span></li>
        ))}
      </ul>
    );
  };

  const renderExclusions = () => {
    return (
      <ul className="list-disc pl-8 mb-4">
        <li>Ad spend on Meta and Google platforms — billed separately to the Client at actuals with no markup (see Clause 2).</li>
        {details.exclusions && details.exclusions.map((item, i) => (
          <li key={i}><span className="bg-yellow-100">{item}</span></li>
        ))}
        <li>Influencer or third-party talent fees.</li>
      </ul>
    );
  };

  const watermarkSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" width="1000" height="500"><text x="50%" y="50%" font-size="160" font-weight="900" font-family="system-ui, sans-serif" text-anchor="middle" dominant-baseline="middle"><tspan fill="rgba(249, 168, 38, 0.08)">VED</tspan><tspan fill="rgba(0,0,0,0.04)">HUNT</tspan></text></svg>`;

  return (
    <div 
      className="bg-white text-black font-sans w-full mx-auto max-w-4xl border border-gray-200 relative"
      style={{
        backgroundImage: `url('${watermarkSvg}')`,
        backgroundRepeat: 'repeat-y',
        backgroundPosition: 'center top',
        backgroundSize: '100% auto'
      }}
    >
      <AgreementHeader />
      
      <div className="p-8 pt-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-[#0B2B5E] tracking-widest mb-2">SERVICE AGREEMENT</h2>
          <p className="text-[#E87B1E] italic text-lg mb-1 font-medium">
            Scope of Work | Non-Disclosure Agreement | Service Level Terms
          </p>
          <p className="text-gray-600 text-sm">
            Performance Marketing Services — Meta Ads & Google Ads Management
          </p>
        </div>

        <table className="w-full border-collapse border border-[#0B2B5E] mb-6">
          <thead>
            <tr className="bg-[#0B2B5E] text-white">
              <th className="border border-[#0B2B5E] p-2 text-left w-1/2">SERVICE PROVIDER</th>
              <th className="border border-[#0B2B5E] p-2 text-left w-1/2">CLIENT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-4 align-top leading-relaxed text-sm">
                Vedhunt InfoTech Pvt. Ltd. CIN: <strong>U62099MH2025PTC447275</strong> Everest<br/>
                Nivara Infotech Park, Turbhe, Navi Mumbai, Maharashtra – 400705<br/>
                info@vedhunt.in | <strong>+91 86524 10289</strong> Represented by: Manisha<br/>
                Choudhary, Director
              </td>
              <td className="border border-gray-300 p-4 align-top leading-relaxed text-sm bg-yellow-100">
                {client?.contactName || '[Contact Name]'} Brand / Domain: {domain}<br/>
                Contact: {client?.phone || '[Phone]'} ("Client")
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mb-6">
          <p className="bg-yellow-100 inline-block px-2 py-1 font-bold text-sm">
            Agreement Date: {agreementDate} &nbsp;&nbsp;&nbsp; Effective Date: {effectiveDate}
          </p>
        </div>

        <p className="mb-6 leading-relaxed text-justify text-sm">
          This Service Agreement ("Agreement") is entered into between Vedhunt InfoTech Pvt. Ltd. ("Vedhunt", "Service Provider", "we", "us") and the Client named above ("Client", "you"), collectively referred to as the "Parties". This Agreement sets out the Scope of Work, confidentiality obligations, service levels, fees, and general terms governing the performance marketing services provided by Vedhunt to the Client. By signing this Agreement, the Parties confirm they have read, understood, and agreed to be bound by all clauses below, including the risk allocation and dispute resolution provisions.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-2">1. Scope of Work</h4>
        
        <h5 className="text-[#0B2B5E] font-bold mb-2">1.1 Services</h5>
        <p className="mb-2 leading-relaxed text-sm">
          Vedhunt shall provide <span className="bg-yellow-100">{serviceName}</span> services for the Client's brand {domain}, covering the following platforms:
        </p>
        <div className="bg-yellow-100 p-2 mb-4 text-sm">
          {renderPlatforms()}
        </div>

        <h5 className="text-[#0B2B5E] font-bold mb-2">1.2 Deliverables</h5>
        <div className="text-sm">
          {renderDeliverables()}
        </div>

        <h5 className="text-[#0B2B5E] font-bold mb-2">1.3 Exclusions (unless separately contracted and quoted)</h5>
        <div className="text-sm">
          {renderExclusions()}
        </div>

        <h5 className="text-[#0B2B5E] font-bold mb-2">1.4 Mobilisation Period & Campaign Go-Live Timeline</h5>
        <p className="mb-2 leading-relaxed text-justify text-sm">
          Upon receipt of full and complete access to all assets required for campaign setup — including, without limitation, Meta Business Manager, Meta Ads Account, Google Ads Account, Google Merchant Center (where applicable), website/CMS access, and Google Analytics/Search Console access — Vedhunt shall require a mobilisation period of up to seven (7) working days before campaigns are taken live. This mobilisation period is Vedhunt's internal preparation window and covers, without limitation:
        </p>
        <ul className="list-disc pl-8 mb-4 leading-relaxed text-sm">
          <li>Finalization of campaign strategy and ad funnel structure for the Client's account;</li>
          <li>Creative concept ideation and planning — where Creatives are to be produced in-house by Vedhunt, initial concepts/drafts will be shared within this period; where Creatives are to be produced by the Client or the Client's vendor, Vedhunt will instead provide a creative brief specifying the recommended creative type, format, and messaging direction for execution by the Client's team;</li>
          <li>Event testing and validation of Meta Pixel/CAPI and Google conversion tracking, including removal of any test event codes before campaigns go live;</li>
          <li>Verification of Business Manager Roles, ad account status, payment methods, domain verification, catalog feed, and other connected assets on Meta, and the equivalent account-level checks on Google Ads (billing, conversion actions, linked accounts, policy compliance).</li>
        </ul>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          The seven (7) working-day mobilisation period commences only from the date on which all requested access and assets listed above are received in full from the Client. Any delay in granting access, incomplete or partial access, or delay in Client-side creative production shall extend the mobilisation period and the campaign go-live date proportionately, and any such delay shall not be treated as a delay, default, or breach on the part of Vedhunt.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">2. Fees & Payment Terms</h4>
        
        <h5 className="text-[#0B2B5E] font-bold mb-2">2.1 Fee Schedule</h5>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="bg-[#0B2B5E] text-white">
              <th className="border p-2 text-left">Service</th>
              <th className="border p-2 text-center">Monthly Fee (Ex-GST)</th>
              <th className="border p-2 text-center">GST @ 18%</th>
              <th className="border p-2 text-center">Total Payable / Month</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2 bg-yellow-100">{serviceName}</td>
              <td className="border border-gray-300 p-2 text-center bg-yellow-100">₹{monthlyFee.toLocaleString('en-IN')}</td>
              <td className="border border-gray-300 p-2 text-center bg-yellow-100">₹{gstAmount.toLocaleString('en-IN')}</td>
              <td className="border border-gray-300 p-2 text-center bg-yellow-100 font-bold">₹{totalPayable.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        <h5 className="text-[#0B2B5E] font-bold mb-2">2.2 Payment Terms</h5>
        <ul className="list-disc pl-8 mb-6 leading-relaxed text-sm">
          <li>100% of the monthly management fee (<span className="bg-yellow-100">₹{totalPayable.toLocaleString('en-IN')}</span>, inclusive of GST) is payable in advance before mobilisation of that month's campaign work. No chargeable work, platform access requests, or team hours will commence before the advance is received.</li>
          <li>Ad spend (Meta Ads and Google Ads budget) is billed separately to the Client at actuals, with no markup by Vedhunt, and is payable directly to the ad platform or reimbursed to Vedhunt as agreed in writing before each campaign period.</li>
          <li>GST at 18% applies to the management fee only, per applicable Indian tax law at the time of invoicing.</li>
          <li>This Agreement renews on a month-to-month basis. Invoices are raised in advance of each monthly cycle; continued service is contingent on timely payment.</li>
          <li>Any amount remaining unpaid beyond 7 days of its due date shall accrue interest at 1.5% per month (or part thereof) until paid in full, in addition to Vedhunt's right to suspend Services under Clause 10.</li>
        </ul>

        <h5 className="text-[#0B2B5E] font-bold mb-2">2.3 Change of Scope / Additional Services</h5>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Any work requested by the Client that falls outside the Scope of Work defined in Clause 1 — including, without limitation, additional platforms, additional landing pages, creative assets beyond the agreed volume, extended or custom reporting, or any other request not listed as a Deliverable — shall be treated as an Additional Service and may attract additional fees. Such additional fees will be communicated to and agreed with the Client in writing before the corresponding work commences. Any commitment, discount, complimentary deliverable, or scope inclusion offered by Vedhunt's Business Development team beyond what is expressly stated in this Agreement shall be binding on Vedhunt only if it is recorded in writing in the signed proposal or a written annexure to this Agreement; verbal assurances or informal commitments not reflected in a signed document shall not bind Vedhunt.
        </p>

        <h5 className="text-[#0B2B5E] font-bold mb-2">2.4 No Refund Policy</h5>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Fees paid to Vedhunt under this Agreement are consideration for the time, strategic effort, campaign management, and platform expertise applied by Vedhunt's team from the commencement of the mobilisation period onward — the value of which cannot be objectively measured, quantified, or unwound once such work has commenced. Accordingly, management fees paid under this Agreement are non-refundable under any circumstances once the mobilisation period under Clause 1.4 has begun, including but not limited to the Client's dissatisfaction with campaign performance, a change in the Client's business priorities, or early termination of this Agreement by the Client. This Clause does not apply to any ad spend collected by Vedhunt on the Client's behalf and not yet utilized on the ad platforms, which shall be accounted for and returned or adjusted separately.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">3. Client Responsibilities & Dependencies</h4>
        <p className="mb-2 leading-relaxed text-justify text-sm">
          Timely delivery of the Services described in this Agreement depends on the Client's cooperation. The Client shall:
        </p>
        <ul className="list-disc pl-8 mb-4 leading-relaxed text-sm">
          <li>Provide timely and complete access to all accounts, platforms, and assets required for Vedhunt to perform the Services, including but not limited to those listed in Clause 1.4;</li>
          <li>Provide timely approvals, feedback, and creative assets or content (where creative production is Client-side) so as to avoid delays to the agreed timeline;</li>
          <li>Ensure that all products, services, offers, claims, and content supplied to Vedhunt for use in advertising comply with applicable law and platform advertising policies, and do not infringe any third party's intellectual property or other rights;</li>
          <li>Designate a single point of contact authorized to approve campaigns, Creatives, and budgets on the Client's behalf.</li>
        </ul>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Any delay, inaccuracy, or non-compliance arising from the Client's failure to meet the above responsibilities shall not be attributable to Vedhunt. Timelines, deliverables, and service levels under this Agreement shall stand adjusted to account for any such delay, and shall not be treated as a shortfall in Vedhunt's performance.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">4. Confidentiality (Non-Disclosure)</h4>
        <p className="mb-2 leading-relaxed text-justify text-sm">
          Each Party may disclose to the other confidential or proprietary information in connection with this Agreement, including but not limited to campaign strategy, creative assets, performance data, pricing, business plans, and customer information ("Confidential Information"). Each Party agrees to:
        </p>
        <ul className="list-disc pl-8 mb-4 leading-relaxed text-sm">
          <li>Use the other Party's Confidential Information solely for the purpose of performing obligations under this Agreement.</li>
          <li>Not disclose Confidential Information to any third party without the prior written consent of the disclosing Party, except to employees, contractors, or advisors bound by equivalent confidentiality obligations.</li>
          <li>Protect Confidential Information with the same degree of care used to protect its own confidential information, and no less than a reasonable standard of care.</li>
        </ul>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Confidential Information does not include information that is or becomes publicly available through no fault of the receiving Party, is independently developed without reference to the disclosing Party's Confidential Information, or is required to be disclosed by law or court order. These confidentiality obligations survive for a period of two (2) years from the termination or expiry of this Agreement.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">5. Service Level Terms</h4>
        <ul className="list-disc pl-8 mb-6 leading-relaxed text-sm">
          <li>Campaign monitoring: live campaigns are reviewed and optimized on each working day, subject to the mobilisation timeline in Clause 1.4.</li>
          <li>Reporting: the Client receives access to a live excel dashboard, updated from daily tracked data, plus a monthly performance summary covering spend, results, ROAS, and month-on-month growth.</li>
          <li>Response time: Vedhunt will respond to Client queries raised via WhatsApp, call, or email within one (1) business day.</li>
          <li>Performance figures shared during onboarding or in reporting (CPL/CPQL benchmarks, expected ROAS ranges, etc.) are illustrative benchmarks based on category experience and platform data, not guarantees. Digital advertising performance is influenced by factors outside Vedhunt's control, including platform algorithm changes, market conditions, and the Client's website, product, or pricing. Vedhunt does not guarantee specific results, lead volumes, or return on ad spend.</li>
        </ul>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">6. Intellectual Property</h4>
        <ul className="list-disc pl-8 mb-6 leading-relaxed text-sm">
          <li>The Client retains all ownership rights in its brand name, logo, trademarks, website, and product content supplied to Vedhunt.</li>
          <li>Campaign structures, ad Creatives, and strategy documents created by Vedhunt specifically for the Client under this Agreement shall transfer to the Client's ownership only upon full and final payment of all fees due under this Agreement.</li>
          <li>Vedhunt retains all rights, title, and interest in its pre-existing tools, templates, dashboard structures, reporting formats, processes, and methodologies used in delivering the Services, whether created before or during this engagement. Nothing in this Agreement transfers ownership of such pre-existing intellectual property to the Client; the Client receives a non-exclusive right to use outputs generated through these tools (such as the Power BI dashboard) for the duration of this engagement.</li>
          <li>Vedhunt may reference the engagement, campaign category, and non-sensitive aggregate results in its own portfolio or marketing materials; the Client's name, logo, and specific performance data will only be published with the Client's prior written permission.</li>
        </ul>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">7. Platform & Third-Party Risk</h4>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          The Client acknowledges that Meta, Google, and other advertising platforms are independent third parties outside Vedhunt's control. Vedhunt shall not be liable for: (a) suspension, restriction, disapproval, or banning of the Client's ad accounts, Business Manager, or campaigns by such platforms; (b) changes to platform algorithms, policies, targeting capabilities, or advertising costs; (c) platform outages, technical errors, or data/tracking discrepancies; or (d) pre-existing issues, penalties, or restrictions on accounts that existed prior to Vedhunt's engagement. Vedhunt will use reasonable, industry-standard efforts to advise the Client and assist in resolving such issues where possible, but makes no warranty regarding any platform's decisions, policies, or availability.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">8. Indemnification</h4>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          The Client shall indemnify and hold harmless Vedhunt, its directors, employees, and representatives from and against any claims, damages, losses, or expenses (including reasonable legal fees) arising out of: (a) the Client's products, services, offers, or claims advertised under this Agreement; (b) any content, creative, data, or claims supplied by the Client that infringe a third party's rights or violate applicable law or platform policy; or (c) the Client's breach of this Agreement. Vedhunt shall indemnify the Client against direct losses arising from Vedhunt's gross negligence or willful misconduct in performing the Services, subject always to the limitation of liability in Clause 11.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">9. Term & Termination</h4>
        <ul className="list-disc pl-8 mb-6 leading-relaxed text-sm">
          <li>This Agreement is effective from the Effective Date stated above and continues on a month-to-month basis until terminated by either Party.</li>
          <li>Either Party may terminate this Agreement by providing fifteen (15) days' written notice to the other Party.</li>
          <li>Vedhunt may suspend or terminate services immediately in the event of non-payment beyond the cure period stated in Clause 2.2, or under the circumstances set out in Clause 10.</li>
          <li>Upon termination, the Client remains liable for all fees and ad spend incurred up to the effective date of termination, and no refund shall be due per Clause 2.4. Campaign access will be handed over to the Client (or revoked, at the Client's instruction) within a reasonable period following full and final settlement.</li>
        </ul>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">10. Suspension of Services</h4>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Vedhunt may suspend the Services immediately and without liability if: (a) any payment is overdue as per Clause 2.2; (b) the Client's products, services, offers, or content are found to be illegal, fraudulent, or in violation of platform policies or applicable law; or (c) continuing the Services would expose Vedhunt to legal, regulatory, or reputational risk. Vedhunt will notify the Client promptly of any such suspension and the reason for it. Fees for the period already invoiced remain payable in full notwithstanding any suspension under this Clause.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">11. Limitation of Liability</h4>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Vedhunt's total liability arising out of or in connection with this Agreement, whether in contract, tort, or otherwise, shall not exceed the total management fees paid by the Client to Vedhunt in the three (3) months preceding the claim. Vedhunt shall not be liable for indirect, incidental, or consequential damages, including loss of profits or business opportunity, arising from the performance or non-performance of services under this Agreement.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">12. Warranty Disclaimer</h4>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Except as expressly stated in this Agreement, the Services are provided on an "as-is" and "as-available" basis. Vedhunt makes no warranties, express or implied, regarding uninterrupted service, specific campaign outcomes, or fitness for a particular purpose, beyond the professional standard of care ordinarily applied in the digital marketing industry.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">13. Independent Contractor Relationship</h4>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Vedhunt is an independent contractor providing services to the Client under this Agreement. Nothing in this Agreement shall be construed to create a partnership, joint venture, agency, or employer-employee relationship between the Parties. Neither Party has authority to bind the other except as expressly stated in this Agreement.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">14. Non-Solicitation of Personnel</h4>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          During the term of this Agreement and for a period of twelve (12) months following its termination or expiry, the Client shall not directly or indirectly solicit, hire, or engage — as an employee, contractor, or consultant — any employee, contractor, or consultant of Vedhunt who was involved in delivering the Services, without Vedhunt's prior written consent.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">15. Governing Law & Dispute Resolution</h4>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          This Agreement is governed by the laws of India. Subject to Clause 15.1 below, the courts at Navi Mumbai, Maharashtra shall have exclusive jurisdiction over any disputes arising out of or in connection with this Agreement.
        </p>

        <h5 className="text-[#0B2B5E] font-bold mb-2">15.1 Arbitration</h5>
        <p className="mb-6 leading-relaxed text-justify text-sm">
          Any dispute, controversy, or claim arising out of or relating to this Agreement, including its formation, interpretation, breach, or termination, shall first be attempted to be resolved amicably through good-faith discussion between the Parties within thirty (30) days. Failing amicable resolution, the dispute shall be referred to and finally resolved by arbitration under the Arbitration and Conciliation Act, 1996, with the seat and venue of arbitration at Navi Mumbai, Maharashtra, before a sole arbitrator mutually appointed by the Parties. The arbitration proceedings shall be conducted in English, and the award rendered shall be final and binding on both Parties.
        </p>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">16. General Terms</h4>
        <ul className="list-disc pl-8 mb-6 leading-relaxed text-sm">
          <li><strong>Entire Agreement:</strong> This Agreement constitutes the entire understanding between the Parties regarding its subject matter and supersedes all prior discussions, proposals, or agreements, written or oral, except as expressly incorporated by reference.</li>
          <li><strong>Order of Precedence:</strong> In the event of any conflict between this Agreement, the signed proposal, and any written annexure specifically agreed and signed by both Parties, the written annexure shall prevail for the specific matter it addresses, followed by this Agreement, and followed by the proposal document.</li>
          <li><strong>Amendment:</strong> This Agreement may only be amended by a written document signed by authorized representatives of both Parties.</li>
          <li><strong>Force Majeure:</strong> Neither Party shall be liable for delay or failure to perform obligations due to causes beyond its reasonable control, including but not limited to platform outages, natural disasters, or changes in law.</li>
          <li><strong>Notices:</strong> All formal notices under this Agreement shall be sent in writing to the addresses/contacts stated in the Parties table above.</li>
          <li><strong>Severability:</strong> If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.</li>
          <li><strong>Waiver:</strong> No failure or delay by either Party in exercising any right under this Agreement shall operate as a waiver of that right.</li>
        </ul>

        <h4 className="text-[#0B2B5E] font-bold text-lg mb-4">17. Signatures</h4>
        <p className="mb-8 leading-relaxed text-justify text-sm">
          By signing below, the Parties confirm their agreement to the terms set out in this Service Agreement (Scope of Work, Non-Disclosure Agreement, and Service Level Terms), including the risk allocation, payment, and dispute resolution provisions above.
        </p>

        <table className="w-full mb-12 text-sm">
          <tbody>
            <tr>
              <td className="w-1/2 align-bottom pb-4 font-bold text-[#0B2B5E]">For Vedhunt InfoTech Pvt. Ltd.</td>
              <td className="w-1/2 align-bottom pb-4 font-bold text-[#0B2B5E]">For the Client</td>
            </tr>
            <tr>
              <td className="w-1/2 h-24 align-bottom pt-8">
                {/* Signature Placeholder */}
                <div className="h-16 flex items-end">
                  <span className="italic text-gray-400 font-serif text-xl border-b border-gray-300 inline-block w-48 text-center pb-1">
                    Vedhunt Director
                  </span>
                </div>
              </td>
              <td className="w-1/2 h-24 align-bottom pt-8">
                <div className="h-16 flex items-end">
                  {client?.acceptedAgreementVersion ? (
                     <span className="italic text-green-600 font-serif text-xl border-b border-gray-300 inline-block w-48 text-center pb-1">
                       Digitally Accepted
                     </span>
                  ) : (
                     <span className="border-b border-gray-300 inline-block w-48"></span>
                  )}
                </div>
              </td>
            </tr>
            <tr>
              <td className="w-1/2 pt-2 border-t border-gray-800">
                <p>Manisha Choudhary</p>
                <p className="text-gray-500">Director & Authorized Signatory</p>
                <p className="mt-2"><span className="bg-yellow-100">Date:</span> {agreementDate}</p>
              </td>
              <td className="w-1/2 pt-2 border-t border-gray-800">
                <p className="bg-yellow-100 inline-block">{client?.contactName || '[Contact Name]'}</p>
                <br/>
                <p className="bg-yellow-100 inline-block">{domain}</p>
                <p className="mt-2">
                  <span className="bg-yellow-100">
                    Date: {formatDateDDMMMYYYY(client?.agreementAcceptedAt) || '_____________'}
                  </span>
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="border-t border-gray-300 pt-4 mt-8">
          <p className="text-xs text-gray-500 italic text-justify">
            This is a standard-form template prepared for internal use and has not yet been reviewed by a Maharashtra-registered lawyer. Please route it for legal review before relying on it as a binding contract.
          </p>
        </div>

      </div>
    </div>
  );
};

export default AgreementTemplate;
