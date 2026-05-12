import React, { useState, useEffect, useRef } from "react";

const DEFAULT_CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+{}|:<>?-=[]\\;',./";

export function EncryptedText({
  text,
  className = "",
  revealDelayMs = 40,
  flipDelayMs = 35,
  charset = DEFAULT_CHARSET,
  encryptedClassName = "text-primary/60 font-mono",
  revealedClassName = "text-app-text",
}) {
  const [hasIntersected, setHasIntersected] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [scrambled, setScrambled] = useState([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef(null);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Set up Intersection Observer to trigger decryption once scrolled into view
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasIntersected(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "-30px" }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize scramble array - instant reveal for reduced motion
  useEffect(() => {
    if (prefersReducedMotion) {
      setScrambled(text.split(""));
      setRevealedCount(text.length);
      return;
    }

    const initial = text.split("").map((char) => {
      if (char === " ") return " ";
      return charset[Math.floor(Math.random() * charset.length)];
    });
    setScrambled(initial);
    if (!hasIntersected) {
      setRevealedCount(0);
    }
  }, [text, charset, hasIntersected, prefersReducedMotion]);

  // Incremental reveal timer - skip for reduced motion
  useEffect(() => {
    if (!hasIntersected || prefersReducedMotion) return;
    if (revealedCount >= text.length) return;

    const revealTimer = setTimeout(() => {
      setRevealedCount((prev) => prev + 1);
    }, revealDelayMs);

    return () => clearTimeout(revealTimer);
  }, [revealedCount, text.length, revealDelayMs, hasIntersected, prefersReducedMotion]);

  // Scramble character flip timer - skip for reduced motion
  useEffect(() => {
    if (!hasIntersected || prefersReducedMotion) return;
    if (revealedCount >= text.length) return;

    const flipTimer = setInterval(() => {
      setScrambled((prev) => {
        return text.split("").map((char, index) => {
          if (index < revealedCount) {
            return char;
          }
          if (char === " ") return " ";
          return charset[Math.floor(Math.random() * charset.length)];
        });
      });
    }, flipDelayMs);

    return () => clearInterval(flipTimer);
  }, [revealedCount, text, charset, flipDelayMs, hasIntersected, prefersReducedMotion]);

  return (
    <span ref={containerRef} className={`${className} inline-block`}>
      {text.split("").map((char, index) => {
        const isRevealed = hasIntersected && index < revealedCount;
        return (
          <span
            key={index}
            className={isRevealed ? revealedClassName : encryptedClassName}
          >
            {isRevealed ? char : (scrambled[index] || char)}
          </span>
        );
      })}
    </span>
  );
}
