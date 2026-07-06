import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useClientStore } from '../store/useClientStore';
import { useEffect } from 'react';

/**
 * Client Portal Private Route Guard
 *
 * ISOLATED from admin PrivateRoute:
 * - Uses useClientStore (not useAdminStore)
 * - Redirects to /client/login (not /admin/login)
 */
const ClientPrivateRoute = () => {
  const { isAuthenticated, isInitializing, checkAuth } = useClientStore();
  const location = useLocation();

  useEffect(() => {
    if (isInitializing) {
      checkAuth();
    }
  }, [isInitializing, checkAuth]);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-[#FF5A1F] animate-spin" />
          <p className="text-[#9CA3AF] text-sm">Verifying session…</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/client/login" state={{ from: location }} replace />
  );
};

export default ClientPrivateRoute;
