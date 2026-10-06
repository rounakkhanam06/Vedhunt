/**
 * Minutes as words: 355 → "5 hrs 55 mins", 60 → "1 hr", 45 → "45 mins", 1 → "1 min".
 * Used for "late by" and similar durations shown to people.
 */
export const formatDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const part = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (!hours) return part(mins, 'min');
  return mins ? `${part(hours, 'hr')} ${part(mins, 'min')}` : part(hours, 'hr');
};
