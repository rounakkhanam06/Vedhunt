import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';
import { Lock, Mail } from 'lucide-react';
import lightLogo from '../../assets/logo_Square.jpg__1_-removebg-preview.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, isAuthenticated } = useAdminStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/admin/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
      // navigation handled by useEffect
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-offWhite px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-admin-white p-8 shadow-lg border border-admin-border">
        <div className="flex flex-col items-center">
          <img src={lightLogo} alt="Vedhunt Logo" className="h-16 w-auto mb-4" />
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-admin-textDark">
            Vedhunt Admin
          </h2>
          <p className="mt-2 text-center text-sm text-admin-gray">
            Sign in to access the admin dashboard
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="-space-y-px rounded-md shadow-sm">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-5 w-5 text-admin-gray" />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full appearance-none rounded-none rounded-t-md border border-admin-border px-3 py-3 pl-10 text-admin-textDark placeholder-admin-gray focus:z-10 focus:border-admin-primary focus:outline-none focus:ring-admin-primary sm:text-sm bg-admin-white"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-admin-gray" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full appearance-none rounded-none rounded-b-md border border-admin-border px-3 py-3 pl-10 text-admin-textDark placeholder-admin-gray focus:z-10 focus:border-admin-primary focus:outline-none focus:ring-admin-primary sm:text-sm bg-admin-white"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-admin-primary px-4 py-3 text-sm font-medium text-admin-white hover:bg-admin-primaryHover focus:outline-none focus:ring-2 focus:ring-admin-primary focus:ring-offset-2 disabled:opacity-70 transition-colors duration-200"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
