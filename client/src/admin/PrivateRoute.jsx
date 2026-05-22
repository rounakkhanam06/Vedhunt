import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminStore } from '../store/useAdminStore';
import { useEffect } from 'react';

const PrivateRoute = () => {
  const { isAuthenticated, isInitializing, checkAuth } = useAdminStore();
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

  return isAuthenticated ? <Outlet /> : <Navigate to="/admin/login" state={{ from: location }} replace />;
};

export default PrivateRoute;
