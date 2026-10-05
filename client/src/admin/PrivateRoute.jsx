import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminStore } from '../store/useAdminStore';
import { useEffect } from 'react';

const PrivateRoute = () => {
  const { isAuthenticated, isInitializing, checkAuth, admin } = useAdminStore();
  const location = useLocation();

  useEffect(() => {
    if (isInitializing) {
      checkAuth();
    }
  }, [isInitializing, checkAuth]);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  // Still on a temporary password → must set a real one first (the API refuses everything else too)
  if (admin?.isTemporaryPassword) return <Navigate to="/admin/reset-temp-password" replace />;
  return <Outlet />;
};

export default PrivateRoute;
