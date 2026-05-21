import { motion } from 'framer-motion';

export default function LegalPageLayout({ title, description, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-app-bg pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-app-text font-heading mb-4"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600 dark:text-app-text-muted"
            >
              {description}
            </motion.p>
          )}
          {lastUpdated && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold"
            >
              Last Updated: {lastUpdated}
            </motion.div>
          )}
        </div>

        {/* Content Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-app-card rounded-3xl p-8 md:p-12 shadow-xl dark:shadow-2xl border border-slate-200 dark:border-app-border space-y-6 text-slate-600 dark:text-app-text-muted leading-relaxed"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
