import { useState, useEffect } from 'react';
import { X, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Bulk reassignment, in three steps: preview (server checks every selected
 * lead and says which can't move and why) → explicit confirmation → summary
 * with success/failure counts and every failed record. The server re-checks
 * each lead on confirm (services/bulkReassign.js), so nothing outside the
 * preview can move.
 */
export default function BulkReassignModal({ http, root, leadPath, leadIds, target, expectedOwner, filterChips, selection, onClose, onDone }) {
  const [step, setStep] = useState('loading'); // loading | preview | running | done | error
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const body = { leadIds, assignedTo: target, expectedOwner: expectedOwner || undefined };

  useEffect(() => {
    http.post(`${root}/leads/bulk-assign/preview`, body)
      .then((res) => { setPreview(res.data.data); setStep('preview'); })
      .catch((err) => { setError(err.response?.data?.message || 'Could not prepare the preview.'); setStep('error'); });
    // body is fixed for the life of the modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setStep('running');
    try {
      const res = await http.post(`${root}/leads/bulk-assign`, { ...body, reason, selection, filters: { chips: filterChips } });
      setResult(res.data);
      setStep('done');
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk reassignment failed. No summary was returned — check the lead list before retrying.');
      setStep('error');
    }
  };

  const plural = (n) => `${n} lead${n === 1 ? '' : 's'}`;
  const busy = step === 'loading' || step === 'running';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-reassign-title"
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-app-card border border-app-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-app-border">
          <h3 id="bulk-reassign-title" className="text-app-text font-semibold text-lg">
            {step === 'done' ? 'Bulk reassignment summary' : 'Review bulk reassignment'}
          </h3>
          <button onClick={onClose} disabled={step === 'running'} className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text disabled:opacity-40" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-5 text-sm">
          {busy && (
            <div className="flex items-center gap-3 text-app-text-muted">
              <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              {step === 'loading' ? `Checking ${plural(leadIds.length)}…` : `Reassigning… don’t close this window.`}
            </div>
          )}

          {step === 'error' && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {step === 'preview' && preview && (
            <>
              <div className="p-3 rounded-lg bg-app-bg border border-app-border space-y-2">
                <p className="text-app-text">
                  <span className="font-semibold">Selection: </span>
                  {selection === 'all-matching'
                    ? `all ${plural(preview.requested)} matching the filters (every page)`
                    : `${plural(preview.requested)} picked by hand`}
                </p>
                {filterChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {filterChips.map((c) => <span key={c} className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">{c}</span>)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-app-text-muted mb-1">From (current owner)</p>
                  {preview.sources.length === 0 ? <p className="text-app-text-muted">—</p> : preview.sources.map((s) => (
                    <p key={s._id || 'none'} className="text-app-text">{s.name} <span className="text-app-text-muted">· {plural(s.count)}</span></p>
                  ))}
                </div>
                <ArrowRight className="hidden sm:block text-app-text-muted" size={18} />
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-app-text-muted mb-1">To (new owner)</p>
                  <p className="text-app-text font-semibold">{preview.target.name}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">{plural(preview.eligible)} will be reassigned</span>
                {preview.ineligible.length > 0 && (
                  <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">{plural(preview.ineligible.length)} can’t be reassigned</span>
                )}
              </div>

              {preview.ineligible.length > 0 && <LeadTable title="These will be left as they are" rows={preview.ineligible} leadPath={leadPath} showOwner />}

              <p className="text-app-text-muted text-xs">
                Only the owner changes. Status, stage, lead score, call logs, notes, remarks and history stay on each lead; pending follow-ups move to the new owner.
                Every lead gets its own assignment-history entry.
              </p>

              {preview.eligible > 0 && (
                <>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Reason (optional, saved in the history)"
                    className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-app-text focus:outline-none focus:border-primary" />
                  <label className="flex items-start gap-2 text-app-text cursor-pointer">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[#FF6B00]" />
                    I want to change the owner of these {plural(preview.eligible)} to {preview.target.name}.
                  </label>
                </>
              )}
            </>
          )}

          {step === 'done' && result && (
            <>
              <div className={`flex gap-2 p-3 rounded-lg border ${result.failed ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                {result.failed ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
                {result.message}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Selected" value={result.requested} />
                <Stat label="Reassigned" value={result.assigned} tone="text-emerald-400" />
                <Stat label="Failed" value={result.failed} tone={result.failed ? 'text-red-400' : undefined} />
              </div>
              {result.failures?.length > 0 && <LeadTable title="Not reassigned" rows={result.failures.map((f) => ({ ...f, _id: f.lead }))} leadPath={leadPath} />}
              <p className="text-xs text-app-text-muted">Run ID {result.runId} — kept with who ran it, when, and every lead’s previous owner.</p>
            </>
          )}
        </div>

        <div className="shrink-0 px-6 py-3.5 border-t border-app-border flex justify-end gap-2">
          <button onClick={onClose} disabled={step === 'running'} className="px-4 py-2 rounded-lg border border-app-border text-app-text-muted hover:text-app-text disabled:opacity-40">
            {step === 'done' || step === 'error' ? 'Close' : 'Cancel'}
          </button>
          {step === 'preview' && preview?.eligible > 0 && (
            <button onClick={run} disabled={!confirmed} className="px-4 py-2 rounded-lg bg-primary text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed">
              Reassign {plural(preview.eligible)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'text-app-text' }) {
  return (
    <div className="p-3 rounded-lg bg-app-bg border border-app-border">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-app-text-muted">{label}</p>
    </div>
  );
}

function LeadTable({ title, rows, leadPath, showOwner = false }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold tracking-wider text-app-text-muted mb-2">{title}</p>
      <div className="border border-app-border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-app-bg text-app-text-muted sticky top-0">
            <tr>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">Name</th>
              {showOwner && <th className="px-3 py-2">Owner</th>}
              <th className="px-3 py-2">Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r._id)} className="border-t border-app-border">
                <td className="px-3 py-2 font-mono text-primary">
                  <a href={leadPath(r._id)} target="_blank" rel="noreferrer" className="hover:underline">{r.leadId || String(r._id).slice(-6)}</a>
                </td>
                <td className="px-3 py-2 text-app-text">{r.fullName || '—'}</td>
                {showOwner && <td className="px-3 py-2 text-app-text-muted">{r.owner}</td>}
                <td className="px-3 py-2 text-amber-400">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
