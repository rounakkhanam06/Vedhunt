import { useState } from 'react';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff } from 'lucide-react';
import employeeApi from '../../services/employeeApi';

// A password input with its own show/hide toggle inside the field
const PasswordField = ({ id, label, value, onChange, autoComplete, minLength, hint, error }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-app-text-muted mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          className={`w-full text-sm rounded-lg border bg-form-input-bg pl-4 pr-10 py-2.5 text-app-text focus:outline-none focus:ring-1 transition-colors ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-app-border focus:border-primary focus:ring-primary'
          }`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-app-text-muted hover:text-app-text cursor-pointer"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {(error || hint) && (
        <p className={`mt-1 text-[11px] ${error ? 'text-red-500' : 'text-app-text-muted'}`}>{error || hint}</p>
      )}
    </div>
  );
};

const ChangePasswordCard = () => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
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

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const tooShort = form.next.length > 0 && form.next.length < 6;
  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;

  return (
    <form onSubmit={submit} className="lg:col-span-3 bg-app-card p-6 rounded-xl border border-app-border space-y-5">
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2"><Lock size={15} className="text-primary" /> Change Password</h3>
        <p className="text-xs text-app-text-muted mt-1">Your new password must be at least 6 characters.</p>
      </div>
      <div className="space-y-4">
        <PasswordField id="emp-pw-current" label="Current password" autoComplete="current-password"
          value={form.current} onChange={set('current')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PasswordField id="emp-pw-new" label="New password" autoComplete="new-password" minLength={6}
            value={form.next} onChange={set('next')} error={tooShort ? 'At least 6 characters' : ''} />
          <PasswordField id="emp-pw-confirm" label="Confirm new password" autoComplete="new-password" minLength={6}
            value={form.confirm} onChange={set('confirm')} error={mismatch ? 'Passwords do not match' : ''} />
        </div>
      </div>
      <button type="submit" disabled={saving || !form.current || !form.next || !form.confirm || tooShort || mismatch}
        className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
        {saving ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  );
};

export default ChangePasswordCard;
