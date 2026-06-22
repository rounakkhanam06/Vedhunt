import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { BarChart3, Users, Clock, Filter, Download } from 'lucide-react';

const ManagerDashboard = () => {
  const [stats, setStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [dateRange, setDateRange] = useState('Today');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    fetchProductivity();
  }, [dateRange, department]);

  const fetchProductivity = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/employees/manager/productivity', {
        params: { dateRange, department }
      });
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      toast.error('Failed to load manager dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    // Generate simple CSV
    const headers = ['Employee Name', 'Department', 'Type', 'Total Worked (hrs)', 'Productive (hrs)', 'Non-Productive (hrs)', 'Billable (hrs)', 'Utilization (%)'];
    const rows = stats.map(s => [
      s.name, s.department, s.type, s.totalWorkedHours, s.productiveHours, s.nonProductiveHours, s.billableHours, s.utilizationPercentage
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `productivity_report_${dateRange.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && stats.length === 0) {
    return (
      <div className="flex justify-center items-center py-20 bg-admin-bg min-h-screen text-white">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-2xl border border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="text-orange-500" />
            Productivity & Timesheet Reports
          </h1>
          <p className="text-gray-400 mt-1">Monitor employee working hours, productivity, and utilization across the company.</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 text-sm font-medium"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-surface rounded-xl border border-white/5">
        <div className="flex items-center gap-2 text-gray-400">
          <Filter size={16} />
          <span className="text-sm font-bold uppercase tracking-wider">Filters:</span>
        </div>
        
        <select 
          className="bg-[#141416] border border-white/10 rounded-lg px-4 py-2 text-sm text-white"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="Today">Today</option>
          <option value="Weekly">This Week</option>
          <option value="Monthly">This Month</option>
          <option value="All Time">All Time</option>
        </select>

        <select 
          className="bg-[#141416] border border-white/10 rounded-lg px-4 py-2 text-sm text-white"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">All Departments</option>
          <option value="Engineering">Engineering</option>
          <option value="Design">Design</option>
          <option value="Sales">Sales</option>
          <option value="Marketing">Marketing</option>
          <option value="HR">HR</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-xs text-gray-400 uppercase tracking-wider">
                <th className="py-4 px-6 font-bold">Employee Name</th>
                <th className="py-4 px-6 font-bold">Total Worked</th>
                <th className="py-4 px-6 font-bold text-emerald-500">Productive</th>
                <th className="py-4 px-6 font-bold text-orange-500">Non-Productive</th>
                <th className="py-4 px-6 font-bold text-blue-500">Billable</th>
                <th className="py-4 px-6 font-bold">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {stats.map((emp) => (
                <tr key={emp.id} className="hover:bg-white/[0.01]">
                  <td className="py-4 px-6">
                    <div className="font-bold text-white">{emp.name}</div>
                    <div className="text-xs text-gray-500">{emp.department} • {emp.type}</div>
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-white">
                    {emp.totalWorkedHours} <span className="text-gray-500 font-sans font-normal text-xs">hrs</span>
                  </td>
                  <td className="py-4 px-6 font-mono text-emerald-400">
                    {emp.productiveHours} <span className="text-gray-500 font-sans text-xs">hrs</span>
                  </td>
                  <td className="py-4 px-6 font-mono text-orange-400">
                    {emp.nonProductiveHours} <span className="text-gray-500 font-sans text-xs">hrs</span>
                  </td>
                  <td className="py-4 px-6 font-mono text-blue-400">
                    {emp.billableHours} <span className="text-gray-500 font-sans text-xs">hrs</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-white/10 rounded-full h-2 max-w-[100px]">
                        <div 
                          className={`h-2 rounded-full ${emp.utilizationPercentage >= 70 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min(emp.utilizationPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <span className="font-mono text-xs font-bold w-10 text-right">{emp.utilizationPercentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {stats.length === 0 && !isLoading && (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-gray-500">
                    <Users size={48} className="mx-auto text-white/10 mb-4" />
                    No employees found matching the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ManagerDashboard;
