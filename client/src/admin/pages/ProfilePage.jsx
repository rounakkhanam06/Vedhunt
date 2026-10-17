import { useState, useEffect } from 'react';
import { User, Mail, Lock, Shield, Check, Loader2 } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
import { authService } from '../../services/authService';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { admin, updateProfile } = useAdminStore();

  const [formData, setFormData] = useState({
    firstName: admin?.firstName || '',
    lastName: admin?.lastName || '',
    email: admin?.email || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (admin) {
      setFormData({
        firstName: admin.firstName || '',
        lastName: admin.lastName || '',
        email: admin.email || ''
      });
    }
  }, [admin]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.email || !formData.email.includes('@')) {
      toast.error('Please provide a valid email address.');
      return;
    }

    const isUpdatingPassword = Boolean(
      passwordData.currentPassword || passwordData.newPassword || passwordData.confirmPassword
    );

    if (isUpdatingPassword) {
      if (!passwordData.currentPassword) {
        toast.error('Please enter your current password.');
        return;
      }
      if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
        toast.error('New password must be at least 6 characters long.');
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast.error('New password and confirmation do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Update personal details
      const res = await authService.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email
      });

      if (res?.success && res?.admin) {
        updateProfile(res.admin);
      }

      // 2. Change password if requested
      if (isUpdatingPassword) {
        await authService.changePassword({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        });
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        toast.success('Profile and password updated successfully!');
      } else {
        toast.success('Profile updated successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClasses =
    'w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-app-text placeholder:text-app-text-muted/50 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all text-sm';
  const labelClasses =
    'block text-xs font-semibold text-app-text mb-1.5 uppercase tracking-wider';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app-text leading-tight">Profile Settings</h1>
        <p className="text-sm text-app-text-muted mt-1">
          Manage your personal information and security preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-app-card border border-app-border rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">
        {/* Personal Details Section */}
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-[#FF6B00] uppercase tracking-wider mb-4 flex items-center gap-3">
            <span>Personal Details</span>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent" />
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClasses}>First Name</label>
              <input
                type="text"
                placeholder="First name"
                className={inputClasses}
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClasses}>Last Name</label>
              <input
                type="text"
                placeholder="Last name"
                className={inputClasses}
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClasses}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" size={17} />
                <input
                  type="email"
                  placeholder="admin@vedhunt.com"
                  className={`${inputClasses} pl-10`}
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={labelClasses}>Role Level</label>
              <div className="w-full bg-app-bg/70 border border-app-border/80 rounded-xl px-4 py-2.5 text-[#FF6B00] font-semibold text-sm select-none cursor-not-allowed flex items-center h-[42px] gap-2">
                <Shield size={16} className="text-[#FF6B00] shrink-0" />
                <span className="truncate">
                  Role: {admin?.roles?.length > 0 ? admin.roles.map((r) => r.name).join(', ') : 'No Role Assigned'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-[#FF6B00] uppercase tracking-wider mb-4 flex items-center gap-3">
            <span>Security</span>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent" />
          </h2>

          <div className="space-y-4">
            <div>
              <label className={labelClasses}>Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" size={17} />
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`${inputClasses} pl-10`}
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClasses}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" size={17} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`${inputClasses} pl-10`}
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelClasses}>Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" size={17} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`${inputClasses} pl-10`}
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 flex items-center justify-end border-t border-app-border/40">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF6B00]/90 disabled:opacity-60 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer active:scale-98"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
