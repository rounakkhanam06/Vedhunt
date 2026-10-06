import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import employeeApi from '../../services/employeeApi';

const EmployeeForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await employeeApi.post('/employee/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-app-card p-8 shadow-2xl border border-app-border">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3"><Mail size={22} /></div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-app-text">Forgot password?</h2>
          <p className="mt-1.5 text-xs sm:text-sm text-app-text-muted">Enter your work email and we&apos;ll send you a reset link.</p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-app-text">
            If <strong>{email}</strong> belongs to an employee account, a reset link is on its way. It expires in 10 minutes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">{error}</div>}
            <div>
              <label htmlFor="emp-forgot-email" className="block text-sm font-medium text-app-text-muted mb-1">Email</label>
              <input id="emp-forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-3 text-app-text focus:border-primary focus:outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-70 cursor-pointer">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <Link to="/employee/login" className="flex items-center justify-center gap-1.5 text-sm text-app-text-muted hover:text-primary">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default EmployeeForgotPassword;
