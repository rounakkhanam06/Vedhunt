import { useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * AdminThemeGuard
 * 
 * A wrapper component for Admin routes that forces the application into 'dark' mode
 * for the duration of the component's lifecycle. 
 * This isolates the Admin Panel aesthetic from the user-facing site's light/dark mode toggle.
 */
export default function AdminThemeGuard({ children }) {
  const { setForceDark } = useTheme();

  useEffect(() => {
    // Force dark mode on mount
    setForceDark(true);

    // Restore previous user preference on unmount
    return () => {
      setForceDark(false);
    };
  }, [setForceDark]);

  return children;
}

