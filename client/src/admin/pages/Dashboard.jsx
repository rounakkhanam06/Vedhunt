import { Link } from 'react-router-dom';
import { UserPlus, LineChart, Megaphone, Activity, TrendingUp } from 'lucide-react';

const Dashboard = () => {
  return (
    <>
      {/* KPI Top Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Leads */}
        <div className="bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-on-primary-container">Total Leads</span>
            <UserPlus className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold mb-1">1,284</div>
          <div className="flex items-center gap-1 text-[10px] font-medium text-[#00FF94]">
            <TrendingUp className="w-3 h-3" />
            +12% week-over-week
          </div>
        </div>

        {/* Ad Spend ROI */}
        <div className="bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-on-primary-container">Ad Spend ROI</span>
            <LineChart className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold mb-1">4.2x</div>
          <div className="text-[10px] font-medium text-on-surface-variant">
            Target: <span className="text-secondary">3.5x</span>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-on-primary-container">Active Campaigns</span>
            <Megaphone className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold mb-1">12</div>
          <div className="flex items-center gap-1 text-[10px] font-medium text-on-surface">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF94]"></span>
            8 High Performance
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-on-primary-container">Conversion Rate</span>
            <Activity className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold mb-1">3.8%</div>
          <div className="flex items-center gap-1 text-[10px] font-medium text-[#00FF94]">
            <TrendingUp className="w-3 h-3" />
            +0.4% from last month
          </div>
        </div>
      </section>

      {/* Main Analytics Row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Area Chart Simulation */}
        <div className="lg:col-span-2 bg-admin-glass border border-white/5 p-6 rounded-xl">
          <div className="flex justify-between items-center mb-10 border-b border-outline-variant pb-4">
            <h3 className="text-xl font-semibold text-on-surface">Lead Flow Over Past 30 Days</h3>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-surface-variant/50 rounded text-xs text-on-surface-variant">Daily</span>
              <span className="px-2 py-1 bg-secondary-container/20 text-secondary rounded text-xs font-bold">Monthly</span>
            </div>
          </div>
          <div className="relative h-64 w-full flex items-end gap-[2%] px-2">
            {/* Simulated Chart */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-b border-outline-variant w-full"></div>
              <div className="border-b border-outline-variant w-full"></div>
              <div className="border-b border-outline-variant w-full"></div>
              <div className="border-b border-outline-variant w-full"></div>
            </div>
            
            <div className="w-[3%] bg-secondary/20 h-[30%] rounded-t-sm relative group">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface p-1 rounded border border-outline-variant opacity-0 group-hover:opacity-100 text-[10px] transition-opacity">12</div>
            </div>
            <div className="w-[3%] bg-secondary/30 h-[45%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary/40 h-[38%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary/50 h-[60%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary/60 h-[55%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary/70 h-[72%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary h-[85%] rounded-t-sm shadow-[0_0_15px_rgba(255,107,0,0.3)]"></div>
            <div className="w-[3%] bg-secondary/80 h-[78%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary/70 h-[65%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary/60 h-[70%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary/50 h-[62%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary/60 h-[75%] rounded-t-sm"></div>
            <div className="w-[3%] bg-secondary h-[92%] rounded-t-sm shadow-[0_0_15px_rgba(255,107,0,0.3)]"></div>
          </div>
          <div className="mt-4 flex justify-between px-2 text-[10px] font-medium text-on-primary-container">
            <span>Day 01</span>
            <span>Day 10</span>
            <span>Day 20</span>
            <span>Today</span>
          </div>
        </div>

        {/* Right: Donut Chart Simulation */}
        <div className="bg-admin-glass border border-white/5 p-6 rounded-xl flex flex-col">
          <div className="mb-10 border-b border-outline-variant pb-4">
            <h3 className="text-xl font-semibold text-on-surface">Leads by Category</h3>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center py-6">
            <div className="relative w-48 h-48 rounded-full border-[16px] border-[#222226] flex items-center justify-center">
              <div className="absolute inset-[-16px] rounded-full border-[16px] border-secondary border-t-transparent border-l-transparent transform rotate-45 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"></div>
              <div className="absolute inset-[-16px] rounded-full border-[16px] border-[#94A3B8] border-b-transparent border-r-transparent transform -rotate-12"></div>
              <div className="text-center">
                <div className="text-3xl font-bold">1,284</div>
                <div className="text-[10px] font-medium text-on-primary-container">TOTAL</div>
              </div>
            </div>
          </div>
          <div className="space-y-2 mt-auto">
            <div className="flex justify-between items-center text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-secondary"></span>
                <span>Website Dev</span>
              </div>
              <span className="text-on-surface">45%</span>
            </div>
            <div className="flex justify-between items-center text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#94A3B8]"></span>
                <span>Perf. Marketing</span>
              </div>
              <span className="text-on-surface">32%</span>
            </div>
            <div className="flex justify-between items-center text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#2D2D33]"></span>
                <span>SMM</span>
              </div>
              <span className="text-on-surface">23%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Section: Data Table */}
      <section className="bg-admin-glass border border-white/5 rounded-xl overflow-hidden mt-6">
        <div className="p-6 border-b border-outline-variant flex justify-between items-center">
          <h3 className="text-xl font-semibold text-on-surface">Live Leads Data Table</h3>
          <button className="bg-[#121215] border border-[#2D2D33] px-4 py-2 rounded-lg text-xs font-medium hover:border-secondary transition-all text-on-surface">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50 text-xs font-medium text-on-primary-container">
                <th className="px-6 py-4 font-medium">CLIENT NAME</th>
                <th className="px-6 py-4 font-medium">CONTACT</th>
                <th className="px-6 py-4 font-medium">CHOSEN SERVICE</th>
                <th className="px-6 py-4 font-medium">SOURCE</th>
                <th className="px-6 py-4 font-medium">STATUS</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/30 text-on-surface-variant">
              <tr className="hover:bg-surface-variant/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 text-on-surface">
                    <div className="w-8 h-8 rounded-full bg-secondary-container/20 text-secondary flex items-center justify-center font-bold text-xs">JD</div>
                    John Doe
                  </div>
                </td>
                <td className="px-6 py-4">john@email.com</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-surface-variant text-on-surface rounded text-[11px] font-medium">Website Dev</span>
                </td>
                <td className="px-6 py-4">Google Ads /lp/</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#FFB800]/10 text-[#FFB800] text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-[#FFB800] mr-2"></span>
                    New
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-surface-variant/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 text-on-surface">
                    <div className="w-8 h-8 rounded-full bg-[#1e293b] text-on-surface flex items-center justify-center font-bold text-xs">JS</div>
                    Jane Smith
                  </div>
                </td>
                <td className="px-6 py-4">jane@company.com</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-surface-variant text-on-surface rounded text-[11px] font-medium">SMM</span>
                </td>
                <td className="px-6 py-4">Facebook Organic</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-blue-400 mr-2"></span>
                    In Progress
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-surface-variant/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 text-on-surface">
                    <div className="w-8 h-8 rounded-full bg-[#e5e2e1]/10 text-on-surface flex items-center justify-center font-bold text-xs">AC</div>
                    Acme Corp
                  </div>
                </td>
                <td className="px-6 py-4">admin@acme.co</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-surface-variant text-on-surface rounded text-[11px] font-medium">Perf. Marketing</span>
                </td>
                <td className="px-6 py-4">Google Search</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#00FF94]/10 text-[#00FF94] text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-[#00FF94] mr-2"></span>
                    Converted
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

export default Dashboard;
