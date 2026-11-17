import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

/**
 * Tells the admin what is still missing for project balances to be right —
 * projects with no value, invoices not linked to a project — and lets them
 * fix each one in place. Hidden once nothing is missing.
 */
export default function BillingSetupGaps({ http, base, canEditInvoices, canEditProjects, onChanged }) {
  const [gaps, setGaps] = useState(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    http.get(`${base}/billing-setup-gaps`).then((r) => setGaps(r.data)).catch(() => setGaps(null));
  }, [http, base]);
  useEffect(() => { load(); }, [load]);

  if (!gaps) return null;
  const { projectsWithoutValue = [], unlinkedInvoices = [] } = gaps;
  const total = projectsWithoutValue.length + unlinkedInvoices.length;
  if (!total) return null;

  const saveValue = async (p) => {
    const v = Number(values[p._id]);
    if (!(v > 0)) return toast.error('Enter the project value in ₹');
    setBusy(p._id);
    try {
      await http.put(`${base}/projects/${p._id}`, { totalPrice: v });
      toast.success(`Value saved for ${p.projectName}`);
      load(); onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save the value');
    } finally { setBusy(''); }
  };

  const link = async (inv, projectRef) => {
    if (!projectRef) return;
    setBusy(inv._id);
    try {
      await http.put(`${base}/invoices/${inv._id}`, { project_ref: projectRef });
      toast.success(`${inv.invoiceId} linked`);
      load(); onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not link the invoice');
    } finally { setBusy(''); }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-start gap-3 p-4 text-left cursor-pointer">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface">Project balances need setting up</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {projectsWithoutValue.length > 0 && <>{projectsWithoutValue.length} project{projectsWithoutValue.length === 1 ? '' : 's'} without a value</>}
            {projectsWithoutValue.length > 0 && unlinkedInvoices.length > 0 && ' · '}
            {unlinkedInvoices.length > 0 && <>{unlinkedInvoices.length} invoice{unlinkedInvoices.length === 1 ? '' : 's'} not linked to a project</>}
            {' — '}until these are done, a project can't show how much is left to collect.
          </p>
        </div>
        {open ? <ChevronUp size={16} className="text-on-surface-variant" /> : <ChevronDown size={16} className="text-on-surface-variant" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5">
          {projectsWithoutValue.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-on-surface mb-1">Step 1 · Add the project value</p>
              <p className="text-[11px] text-on-surface-variant mb-2">The total agreed price of the project. Payments are counted against it.</p>
              <div className="space-y-2">
                {projectsWithoutValue.map((p) => (
                  <div key={p._id} className="flex flex-wrap items-center gap-2 text-xs bg-admin-bg border border-outline-variant rounded-lg p-2">
                    <span className="flex-1 min-w-[180px] text-on-surface">
                      <span className="font-semibold">{p.projectName}</span>
                      <span className="text-on-surface-variant"> · {p.projectId} · {p.client?.businessName}</span>
                    </span>
                    {canEditProjects ? (
                      <>
                        <input type="number" min="1" placeholder="Value ₹" value={values[p._id] || ''}
                          onChange={(e) => setValues((v) => ({ ...v, [p._id]: e.target.value }))}
                          className="w-32 px-2 py-1.5 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary" />
                        <button type="button" disabled={busy === p._id} onClick={() => saveValue(p)}
                          className="px-3 py-1.5 rounded-lg bg-secondary/15 text-secondary border border-secondary/30 font-semibold cursor-pointer disabled:opacity-50">
                          {busy === p._id ? 'Saving…' : 'Save'}
                        </button>
                      </>
                    ) : <span className="text-on-surface-variant">Ask someone with Projects edit access</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {unlinkedInvoices.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-on-surface mb-1">Step 2 · Link invoices to their project</p>
              <p className="text-[11px] text-on-surface-variant mb-2">These clients have projects, but these invoices aren't linked to one. Pick the project each invoice was for — leave it if it's a retainer or other non-project bill.</p>
              <div className="space-y-2">
                {unlinkedInvoices.map((inv) => (
                  <div key={inv._id} className="flex flex-wrap items-center gap-2 text-xs bg-admin-bg border border-outline-variant rounded-lg p-2">
                    <span className="flex-1 min-w-[180px] text-on-surface">
                      <span className="font-mono text-secondary">{inv.invoiceId}</span>
                      <span className="text-on-surface-variant"> · {inv.client_ref?.businessName} · {inr(inv.totalAmount)}{inv.paidAmount > 0 ? ` (paid ${inr(inv.paidAmount)})` : ''}</span>
                    </span>
                    {canEditInvoices ? (
                      <select defaultValue="" disabled={busy === inv._id} onChange={(e) => link(inv, e.target.value)}
                        className="px-2 py-1.5 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary cursor-pointer">
                        <option value="">Link to project…</option>
                        {inv.projects.map((p) => <option key={p._id} value={p._id}>{p.projectName} — {p.projectId}</option>)}
                      </select>
                    ) : <span className="text-on-surface-variant">Ask someone with Invoices edit access</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-green-400" />
            For new work: set the value when creating a project, and pick the project when creating its invoice.
          </p>
        </div>
      )}
    </div>
  );
}
