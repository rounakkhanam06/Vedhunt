import { User, Mail, Lock } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';

const ProfilePage = () => {
  const { admin } = useAdminStore();

  const inputClasses = "w-full bg-[#121215] border border-[#2D2D33] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all duration-300";
  const labelClasses = "block text-[12px] font-medium text-gray-400 mb-1.5 font-mono uppercase tracking-wider";

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-2xl font-bold text-white mb-2">Profile Settings</h3>
      <p className="text-gray-400 text-sm mb-8">Manage your personal information and security preferences.</p>
      
      <div className="space-y-8 bg-[#1A1A1A] p-8 rounded-xl border border-[#2D2D33]">
        {/* Divider Heading */}
        <div>
          <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4 flex items-center gap-4">
            <span>Personal Details</span>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent"></div>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>First Name</label>
              <input type="text" placeholder="Admin" className={inputClasses} defaultValue="Admin" />
            </div>
            <div>
              <label className={labelClasses}>Last Name</label>
              <input type="text" placeholder="User" className={inputClasses} defaultValue="User" />
            </div>
            <div>
              <label className={labelClasses}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gray-500" size={18} />
                <input type="email" placeholder="admin@vedhunt.com" className={`${inputClasses} pl-10`} defaultValue={admin?.email || "vedhunt@gmail.com"} />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Role Level</label>
              <div className="w-full bg-[#16161A] border border-[#2D2D33] rounded-lg px-4 py-2 text-[#FF6B00] font-semibold text-sm select-none cursor-not-allowed flex items-center h-[42px]">
                Role: {admin?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Editor'}
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div>
          <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4 mt-8 flex items-center gap-4">
            <span>Security</span>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent"></div>
          </h4>
          <div className="space-y-4">
            <div>
              <label className={labelClasses}>Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-gray-500" size={18} />
                <input type="password" placeholder="••••••••" className={`${inputClasses} pl-10`} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClasses}>New Password</label>
                <input type="password" placeholder="••••••••" className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Confirm New Password</label>
                <input type="password" placeholder="••••••••" className={inputClasses} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-6 text-right">
          <button className="bg-[#FF6B00] hover:bg-[#EA580C] text-white px-6 py-2 rounded-lg font-bold transition-all hover:scale-105 active:scale-95">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
