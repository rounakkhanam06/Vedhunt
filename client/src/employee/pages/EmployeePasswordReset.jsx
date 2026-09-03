import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const EmployeePasswordReset = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { resetTempPassword } = useEmployeeStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetTempPassword(newPassword);
      if (res.success) {
        toast.success('Password updated successfully!');
        navigate('/employee/dashboard');
      } else {
        toast.error(res.message || 'Failed to reset password.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-app-card p-8 shadow-2xl border border-app-border">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Lock size={32} />
          </div>
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-app-text">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-app-text-muted">
            You are logged in with a temporary password. Please set a secure password to access your dashboard.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text-muted mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full rounded-md border border-form-input-border bg-form-input-bg px-4 py-3 text-app-text placeholder:text-app-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm pr-10"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-app-text-muted hover:text-app-text cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-muted mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full rounded-md border border-form-input-border bg-form-input-bg px-4 py-3 text-app-text placeholder:text-app-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm pr-10"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-app-text-muted hover:text-app-text cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70 transition-colors duration-200 cursor-pointer"
            >
              {isLoading ? 'Updating password...' : 'Update & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeePasswordReset;
