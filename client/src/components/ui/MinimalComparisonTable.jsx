import React from 'react';
import { cn } from '../../lib/utils';

/**
 * MinimalComparisonTable - An ultra-compact, high-contrast comparison matrix.
 * Designed for dark themes with Vedhunt's signature blue and orange branding.
 */
const MinimalComparisonTable = () => {
  const comparisonData = [
    { feature: "Services", vedhunt: "8 Under One Roof", agency: "2–3 Only" },
    { feature: "Pricing", vedhunt: "100% Transparent", agency: "Hidden Fees" },
    { feature: "Reports", vedhunt: "Real-Time Dashboards", agency: "Monthly PDF" },
    { feature: "Support", vedhunt: "Dedicated Manager+WA", agency: "Email Tickets" },
    { feature: "Strategy", vedhunt: "100% Custom Built", agency: "Generic Templates" },
    { feature: "Tech", vedhunt: "Proprietary Stack", agency: "Outsourced" },
    { feature: "Focus", vedhunt: "KPI & ROI Driven", agency: "Vanity Metrics" },
  ];

  return (
    <div className="bg-black w-full py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full border-collapse min-w-[450px]">
            <thead>
              <tr className="border-b border-[#E8470A]">
                <th className="py-2 px-3 text-left text-[10px] md:text-xs font-black text-white uppercase tracking-widest">
                  Feature
                </th>
                <th className="py-2 px-3 text-center text-[10px] md:text-xs font-black text-[#E8470A] bg-[#1A1A2E] uppercase tracking-widest border-x border-[#E8470A]">
                  Vedhunt
                </th>
                <th className="py-2 px-3 text-center text-[10px] md:text-xs font-black text-[#666666] uppercase tracking-widest">
                  Typical Agency
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr 
                  key={index} 
                  className={cn(
                    "border-b border-[#E8470A]/40 transition-colors hover:bg-white/5",
                    index === comparisonData.length - 1 && "border-b-[#E8470A]"
                  )}
                >
                  <td className="py-2 px-3 text-xs md:text-sm font-bold text-white/90">
                    {row.feature}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm font-black text-[#E8470A] bg-[#1A1A2E] border-x border-[#E8470A]/40">
                    {row.vedhunt}
                  </td>
                  <td className="py-2 px-3 text-center text-xs md:text-sm font-medium text-[#666666]">
                    {row.agency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[8px] md:text-[10px] text-center text-[#666666] uppercase tracking-[0.3em] font-bold">
          High Performance Growth Matrix • 2026
        </p>
      </div>
    </div>
  );
};

export default MinimalComparisonTable;
