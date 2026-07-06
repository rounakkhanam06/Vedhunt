import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clientService from '../../services/clientService';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../../assets/DarkthemeLogo.png';

const ClientTempPasswordReset = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [show, setShow] = useState({ pw: false, cpw: false });
  const [loading, setLoading] = useState(false);
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
      await clientService.resetTempPassword(form.password);
      toast.success('Password updated successfully!');
      navigate('/client/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Animated Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-primary/[0.15] rounded-full blur-[100px] mix-blend-screen animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] bg-[#E64A19]/[0.12] rounded-full blur-[100px] mix-blend-screen animate-pulse pointer-events-none" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,transparent_0%,#0A0A0B_100%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 flex flex-col animate-fade-in-up">
        {/* Header Section */}
        <div className="text-center mb-4 md:mb-6">
          <img src={logo} alt="Vedhunt Logo" className="mx-auto h-16 md:h-20 mb-1 object-contain" />
          
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-[#FF5A1F]/50"></div>
            <span className="text-primary text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase">Security Update</span>
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-[#FF5A1F]/50"></div>
          </div>
          <p className="text-[#8B92A5] text-xs md:text-sm max-w-[280px] mx-auto text-balance">
            Please update your temporary password to continue accessing the portal.
          </p>
        </div>

        {/* Form Card */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-[#FF5A1F]/30 to-transparent rounded-[24px] blur opacity-0 group-hover:opacity-100 transition duration-1000"></div>
          
          <div className="relative bg-bg-card/80 backdrop-blur-2xl border border-border-default rounded-[24px] p-5 sm:p-6 shadow-2xl">
            <h2 className="text-white text-lg md:text-xl font-semibold mb-6">Set New Password</h2>

            {error && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-5 animate-shake">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-200 text-xs md:text-sm leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { key: 'password', label: 'New Password', showKey: 'pw' },
                { key: 'confirmPassword', label: 'Confirm Password', showKey: 'cpw' },
              ].map(({ key, label, showKey }) => (
                <div key={key} className="space-y-1.5">
                  <label className="block text-[#A1A1AA] text-[10px] md:text-xs font-semibold uppercase tracking-wider">
                    {label}
                  </label>
                  <div className="relative group/input">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#52525B] group-focus-within/input:text-primary transition-colors" />
                    <input
                      type={show[showKey] ? 'text' : 'password'}
                      required
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-12 py-2.5 md:py-3 bg-bg-primary/40 border border-border-default rounded-xl text-white placeholder-[#52525B] focus:outline-none focus:border-[#FF5A1F]/50 focus:bg-primary/[0.02] focus:ring-4 focus:ring-[#FF5A1F]/10 transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((p) => ({ ...p, [showKey]: !p[showKey] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#52525B] hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                    >
                      {show[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group/btn overflow-hidden mt-6 py-3 rounded-xl bg-gradient-to-r from-[#FF5A1F] to-[#E64A19] text-white font-bold text-sm md:text-base disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-[0_8px_20px_-8px_rgba(255,90,31,0.6)] hover:shadow-[0_12px_24px_-8px_rgba(255,90,31,0.8)] hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientTempPasswordReset;
