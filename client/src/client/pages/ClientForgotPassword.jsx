import { useState } from 'react';
import { Link } from 'react-router-dom';
import clientService from '../../services/clientService';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const ClientForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await clientService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
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
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-[#22C55E]" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">Check your email</h2>
              <p className="text-[#9CA3AF] text-sm">
                If <span className="text-white">{email}</span> is registered, a reset link has been sent.
              </p>
              <Link
                to="/client/login"
                className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-white text-xl font-semibold mb-2">Forgot your password?</h2>
              <p className="text-[#9CA3AF] text-sm mb-6">
                Enter your registered email and we'll send a reset link.
              </p>

              {error && (
                <div className="p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 mb-5">
                  <p className="text-[#EF4444] text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[#C4C7C7] text-sm font-medium mb-2">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-10 pr-4 py-3 bg-bg-surface/50 border border-border-default rounded-xl text-white placeholder-[#4B5563] focus:outline-none focus:border-[#FF5A1F]/60 transition-all text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF5A1F] to-[#E64A19] text-white font-semibold text-sm hover:from-[#FF7A47] hover:to-[#FF5A1F] disabled:opacity-60 transition-all cursor-pointer"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientForgotPassword;
