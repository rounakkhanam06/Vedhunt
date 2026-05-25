import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { contentService } from '../../services/contentService';

/**
 * ComparisonTable - A CRO-focused component comparing Vedhunt InfoTech with typical agencies.
 * Designed for maximum trust building and clarity using a structured data matrix.
 */
export default function ComparisonTable() {
  const [data, setData] = useState({ header: null, rows: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Fallback static data to prevent empty renders before DB is populated
  const defaultData = {
    header: {
      heading: 'The Vedhunt Advantage',
      description: "We don't just provide services; we build high-performance growth machines. Here is how we stand out from the typical agency model.",
      vedhuntColumnHeader: 'Vedhunt InfoTech ✅',
      typicalColumnHeader: 'Typical Agency ❌',
      bottomNote: 'Empirical Data Based on Regional Industry Audits 2026'
    },
    rows: [
      { feature: "All-in-One Services", vedhunt: "8 services under one roof", typical: "Usually 2–3 services" },
      { feature: "Pricing", vedhunt: "Transparent, no hidden fees", typical: "Often vague or inflated" },
      { feature: "Reporting", vedhunt: "Real-time dashboards & reports", typical: "Monthly PDF only" },
      { feature: "Communication", vedhunt: "Dedicated manager + WhatsApp", typical: "Email tickets only" },
      { feature: "Strategy", vedhunt: "Custom strategy per client", typical: "Generic templates" },
      { feature: "Technology", vedhunt: "Own tech stack + automation", typical: "Outsourced delivery" },
      { feature: "ROI Focus", vedhunt: "KPI-based campaigns always", typical: "Vanity metrics focus" }
    ]
  };

  useEffect(() => {
    const fetchAdvantage = async () => {
      try {
        const result = await contentService.getAdvantagePublic();
        if (result.data) {
          setData(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch advantage section:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdvantage();
  }, []);

  const header = data.header || defaultData.header;
  const rows = data.rows?.length > 0 ? data.rows : defaultData.rows;

  return (
    <section className="py-8 px-4 bg-app-bg text-app-text relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/5 blur-[100px] pointer-events-none rounded-full" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-6 space-y-2">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-black font-heading text-app-text leading-tight"
          >
            {header.heading}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-app-text-muted text-[11px] md:text-xs max-w-lg mx-auto leading-relaxed"
          >
            {header.description}
          </motion.p>
        </div>

        {/* Responsive Table Container with 3D Folded Corners */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-slate-200 dark:border-app-border bg-white dark:bg-app-card/80 backdrop-blur-xl shadow-xl dark:shadow-2xl relative"
          style={{
            clipPath: 'polygon(36px 0%, 100% 0%, 100% calc(100% - 36px), calc(100% - 36px) 100%, 0% 100%, 0% 36px)'
          }}
        >
          {/* Top-Left 3D Fold Flap */}
          <div 
            className="absolute top-0 left-0 w-9 h-9 bg-gradient-to-br from-app-border/40 via-app-border/10 to-app-border/5 border-l border-t border-app-border shadow-md backdrop-blur-2xl z-30 pointer-events-none"
            style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
          >
            {/* Inner crease highlight */}
            <div className="absolute inset-0 bg-gradient-to-tl from-black/5 to-transparent" />
          </div>

          {/* Bottom-Right 3D Fold Flap (with Primary Orange Accent) */}
          <div 
            className="absolute bottom-0 right-0 w-9 h-9 bg-gradient-to-tl from-primary/50 via-primary/20 to-primary/10 border-r border-b border-primary/40 shadow-md backdrop-blur-2xl z-30 pointer-events-none"
            style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
          >
            {/* Inner crease highlight */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent" />
          </div>

          {/* Inner glass highlight border */}
          <div className="absolute inset-0 border border-app-border/50 pointer-events-none z-20" />

          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left border-collapse min-w-[550px] sm:min-w-full">
              {/* Table Header */}
              <thead>
                <tr className="bg-slate-50 dark:bg-app-bg border-b border-slate-200 dark:border-app-border">
                  <th className="pl-10 pr-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-app-text-muted border-r border-slate-200 dark:border-app-border w-1/3">
                    Feature
                  </th>
                  <th className="px-4 py-3 text-xs font-black text-primary bg-primary/10 border-r border-primary/20 w-1/3 text-center">
                    {header.vedhuntColumnHeader}
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-app-text-muted w-1/3 text-center">
                    {header.typicalColumnHeader}
                  </th>
                </tr>
              </thead>
              
              {/* Table Body */}
              <tbody className="divide-y divide-slate-100 dark:divide-app-border">
                {rows.map((row, index) => (
                  <tr 
                    key={row._id || index} 
                    className="group hover:bg-slate-50 dark:hover:bg-app-bg transition-colors duration-300"
                  >
                    {/* Feature Column */}
                    <td className="pl-10 pr-4 py-2.5 text-[11px] font-bold text-slate-800 dark:text-app-text transition-colors">
                      {row.feature}
                    </td>
                    
                    {/* Vedhunt Column - Highlighted */}
                    <td className="px-4 py-2.5 text-[11px] font-black text-primary bg-primary/5 border-l border-r border-primary/20 group-hover:bg-primary/10 transition-colors text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_8px_rgba(255,107,0,0.8)]" />
                        <span>{row.vedhunt}</span>
                      </div>
                    </td>
                    
                    {/* Typical Agency Column - Muted */}
                    <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-app-text-muted transition-colors text-center">
                      {row.typical}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Bottom Trust Note */}
        {header.bottomNote && (
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-5 text-center text-[9px] font-black uppercase tracking-[0.2em] text-app-text-muted/60"
          >
            {header.bottomNote}
          </motion.p>
        )}

      </div>
    </section>
  );
}
