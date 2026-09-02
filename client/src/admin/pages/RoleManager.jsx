import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Shield, Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react';

const permissionLabels = {
  'team.manage': 'Team Management',
  'roles.manage': 'Role Management',
  'services.manage': 'Services Management',
  'portfolio.manage': 'Portfolio Items',
  'cms.manage': 'Content Manager (CMS)',
  'pricing.manage': 'Pricing Management',
  'careers.manage': 'Careers CMS',
  'legal.manage': 'Legal & Compliance',
  'leads.view': 'Lead Manager (Ads)',
  'settings.manage': 'Settings Management',
  'payroll.manage': 'Payroll & Payslips',
};

const RoleManager = () => {
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: []
  });
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/rbac/roles'),
        api.get('/rbac/permissions')
      ]);
      
      if (rolesRes.data.success) {
        setRoles(rolesRes.data.roles);
      }
      if (permsRes.data.success) {
        setAvailablePermissions(permsRes.data.permissions);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions || []
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        description: '',
        permissions: []
      });
    }
    setError('');
    setShowModal(true);
  };

  const handleTogglePermission = (permission) => {
    setFormData(prev => {
      const isSelected = prev.permissions.includes(permission);
      if (isSelected) {
        return { ...prev, permissions: prev.permissions.filter(p => p !== permission) };
      } else {
        return { ...prev, permissions: [...prev.permissions, permission] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (editingRole) {
        await api.put(`/rbac/roles/${editingRole._id}`, formData);
      } else {
        await api.post('/rbac/roles', formData);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving role');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this role? Users assigned to this role might lose access.')) {
      try {
        await api.delete(`/rbac/roles/${id}`);
        fetchData();
      } catch (err) {
        alert(err.response?.data?.message || 'Error deleting role');
      }
    }
  };

  const inputClasses = "w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2 text-app-text placeholder-app-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-300";
  const labelClasses = "block text-[12px] font-medium text-app-text-muted mb-1.5 font-mono uppercase tracking-wider";

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-app-text mb-2">Role Management</h2>
          <p className="text-app-text-muted">Manage system roles and configure specific permissions.</p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-semibold shadow-[0_4px_15px_rgba(255,107,0,0.3)] transition-all cursor-pointer"
        >
          <Plus size={18} />
          Create New Role
        </button>
      </div>

      <div className="bg-app-card border border-app-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-app-bg border-b border-app-border">
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-app-text-muted font-semibold">Role Name</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-app-text-muted font-semibold">Description</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-app-text-muted font-semibold">Permissions</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-app-text-muted font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-app-text-muted">Loading roles...</td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-app-text-muted">No roles found.</td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role._id} className="border-b border-app-border hover:bg-surface-variant transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Shield className="text-primary" size={18} />
                        <div>
                          <div className="text-app-text font-medium flex items-center gap-2">
                            {role.name}
                            {role.isSystem && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 uppercase">System</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-app-text-muted text-sm">
                      {role.description}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {role.permissions.includes('*') ? (
                          <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono border border-primary/20">
                            * (All Access)
                          </span>
                        ) : (
                          role.permissions.slice(0, 3).map(p => (
                            <span key={p} className="px-2 py-1 rounded bg-surface-variant text-app-text text-xs font-mono border border-app-border">
                              {p}
                            </span>
                          ))
                        )}
                        {role.permissions.length > 3 && !role.permissions.includes('*') && (
                          <span className="px-2 py-1 rounded bg-surface-variant/50 text-app-text-muted text-xs font-mono">
                            +{role.permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {role.name !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleOpenModal(role)}
                            className="text-app-text-muted hover:text-app-text transition-colors p-2 rounded-lg hover:bg-surface-variant cursor-pointer"
                            title="Edit Role"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {!role.isSystem && (
                          <button
                            onClick={() => handleDelete(role._id)}
                            className="text-app-text-muted hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10 cursor-pointer"
                            title="Delete Role"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-app-border flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-app-text">{editingRole ? 'Edit Role' : 'Create New Role'}</h3>
              <button onClick={() => setShowModal(false)} className="text-app-text-muted hover:text-app-text cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm shrink-0">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 shrink-0">
                <div>
                  <label className={labelClasses}>Role Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Manager"
                    className={inputClasses}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Description</label>
                  <input
                    type="text"
                    placeholder="Brief description of responsibilities"
                    className={inputClasses}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className={labelClasses}>Permissions ({formData.permissions.length} selected)</label>
                <div className="bg-app-bg border border-app-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availablePermissions.map(permission => {
                    const isSelected = formData.permissions.includes(permission);
                    return (
                      <div
                        key={permission}
                        onClick={() => handleTogglePermission(permission)}
                        className={`
                          flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200
                          ${isSelected
                            ? 'bg-primary/10 border-primary/30 text-app-text'
                            : 'bg-app-card border-app-border text-app-text-muted hover:border-app-text-muted'}
                        `}
                      >
                        <div className={`mt-0.5 rounded flex items-center justify-center shrink-0 w-4 h-4 border ${isSelected ? 'bg-primary border-primary' : 'border-app-text-muted'}`}>
                          {isSelected && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                        <div className="text-sm font-medium break-all">{permissionLabels[permission] || permission}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-app-border shrink-0 flex gap-3 bg-app-card">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-app-border text-app-text-muted hover:bg-surface-variant hover:text-app-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-colors"
              >
                {editingRole ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManager;
