import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAdminStore } from '../../store/useAdminStore';
import { UserPlus, Trash2, Shield, User, Mail, Lock, CheckCircle2, Eye, EyeOff, Edit2, Copy, Check, ExternalLink, Info } from 'lucide-react';

const TeamManagement = () => {
  const { admin: currentAdmin } = useAdminStore();
  const [admins, setAdmins] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  // New admin form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roles: []
  });

  // Edit admin form state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    roles: [],
    isActive: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [teamRes, rolesRes] = await Promise.all([
        api.get('/team'),
        api.get('/rbac/roles')
      ]);
      
      if (teamRes.data.success) {
        // GET /api/team returns every login in the Admin collection, which
        // includes HRMS employee accounts (Support Desk's ticket-assignment
        // dropdown needs those, so the backend can't filter them out) — but
        // this page is "Team Management" for admin-panel users specifically,
        // and those employees already have a dedicated home in Employee
        // Manager. Drop them here so this list only shows real admins.
        setAdmins(teamRes.data.admins.filter(a => !a.employeeId));
      }
      if (rolesRes.data.success) {
        // Employee-type roles (isEmployeeRole) are assigned from the Employee
        // Manager, which also creates the linked Employee HR profile —
        // offering them here would let an admin create a login with no
        // profile behind it.
        setAvailableRoles(rolesRes.data.roles.filter(role => !role.isEmployeeRole));
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

  const handleToggleRole = (roleId) => {
    setFormData(prev => {
      const isSelected = prev.roles.includes(roleId);
      if (isSelected) {
        return { ...prev, roles: prev.roles.filter(id => id !== roleId) };
      } else {
        return { ...prev, roles: [...prev.roles, roleId] };
      }
    });
  };

  const handleToggleEditRole = (roleId) => {
    setEditFormData(prev => {
      const isSelected = prev.roles.includes(roleId);
      if (isSelected) {
        return { ...prev, roles: prev.roles.filter(id => id !== roleId) };
      } else {
        return { ...prev, roles: [...prev.roles, roleId] };
      }
    });
  };

  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    setEditError('');
    setIsUpdating(true);
    
    try {
      const res = await api.put(`/team/${editFormData.id}`, {
        roles: editFormData.roles,
        isActive: editFormData.isActive
      });
      if (res.data.success) {
        setShowEditModal(false);
        fetchData();
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Error updating admin');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await api.post('/team', formData);
      if (res.data.success) {
        setShowModal(false);
        setFormData({ firstName: '', lastName: '', email: '', password: '', roles: [] });
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating admin');
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (window.confirm('Are you sure you want to delete this admin account?')) {
      try {
        const res = await api.delete(`/team/${id}`);
        if (res.data.success) {
          fetchData();
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Error deleting admin');
      }
    }
  };

  const inputClasses = "w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all duration-300";
  const labelClasses = "block text-[12px] font-medium text-app-text-muted mb-1.5 font-mono uppercase tracking-wider";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-app-text mb-2">Team Management</h2>
          <p className="text-app-text-muted">Manage admin access, roles, and security permissions.</p>
        </div>
        
        <button 
          onClick={() => {
            setFormData({ firstName: '', lastName: '', email: '', password: '', roles: [] });
            setError('');
            setShowPassword(false);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#EA580C] text-white px-5 py-2.5 rounded-lg font-semibold shadow-[0_4px_15px_rgba(255,107,0,0.3)] transition-all cursor-pointer shrink-0"
        >
          <UserPlus size={18} />
          Add New Admin
        </button>
      </div>

      {/* Admin Portal Login Guidance Banner */}
      <div className="mb-6 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
            <Info size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-app-text flex items-center gap-2">
              Admin Login Portal
            </div>
            <p className="text-xs text-app-text-muted mt-1 leading-relaxed">
              Users created on this page are administrators. They can sign in to manage the platform using their registered email and password at:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="px-3 py-1 rounded-md bg-app-bg border border-app-border text-xs font-mono font-bold text-primary select-all">
                https://vedhunt.in/admin
              </code>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => {
              const url = 'https://vedhunt.in/admin';
              navigator.clipboard.writeText(url);
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 2000);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-app-border bg-app-card hover:border-primary/50 text-xs font-semibold text-app-text transition-all cursor-pointer shadow-sm"
            title="Copy admin login portal URL"
          >
            {copiedUrl ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-app-text-muted" />}
            <span>{copiedUrl ? 'Copied URL!' : 'Copy Portal URL'}</span>
          </button>
          <a
            href="https://vedhunt.in/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all"
            title="Open Admin Login Portal"
          >
            <span>Open</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <div className="bg-app-card border border-app-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-app-bg border-b border-app-border">
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-app-text-muted font-semibold min-w-[250px]">Admin Account</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-app-text-muted font-semibold min-w-[200px]">Roles</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-app-text-muted font-semibold min-w-[120px]">Status</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-app-text-muted font-semibold text-right min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-app-text-muted">Loading team members...</td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-app-text-muted">No admin accounts found.</td>
                </tr>
              ) : (
                admins.map((user) => (
                  <tr key={user._id} className="hover:bg-surface-variant transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00] font-bold shrink-0">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-app-text font-medium">{user.email}</div>
                          {user.employeeId && (
                            <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-medium">HRMS Employee ({user.employeeId}) — managed in Employee Manager</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 text-sm">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map(r => (
                            <span key={r._id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-[#2D2D33] text-gray-700 dark:text-gray-200 text-xs font-medium border border-gray-200 dark:border-[#3D3D45]">
                              {r.name === 'SUPER_ADMIN' ? <Shield size={12} className="text-[#FF6B00]" /> : <User size={12} className="text-blue-500 dark:text-blue-400" />}
                              <span className={r.name === 'SUPER_ADMIN' ? 'text-[#FF6B00] font-semibold' : 'text-blue-600 dark:text-blue-400 font-semibold'}>{r.name}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-app-text-muted text-xs italic">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {currentAdmin?._id !== user._id && !user.employeeId && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditFormData({
                                id: user._id,
                                firstName: user.firstName || '',
                                lastName: user.lastName || '',
                                email: user.email,
                                roles: user.roles ? user.roles.map(r => r._id || r) : [],
                                isActive: user.isActive !== false // defaults to true if undefined
                              });
                              setEditError('');
                              setShowEditModal(true);
                            }}
                            className="text-app-text-muted hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 rounded-lg hover:bg-blue-500/10 cursor-pointer"
                            title="Edit Admin Roles"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteAdmin(user._id)}
                            className="text-app-text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10 cursor-pointer"
                            title="Remove Admin"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                      {currentAdmin?._id === user._id && (
                        <span className="text-xs text-app-text-muted italic mr-2">You</span>
                      )}
                      {currentAdmin?._id !== user._id && user.employeeId && (
                        <span className="text-xs text-app-text-muted italic mr-2">Use Employee Manager</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Admin Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-app-border flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-app-text">Create New Admin</h3>
              <button onClick={() => setShowModal(false)} className="text-app-text-muted hover:text-app-text cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm shrink-0">
                  {error}
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-app-text-muted flex items-center gap-2">
                <Info size={16} className="text-blue-500 shrink-0" />
                <span>Admins created here will sign in at <code className="text-primary font-bold font-mono">https://vedhunt.in/admin</code> using these credentials.</span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                <div className="flex-1">
                  <label className={labelClasses}>First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 text-app-text-muted" size={18} />
                    <input 
                      type="text" 
                      required
                      placeholder="First Name" 
                      className={`${inputClasses} pl-10`}
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className={labelClasses}>Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 text-app-text-muted" size={18} />
                    <input 
                      type="text" 
                      required
                      placeholder="Last Name" 
                      className={`${inputClasses} pl-10`}
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <div className="shrink-0">
                <label className={labelClasses}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-app-text-muted" size={18} />
                  <input 
                    type="email" 
                    required
                    placeholder="admin@vedhunt.com" 
                    className={`${inputClasses} pl-10`}
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="shrink-0">
                <label className={labelClasses}>Temporary Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-app-text-muted" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    minLength="6"
                    placeholder="Min 6 characters" 
                    className={`${inputClasses} pl-10 pr-10`}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-app-text-muted hover:text-[#FF6B00] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 shrink-0">
                <label className={labelClasses}>Role Assignment</label>
                <div className="bg-app-bg border border-app-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {availableRoles.length === 0 ? (
                    <div className="text-sm text-app-text-muted p-2">No roles available.</div>
                  ) : (
                    availableRoles.map(role => {
                      const isSelected = formData.roles.includes(role._id);
                      return (
                        <div 
                          key={role._id}
                          onClick={() => handleToggleRole(role._id)}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200
                            ${isSelected 
                              ? 'bg-[#FF6B00]/10 border-[#FF6B00]/40 text-app-text' 
                              : 'bg-app-card border-app-border text-app-text-muted hover:border-primary/40'}
                          `}
                        >
                          <div className={`shrink-0 rounded-full flex items-center justify-center w-5 h-5 border ${isSelected ? 'bg-[#FF6B00] border-[#FF6B00]' : 'border-gray-400 dark:border-gray-600'}`}>
                            {isSelected && <CheckCircle2 size={14} className="text-white" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-app-text">{role.name}</div>
                            {role.description && <div className="text-xs text-app-text-muted mt-0.5">{role.description}</div>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-app-border shrink-0 flex gap-3 bg-app-card">
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-app-border text-app-text hover:bg-surface-variant transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                onClick={handleCreateAdmin}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                disabled={formData.roles.length === 0}
              >
                Create Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-app-border flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-app-text">Edit Admin Access</h3>
              <button onClick={() => setShowEditModal(false)} className="text-app-text-muted hover:text-app-text cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleUpdateAdmin} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {editError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm shrink-0">
                  {editError}
                </div>
              )}
              
              <div className="bg-app-bg border border-app-border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-bold text-app-text">{editFormData.firstName} {editFormData.lastName}</div>
                  <button
                    type="button"
                    onClick={() => setEditFormData(f => ({ ...f, isActive: !f.isActive }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${editFormData.isActive ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${editFormData.isActive ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'}`} />
                    {editFormData.isActive ? 'Account Active' : 'Account Suspended'}
                  </button>
                </div>
                <div className="text-sm text-app-text-muted">{editFormData.email}</div>
                <div className="text-xs text-app-text-muted mt-2 italic">Suspended accounts cannot log in to the portal.</div>
              </div>

              <div className="pt-2 shrink-0">
                <label className={labelClasses}>Role Assignment</label>
                <div className="bg-app-bg border border-app-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {availableRoles.length === 0 ? (
                    <div className="text-sm text-app-text-muted p-2">No roles available.</div>
                  ) : (
                    availableRoles.map(role => {
                      const isSelected = editFormData.roles.includes(role._id);
                      return (
                        <div 
                          key={role._id}
                          onClick={() => handleToggleEditRole(role._id)}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200
                            ${isSelected 
                              ? 'bg-[#FF6B00]/10 border-[#FF6B00]/40 text-app-text' 
                              : 'bg-app-card border-app-border text-app-text-muted hover:border-primary/40'}
                          `}
                        >
                          <div className={`shrink-0 rounded-full flex items-center justify-center w-5 h-5 border ${isSelected ? 'bg-[#FF6B00] border-[#FF6B00]' : 'border-gray-400 dark:border-gray-600'}`}>
                            {isSelected && <CheckCircle2 size={14} className="text-white" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-app-text">{role.name}</div>
                            {role.description && <div className="text-xs text-app-text-muted mt-0.5">{role.description}</div>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-app-border shrink-0 flex gap-3 bg-app-card">
              <button 
                type="button" 
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-app-border text-app-text hover:bg-surface-variant transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                onClick={handleUpdateAdmin}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white font-semibold transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                disabled={editFormData.roles.length === 0 || isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
