import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Layers, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const inputCls = 'w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text focus:outline-none focus:border-primary';

/**
 * Settings → Services: the one service list used by client profiles (services taken) and invoice
 * lines (Financial Overview → revenue by service). server/services/serviceCatalog.js.
 * Removing a name does not change clients or invoices that already use it.
 */
export default function ServiceListSettings() {
  const queryClient = useQueryClient();
  const [list, setList] = useState(null);
  const [saved, setSaved] = useState([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api.get('/admin/service-catalog')
      .then((r) => { if (live) { setList(r.data.services); setSaved(r.data.services); } })
      .catch(() => toast.error('Could not load the service list'));
    return () => { live = false; };
  }, []);

  if (!list) return <p className="text-sm text-app-text-muted">Loading…</p>;
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);

  const add = (e) => {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (list.some((s) => s.toLowerCase() === n.toLowerCase())) { toast.error(`"${n}" is already in the list`); return; }
    if (n.toLowerCase() === 'unassigned') { toast.error('"Unassigned" is used for invoice lines without a service'); return; }
    // New names go before "Other" when it is last
    const at = list[list.length - 1] === 'Other' ? list.length - 1 : list.length;
    setList([...list.slice(0, at), n, ...list.slice(at)]);
    setName('');
  };
  const move = (i, d) => setList((l) => { const n = [...l]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put('/admin/service-catalog', { services: list });
      setList(r.data.services);
      setSaved(r.data.services);
      queryClient.invalidateQueries({ queryKey: ['service-catalog'] });
      toast.success(r.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the service list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <section className="rounded-xl border border-app-border bg-app-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-app-text flex items-center gap-2"><Layers size={16} className="text-primary" /> Services</h3>
            <p className="text-xs text-app-text-muted mt-1 max-w-xl">
              One list for client profiles and invoice lines. The Financial Overview splits revenue by the service on each invoice line;
              lines without one show as <strong>Unassigned</strong> until they are mapped. Removing a name here does not change clients or invoices that already use it.
            </p>
          </div>
          <button type="button" onClick={save} disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <ul className="divide-y divide-app-border rounded-lg border border-app-border">
          {list.map((s, i) => (
            <li key={s} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 text-sm text-app-text">{s}</span>
              <button type="button" aria-label={`Move ${s} up`} disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-app-text-muted hover:text-app-text disabled:opacity-30 cursor-pointer"><ArrowUp size={14} /></button>
              <button type="button" aria-label={`Move ${s} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)} className="p-1 text-app-text-muted hover:text-app-text disabled:opacity-30 cursor-pointer"><ArrowDown size={14} /></button>
              <button type="button" aria-label={`Remove ${s}`} disabled={list.length === 1} onClick={() => setList(list.filter((x) => x !== s))} className="p-1 text-rose-400 hover:text-rose-300 disabled:opacity-30 cursor-pointer"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex gap-2">
          <input className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Add a service, e.g. SEO" aria-label="New service" />
          <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-app-border text-sm text-app-text hover:border-primary cursor-pointer whitespace-nowrap"><Plus size={14} /> Add</button>
        </form>
      </section>
    </div>
  );
}
