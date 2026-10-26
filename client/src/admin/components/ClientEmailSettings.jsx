import { useEffect, useState } from 'react';
import { Bell, Mail, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * Which client notifications are also emailed. Every event always appears in
 * the client's bell in the portal; switching one on here additionally emails it.
 */
export default function ClientEmailSettings() {
  const [events, setEvents] = useState([]);
  const [policy, setPolicy] = useState({});
  const [saved, setSaved] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api.get('/admin/settings/client-email-notifications')
      .then((res) => { if (live) { setEvents(res.data.events); setPolicy(res.data.policy); setSaved(res.data.policy); } })
      .catch(() => toast.error('Could not load the client email settings.'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const dirty = events.some((e) => policy[e.key] !== saved[e.key]);
  const emailCount = events.filter((e) => policy[e.key]).length;

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/admin/settings/client-email-notifications', { policy });
      setPolicy(res.data.policy);
      setSaved(res.data.policy);
      toast.success('Client email settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the client email settings.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-app-text">Client email notifications</h2>
          <p className="text-xs text-app-text-muted mt-1 max-w-xl">
            Clients always see every update in the bell inside their portal. Choose which of them are <strong>also emailed</strong>.
            Account emails (welcome and password reset) are not affected.
          </p>
        </div>
        <button
          type="button" onClick={save} disabled={saving || loading || !dirty}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-app-text-muted">Loading…</p>
      ) : (
        <>
          <p className="text-xs text-app-text-muted">{emailCount} of {events.length} events send an email.</p>
          <ul className="divide-y divide-app-border rounded-xl border border-app-border overflow-hidden">
            {events.map((e) => (
              <li key={e.key} className="flex items-center gap-4 px-4 py-3 bg-app-card">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-app-text">{e.label}</p>
                  <p className="text-xs text-app-text-muted mt-0.5">{e.hint}</p>
                </div>
                <span className="hidden sm:flex items-center gap-1 text-[11px] text-app-text-muted" title="Always shown in the client's bell">
                  <Bell size={12} /> always
                </span>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <Mail size={13} className={policy[e.key] ? 'text-primary' : 'text-app-text-muted'} aria-hidden="true" />
                  <input
                    type="checkbox" role="switch" checked={!!policy[e.key]}
                    onChange={(ev) => setPolicy((p) => ({ ...p, [e.key]: ev.target.checked }))}
                    aria-label={`Email: ${e.label}`}
                    className="w-4 h-4 accent-[#FF5A1F] cursor-pointer"
                  />
                  <span className="text-xs w-6 text-app-text-muted">{policy[e.key] ? 'On' : 'Off'}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
