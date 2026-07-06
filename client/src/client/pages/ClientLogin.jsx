import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useClientStore } from '../../store/useClientStore';
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../../assets/DarkthemeLogo.png';

const ClientLogin = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useClientStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/client/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      if (data.mustResetPassword) {
        toast('Please set a new password to continue.', { icon: '🔐' });
        navigate('/client/reset-temp-password');
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid email or password';
      setError(msg);
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
          <img src={logo} alt="Vedhunt Logo" className="mx-auto h-24 md:h-28 mb-1 object-contain" />
          
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-[#FF5A1F]/50"></div>
            <span className="text-primary text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase">Client Portal</span>
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-[#FF5A1F]/50"></div>
          </div>
          <p className="text-[#8B92A5] text-xs md:text-sm max-w-[280px] mx-auto text-balance">
            Sign in to track your projects, invoices, and support tickets securely.
          </p>
        </div>

        {/* Login Card */}
        <div className="relative group">
          {/* Subtle Glow Border on Hover */}
          <div className="absolute -inset-0.5 bg-gradient-to-b from-[#FF5A1F]/30 to-transparent rounded-[24px] blur opacity-0 group-hover:opacity-100 transition duration-1000"></div>
          
          <div className="relative bg-bg-card/80 backdrop-blur-2xl border border-border-default rounded-[24px] p-5 sm:p-6 shadow-2xl">
            <h2 className="text-white text-lg md:text-xl font-semibold mb-6">Welcome back</h2>

            {error && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-5 animate-shake">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-200 text-xs md:text-sm leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="client-email" className="block text-[#A1A1AA] text-[10px] md:text-xs font-semibold uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative group/input">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#52525B] group-focus-within/input:text-primary transition-colors" />
                  <input
                    id="client-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-2.5 md:py-3 bg-bg-primary/40 border border-border-default rounded-xl text-white placeholder-[#52525B] focus:outline-none focus:border-[#FF5A1F]/50 focus:bg-primary/[0.02] focus:ring-4 focus:ring-[#FF5A1F]/10 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="client-password" className="block text-[#A1A1AA] text-[10px] md:text-xs font-semibold uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    to="/client/forgot-password"
                    className="text-[10px] md:text-xs font-medium text-primary hover:text-[#FF8A66] transition-colors hover:underline underline-offset-4"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative group/input">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#52525B] group-focus-within/input:text-primary transition-colors" />
                  <input
                    id="client-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-2.5 md:py-3 bg-bg-primary/40 border border-border-default rounded-xl text-white placeholder-[#52525B] focus:outline-none focus:border-[#FF5A1F]/50 focus:bg-primary/[0.02] focus:ring-4 focus:ring-[#FF5A1F]/10 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#52525B] hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                id="client-login-submit"
                className="w-full relative group/btn overflow-hidden mt-6 py-3 rounded-xl bg-gradient-to-r from-[#FF5A1F] to-[#E64A19] text-white font-bold text-sm md:text-base disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-[0_8px_20px_-8px_rgba(255,90,31,0.6)] hover:shadow-[0_12px_24px_-8px_rgba(255,90,31,0.8)] hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In to Portal
                      <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[#52525B] text-[10px] md:text-xs mt-6 font-medium">
          Having trouble? Contact support at{' '}
          <a href="mailto:support@vedhunt.in" className="text-primary hover:text-[#FFA07A] transition-colors hover:underline underline-offset-4">
            support@vedhunt.in
          </a>
        </p>
      </div>
      
      {/* Global CSS for Animations */}
      <style>{`
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default ClientLogin;
