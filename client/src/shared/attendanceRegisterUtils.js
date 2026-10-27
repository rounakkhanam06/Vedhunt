// Values and helpers shared by the Attendance Register views (components in ./attendanceRegister.jsx;
// server/services/attendanceRegister.js computes every value shown).

export const STATUS_CLASS = {
  Present: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Half Day': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Absent: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  Leave: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Holiday: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Weekly Off': 'bg-app-border/40 text-app-text-muted border-app-border',
  'Not clocked in': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  Upcoming: 'bg-app-border/20 text-app-text-muted border-app-border',
  'Not employed': 'bg-app-border/20 text-app-text-muted border-app-border',
};

// Working hours: more than 8 h green, exactly 8 h amber, less than 8 h red
export const HOURS_CLASS = {
  over: 'text-emerald-500 bg-emerald-500/10',
  exact: 'text-amber-500 bg-amber-500/10',
  under: 'text-rose-500 bg-rose-500/10',
};

export const STATUSES = ['Present', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Weekly Off'];

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoursText = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h ${pad(m % 60)}m`);
export const bandOf = (m) => (m == null ? null : m > 480 ? 'over' : m === 480 ? 'exact' : 'under');
export const fmtDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Initial range for a mode: today, this month so far, or the last 7 days. */
export function rangeFor(mode, monthValue) {
  const today = new Date();
  if (mode === 'daily') return { from: ymd(today), to: ymd(today) };
  if (mode === 'monthly') {
    const [y, m] = (monthValue || ymd(today).slice(0, 7)).split('-').map(Number);
    return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  }
  return { from: ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), to: ymd(today) };
}

/** Saves an axios blob response as a file, reading the error message if the server sent JSON instead. */
export async function downloadBlob(promise, fallbackName) {
  try {
    const res = await promise;
    const name = /filename="([^"]+)"/.exec(res.headers?.['content-disposition'] || '')?.[1] || fallbackName;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    let message = 'Could not export the register.';
    try { message = JSON.parse(await err.response.data.text()).message || message; } catch { /* not JSON */ }
    throw new Error(message, { cause: err });
  }
}
