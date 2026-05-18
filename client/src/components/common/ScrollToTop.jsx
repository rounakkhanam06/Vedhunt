import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLenis } from 'lenis/react';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const lenis = useLenis();

  useEffect(() => {
    if (lenis) {
      // Instantly scroll Lenis to top on route change to prevent layout shift lag
      lenis.scrollTo(0, { immediate: true });
    } else {
      // Fallback for native scrolling
      window.scrollTo(0, 0);
    }
  }, [pathname, lenis]);

  return null;
}
