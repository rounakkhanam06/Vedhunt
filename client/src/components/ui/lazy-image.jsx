import { useState, useEffect, useRef } from 'react';

/**
 * OptimizedLazyImage - Lazy loads images with IntersectionObserver
 * - Only loads when near viewport
 * - Shows lightweight placeholder until loaded
 * - Uses native loading="lazy" as fallback
 */
export function OptimizedLazyImage({
  src,
  alt,
  className = '',
  placeholderColor = '#f1f5f9',
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    // Intersection Observer - load when 100px before entering viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${className}`}
      style={{
        backgroundColor: isLoaded ? 'transparent' : placeholderColor,
        overflow: 'hidden',
        display: 'block'
      }}
    >
      {shouldLoad ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          {...props}
        />
      ) : (
        <div
          className="animate-pulse"
          style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(90deg, ${placeholderColor} 25%, #e2e8f0 50%, ${placeholderColor} 75%)`,
            backgroundSize: '200% 100%'
          }}
        />
      )}
    </div>
  );
}

export default OptimizedLazyImage;