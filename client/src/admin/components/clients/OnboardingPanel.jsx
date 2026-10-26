import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Circle, Clock, Ban, MinusCircle, Rocket, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Completed', 'Not Applicable'];

const STATUS_STYLE = {
  'Not Started': { icon: Circle, cls: 'text-on-surface-variant' },
  'In Progress': { icon: Clock, cls: 'text-blue-400' },
  Blocked: { icon: Ban, cls: 'text-red-400' },
  Completed: { icon: CheckCircle2, cls: 'text-green-400' },
  'Not Applicable': { icon: MinusCircle, cls: 'text-on-surface-variant' },
};

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const inputCls = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';

function StepRow({ step, staff, canEdit, onSave }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(null);
  const { icon: Icon, cls } = STATUS_STYLE[step.status];
  const owner = staff.find((s) => String(s.adminId) === String(step.owner));

  const begin = () => {
    setF({
      status: step.status, owner: step.owner || '', dueDate: toDateInput(step.dueDate),
      evidenceLink: step.evidenceLink || '', remarks: step.remarks || '', blocker: step.blocker || '', naReason: step.naReason || '',
    });
    setOpen(true);
  };
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    const ok = await onSave(step.key, { ...f, owner: f.owner || null, dueDate: f.dueDate || null });
    setSaving(false);
    if (ok) setOpen(false);
  };

  return (
    <li className="border border-outline-variant rounded-xl bg-admin-bg/40">
      <button type="button" onClick={() => (open ? setOpen(false) : begin())} className="w-full flex items-center gap-3 px-3.5 py-3 text-left cursor-pointer">
        <Icon size={18} className={`${cls} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-on-surface text-sm font-medium">{step.label}</p>
          <p className="text-on-surface-variant text-[11px] mt-0.5 flex flex-wrap gap-x-3">
            <span>{step.status}</span>
            {owner && <span>Owner: {[owner.firstName, owner.lastName].filter(Boolean).join(' ')}</span>}
            {step.dueDate && <span className={step.overdue ? 'text-red-400 font-semibold' : ''}>Due {fmt(step.dueDate)}{step.overdue ? ' · overdue' : ''}</span>}
            {step.completedAt && <span>Done {fmt(step.completedAt)}</span>}
            {step.status === 'Blocked' && step.blocker && <span className="text-red-400">{step.blocker}</span>}
            {step.status === 'Not Applicable' && step.naReason && <span>{step.naReason}</span>}
          </p>
        </div>
        {open ? <ChevronUp size={16} className="text-on-surface-variant" /> : <ChevronDown size={16} className="text-on-surface-variant" />}
      </button>

      {open && f && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-outline-variant">
          {!canEdit && <p className="text-on-surface-variant text-xs pt-2">You can view this step but not change it.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Status</label>
              <select disabled={!canEdit} className={inputCls} value={f.status} onChange={set('status')}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Owner</label>
              <select disabled={!canEdit} className={inputCls} value={f.owner} onChange={set('owner')}>
                <option value="">— Unassigned —</option>
                {staff.filter((s) => s.adminId).map((s) => <option key={s._id} value={s.adminId}>{[s.firstName, s.lastName].filter(Boolean).join(' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Due date</label>
              <input disabled={!canEdit} type="date" className={inputCls} value={f.dueDate} onChange={set('dueDate')} />
            </div>
          </div>
          <div>
            <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">
              Evidence / document link{step.needsEvidence && <span className="text-amber-400 normal-case font-normal"> · needed to complete (or add remarks)</span>}
            </label>
            <input disabled={!canEdit} className={inputCls} value={f.evidenceLink} onChange={set('evidenceLink')} placeholder="https://…" />
          </div>
          <div>
            <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Remarks</label>
            <textarea disabled={!canEdit} rows={2} className={`${inputCls} resize-none`} value={f.remarks} onChange={set('remarks')} />
          </div>
          {f.status === 'Blocked' && (
            <div>
              <label className="block text-red-400 text-[10px] uppercase font-bold tracking-wider mb-1">What is blocking this step? *</label>
              <input disabled={!canEdit} className={inputCls} value={f.blocker} onChange={set('blocker')} />
            </div>
          )}
          {f.status === 'Not Applicable' && (
            <div>
              <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Why is this not applicable? *</label>
              <input disabled={!canEdit} className={inputCls} value={f.naReason} onChange={set('naReason')} />
            </div>
          )}
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer">
                {saving ? 'Saving…' : 'Save step'}
              </button>
              <button onClick={() => setOpen(false)} className="px-4 py-2 bg-admin-bg border border-outline-variant text-on-surface-variant rounded-lg text-sm cursor-pointer">Cancel</button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Onboarding checklist + go-live gate for one client (Client Portal CRM §4).
 * The server decides what blocks launch; this panel only shows it and sends
 * the requests. `canException` is Super Admin only.
 */
export default function OnboardingPanel({ clientId, http, base, canEdit, canException }) {
  const [data, setData] = useState(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [goingLive, setGoingLive] = useState(false);
  const [showException, setShowException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [blockers, setBlockers] = useState(null); // blockers returned by a refused go-live

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/onboarding`)
      .then((res) => { if (live) { setData(res.data.data); setError(''); } })
      .catch((err) => { if (live) setError(err?.response?.data?.message || 'Could not load the checklist'); });
    return () => { live = false; };
  }, [http, base, clientId]);
  useEffect(() => {
    let live = true;
    http.get(`${base}/clients-staff`).then((r) => { if (live) setStaff(r.data.data || []); }).catch(() => {});
    return () => { live = false; };
  }, [http, base]);

  const saveStep = async (key, body) => {
    try {
      const res = await http.put(`${base}/clients/${clientId}/onboarding/items/${key}`, body);
      setData(res.data.data);
      setBlockers(null);
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save the step');
      return false;
    }
  };

  const goLive = async (withException) => {
    setGoingLive(true);
    try {
      const res = await http.post(`${base}/clients/${clientId}/onboarding/go-live`, withException ? { exception: { reason: exceptionReason } } : {});
      setData(res.data.data);
      setBlockers(null);
      setShowException(false);
      toast.success(res.data.message);
    } catch (err) {
      const body = err?.response?.data;
      if (body?.blockers) setBlockers(body.blockers);
      toast.error(body?.message || 'Could not mark the campaign live');
    } finally { setGoingLive(false); }
  };

  const openBlockers = useMemo(() => blockers || data?.blockers || [], [blockers, data]);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>;

  const { summary, goLive: live } = data;
  const noScope = !data.scope.services.length && !data.scope.platforms.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-on-surface-variant">
        <span><strong className="text-on-surface">{summary.done}</strong> of {summary.total} steps done</span>
        {summary.blocked > 0 && <span className="text-red-400 font-semibold">{summary.blocked} blocked</span>}
        {summary.overdue > 0 && <span className="text-red-400 font-semibold">{summary.overdue} overdue</span>}
      </div>

      {noScope && (
        <p className="text-amber-300 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          No services or platforms are set on the Profile tab yet, so only the general steps are shown. Add them to get the Meta / Google / website steps.
        </p>
      )}

      {live.isLive ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3.5 text-sm">
          <p className="text-green-400 font-semibold flex items-center gap-2"><Rocket size={15} /> Campaign live since {fmt(live.liveDate)}</p>
          {live.exception?.reason && (
            <p className="text-amber-300 text-xs mt-2"><AlertTriangle size={12} className="inline mr-1" />
              Went live with an exception: {live.exception.reason}
              {live.exception.waivedItems?.length ? ` (waived: ${live.exception.waivedItems.length} step${live.exception.waivedItems.length > 1 ? 's' : ''})` : ''}
            </p>
          )}
          {live.platformLinks?.length > 0 && (
            <p className="text-xs mt-2 text-on-surface-variant">Links: {live.platformLinks.map((l) => <a key={l} href={l} target="_blank" rel="noreferrer" className="text-secondary hover:underline mr-2">{l}</a>)}</p>
          )}
        </div>
      ) : (
        <>
          {openBlockers.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
              <p className="text-amber-300 text-sm font-semibold flex items-center gap-2"><AlertTriangle size={15} /> Cannot go live yet — {openBlockers.length} launch-critical step{openBlockers.length > 1 ? 's' : ''} open</p>
              <ul className="mt-2 space-y-1">
                {openBlockers.map((b) => (
                  <li key={b.key} className="text-xs text-on-surface">
                    • {b.label} <span className={b.status === 'Blocked' || b.overdue ? 'text-red-400' : 'text-on-surface-variant'}>— {b.reason}{b.overdue ? ' (overdue)' : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {canEdit && (
            <div className="space-y-2">
              <button onClick={() => goLive(false)} disabled={goingLive || openBlockers.length > 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                <Rocket size={15} /> {goingLive ? 'Working…' : 'Mark campaign live'}
              </button>
              {openBlockers.length > 0 && canException && !showException && (
                <button onClick={() => setShowException(true)} className="block text-amber-300 text-xs underline cursor-pointer">Go live anyway with a logged exception…</button>
              )}
              {showException && (
                <div className="rounded-xl border border-outline-variant p-3 space-y-2 bg-admin-bg/40">
                  <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Reason for the exception (kept in the audit log)</label>
                  <textarea rows={2} className={`${inputCls} resize-none`} value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} placeholder="Why is it safe to launch with these steps open?" />
                  <div className="flex gap-2">
                    <button onClick={() => goLive(true)} disabled={goingLive || exceptionReason.trim().length < 10}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 cursor-pointer">Approve exception &amp; go live</button>
                    <button onClick={() => setShowException(false)} className="px-4 py-2 bg-admin-bg border border-outline-variant text-on-surface-variant rounded-lg text-sm cursor-pointer">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ul className="space-y-2">
        {data.items.map((s) => <StepRow key={s.key} step={s} staff={staff} canEdit={canEdit && !live.isLive} onSave={saveStep} />)}
      </ul>
    </div>
  );
}
