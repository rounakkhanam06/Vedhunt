import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAdminStore } from '../../store/useAdminStore';
import { UserPlus, Trash2, Shield, User, Mail, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const TeamManagement = () => {
  const { admin: currentAdmin } = useAdminStore();
  const [admins, setAdmins] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // New admin form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roles: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [teamRes, rolesRes] = await Promise.all([
        api.get('/team'),
        api.get('/rbac/roles')
      ]);
      
      if (teamRes.data.success) {
        setAdmins(teamRes.data.admins);
      }
      if (rolesRes.data.success) {
        setAvailableRoles(rolesRes.data.roles);
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

  const inputClasses = "w-full bg-[#121215] border border-[#2D2D33] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all duration-300";
  const labelClasses = "block text-[12px] font-medium text-gray-400 mb-1.5 font-mono uppercase tracking-wider";

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Team Management</h2>
          <p className="text-gray-400">Manage admin access, roles, and security permissions.</p>
        </div>
        
        <button 
          onClick={() => {
            setFormData({ firstName: '', lastName: '', email: '', password: '', roles: [] });
            setError('');
            setShowPassword(false);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#EA580C] text-white px-5 py-2.5 rounded-lg font-semibold shadow-[0_4px_15px_rgba(255,107,0,0.3)] transition-all cursor-pointer"
        >
          <UserPlus size={18} />
          Add New Admin
        </button>
      </div>

      <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#121215] border-b border-[#2D2D33]">
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-gray-500 font-semibold">Admin Account</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-gray-500 font-semibold">Roles</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-gray-500 font-semibold">Status</th>
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-gray-500 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">Loading team members...</td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">No admin accounts found.</td>
                </tr>
              ) : (
                admins.map((user) => (
                  <tr key={user._id} className="border-b border-[#2D2D33] hover:bg-[#16161A] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00] font-bold shrink-0">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-white font-medium break-all">{user.email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 text-sm">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map(r => (
                            <span key={r._id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#2D2D33] text-gray-300 text-xs font-semibold border border-[#3D3D45]">
                              {r.name === 'SUPER_ADMIN' ? <Shield size={12} className="text-[#FF6B00]" /> : <User size={12} className="text-blue-400" />}
                              <span className={r.name === 'SUPER_ADMIN' ? 'text-[#FF6B00]' : 'text-blue-400'}>{r.name}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-xs italic">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          Inactive
                        </span>
                      )}
                    </td>
                      <td className="p-4 text-right">
                        {currentAdmin?._id !== user._id && (
                          <button 
                            onClick={() => handleDeleteAdmin(user._id)}
                            className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10 cursor-pointer"
                            title="Remove Admin"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        {currentAdmin?._id === user._id && (
                          <span className="text-xs text-gray-500 italic mr-2">You</span>
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
          <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-[#2D2D33] flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-white">Create New Admin</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm shrink-0">
                  {error}
                </div>
              )}
              
              <div className="flex gap-4 shrink-0">
                <div className="flex-1">
                  <label className={labelClasses}>First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 text-gray-500" size={18} />
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
                    <User className="absolute left-3 top-2.5 text-gray-500" size={18} />
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
                  <Mail className="absolute left-3 top-2.5 text-gray-500" size={18} />
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
                  <Lock className="absolute left-3 top-2.5 text-gray-500" size={18} />
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
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-[#FF6B00] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 shrink-0">
                <label className={labelClasses}>Role Assignment</label>
                <div className="bg-[#121215] border border-[#2D2D33] rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {availableRoles.length === 0 ? (
                    <div className="text-sm text-gray-500 p-2">No roles available.</div>
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
                              ? 'bg-[#FF6B00]/10 border-[#FF6B00]/30 text-white' 
                              : 'bg-[#1A1A1A] border-[#2D2D33] text-gray-400 hover:border-gray-600'}
                          `}
                        >
                          <div className={`shrink-0 rounded-full flex items-center justify-center w-5 h-5 border ${isSelected ? 'bg-[#FF6B00] border-[#FF6B00]' : 'border-gray-600'}`}>
                            {isSelected && <CheckCircle2 size={14} className="text-white" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{role.name}</div>
                            {role.description && <div className="text-xs text-gray-500 mt-0.5">{role.description}</div>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-[#2D2D33] shrink-0 flex gap-3 bg-[#1A1A1A]">
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#2D2D33] text-gray-300 hover:bg-[#2D2D33] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                onClick={handleCreateAdmin}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white font-semibold transition-colors"
                disabled={formData.roles.length === 0}
              >
                Create Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
