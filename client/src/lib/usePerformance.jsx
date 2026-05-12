import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Intersection Observer hook for lazy loading
 * - Triggers callback when element enters viewport
 * - Automatically disconnects after triggering (one-time)
 */
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || hasIntersected) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          setHasIntersected(true);
          observer.disconnect();
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '50px',
        ...options
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [hasIntersected, options.threshold, options.rootMargin]);

  return [ref, isIntersecting, hasIntersected];
}

/**
 * useVisibleOnly hook - Only renders content when visible
 * - Uses IntersectionObserver to delay rendering until visible
 * - Great for below-fold content
 */
export function useVisibleOnly(options = {}) {
  const [ref, isIntersecting, hasIntersected] = useIntersectionObserver(options);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (hasIntersected && !shouldRender) {
      // Small delay to allow smooth transition
      const timer = setTimeout(() => setShouldRender(true), 50);
      return () => clearTimeout(timer);
    }
  }, [hasIntersected, shouldRender]);

  return { ref, shouldRender: hasIntersected && shouldRender, isVisible: isIntersecting };
}

/**
 * Debounced scroll handler hook
 * - Reduces scroll event frequency for performance
 * - Uses requestAnimationFrame for smooth throttling
 */
export function useDebouncedScroll(callback, delay = 16) {
  const rafRef = useRef(null);
  const lastValueRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastValueRef.current >= delay) {
        lastValueRef.current = now;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          callback();
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [callback, delay]);
}

/**
 * useReducedMotion hook - Detect user's motion preferences
 * - Respects OS accessibility settings
 * - Returns true if user prefers reduced motion
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * useIdleCallback hook - Use requestIdleCallback when available
 * - Defers non-critical work to browser idle time
 * - Fallback to setTimeout for unsupported browsers
 */
export function useIdleCallback(callback, deps = []) {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => callback());
      return () => cancelIdleCallback(id);
    } else {
      const timeout = setTimeout(() => callback(), 100);
      return () => clearTimeout(timeout);
    }
  }, deps);
}