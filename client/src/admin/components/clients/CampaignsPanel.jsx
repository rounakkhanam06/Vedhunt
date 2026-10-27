import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Megaphone } from 'lucide-react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const STATUS_CLS = {
  Active: 'text-green-400 border-green-500/30 bg-green-500/10',
  Paused: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  Ended: 'text-on-surface-variant border-outline-variant bg-surface-container-low',
  '': 'text-orange-400 border-orange-500/40 bg-orange-500/10',
};
const inputCls = 'px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';

/**
 * The client's campaigns and the status the team gives each one (server/services/campaigns.js).
 * "Campaigns live" on the Financial Overview counts the ones marked Active. Campaigns named in the
 * daily ad data appear here on their own, with no status ("Needs status") until someone sets it.
 */
export default function CampaignsPanel({ clientId, http, base, canEdit }) {
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ platform: 'Meta', name: '', status: 'Active' });

  const load = useCallback(() => http.get(`${base}/clients/${clientId}/campaigns`)
    .then((r) => setData(r.data))
    .catch(() => setData({ data: [], statuses: [], platforms: [] })), [http, base, clientId]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (c, status) => {
    try {
      await http.put(`${base}/clients/${clientId}/campaigns/${c._id}`, { status });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change the status');
    }
  };

  const add = async (e) => {
    e.preventDefault();
    try {
      await http.post(`${base}/clients/${clientId}/campaigns`, form);
      toast.success('Campaign added');
      setAdding(false);
      setForm({ platform: 'Meta', name: '', status: 'Active' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add the campaign');
    }
  };

  if (!data) return null;
  const list = data.data || [];
  const needsStatus = list.filter((c) => !c.status).length;
  return (
    <div className="rounded-xl border border-outline-variant p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-on-surface font-semibold text-sm flex items-center gap-2"><Megaphone size={15} className="text-secondary" /> Campaigns</h4>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Status set by the team; Active campaigns count as live.
            {needsStatus > 0 && <span className="text-orange-400 font-semibold"> {needsStatus} need{needsStatus === 1 ? 's' : ''} a status.</span>}
          </p>
        </div>
        {canEdit && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-semibold text-secondary cursor-pointer"><Plus size={13} /> Add campaign</button>
        )}
      </div>

      {adding && (
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <select aria-label="Platform" className={inputCls} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            {(data.platforms || []).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input aria-label="Campaign name" className={`${inputCls} flex-1 min-w-[10rem]`} placeholder="Campaign name" maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select aria-label="Status" className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {(data.statuses || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="submit" className="px-3 py-2 rounded-lg bg-secondary text-white text-xs font-bold cursor-pointer">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 text-xs text-on-surface-variant cursor-pointer">Cancel</button>
        </form>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No campaigns yet. They appear here when ad data is entered, or add one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[560px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
                <th className="py-2 pr-3">Platform</th><th className="py-2 pr-3">Campaign</th><th className="py-2 pr-3 text-right">Spend</th>
                <th className="py-2 pr-3">Last ad data</th><th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {list.map((c) => (
                <tr key={c._id}>
                  <td className="py-2 pr-3 text-on-surface-variant">{c.platform}</td>
                  <td className="py-2 pr-3 text-on-surface">{c.name}{c.source === 'ad-data' && <span className="ml-1.5 text-[10px] text-on-surface-variant">(from ad data)</span>}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-on-surface">{inr(c.spend)}</td>
                  <td className="py-2 pr-3 text-on-surface-variant text-xs">{c.lastDay || '—'}</td>
                  <td className="py-2">
                    {canEdit ? (
                      <select aria-label={`Status of ${c.name}`} value={c.status || ''} onChange={(e) => setStatus(c, e.target.value || null)}
                        className={`px-2 py-1 rounded-lg border text-xs font-semibold cursor-pointer bg-transparent ${STATUS_CLS[c.status || '']}`}>
                        {!c.status && <option value="">Needs status</option>}
                        {(data.statuses || []).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${STATUS_CLS[c.status || '']}`}>{c.status || 'Needs status'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
