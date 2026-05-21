import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import dpaHeroImage from '../assets/dpa_hero.png';

const dpaSections = [
  {
    title: "1. Purpose",
    content: "The purpose of this DPA is to ensure that any personal or sensitive data processed by Vedhunt InfoTech on behalf of the Client is handled in compliance with applicable data protection laws, including but not limited to the Information Technology Act, 2000, GDPR, and other international regulations."
  },
  {
    title: "2. Scope of Processing",
    content: "Vedhunt InfoTech may process data solely for the following business purposes:\n• Website & App development services\n• Automation, Analytics, and Reporting (SQL, Power BI, Python, BI tools)\n• Digital Marketing and Lead Management (Google, Meta, LinkedIn, etc.)\n• Accounting & Financial MIS Automation\n• Healthcare and Insurance Vendor Analytics (non-clinical data)\n• Any additional service explicitly defined in the client’s project scope\n\nVedhunt shall not process or use the Client’s data for any purpose other than what is contractually agreed."
  },
  {
    title: "3. Roles and Responsibilities",
    content: "3.1 Client (Data Controller)\nThe Client determines:\n• The categories of data processed.\n• The lawful basis for processing.\n• Instructions provided to Vedhunt InfoTech.\n\nThe Client ensures data shared is obtained lawfully and does not violate any third-party rights.\n\n3.2 Vedhunt InfoTech (Data Processor)\nVedhunt agrees to:\n• Process data only on documented instructions from the Client.\n• Implement technical and organizational measures to protect data.\n• Ensure confidentiality of all personnel with access to data.\n• Not engage any sub-processor without written consent.\n• Assist the Client in ensuring compliance with applicable laws."
  },
  {
    title: "4. Categories of Data Processed",
    content: "Depending on the service, Vedhunt may process:\n• Contact details (name, email, phone, company info)\n• Project data and reports\n• Transaction or performance data\n• System or log data (e.g., Power BI logs, SQL transactions)\n• Non-clinical healthcare data (member IDs, claim reference IDs — anonymized)\n\nSensitive Personal Data (if applicable): In limited cases (e.g., healthcare vendors), only pseudonymized or masked data is used, ensuring no direct identifiers are accessible."
  },
  {
    title: "5. Sub-Processors",
    content: "Vedhunt may use third-party service providers (e.g., AWS, Azure, Google Cloud, Microsoft Power BI, Sendinblue, or Zoho) to perform specific functions.\n\nVedhunt ensures that:\n• Sub-processors are bound by written contracts ensuring equivalent data protection.\n• Clients are informed and may object to specific sub-processors.\n\nData transfers comply with international standards (Standard Contractual Clauses or similar)."
  },
  {
    title: "6. Data Security",
    content: "Vedhunt InfoTech implements reasonable security practices under Indian IT Rules and industry-standard measures, including:\n• SSL/TLS encryption for all transmissions\n• Encrypted storage for client files and databases\n• Role-based access control (RBAC)\n• Regular security audits and firewall protection\n• Daily backups and disaster recovery systems\n• 2FA and VPN-based access for internal operations\n\nIf a data breach occurs, Vedhunt will promptly notify the Client (within 72 hours) with full details and corrective actions."
  },
  {
    title: "7. Confidentiality",
    content: "• All data, project information, and deliverables are treated as confidential.\n• Employees, contractors, and partners are bound by NDAs.\n• Confidentiality obligations remain effective even after contract termination."
  },
  {
    title: "8. Data Retention and Deletion",
    content: "Vedhunt retains client data only as long as necessary for the project or as required by law.\n\nUpon completion or termination of the engagement:\n• All personal data will be securely deleted, anonymized, or returned to the Client.\n• Backup copies will be purged within 30 to 60 days unless required for legal compliance."
  },
  {
    title: "9. Data Subject Rights",
    content: "Vedhunt assists the Client in fulfilling requests from data subjects, including:\n• Access, correction, or deletion of their personal data.\n• Restriction or objection to processing.\n• Data portability (where applicable).\n\nVedhunt shall not respond directly to such requests without prior approval from the Client."
  },
  {
    title: "10. International Data Transfers",
    content: "If data is transferred outside India (e.g., hosting or cloud services), Vedhunt ensures:\n• The transfer complies with applicable legal safeguards.\n• Only GDPR-compliant cloud providers (e.g., AWS, Azure, GCP) are used.\n• Data remains encrypted during and after transfer."
  },
  {
    title: "11. Audit and Compliance",
    content: "• Vedhunt will make available all information necessary to demonstrate compliance.\n• The Client may, upon reasonable notice, audit Vedhunt’s data handling procedures (once per year).\n• Vedhunt will cooperate fully and correct any non-compliance promptly."
  },
  {
    title: "12. Data Breach Notification",
    content: "In the event of an actual or suspected breach:\n1. Vedhunt will notify the Client within 72 hours.\n2. The notice will include: Nature and scope of the breach, Data affected, Steps taken to mitigate risks.\n3. Vedhunt will work closely with the Client to contain and remediate the issue."
  },
  {
    title: "13. Liability",
    content: "Vedhunt InfoTech’s total liability arising out of data processing shall not exceed the total amount paid by the Client under the service contract during the 6-month period preceding the claim, unless caused by gross negligence or willful misconduct."
  },
  {
    title: "14. Term and Termination",
    content: "This DPA remains in effect:\n• For as long as Vedhunt processes data on behalf of the Client; or\n• Until the termination of all service agreements.\n\nUpon termination:\n• Vedhunt will delete or return all client data (as per Section 8).\n• Any surviving confidentiality and security obligations remain binding."
  },
  {
    title: "15. Governing Law and Jurisdiction",
    content: "This Agreement shall be governed by and construed under the laws of India. All disputes shall be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra, India."
  }
];

export default function DPA() {
  const [openSection, setOpenSection] = useState(0); // First section open by default

  const toggleSection = (index) => {
    setOpenSection(openSection === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-app-bg pt-24 pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-app-bg to-app-bg z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-16 pb-12 lg:pt-24 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
                <ShieldCheck size={20} />
                <span className="font-bold text-sm">GDPR & IT Act Compliant</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-heading text-app-text leading-tight mb-6">
                Data Processing <span className="text-primary">Agreement</span>
              </h1>
              <p className="text-lg text-slate-600 dark:text-app-text-muted mb-8 leading-relaxed">
                This Data Processing Agreement (“Agreement” or “DPA”) forms an integral part of the Service Agreement, Statement of Work (SOW), or Master Services Agreement executed between Vedhunt InfoTech and our Clients.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="mailto:info@vedhunt.in" className="btn-primary flex justify-center text-center">
                  Contact Compliance Team
                </a>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative rounded-3xl overflow-hidden shadow-2xl border border-app-border"
            >
              <img 
                src={dpaHeroImage} 
                alt="Data Processing Security" 
                className="w-full h-auto object-cover aspect-video"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Accordion Content Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white dark:bg-app-card rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200 dark:border-app-border"
        >
          <div className="mb-8 border-b border-slate-100 dark:border-app-border pb-6">
            <h2 className="text-2xl font-bold font-heading text-app-text">Agreement Sections</h2>
            <p className="text-slate-500 dark:text-app-text-muted mt-2">Click to expand and read the details of our data processing commitments.</p>
          </div>

          <div className="space-y-4">
            {dpaSections.map((section, index) => (
              <div 
                key={index} 
                className="border border-slate-200 dark:border-app-border rounded-xl overflow-hidden bg-slate-50/50 dark:bg-black/20"
              >
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-black/40 focus:outline-none"
                >
                  <span className={`font-bold font-heading text-lg ${openSection === index ? 'text-primary' : 'text-app-text'}`}>
                    {section.title}
                  </span>
                  <motion.div
                    animate={{ rotate: openSection === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex-shrink-0 ml-4 ${openSection === index ? 'text-primary' : 'text-slate-400'}`}
                  >
                    <ChevronDown size={24} />
                  </motion.div>
                </button>
                
                <AnimatePresence>
                  {openSection === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="p-5 pt-0 text-slate-600 dark:text-app-text-muted leading-relaxed border-t border-slate-100 dark:border-app-border mt-2">
                        {section.content.split('\n').map((paragraph, pIndex) => (
                          <p key={pIndex} className="mb-2 last:mb-0">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-primary/10 rounded-2xl border border-primary/20">
            <h3 className="text-lg font-bold font-heading text-app-text mb-3">Agreement Acceptance</h3>
            <p className="text-slate-600 dark:text-app-text-muted mb-4">
              By signing a Service Agreement or engaging Vedhunt InfoTech’s services, the Client acknowledges that they have reviewed and accepted this Data Processing Agreement. This DPA forms part of the binding contractual relationship between Vedhunt and the Client.
            </p>
            <p className="font-semibold text-primary">
              Vedhunt InfoTech is committed to protecting the integrity, confidentiality, and security of all client data — ensuring full compliance with Indian and international data protection laws.
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
