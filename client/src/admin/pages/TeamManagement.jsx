import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAdminStore } from '../../store/useAdminStore';
import { UserPlus, Trash2, Shield, User, Mail, Lock } from 'lucide-react';

const TeamManagement = () => {
  const { admin: currentAdmin } = useAdminStore();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  
  // New admin form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'EDITOR'
  });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await api.get('/team');
      if (res.data.success) {
        setAdmins(res.data.admins);
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await api.post('/team', formData);
      if (res.data.success) {
        setShowModal(false);
        setFormData({ email: '', password: '', role: 'EDITOR' });
        fetchAdmins();
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
          fetchAdmins();
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
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#EA580C] text-white px-5 py-2.5 rounded-lg font-semibold shadow-[0_4px_15px_rgba(255,107,0,0.3)] transition-all"
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
                <th className="p-4 text-xs font-mono uppercase tracking-widest text-gray-500 font-semibold">Role</th>
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
                        <div className="w-10 h-10 rounded-full bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00] font-bold">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-white font-medium">{user.email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-sm">
                        {user.role === 'SUPER_ADMIN' ? (
                          <><Shield size={14} className="text-[#FF6B00]" /><span className="text-[#FF6B00] font-semibold">Super Admin</span></>
                        ) : (
                          <><User size={14} className="text-blue-400" /><span className="text-blue-400 font-semibold">Editor</span></>
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
                          className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
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
          <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#2D2D33] flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Create New Admin</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div>
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

              <div>
                <label className={labelClasses}>Temporary Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-gray-500" size={18} />
                  <input 
                    type="password" 
                    required
                    minLength="6"
                    placeholder="Min 6 characters" 
                    className={`${inputClasses} pl-10`}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className={labelClasses}>Role Assignment</label>
                <select 
                  className={inputClasses}
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option value="EDITOR">Editor (Content & Leads only)</option>
                  <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#2D2D33] text-gray-300 hover:bg-[#2D2D33] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white font-semibold transition-colors"
                >
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
