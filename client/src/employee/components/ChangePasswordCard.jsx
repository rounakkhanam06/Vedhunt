import { useState } from 'react';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff } from 'lucide-react';
import employeeApi from '../../services/employeeApi';

const ChangePasswordCard = () => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 6) return toast.error('New password must be at least 6 characters long.');
    if (form.next !== form.confirm) return toast.error('New passwords do not match.');
    setSaving(true);
    try {
      const res = await employeeApi.put('/employee/auth/password', { currentPassword: form.current, newPassword: form.next });
      toast.success(res.data.message || 'Password changed.');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';
  const input = 'w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text focus:border-primary focus:outline-none';
  return (
    <form onSubmit={submit} className="lg:col-span-3 bg-app-card p-6 rounded-xl border border-app-border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2"><Lock size={15} className="text-primary" /> Change Password</h3>
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide passwords' : 'Show passwords'} className="text-app-text-muted hover:text-app-text cursor-pointer">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="emp-pw-current" className="block text-xs text-app-text-muted mb-1">Current password</label>
          <input id="emp-pw-current" type={type} required autoComplete="current-password" value={form.current} onChange={(e) => setForm((p) => ({ ...p, current: e.target.value }))} className={input} />
        </div>
        <div>
          <label htmlFor="emp-pw-new" className="block text-xs text-app-text-muted mb-1">New password</label>
          <input id="emp-pw-new" type={type} required minLength={6} autoComplete="new-password" value={form.next} onChange={(e) => setForm((p) => ({ ...p, next: e.target.value }))} className={input} />
        </div>
        <div>
          <label htmlFor="emp-pw-confirm" className="block text-xs text-app-text-muted mb-1">Confirm new password</label>
          <input id="emp-pw-confirm" type={type} required minLength={6} autoComplete="new-password" value={form.confirm} onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))} className={input} />
        </div>
      </div>
      <button type="submit" disabled={saving || !form.current || !form.next || !form.confirm}
        className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer">
        {saving ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  );
};

export default ChangePasswordCard;
