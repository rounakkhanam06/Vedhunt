import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const comparisonData = [
  { feature: 'Delivery Speed', vedhunt: 'Lightning Fast (Days)', typical: 'Weeks or Months' },
  { feature: 'Code Quality', vedhunt: 'Custom, Scalable & Clean', typical: 'Template-based, Cluttered' },
  { feature: 'Design Aesthetics', vedhunt: 'Premium & Modern', typical: 'Generic & Outdated' },
  { feature: 'Support & Maintenance', vedhunt: '24/7 Dedicated Support', typical: 'Slow Ticket-based' },
  { feature: 'Pricing Structure', vedhunt: 'Transparent, No Hidden Fees', typical: 'Unexpected Costs' },
  { feature: 'Tech Stack', vedhunt: 'Latest Edge Technologies', typical: 'Legacy Frameworks' },
];

export default function ComparisonTable() {
  return (
    <section className="mb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-10 space-y-2"
      >
        <h2 className="text-2xl md:text-3xl font-bold font-heading tracking-tight">Why Choose <span className="text-primary">Vedhunt</span>?</h2>
        <p className="text-white/30 text-[10px] tracking-[0.2em] font-bold uppercase">Vedhunt vs Typical Agency</p>
      </motion.div>

      <div className="max-w-4xl mx-auto overflow-x-auto pb-4">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-4 px-6 text-white/50 text-[10px] font-bold tracking-widest uppercase w-1/3">Feature</th>
              <th className="py-4 px-6 bg-primary/5 text-primary text-sm font-bold tracking-wide rounded-t-xl border-x border-t border-primary/20 text-center w-1/3">Vedhunt</th>
              <th className="py-4 px-6 text-white/50 text-[10px] font-bold tracking-widest uppercase text-center w-1/3">Typical Agency</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="py-4 px-6 text-sm font-medium text-white/80">{row.feature}</td>
                <td className="py-4 px-6 bg-primary/[0.02] border-x border-primary/20 text-center relative group">
                  <div className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-[13px] font-bold text-white group-hover:text-primary transition-colors">{row.vedhunt}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-center text-white/40">
                  <div className="flex items-center justify-center gap-2">
                    <X className="w-4 h-4 text-white/20 shrink-0" />
                    <span className="text-[13px] font-medium">{row.typical}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-2 px-6"></td>
              <td className="py-2 px-6 bg-primary/5 border-x border-b border-primary/20 rounded-b-xl"></td>
              <td className="py-2 px-6"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
