import { useEffect, useState } from 'react';
import { PauseCircle, Clock, Save, Play, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const inputCls = 'w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text focus:outline-none focus:border-primary';
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function Section({ icon: Icon, title, intro, children, onSave, saving, dirty }) {
  return (
    <section className="rounded-xl border border-app-border bg-app-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-app-text flex items-center gap-2"><Icon size={16} className="text-primary" /> {title}</h3>
          <p className="text-xs text-app-text-muted mt-1 max-w-xl">{intro}</p>
        </div>
        <button type="button" onClick={onSave} disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {children}
    </section>
  );
}

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-[11px] font-medium text-app-text-muted uppercase tracking-wider mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-app-text-muted mt-1">{hint}</span>}
  </label>
);

/**
 * Super Admin rules the business can change without a developer:
 * (1) when an unpaid client goes On hold automatically, (2) how extra retainer
 * hours are billed. Both start switched off / track-only.
 */
export default function ClientPoliciesSettings() {
  const [hold, setHold] = useState(null);
  const [extra, setExtra] = useState(null);
  const [billing, setBilling] = useState(null);
  const [saved, setSaved] = useState({});
  const [busy, setBusy] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let live = true;
    api.get('/admin/settings/client-policies')
      .then((res) => { if (live) { setHold(res.data.autoHold); setExtra(res.data.extraHours); setBilling(res.data.billing); setSaved({ hold: res.data.autoHold, extra: res.data.extraHours, billing: res.data.billing }); } })
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load the client rules.'));
    return () => { live = false; };
  }, []);

  const save = async (which) => {
    setBusy(which);
    try {
      const body = which === 'hold' ? { autoHold: hold } : which === 'billing' ? { billing } : { extraHours: extra };
      const res = await api.put('/admin/settings/client-policies', body);
      setHold(res.data.autoHold); setExtra(res.data.extraHours); setBilling(res.data.billing);
      setSaved({ hold: res.data.autoHold, extra: res.data.extraHours, billing: res.data.billing });
      toast.success('Saved');
    } catch (err) { toast.error(err.response?.data?.message || 'Could not save'); }
    finally { setBusy(''); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await api.post('/admin/settings/client-policies/run-auto-hold');
      if (!res.data.enabled) toast('The rule is switched off, so nothing was changed.');
      else toast.success(`${res.data.held.length} client(s) put on hold, ${res.data.released.length} released.`);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not run the check'); }
    finally { setRunning(false); }
  };

  if (!hold || !extra || !billing) return <p className="text-sm text-app-text-muted">Loading…</p>;
  const holdDirty = JSON.stringify(hold) !== JSON.stringify(saved.hold);
  const billingDirty = JSON.stringify(billing) !== JSON.stringify(saved.billing);
  const extraDirty = JSON.stringify(extra) !== JSON.stringify(saved.extra);
  const num = (setter) => (k) => (e) => setter((v) => ({ ...v, [k]: e.target.value === '' ? '' : Number(e.target.value) }));

  // A worked example so the rule is clear before saving
  const example = (() => {
    if (extra.mode !== 'bill' || !(extra.ratePerHour > 0)) return null;
    const over = Math.max(0, 3 - (extra.freeHours || 0));
    const hours = over > 0 ? Math.ceil(over / extra.roundTo) * extra.roundTo : 0;
    const amount = hours * extra.ratePerHour;
    return `Example: 3 extra hours → ${extra.freeHours || 0}h free, ${hours}h billed × ${inr(extra.ratePerHour)} = ${inr(amount)} + ${extra.gstPercent}% GST = ${inr(amount * (1 + extra.gstPercent / 100))}.`;
  })();

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-app-text">Client rules</h2>
        <p className="text-xs text-app-text-muted mt-1">Only a Super Admin can see and change these. Every change is recorded in the audit log.</p>
      </div>

      <Section icon={PauseCircle} title="Automatic hold for unpaid clients" onSave={() => save('hold')} saving={busy === 'hold'} dirty={holdDirty}
        intro="Put a client on hold automatically when an invoice stays unpaid. A client on hold can still log in to see why and to pay. A daily check runs at 10:00 AM.">
        <label className="flex items-center gap-2 text-sm font-medium text-app-text cursor-pointer">
          <input type="checkbox" role="switch" checked={hold.enabled} onChange={(e) => setHold((h) => ({ ...h, enabled: e.target.checked }))} className="w-4 h-4 accent-[#FF5A1F]" />
          Hold clients automatically <span className="text-xs font-normal text-app-text-muted">({hold.enabled ? 'on' : 'off — staff can still hold clients by hand'})</span>
        </label>
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${hold.enabled ? '' : 'opacity-50'}`}>
          <Field label="Days overdue" hint="Counted from the oldest unpaid invoice's due date.">
            <input type="number" min="1" max="180" step="1" className={inputCls} value={hold.daysOverdue} onChange={num(setHold)('daysOverdue')} disabled={!hold.enabled} />
          </Field>
          <Field label="Minimum overdue amount (₹)" hint="Ignore small balances. 0 = any amount.">
            <input type="number" min="0" step="100" className={inputCls} value={hold.minOverdueAmount} onChange={num(setHold)('minOverdueAmount')} disabled={!hold.enabled} />
          </Field>
        </div>
        <label className={`flex items-start gap-2 text-sm text-app-text cursor-pointer ${hold.enabled ? '' : 'opacity-50'}`}>
          <input type="checkbox" checked={hold.autoRelease} disabled={!hold.enabled} onChange={(e) => setHold((h) => ({ ...h, autoRelease: e.target.checked }))} className="w-4 h-4 mt-0.5 accent-[#FF5A1F]" />
          <span>Take them off hold automatically once nothing is overdue<span className="block text-[11px] text-app-text-muted">Only holds placed by this rule are lifted — a hold set by staff is never lifted automatically.</span></span>
        </label>
        <button type="button" onClick={runNow} disabled={running || holdDirty} title={holdDirty ? 'Save first' : ''}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-border text-xs text-app-text hover:border-primary/40 disabled:opacity-50 cursor-pointer">
          <Play size={12} /> {running ? 'Checking…' : 'Run the check now'}
        </button>
      </Section>

      <Section icon={CalendarClock} title="Recurring invoices" onSave={() => save('billing')} saving={busy === 'billing'} dirty={billingDirty}
        intro="Defaults for the invoices created from each client's billing schedule. The billing day and start date are set per client (client → Billing). Invoices are always drafts that an admin approves before the client sees them.">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Days to pay (default)" hint="Each client can use 7 or 10 days instead."><input type="number" min="1" max="30" step="1" className={inputCls} value={billing.defaultDueDays} onChange={num(setBilling)('defaultDueDays')} /></Field>
          <Field label="GST on invoices (%)"><input type="number" min="0" max="28" step="1" className={inputCls} value={billing.gstPercent} onChange={num(setBilling)('gstPercent')} /></Field>
        </div>
      </Section>

      <Section icon={Clock} title="Extra retainer hours" onSave={() => save('extra')} saving={busy === 'extra'} dirty={extraDirty}
        intro="What happens to hours worked beyond a retainer's monthly plan. Nothing is ever invoiced by itself — staff preview a finished month and click to create the invoice, and each month can be invoiced once.">
        <div className="space-y-2" role="radiogroup" aria-label="Extra hours">
          {[['track_only', 'Track only', 'Show the extra hours to staff and the client; do not invoice them.'], ['bill', 'Bill at an hourly rate', 'Staff can invoice a finished month’s extra hours.']].map(([mode, label, hint]) => (
            <label key={mode} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${extra.mode === mode ? 'border-primary/50 bg-primary/5' : 'border-app-border'}`}>
              <input type="radio" name="extra-mode" checked={extra.mode === mode} onChange={() => setExtra((x) => ({ ...x, mode }))} className="mt-1 accent-[#FF5A1F]" />
              <span><span className="block text-sm font-medium text-app-text">{label}</span><span className="block text-[11px] text-app-text-muted">{hint}</span></span>
            </label>
          ))}
        </div>
        {extra.mode === 'bill' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rate per hour (₹)"><input type="number" min="0" step="50" className={inputCls} value={extra.ratePerHour} onChange={num(setExtra)('ratePerHour')} /></Field>
              <Field label="Free extra hours" hint="Not charged each month."><input type="number" min="0" max="100" step="0.5" className={inputCls} value={extra.freeHours} onChange={num(setExtra)('freeHours')} /></Field>
              <Field label="Round up to">
                <select className={inputCls} value={extra.roundTo} onChange={(e) => setExtra((x) => ({ ...x, roundTo: Number(e.target.value) }))}>
                  <option value={0.25}>15 minutes</option><option value={0.5}>30 minutes</option><option value={1}>1 hour</option>
                </select>
              </Field>
              <Field label="GST (%)"><input type="number" min="0" max="28" step="1" className={inputCls} value={extra.gstPercent} onChange={num(setExtra)('gstPercent')} /></Field>
            </div>
            {example && <p className="text-xs text-app-text-muted rounded-lg bg-app-bg px-3 py-2">{example}</p>}
          </>
        )}
      </Section>
    </div>
  );
}
