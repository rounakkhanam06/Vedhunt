import { useEffect } from 'react';

/**
 * Forces dark theme for the Client Portal.
 * Mirrors AdminThemeGuard — adds 'dark' class on mount, removes on unmount.
 * This isolates the client portal theme from the public site's light/dark toggle.
 */
const ClientThemeGuard = ({ children }) => {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
      // Only remove if admin portal isn't also mounted
      if (!document.querySelector('[data-admin-portal]')) {
        document.documentElement.classList.remove('dark');
      }
    };
  }, []);

  return <div data-client-portal="true">{children}</div>;
};

export default ClientThemeGuard;
