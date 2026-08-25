import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useEmployeeStore } from '../store/useEmployeeStore';

const EmployeePrivateRoute = () => {
  const { isAuthenticated, isInitializing, checkAuth } = useEmployeeStore();

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

  return isAuthenticated ? <Outlet /> : <Navigate to="/employee/login" replace />;
};

export default EmployeePrivateRoute;
