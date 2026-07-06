import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import clientService from '../../services/clientService';
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const ClientResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [show, setShow] = useState({ pw: false, cpw: false });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match.');
    }
    setLoading(true);
    try {
      await clientService.resetPassword(token, form.password);
      setDone(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/client/login'), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid or expired reset token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/[0.06] rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Link
          to="/client/login"
          className="inline-flex items-center gap-2 text-[#9CA3AF] hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to login
        </Link>

        <div className="bg-bg-card/80 backdrop-blur-xl border border-border-default rounded-2xl p-8 shadow-2xl">
          {done ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-[#22C55E]" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">Password Reset!</h2>
              <p className="text-[#9CA3AF] text-sm">Redirecting you to login…</p>
            </div>
          ) : (
            <>
              <h2 className="text-white text-xl font-semibold mb-2">Set New Password</h2>
              <p className="text-[#9CA3AF] text-sm mb-6">Choose a strong password for your portal account.</p>

              {error && (
                <div className="p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 mb-5">
                  <p className="text-[#EF4444] text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {[
                  { key: 'password', label: 'New Password', showKey: 'pw' },
                  { key: 'confirmPassword', label: 'Confirm Password', showKey: 'cpw' },
                ].map(({ key, label, showKey }) => (
                  <div key={key}>
                    <label className="block text-[#C4C7C7] text-sm font-medium mb-2">{label}</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                      <input
                        type={show[showKey] ? 'text' : 'password'}
                        required
                        value={form[key]}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-3 bg-bg-surface/50 border border-border-default rounded-xl text-white placeholder-[#4B5563] focus:outline-none focus:border-[#FF5A1F]/60 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShow((p) => ({ ...p, [showKey]: !p[showKey] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#9CA3AF] cursor-pointer"
                      >
                        {show[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF5A1F] to-[#E64A19] text-white font-semibold text-sm hover:from-[#FF7A47] hover:to-[#FF5A1F] disabled:opacity-60 transition-all cursor-pointer"
                >
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientResetPassword;
