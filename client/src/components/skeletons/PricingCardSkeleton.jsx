import { motion } from 'framer-motion';

export default function PricingCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative rounded-[2.25rem] border-[1.5px] border-slate-100 dark:border-white/10 bg-white dark:bg-app-card overflow-hidden flex flex-col justify-between h-full animate-pulse"
    >
      <div className="flex flex-col flex-grow">
        {/* Header Row: Icon + Title */}
        <div className="flex items-center gap-4 p-6 pt-7">
          <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="space-y-2 flex-grow">
            <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
          </div>
        </div>

        {/* Deliverables / Features Box */}
        <div className="px-6 pb-6 flex-grow flex flex-col">
          <div className="rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-4.5 flex flex-col space-y-4 h-[250px]">
            <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-2" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="bg-[#FFF6F2] dark:bg-[#07070F] p-6 border-t border-black/5 dark:border-white/5 rounded-b-[2.25rem] flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-24" />
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-16" />
        </div>
        <div className="w-32 h-10 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
    </motion.div>
  );
}
