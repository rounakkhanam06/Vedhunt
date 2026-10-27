import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ShieldCheck, Flag } from 'lucide-react';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/**
 * Is the client at risk, and why (server/services/clientRisk.js): an invoice overdue more than 7 days,
 * a KPI off target two months running, or a manual flag with its reason. Staff can flag / unflag.
 */
export default function ClientRiskPanel({ clientId, http, base, canEdit }) {
  const [risk, setRisk] = useState(null);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => http.get(`${base}/clients/${clientId}/risk`)
    .then((r) => setRisk(r.data))
    .catch(() => setRisk(null)), [http, base, clientId]);
  useEffect(() => { load(); }, [load]);

  const save = async (flagged) => {
    setSaving(true);
    try {
      const r = await http.put(`${base}/clients/${clientId}/risk-flag`, { flagged, reason });
      toast.success(r.data.message);
      setEditing(false);
      setReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the risk flag');
    } finally {
      setSaving(false);
    }
  };

  if (!risk) return null;
  const flagged = risk.flag?.flagged;
  return (
    <div className={`rounded-xl border p-4 ${risk.atRisk ? 'border-red-500/30 bg-red-500/5' : 'border-outline-variant bg-surface-container-low/40'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {risk.atRisk ? <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" /> : <ShieldCheck size={18} className="text-green-400 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${risk.atRisk ? 'text-red-400' : 'text-on-surface'}`}>{risk.atRisk ? 'Client at risk' : 'Not at risk'}</p>
            {risk.atRisk ? (
              <ul className="mt-1 space-y-0.5 text-xs text-on-surface">
                {risk.reasons.map((r, i) => (
                  <li key={i}>
                    • {r.text}
                    {r.type === 'manual' && r.by && <span className="text-on-surface-variant"> — {r.by}{r.at ? `, ${fmt(r.at)}` : ''}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-on-surface-variant mt-0.5">No invoice overdue more than 7 days, no KPI off target two months running, not flagged.</p>
            )}
          </div>
        </div>
        {canEdit && !editing && (
          flagged ? (
            <button type="button" disabled={saving} onClick={() => save(false)}
              className="text-xs font-semibold text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-lg px-3 py-1.5 cursor-pointer">Remove flag</button>
          ) : (
            <button type="button" onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-400 border border-red-500/30 rounded-lg px-3 py-1.5 hover:bg-red-500/10 cursor-pointer"><Flag size={12} /> Flag at risk</button>
          )
        )}
      </div>
      {editing && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus placeholder="Why is this client at risk?"
            aria-label="Reason" className="flex-1 px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary" />
          <div className="flex gap-2">
            <button type="button" disabled={saving || !reason.trim()} onClick={() => save(true)}
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Flag'}</button>
            <button type="button" onClick={() => { setEditing(false); setReason(''); }} className="px-3 py-2 text-xs text-on-surface-variant cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
