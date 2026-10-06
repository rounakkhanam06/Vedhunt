// Date helpers for the Employee Portal. Inputs and "today" are in the user's
// local time — toISOString() is UTC and shifts India-time values by 5:30.

const pad = (n) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD (for <input type="date"> and API ?date= params). */
export const toDateInput = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Local YYYY-MM-DDTHH:mm for <input type="datetime-local">. */
export const toDateTimeInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${toDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Local HH:mm for <input type="time">. */
export const toTimeInput = (date) => {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** A datetime-local/date value back to an ISO instant ('' stays ''). */
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : '');

/** "10:05 AM" (attendance's stored clock string) → "10:05" for a time input. */
export const clockToTimeInput = (clock) => {
  const m = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/.exec(String(clock || '').trim());
  if (!m) return '';
  let h = Number(m[1]);
  const mer = m[3]?.toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return `${pad(h)}:${m[2]}`;
};

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtMinutes = (m) => `${Math.floor((m || 0) / 60)}h ${Math.round((m || 0) % 60)}m`;
export const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/** "x ago" for recent activity. */
export function timeAgo(date) {
  if (!date) return '—';
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : fmtDate(date);
}

export const isThisMonth = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};
