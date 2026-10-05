import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useEmployeeStore } from '../store/useEmployeeStore';

const EmployeePrivateRoute = () => {
  const { isAuthenticated, isInitializing, checkAuth, employee } = useEmployeeStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/employee/login" replace />;
  // Still on a temporary password → must set a real one first (the API refuses everything else too)
  if (employee?.isTemporaryPassword) return <Navigate to="/employee/reset-temp-password" replace />;
  return <Outlet />;
};

export default EmployeePrivateRoute;
