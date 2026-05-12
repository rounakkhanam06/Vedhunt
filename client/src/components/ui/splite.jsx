import React, { useState, useEffect, useRef, Suspense } from 'react'

// Check for low-power mode or reduced motion preference
function shouldUseOptimizedRendering() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return prefersReducedMotion || isMobile;
}

// Safely probe if WebGL is active and context creation is allowed by the browser
function checkWebGLAvailability() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

class SplineErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("Spline/WebGL integration caught in ErrorBoundary safely:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center relative overflow-hidden rounded-full min-h-[350px]">
          <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-primary/12 to-primary/3 filter blur-2xl animate-pulse" />
          <div className="w-48 h-48 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center relative orange-glow-sm">
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-primary/10 via-transparent to-transparent flex items-center justify-center relative">
              <span className="text-primary text-[10px] font-extrabold uppercase tracking-widest animate-pulse">
                System Active
              </span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lightweight skeleton loader
const SplineSkeleton = () => {
  return (
    <div className="w-full h-full flex items-center justify-center relative min-h-[350px] overflow-hidden rounded-full">
      <style>{`
        @keyframes shimmer-sweep {
          0% { transform: translate(-100%, -100%) rotate(45deg); }
          100% { transform: translate(100%, 100%) rotate(45deg); }
        }
        .animate-shimmer-sweep {
          animation: shimmer-sweep 3s infinite linear;
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/3 to-transparent opacity-20 pointer-events-none" />
      <div className="absolute top-0 left-0 w-[200%] h-[200%] bg-gradient-to-br from-transparent via-primary/5 to-transparent animate-shimmer-sweep pointer-events-none" />

      <div className="w-40 h-40 rounded-full border border-primary/25 bg-gradient-to-tr from-primary/12 via-primary/5 to-transparent flex items-center justify-center relative shadow-[0_0_50px_rgba(255,107,0,0.18)] animate-pulse">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/15 via-transparent to-transparent flex items-center justify-center relative">
          <span className="text-primary text-[9px] font-black uppercase tracking-[0.22em] animate-pulse">
            LOADING 3D
          </span>
        </div>
      </div>
    </div>
  );
};

export function SplineScene({ scene, className }) {
  const [Spline, setSpline] = useState(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorLoading, setErrorLoading] = useState(false);
  const containerRef = useRef(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Skip loading if user prefers reduced motion or on mobile
    if (shouldUseOptimizedRendering()) {
      setErrorLoading(true);
      return;
    }

    const element = containerRef.current;
    if (!element || hasLoadedRef.current) return;

    // Probe WebGL capability
    const supported = checkWebGLAvailability();
    setIsSupported(supported);
    if (!supported) return;

    // Intersection Observer - only load when in viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoadedRef.current) {
          hasLoadedRef.current = true;
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0.1 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Load Spline when shouldLoad becomes true
  useEffect(() => {
    if (!shouldLoad || Spline) return;

    const loadSpline = async () => {
      try {
        const module = await import('@splinetool/react-spline');
        setSpline(() => module.default);
      } catch (err) {
        console.warn("Failed to dynamically load Spline library safely:", err);
        setErrorLoading(true);
      }
    };

    // Small delay to not block main thread during page load
    const timer = setTimeout(loadSpline, 100);
    return () => clearTimeout(timer);
  }, [shouldLoad, Spline]);

  if (!isSupported || errorLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center relative overflow-hidden rounded-full min-h-[350px]">
        <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-primary/12 to-primary/3 filter blur-2xl animate-pulse" />
        <div className="w-48 h-48 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center relative orange-glow-sm">
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-primary/10 via-transparent to-transparent flex items-center justify-center relative">
            <span className="text-primary text-[10px] font-extrabold uppercase tracking-widest animate-pulse">
              System Active
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      {!shouldLoad || !Spline ? (
        <SplineSkeleton />
      ) : (
        <SplineErrorBoundary>
          <Suspense fallback={<SplineSkeleton />}>
            <Spline scene={scene} />
          </Suspense>
        </SplineErrorBoundary>
      )}
    </div>
  )
}

