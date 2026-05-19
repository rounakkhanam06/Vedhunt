import { useTheme } from '../../context/ThemeContext';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative p-1.5 rounded-full bg-app-card border border-app-border text-app-text hover:text-primary hover:border-primary/30 transition-colors focus:outline-none flex items-center justify-center cursor-pointer overflow-hidden group shadow-md"
      aria-label="Toggle Theme"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {/* Animated Moon Icon for Dark Mode toggle */}
        <motion.div
          animate={{
            scale: theme === 'dark' ? 1 : 0,
            rotate: theme === 'dark' ? 0 : 90,
            opacity: theme === 'dark' ? 1 : 0
          }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="absolute"
        >
          <Moon className="w-5 h-5 text-primary" />
        </motion.div>

        {/* Animated Sun Icon for Light Mode toggle */}
        <motion.div
          animate={{
            scale: theme === 'light' ? 1 : 0,
            rotate: theme === 'light' ? 0 : -90,
            opacity: theme === 'light' ? 1 : 0
          }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="absolute"
        >
          <Sun className="w-5 h-5 text-primary" />
        </motion.div>
      </div>

      {/* Micro-interaction backdrop glow */}
      <span className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </button>
  );
}
