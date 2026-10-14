/**
 * A span of minutes as a readable duration: "45m", "2h 15m", "3d 4h".
 * Shows the two largest units only — at a glance "3d 4h" reads better than
 * "3d 4h 12m". Returns '—' for null/undefined.
 */
export function formatMinutes(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return '—';
  const total = Math.max(Math.round(Number(minutes)), 0);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}
