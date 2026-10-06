import { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * Activity master for the work timer/timesheet: the activity types employees
 * pick from, and whether each counts as Productive / Billable by default.
 */
export default function ActivityMasterSettings() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings/activity-master')
      .then((res) => setTypes(res.data.types || []))
      .catch(() => toast.error('Could not load the activity master.'))
      .finally(() => setLoading(false));
  }, []);

  const update = (i, key, value) => setTypes((list) => list.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/admin/settings/activity-master', { types: types.filter((t) => t.name.trim()) });
      setTypes(res.data.types);
      toast.success('Activity master saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the activity master.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-app-card p-6 rounded-xl border border-app-border space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-app-text">Timesheet Activity Master</h2>
          <p className="text-xs text-app-text-muted mt-0.5">Activity types for the work timer. Productive/Billable set each logged session's default classification.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTypes((l) => [...l, { name: '', productive: true, billable: false }])}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-app-border text-sm text-app-text hover:border-primary/40 cursor-pointer"><Plus size={14} /> Add</button>
          <button type="button" onClick={save} disabled={saving || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50 cursor-pointer"><Save size={14} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {loading ? <p className="text-sm text-app-text-muted">Loading…</p> : (
        <div className="divide-y divide-app-border">
          {types.map((t, i) => (
            <div key={i} className="flex flex-wrap items-center gap-4 py-2">
              <input value={t.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Activity name" maxLength={60}
                className="flex-1 min-w-[180px] text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text" />
              <label className="flex items-center gap-2 text-sm text-app-text cursor-pointer"><input type="checkbox" checked={t.productive} onChange={(e) => update(i, 'productive', e.target.checked)} /> Productive</label>
              <label className="flex items-center gap-2 text-sm text-app-text cursor-pointer"><input type="checkbox" checked={t.billable} onChange={(e) => update(i, 'billable', e.target.checked)} /> Billable</label>
              <button type="button" onClick={() => setTypes((l) => l.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-300 cursor-pointer" aria-label="Remove"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
