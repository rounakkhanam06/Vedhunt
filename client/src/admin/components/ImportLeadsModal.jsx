import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * Bulk lead import (Excel/CSV) — the manual-spreadsheet counterpart to the
 * Facebook webhook/sync ingestion. Two steps (server/services/leadImport.js):
 *
 *   1. POST /leads/import/preview — read-only dry run: what every row would
 *      create/update/skip and why, including invalid emails/statuses and
 *      status changes. Nothing is written.
 *   2. Confirm → POST /leads/import with the same file — the server rebuilds
 *      and re-validates the plan against the current DB, then imports in the
 *      background (a large sheet outlasts the gateway timeout); this modal
 *      polls GET /leads/import/:jobId for progress.
 */

const POLL_INTERVAL_MS = 1500;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ACTION_BADGE = {
  create: { label: 'Create', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  update: { label: 'Update', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  unchanged: { label: 'No change', className: 'bg-app-bg text-app-text-muted border-app-border' },
  skip: { label: 'Skip', className: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

const FIELD_LABELS = {
  fullName: 'Name',
  altPhone: 'Alt phone',
  service: 'Service',
  city: 'City',
  country: 'Country',
  remark: 'Remark'
};

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'create', label: 'To create', match: (r) => r.action === 'create' },
  { id: 'update', label: 'To update', match: (r) => r.action === 'update' },
  { id: 'status', label: 'Status changes', match: (r) => !!r.statusChange },
  { id: 'skip', label: 'Skipped', match: (r) => r.action === 'skip' },
  { id: 'warnings', label: 'Warnings', match: (r) => r.warnings.length > 0 }
];

// A client deployed ahead of the backend gets old-shaped (or HTML) responses
// back — fail with a clear message instead of crashing the page on render.
const OUTDATED_SERVER_MESSAGE = 'Unexpected response from the server — make sure the backend has been redeployed/restarted with the latest import update.';

const normalizeRow = (r) => ({
  ...r,
  changes: Array.isArray(r?.changes) ? r.changes : [],
  errors: Array.isArray(r?.errors) ? r.errors : [],
  warnings: Array.isArray(r?.warnings) ? r.warnings : []
});

const normalizeResult = (s) => ({
  imported: s?.imported || 0,
  updated: s?.updated || 0,
  unchanged: s?.unchanged || 0,
  invalid: Array.isArray(s?.invalid) ? s.invalid : []
});

const truncate = (value, max = 40) => {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

function StatusChange({ change }) {
  const critical = change.closing || change.reopening;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
      critical ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-primary/10 text-primary border-primary/20'
    }`}>
      Status: {change.from} <ArrowRight size={11} /> {change.to}
      {change.reopening && ' (reopen)'}
    </span>
  );
}

function PreviewRow({ row }) {
  const badge = ACTION_BADGE[row.action];
  return (
    <tr className="border-t border-app-border align-top">
      <td className="px-3 py-2 text-xs text-app-text-muted whitespace-nowrap">{row.row}</td>
      <td className="px-3 py-2 min-w-[140px]">
        <div className="text-sm text-app-text font-medium">{row.fullName || <span className="italic text-app-text-muted">no name</span>}</div>
        <div className="text-xs text-app-text-muted">{row.phone || '—'}</div>
        {row.leadId && <div className="text-[11px] text-primary font-mono">{row.leadId}</div>}
      </td>
      <td className="px-3 py-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border whitespace-nowrap ${badge.className}`}>{badge.label}</span>
      </td>
      <td className="px-3 py-2 space-y-1 min-w-[260px]">
        {row.statusChange && <StatusChange change={row.statusChange} />}
        {row.changes.map((c) => (
          <div key={c.field} className="text-xs text-app-text">
            <span className="text-app-text-muted">{FIELD_LABELS[c.field] || c.field}:</span>{' '}
            {c.from ? <span className="line-through text-app-text-muted">{truncate(c.from)}</span> : <span className="text-app-text-muted italic">empty</span>}
            {' → '}{truncate(c.to)}
          </div>
        ))}
        {row.errors.map((e) => (
          <div key={e} className="text-xs text-red-400 flex gap-1"><X size={12} className="shrink-0 mt-0.5" />{e}</div>
        ))}
        {row.warnings.map((w) => (
          <div key={w} className="text-xs text-amber-400 flex gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" />{w}</div>
        ))}
      </td>
    </tr>
  );
}

export default function ImportLeadsModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState('select'); // select | preview | importing | done
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState(null);
  const [filter, setFilter] = useState('all');
  const [progress, setProgress] = useState(null); // { processed, rowCount }
  const [result, setResult] = useState(null);

  const uploadForm = () => {
    const formData = new FormData();
    formData.append('file', file);
    return formData;
  };

  const handlePreview = async () => {
    if (!file) return;
    try {
      setLoadingPreview(true);
      const res = await api.post('/leads/import/preview', uploadForm(), {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data?.data;
      if (!data?.summary || !Array.isArray(data.rows)) throw new Error(OUTDATED_SERVER_MESSAGE);
      setPreview({ summary: data.summary, rows: data.rows.map(normalizeRow) });
      setFilter(data.summary.criticalStatusChanges > 0 ? 'status' : 'all');
      setStep('preview');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to read the file');
    } finally {
      setLoadingPreview(false);
    }
  };

  const pollJob = async (jobId) => {
    for (;;) {
      await wait(POLL_INTERVAL_MS);
      const res = await api.get(`/leads/import/${jobId}`);
      const job = res.data?.data;
      if (!job?.status) throw new Error(OUTDATED_SERVER_MESSAGE);
      setProgress({ processed: job.processed, rowCount: job.rowCount });
      if (job.status === 'completed') return normalizeResult(job.summary);
      if (job.status === 'failed') throw new Error(job.error || 'Import failed');
    }
  };

  const handleConfirm = async () => {
    try {
      setStep('importing');
      setProgress(null);
      // Same file again — the server re-validates every row against the DB
      // as it is now rather than trusting the preview.
      const res = await api.post('/leads/import', uploadForm(), {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const jobId = res.data?.data?.jobId;
      if (!jobId) throw new Error(OUTDATED_SERVER_MESSAGE);
      const s = await pollJob(jobId);
      setResult(s);
      setStep('done');
      const parts = [];
      if (s.imported > 0) parts.push(`${s.imported} new lead(s) imported`);
      if (s.updated > 0) parts.push(`${s.updated} lead(s) updated`);
      if (parts.length) {
        toast.success(parts.join(', '));
        onImported?.();
      } else {
        toast('No leads were created or updated.', { icon: 'ℹ️' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to import leads');
      setStep('preview');
    }
  };

  const summary = preview?.summary;
  const toWrite = summary ? summary.create + summary.update : 0;
  const visibleRows = preview ? preview.rows.filter(FILTERS.find((f) => f.id === filter).match) : [];
  const busy = step === 'importing';

  const chip = (label, value, className) => (
    <div className={`px-3 py-2 rounded-lg border text-center min-w-[90px] ${className}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`bg-app-card border border-app-border rounded-xl shadow-xl w-full overflow-hidden flex flex-col max-h-[90vh] ${
          step === 'select' ? 'max-w-md' : 'max-w-5xl'
        }`}
      >
        <div className="p-4 border-b border-app-border flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-app-text">
            {step === 'select' && 'Import Leads'}
            {step === 'preview' && `Review Import — ${file?.name}`}
            {step === 'importing' && 'Importing…'}
            {step === 'done' && 'Import Complete'}
          </h2>
          <button onClick={onClose} disabled={busy} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-bg rounded-lg transition-colors disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {step === 'select' && (
            <>
              <p className="text-sm text-app-text-muted">
                Upload an .xlsx or .csv file with <strong className="text-app-text">Full Name</strong> and <strong className="text-app-text">Phone</strong> columns.
                You&apos;ll see a preview of every row — what will be created, updated or skipped, and why — before anything is saved.
              </p>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }}
                className="w-full text-sm text-app-text file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-black file:font-semibold file:cursor-pointer bg-app-bg border border-app-border rounded-lg p-1.5"
              />
            </>
          )}

          {(step === 'preview' || step === 'importing') && summary && (
            <>
              <div className="flex flex-wrap gap-2">
                {chip('Create', summary.create, 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5')}
                {chip('Update', summary.update, 'border-blue-500/20 text-blue-400 bg-blue-500/5')}
                {chip('No change', summary.unchanged, 'border-app-border text-app-text-muted bg-app-bg')}
                {chip('Skipped', summary.skip, 'border-red-500/20 text-red-400 bg-red-500/5')}
                {chip('Warnings', summary.withWarnings, 'border-amber-500/20 text-amber-400 bg-amber-500/5')}
                {chip('Status changes', summary.statusChanges, 'border-primary/20 text-primary bg-primary/5')}
              </div>

              {summary.criticalStatusChanges > 0 && (
                <div className="flex gap-2 items-start p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-sm text-red-400">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>{summary.criticalStatusChanges}</strong> lead(s) will be closed (Won/Lost/Dropped) or reopened by this import. Review them under &ldquo;Status changes&rdquo; before confirming.
                  </span>
                </div>
              )}

              {step === 'importing' ? (
                <div className="space-y-1.5 py-2">
                  <div className="flex justify-between text-xs text-app-text-muted">
                    <span>Re-checking and importing… keep this window open</span>
                    {progress && <span>{progress.processed} / {progress.rowCount} rows</span>}
                  </div>
                  <div className="h-2 bg-app-bg border border-app-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress?.rowCount ? Math.round((progress.processed / progress.rowCount) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {FILTERS.map((f) => {
                      const count = preview.rows.filter(f.match).length;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setFilter(f.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            filter === f.id ? 'bg-primary text-black border-primary' : 'border-app-border text-app-text hover:border-primary/50'
                          }`}
                        >
                          {f.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className="border border-app-border rounded-lg overflow-x-auto">
                    {visibleRows.length === 0 ? (
                      <p className="p-4 text-sm text-app-text-muted text-center">No rows in this view.</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-app-bg text-[11px] uppercase tracking-wider text-app-text-muted">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Row</th>
                            <th className="px-3 py-2 font-semibold">Lead</th>
                            <th className="px-3 py-2 font-semibold">Action</th>
                            <th className="px-3 py-2 font-semibold">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row) => <PreviewRow key={row.row} row={row} />)}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {step === 'done' && result && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                <CheckCircle2 size={16} /> {result.imported} new lead(s) imported
              </div>
              <div className="flex items-center gap-2 text-blue-400 font-semibold">
                <CheckCircle2 size={16} /> {result.updated} existing lead(s) updated
              </div>
              {result.unchanged > 0 && (
                <div className="text-app-text-muted">{result.unchanged} row(s) matched existing leads with nothing to change.</div>
              )}
              {result.invalid.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-amber-500 font-semibold">
                    <AlertTriangle size={16} /> {result.invalid.length} row(s) skipped
                  </div>
                  <ul className="mt-1 max-h-60 overflow-y-auto text-xs text-app-text-muted space-y-0.5">
                    {result.invalid.map((item) => (
                      <li key={item.row}>Row {item.row}: {item.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-app-border flex flex-wrap justify-end gap-3 bg-app-bg/50 shrink-0">
          {step === 'select' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-app-text hover:bg-surface-variant rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={!file || loadingPreview}
                className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-black bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                <Eye size={16} />
                {loadingPreview ? 'Checking rows...' : 'Preview Import'}
              </button>
            </>
          )}

          {(step === 'preview' || step === 'importing') && (
            <>
              <button
                onClick={() => { setStep('select'); setPreview(null); }}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-app-text hover:bg-surface-variant rounded-lg transition-colors disabled:opacity-40"
              >
                <ArrowLeft size={16} /> Choose another file
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy || toWrite === 0}
                title={toWrite === 0 ? 'Nothing to create or update' : undefined}
                className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-black bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                <Upload size={16} />
                {busy ? 'Importing...' : `Confirm Import (${summary.create} create, ${summary.update} update)`}
              </button>
            </>
          )}

          {step === 'done' && (
            <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-black bg-primary hover:bg-primary/90 rounded-lg transition-colors">
              Close
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
