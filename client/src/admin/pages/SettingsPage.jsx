import { useState } from 'react';
import { User, Plug, BarChart2, Database, Save, Mail, Lock, Smartphone, DownloadCloud, AlertCircle } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';

const SettingsPage = () => {
  const { admin } = useAdminStore();
  const [activeTab, setActiveTab] = useState('integrations');

  const tabs = [
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'campaigns', label: 'Campaign Control', icon: BarChart2 },
    { id: 'backups', label: 'Backups', icon: Database },
  ];

  const inputClasses = "w-full bg-[#121215] border border-[#2D2D33] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all duration-300";
  const labelClasses = "block text-[12px] font-medium text-gray-400 mb-1.5 font-mono uppercase tracking-wider";

  return (
    <div className="relative min-h-[calc(100vh-80px)] bg-[#1A1A1A] rounded-xl border border-[#2D2D33] overflow-hidden flex flex-col md:flex-row">
      
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 bg-[#16161A] border-r border-[#2D2D33] flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">Settings</h2>
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${
                    isActive 
                      ? 'bg-[#FF6B00]/10 text-[#FF6B00] shadow-[0_0_15px_rgba(255,107,0,0.1)]' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-[#FF6B00]' : 'text-gray-500'} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative pb-24">
        

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">API Integrations</h3>
            <p className="text-gray-400 text-sm mb-8">Connect external services to power your workflows.</p>

            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4 flex items-center gap-4">
                  <span>Communication APIs</span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent"></div>
                </h4>
                <div className="space-y-6">
                  <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#25D366]"></div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                        <Smartphone size={20} className="text-[#25D366]" />
                      </div>
                      <div>
                        <h5 className="text-white font-semibold">WhatsApp Business API</h5>
                        <p className="text-xs text-gray-400">For lead notifications and client updates.</p>
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>API Token</label>
                      <input type="password" placeholder="Enter WhatsApp Token" className={inputClasses} />
                    </div>
                  </div>

                  <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#EA4335]"></div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#EA4335]/10 flex items-center justify-center">
                        <Mail size={20} className="text-[#EA4335]" />
                      </div>
                      <div>
                        <h5 className="text-white font-semibold">SMTP / Email Service</h5>
                        <p className="text-xs text-gray-400">For automated email campaigns and invoicing.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClasses}>Host</label>
                        <input type="text" placeholder="smtp.gmail.com" className={inputClasses} />
                      </div>
                      <div>
                        <label className={labelClasses}>Port</label>
                        <input type="text" placeholder="587" className={inputClasses} />
                      </div>
                      <div className="col-span-2">
                        <label className={labelClasses}>API Key / App Password</label>
                        <input type="password" placeholder="Enter secure key" className={inputClasses} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Campaign Control</h3>
            <p className="text-gray-400 text-sm mb-8">Manage global settings for your ad campaigns and landing pages.</p>
            
            <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl flex items-start gap-4">
              <AlertCircle className="text-[#FFB800] mt-1 shrink-0" size={20} />
              <div>
                <h5 className="text-white font-medium mb-1">Global Tracking Pixels</h5>
                <p className="text-sm text-gray-400 mb-4">These pixels will be injected into all `/lp/` routes automatically.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className={labelClasses}>Facebook/Meta Pixel ID</label>
                    <input type="text" placeholder="e.g. 123456789012345" className={inputClasses} />
                  </div>
                  <div>
                    <label className={labelClasses}>Google Analytics Measurement ID</label>
                    <input type="text" placeholder="e.g. G-XXXXXXX" className={inputClasses} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backups Tab */}
        {activeTab === 'backups' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Data & Backups</h3>
            <p className="text-gray-400 text-sm mb-8">Export your system data securely.</p>
            
            <div className="bg-[#121215] border border-[#2D2D33] p-8 rounded-xl text-center">
              <div className="w-16 h-16 rounded-full bg-[#FF6B00]/10 flex items-center justify-center mx-auto mb-4">
                <DownloadCloud size={28} className="text-[#FF6B00]" />
              </div>
              <h5 className="text-white font-semibold text-lg mb-2">Export Full Database</h5>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">Download a complete Excel (.xlsx) backup of all leads, projects, and financial records.</p>
              
              <button className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                Generate Backup Archive
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Sticky Floating Action Button */}
      <div className="absolute bottom-6 right-6 z-10">
        <button className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#EA580C] text-white px-6 py-3 rounded-full font-bold shadow-[0_4px_20px_rgba(255,107,0,0.4)] transition-all hover:scale-105 active:scale-95">
          <Save size={18} />
          Save Changes
        </button>
      </div>

    </div>
  );
};

export default SettingsPage;
