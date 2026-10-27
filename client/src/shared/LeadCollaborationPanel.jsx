import { useState, useEffect, useCallback } from 'react';
import { Lock, Pencil, Trash2, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

const sectionClass = 'bg-app-card border border-app-border rounded-xl p-4 sm:p-5 w-full min-w-0 overflow-hidden';
const labelClass = 'text-xs text-primary font-bold uppercase tracking-wider mb-3 block';

const fmt = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Cross-assignment + notes for one lead, used by the Admin panel and the
 * Employee Portal lead workspaces. The server decides who sees what
 * (services/leadCollaboration.js); this only shows it.
 *
 * @param http        axios instance for the portal in use
 * @param leadUrl     the lead's API path (…/leads/:id); notes and shares hang off it
 * @param lead        current lead (assignedTo, sharedWith)
 * @param canShare    show share/unshare controls (leads.assign)
 * @param bds         people the lead can be shared with
 * @param onChanged   called after a share change, to reload the lead
 */
export default function LeadCollaborationPanel({ http, leadUrl, lead, canShare = false, bds = [], onChanged }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareTo, setShareTo] = useState('');
  const [editing, setEditing] = useState(null); // { id, text } while a super admin edits a note

  const ownerId = String(lead.assignedTo?._id || lead.assignedTo || '');
  const sharedWith = lead.sharedWith || [];
  const shareable = bds.filter((bd) => String(bd._id) !== ownerId && !sharedWith.some((s) => String(s.admin?._id) === String(bd._id)));

  const loadNotes = useCallback(async () => {
    try {
      const res = await http.get(`${leadUrl}/notes`);
      setNotes(res.data?.notes || res.data?.data || []);
    } catch {
      setNotes([]);
    }
  }, [http, leadUrl]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const addNote = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await http.post(`${leadUrl}/notes`, { text, visibility: isPrivate ? 'private' : 'shared' });
      setText('');
      setIsPrivate(false);
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the note');
    } finally {
      setSaving(false);
    }
  };

  // Super admin only — the server refuses anyone else (n.canManage comes from it)
  const saveEdit = async () => {
    if (!editing?.text.trim()) return;
    setSaving(true);
    try {
      await http.put(`${leadUrl}/notes/${editing.id}`, { text: editing.text });
      toast.success('Note updated');
      setEditing(null);
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the note');
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (id) => {
    if (!window.confirm('Delete this note? It is removed from the lead (kept in the audit log).')) return;
    try {
      // POST fallback: some firewalls block DELETE
      await http.post(`${leadUrl}/notes/${id}/remove`);
      toast.success('Note deleted');
      if (editing?.id === id) setEditing(null);
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete the note');
    }
  };

  const share = async () => {
    if (!shareTo) return;
    try {
      await http.post(`${leadUrl}/share`, { adminId: shareTo });
      toast.success('Lead shared');
      setShareTo('');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not share the lead');
    }
  };

  const unshare = async (adminId, name) => {
    if (!window.confirm(`Remove ${name}'s access to this lead?`)) return;
    try {
      // POST fallback: some firewalls block DELETE
      await http.post(`${leadUrl}/share/${adminId}/remove`);
      toast.success('Access removed');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove access');
    }
  };

  return (
    <>
      {(canShare || sharedWith.length > 0) && (
        <div className={sectionClass}>
          <label className={labelClass}>Also working this lead</label>
          {sharedWith.length === 0 ? (
            <p className="text-sm text-app-text-muted">Only the owner. Share it to let another BD work it too; the owner stays the same.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sharedWith.map((s) => (
                <span key={s.admin._id} title={`Shared ${fmt(s.grantedAt)}${s.grantedBy ? ` by ${s.grantedBy.name}` : ''}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Users size={12} /> {s.admin.name}
                  {canShare && (
                    <button type="button" onClick={() => unshare(s.admin._id, s.admin.name)} className="hover:text-red-400 cursor-pointer" aria-label={`Remove ${s.admin.name}`}>
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {canShare && ownerId && shareable.length > 0 && (
            <div className="flex gap-2 mt-3">
              <select value={shareTo} onChange={(e) => setShareTo(e.target.value)}
                className="flex-1 min-w-0 bg-app-bg border border-app-border text-sm px-3 py-1.5 rounded-lg text-app-text focus:outline-none focus:border-primary cursor-pointer">
                <option className="bg-app-bg text-app-text" value="">Share with…</option>
                {shareable.map((bd) => (
                  <option key={bd._id} className="bg-app-bg text-app-text" value={bd._id}>{bd.firstName} {bd.lastName}</option>
                ))}
              </select>
              <button type="button" onClick={share} disabled={!shareTo}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg disabled:opacity-50 cursor-pointer">
                Share
              </button>
            </div>
          )}
        </div>
      )}

      <div className={sectionClass}>
        <label className={labelClass}>Notes</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={5000}
          placeholder="Add a note…"
          className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary" />
        <div className="flex items-center justify-between gap-3 mt-2">
          <label className="inline-flex items-center gap-2 text-xs text-app-text-muted cursor-pointer">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-primary" />
            Private (only you and admins)
          </label>
          <button type="button" onClick={addNote} disabled={saving || !text.trim()}
            className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg disabled:opacity-50 cursor-pointer">
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-80 overflow-y-auto overscroll-contain">
          {notes.length === 0 && !lead.remark && <p className="text-sm text-app-text-muted">No notes yet.</p>}
          {notes.map((n) => (
            <div key={n._id} className="border-l-2 border-app-border pl-3">
              {editing?.id === n._id ? (
                <div className="space-y-2">
                  <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={3} maxLength={5000} autoFocus
                    className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary" />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} disabled={saving || !editing.text.trim()}
                      className="px-3 py-1 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" onClick={() => setEditing(null)} className="px-3 py-1 text-xs text-app-text-muted hover:text-app-text cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-app-text whitespace-pre-wrap break-words">{n.text}</p>
              )}
              <p className="text-[11px] text-app-text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                {n.visibility === 'private' && <span className="inline-flex items-center gap-1 text-amber-400"><Lock size={10} /> Private ·</span>}
                {n.author?.name || 'Unknown'} · {fmt(n.createdAt)}{n.editedAt && <span title={`Edited ${fmt(n.editedAt)}`}> · edited</span>}
                {n.canManage && editing?.id !== n._id && (
                  <>
                    <button type="button" onClick={() => setEditing({ id: n._id, text: n.text })} className="ml-1 hover:text-primary cursor-pointer" aria-label="Edit note" title="Edit note"><Pencil size={12} /></button>
                    <button type="button" onClick={() => removeNote(n._id)} className="hover:text-red-400 cursor-pointer" aria-label="Delete note" title="Delete note"><Trash2 size={12} /></button>
                  </>
                )}
              </p>
            </div>
          ))}
          {/* Text saved in the old Remark box, from before Notes replaced it — kept as it was, read-only */}
          {lead.remark && (
            <div className="border-l-2 border-dashed border-app-border pl-3 opacity-90">
              <p className="text-sm text-app-text whitespace-pre-wrap break-words">{lead.remark}</p>
              <p className="text-[11px] text-app-text-muted mt-1">Earlier remark · read-only</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
