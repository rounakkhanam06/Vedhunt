// Employee.attendance stores clock-in/out as display strings ("10:05 AM").
// These helpers keep every writer on that one format and let readers turn it
// back into minutes-since-midnight.

/** Date → "10:05 AM" (server local time). */
function formatClock(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** "HH:mm" (24h, from an <input type="time">) → "10:05 AM", or null if invalid. */
function formatHHmm(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
  return formatClock(d);
}

/** "10:05 AM" / "10:05 am" / "22:05" → minutes since midnight, or null. */
function parseClock(value) {
  const m = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/.exec(String(value || '').trim());
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes after the office start time ("09:00"), 0 when on time. */
function lateByMinutes(clockInMinutes, standardStart) {
  const start = parseClock(standardStart);
  if (start == null || clockInMinutes == null) return 0;
  return Math.max(0, clockInMinutes - start);
}

/** 355 → "5 hrs 55 mins", 60 → "1 hr", 45 → "45 mins" (mirrors client/src/utils/formatDuration.js). */
function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const part = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (!hours) return part(mins, 'min');
  return mins ? `${part(hours, 'hr')} ${part(mins, 'min')}` : part(hours, 'hr');
}

module.exports = { formatClock, formatHHmm, parseClock, lateByMinutes, formatDuration };
