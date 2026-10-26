// Chart tokens for the (dark-only) client portal. The two series colours are
// slots 1 and 2 of the validated categorical palette — validated against this
// portal's real card surface (#0e1118): lightness band, chroma, CVD separation,
// normal-vision floor and 3:1 contrast all pass. Slot order is fixed: "Invoiced"
// is always blue and "Paid" always orange, so colour follows the entity.
export const SURFACE = '#0e1118'; // chart card background (bg-surface/30 over bg-primary)

export const SERIES = {
  blue: '#3987e5', // slot 1
  orange: '#d95926', // slot 2
};

export const INK = {
  primary: '#F3F4F6',
  secondary: '#C3C8D2',
  muted: '#8B93A1', // axis labels
};

export const GRID = '#1d222c'; // hairline, one step off the surface
export const AXIS = '#2a303c';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** ₹ compact for axis ticks: 0 / 5K / 1.2L / 3Cr (Indian grouping). */
export const inrCompact = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${+(v / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${+(v / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${+(v / 1e3).toFixed(1)}K`;
  return `₹${v}`;
};

/** Full ₹ amount for tooltips and tables. */
export const inrFull = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** Charts skip their entrance animation for people who ask for reduced motion. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
