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
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/employee/login" replace />;
};

export default EmployeePrivateRoute;
