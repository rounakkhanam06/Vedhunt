import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useAdminStore } from '../../store/useAdminStore';

const ProtectedRoute = ({ children, requiredPermission }) => {
  const { admin, isAuthenticated, isInitializing } = useAdminStore();
  const { can } = usePermissions();

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-admin-primary border-t-transparent"></div>
          <p className="mt-4 text-on-surface-variant font-medium">Checking Authorization...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
