import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [forceDark, setForceDark] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      return systemPreference;
    }
    return 'dark'; // Fallback to premium dark mode
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const activeTheme = forceDark ? 'dark' : theme;
    
    // Inject the global temporary transition helper for ultra smooth transition animation
    root.classList.add('theme-transition');
    
    if (activeTheme === 'dark') {
      root.classList.add('dark');
      // Only persist to localStorage if it's the actual user theme preference, not a forced override
      if (!forceDark) localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      if (!forceDark) localStorage.setItem('theme', 'light');
    }

    // Safely remove the global overrides class after transition completion (350ms)
    const timeout = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 350);

    return () => clearTimeout(timeout);
  }, [theme, forceDark]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, forceDark, setForceDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
