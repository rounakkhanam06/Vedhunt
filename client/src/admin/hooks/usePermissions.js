import { useAdminStore } from '../../store/useAdminStore';

export const usePermissions = () => {
  const { admin } = useAdminStore();

  const can = (permission) => {
    if (!admin || !admin.permissions) return false;
    
    // Super Admin check
    if (admin.permissions.includes('*')) return true;

    return admin.permissions.includes(permission);
  };

  const hasAnyPermission = (permissionsArray) => {
    if (!admin || !admin.permissions) return false;
    if (admin.permissions.includes('*')) return true;
    return permissionsArray.some((perm) => admin.permissions.includes(perm));
  };

  return { can, hasAnyPermission };
};
