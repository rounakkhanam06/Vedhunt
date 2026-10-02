import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { User, Lock, Eye, EyeOff, Save } from 'lucide-react';
import clientService from '../../services/clientService';
import { useClientStore } from '../../store/useClientStore';

const inputCls =
  'w-full px-4 py-2.5 bg-bg-surface/50 border border-border-default rounded-xl text-white placeholder-[#4B5563] focus:outline-none focus:border-[#FF5A1F]/60 transition-all text-sm';
const readOnlyCls =
  'w-full px-4 py-2.5 bg-bg-surface/20 border border-border-default rounded-xl text-[#9CA3AF] text-sm cursor-not-allowed';
const labelCls = 'block text-[#E5E7EB] text-sm font-medium mb-1.5';

const AccountTab = () => {
  const { client, updateClient } = useClientStore();

  const [profile, setProfile] = useState({ contactName: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    setProfile({ contactName: client?.contactName || '', phone: client?.phone || '' });
  }, [client?.contactName, client?.phone]);

  const profileDirty =
    profile.contactName.trim() !== (client?.contactName || '') ||
    profile.phone.trim() !== (client?.phone || '');

  const handleProfileSave = async (e) => {
    e.preventDefault();
    const contactName = profile.contactName.trim();
    if (contactName.length < 2 || !/^[A-Za-z\s]+$/.test(contactName)) {
      return toast.error('Contact name must be at least 2 letters (no numbers or special characters).');
    }
    setSavingProfile(true);
    try {
      const res = await clientService.updateProfile({ contactName, phone: profile.phone.trim() });
      if (res.client) updateClient({ contactName: res.client.contactName, phone: res.client.phone });
      toast.success(res.message || 'Profile updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (pw.next.length < 6) return toast.error('New password must be at least 6 characters long.');
    if (pw.next !== pw.confirm) return toast.error('New passwords do not match.');
    setSavingPw(true);
    try {
      const res = await clientService.changePassword(pw.current, pw.next);
      // The server rotated the session — keep this device signed in
      if (res.token) localStorage.setItem('clientToken', res.token);
      setPw({ current: '', next: '', confirm: '' });
      toast.success(res.message || 'Password changed');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const pwType = showPw ? 'text' : 'password';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold">My Account</h2>
        <p className="text-[#D1D5DB] text-sm mt-1">Manage your contact details and password</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <form onSubmit={handleProfileSave} className="bg-bg-card border border-border-default rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User size={16} className="text-primary" />
            <h3 className="text-white font-semibold">Profile</h3>
          </div>

          <div>
            <label className={labelCls}>Business Name</label>
            <input type="text" value={client?.businessName || ''} readOnly className={readOnlyCls} />
          </div>
          <div>
            <label className={labelCls}>Email (login)</label>
            <input type="email" value={client?.email || ''} readOnly className={readOnlyCls} />
            <p className="text-[#6B7280] text-xs mt-1">To change your business name or email, please raise a support ticket.</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="acc-contact">Contact Name</label>
            <input
              id="acc-contact"
              type="text"
              maxLength={50}
              value={profile.contactName}
              onChange={(e) => setProfile((p) => ({ ...p, contactName: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="acc-phone">Phone</label>
            <input
              id="acc-phone"
              type="tel"
              maxLength={16}
              placeholder="e.g. 9876543210"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              className={inputCls}
            />
          </div>
          {client?.clientId && <p className="text-[#6B7280] text-xs">Client ID: <span className="font-mono">{client.clientId}</span></p>}

          <button
            type="submit"
            disabled={savingProfile || !profileDirty}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Save size={14} /> {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </form>

        {/* Password */}
        <form onSubmit={handlePasswordSave} className="bg-bg-card border border-border-default rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-primary" />
              <h3 className="text-white font-semibold">Change Password</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="text-[#9CA3AF] hover:text-white cursor-pointer"
              aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div>
            <label className={labelCls} htmlFor="acc-pw-current">Current Password</label>
            <input id="acc-pw-current" type={pwType} required autoComplete="current-password" value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="acc-pw-new">New Password</label>
            <input id="acc-pw-new" type={pwType} required minLength={6} autoComplete="new-password" value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="acc-pw-confirm">Confirm New Password</label>
            <input id="acc-pw-confirm" type={pwType} required minLength={6} autoComplete="new-password" value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} className={inputCls} />
          </div>
          <p className="text-[#6B7280] text-xs">At least 6 characters. Other devices will be signed out.</p>

          <button
            type="submit"
            disabled={savingPw || !pw.current || !pw.next || !pw.confirm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Lock size={14} /> {savingPw ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccountTab;
