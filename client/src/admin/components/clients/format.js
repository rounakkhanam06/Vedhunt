// Display helpers shared by the client portfolio screens.

/** ₹ amount in Indian grouping; null/undefined shows "--" (no data, not zero). */
export const inr = (n) => (n == null ? '--' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);

/** Percentage to one decimal; null shows "--" (e.g. nothing billed yet). */
export const pct = (n) => (n == null ? '--' : `${Number(n).toFixed(1)}%`);
