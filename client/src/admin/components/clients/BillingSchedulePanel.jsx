import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, CalendarClock } from 'lucide-react';

const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// The first date the daily job will draft on its own: a missed run only catches up the last 7 days
function firstAutomaticDate(startDate, billingDay) {
  if (!startDate) return null;
  const today = todayStr();
  const earliest = new Date(`${today}T12:00:00`);
  earliest.setDate(earliest.getDate() - 7);
  const from = `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2, '0')}-${String(earliest.getDate()).padStart(2, '0')}`;
  const [y, m] = startDate.split('-').map(Number);
  for (let k = 0; k < 600; k += 1) {
    let d = startDate;
    if (k > 0) {
      const first = new Date(y, m - 1 + k, 1);
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      d = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(Math.min(Number(billingDay) || 1, last)).padStart(2, '0')}`;
    }
    if (d >= from) return d;
  }
  return null;
}

const inputCls = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';

/**
 * A client's recurring-invoice schedule: the billing day is set per client, billed
 * in advance for the coming month, full fee. Turning it on makes the daily job
 * create DRAFTS that an admin approves (Invoices → Awaiting approval).
 */
export default function BillingSchedulePanel({ clientId, http, base, canEdit }) {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState('');

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/billing-schedule`)
      .then((res) => {
        if (!live) return;
        const d = res.data.data;
        setInfo(d);
        const s = d.schedule;
        setForm(s
          ? { active: s.active, billingDay: s.billingDay, startDate: s.startDate, dueDays: s.dueDays, note: s.note || '' }
          : { active: false, billingDay: d.suggestedStartDate ? Number(d.suggestedStartDate.slice(8)) : '', startDate: d.suggestedStartDate || '', dueDays: d.defaultDueDays, note: '' });
      })
      .catch((err) => toast.error(err?.response?.data?.message || 'Could not load the billing schedule'));
    return () => { live = false; };
  }, [http, base, clientId, reload]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await http.put(`${base}/clients/${clientId}/billing-schedule`, { ...form, billingDay: Number(form.billingDay), dueDays: Number(form.dueDays) });
      toast.success(res.data.message);
      setReload((n) => n + 1);
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  const createNow = async (invoiceDate) => {
    setCreating(invoiceDate);
    try {
      const res = await http.post(`${base}/clients/${clientId}/billing-schedule/draft`, { invoiceDate });
      toast.success(res.data.message);
      setReload((n) => n + 1);
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not create the draft'); }
    finally { setCreating(''); }
  };

  if (!info || !form) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>;

  return (
    <form onSubmit={save} className="space-y-5">
      <p className="text-xs text-on-surface-variant max-w-xl">
        Invoices are raised in advance for the coming month at the full monthly retainer fee, on this client&apos;s billing day. Ad spend is billed separately and is never included.
        Each invoice is created as a draft that an admin approves before the client sees it.
      </p>

      <label className="flex items-center gap-2 text-sm font-medium text-on-surface cursor-pointer">
        <input type="checkbox" role="switch" checked={form.active} disabled={!canEdit} onChange={set('active')} className="w-4 h-4 accent-[#FF5A1F]" />
        Recurring invoices <span className="text-xs font-normal text-on-surface-variant">({form.active ? 'on' : 'off'})</span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block"><span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">First invoice date *</span>
          <input type="date" required className={inputCls} value={form.startDate} disabled={!canEdit} onChange={set('startDate')} />
          {info.suggestedStartDate && <span className="block text-[11px] text-on-surface-variant mt-1">Suggested: {fmt(info.suggestedStartDate)} (onboarding + 30 days)</span>}
        </label>
        <label className="block"><span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Billing day of the month *</span>
          <input type="number" required min="1" max="31" step="1" className={inputCls} value={form.billingDay} disabled={!canEdit} onChange={set('billingDay')} />
          <span className="block text-[11px] text-on-surface-variant mt-1">29–31 use the last day of a shorter month.</span>
        </label>
        <label className="block"><span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Days to pay</span>
          <select className={inputCls} value={form.dueDays} disabled={!canEdit} onChange={set('dueDays')}>
            {[...new Set([7, 10, Number(form.dueDays)])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} days</option>)}
          </select>
        </label>
      </div>
      {/* What each draft will bill — from the client's active monthly retainers */}
      {info.billing && (info.billing.retainers.length ? (
        <div className="rounded-lg border border-outline-variant bg-admin-bg/60 px-3 py-2.5 text-xs">
          <p className="text-on-surface-variant mb-1">Each invoice will bill (from active monthly retainers):</p>
          {info.billing.retainers.map((r) => (
            <p key={r.packageName} className="flex justify-between gap-3 text-on-surface">
              <span>{r.packageName}<span className="text-on-surface-variant"> · until {fmt(String(r.contractEndDate).slice(0, 10))}</span></span>
              <span>₹{Number(r.monthlyAmount).toLocaleString('en-IN')}</span>
            </p>
          ))}
          <p className="flex justify-between gap-3 mt-1 pt-1 border-t border-outline-variant font-semibold text-on-surface">
            <span>Total incl. {info.billing.gstPercent}% GST</span><span>₹{Number(info.billing.total).toLocaleString('en-IN')} / month</span>
          </p>
        </div>
      ) : (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" role="alert">
          This client has <strong>no active monthly retainer</strong>, so there is nothing to bill — every draft would be marked &quot;Needs Attention&quot;.
          Add one in <strong>Retainer Manager</strong> (status Active, billing cycle Monthly, with the monthly fee) before turning recurring invoices on.
        </p>
      ))}

      {form.startDate && form.billingDay && Number(form.startDate.slice(8)) !== Number(form.billingDay) && (
        <p className="text-xs text-on-surface-variant bg-admin-bg/60 border border-outline-variant rounded-lg px-3 py-2">
          The first invoice date is the {Number(form.startDate.slice(8))}{['th', 'st', 'nd', 'rd'][(Number(form.startDate.slice(8)) % 10 > 3 || [11, 12, 13].includes(Number(form.startDate.slice(8)))) ? 0 : Number(form.startDate.slice(8)) % 10]} but the billing day is {form.billingDay}. Usually these match — the first invoice date is simply the first billing day.
        </p>
      )}

      <label className="block"><span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Internal note</span>
        <input className={inputCls} maxLength={500} value={form.note} disabled={!canEdit} onChange={set('note')} /></label>

      {(() => {
        const first = firstAutomaticDate(form.startDate, form.billingDay);
        if (!form.startDate || !first || first === form.startDate) return null;
        return (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2" role="status">
            {fmt(form.startDate)} has already passed, so the daily job will not create a draft for it. The first automatic invoice will be on <strong>{fmt(first)}</strong>.
            {info.schedule ? ' You can create the draft for the missed date below.' : ' Save the schedule, then you can create the draft for the missed date.'}
          </p>
        );
      })()}

      {canEdit && (
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"><Save size={14} /> {saving ? 'Saving…' : 'Save schedule'}</button>
      )}

      {canEdit && info.missed?.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
          <p className="text-on-surface text-sm font-semibold">Missed invoice dates</p>
          <p className="text-xs text-on-surface-variant">These dates have passed with no draft or invoice. Create the draft for each one that should still be billed — it will wait for approval like any other.</p>
          <ul className="space-y-2">
            {info.missed.map((m) => (
              <li key={m.invoiceDate} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-on-surface">{fmt(m.invoiceDate)} <span className="text-on-surface-variant">— covers {fmt(m.start)} to {fmt(m.end)}</span></span>
                <button type="button" disabled={!!creating} onClick={() => createNow(m.invoiceDate)} className="px-3 py-1.5 rounded-lg bg-secondary text-white font-semibold disabled:opacity-60 cursor-pointer">
                  {creating === m.invoiceDate ? 'Creating…' : 'Create draft now'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {info.schedule && (
        <div className="rounded-xl border border-outline-variant bg-admin-bg/40 p-3.5">
          <p className="text-on-surface text-sm font-semibold flex items-center gap-2"><CalendarClock size={15} className="text-secondary" /> Next invoices {info.schedule.active ? '' : '(schedule is off)'}</p>
          <ul className="mt-2 space-y-1">
            {info.upcoming.map((u) => <li key={u.invoiceDate} className="text-xs text-on-surface-variant"><span className="text-on-surface font-medium">{fmt(u.invoiceDate)}</span> — covers {fmt(u.start)} to {fmt(u.end)}</li>)}
          </ul>
        </div>
      )}
    </form>
  );
}
