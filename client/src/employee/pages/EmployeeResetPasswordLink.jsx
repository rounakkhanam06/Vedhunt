import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import employeeApi from '../../services/employeeApi';

// Opened from the emailed reset link: /employee/reset-password/:token
const EmployeeResetPasswordLink = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters long.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const res = await employeeApi.put(`/employee/auth/reset-password/${token}`, { password });
      toast.success(res.data.message || 'Password reset.');
      navigate('/employee/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset the password.');
    } finally {
      setLoading(false);
    }
  };

  const input = 'w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-3 text-app-text focus:border-primary focus:outline-none';
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-app-card p-8 shadow-2xl border border-app-border">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3"><Lock size={22} /></div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-app-text">Set a new password</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">{error}</div>}
          <div>
            <label htmlFor="emp-reset-new" className="block text-sm font-medium text-app-text-muted mb-1">New password</label>
            <input id="emp-reset-new" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="emp-reset-confirm" className="block text-sm font-medium text-app-text-muted mb-1">Confirm new password</label>
            <input id="emp-reset-confirm" type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-70 cursor-pointer">
            {loading ? 'Saving…' : 'Reset password'}
          </button>
        </form>
        <Link to="/employee/forgot-password" className="block text-center text-sm text-app-text-muted hover:text-primary">Link expired? Request a new one</Link>
      </div>
    </div>
  );
};

export default EmployeeResetPasswordLink;
