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
      <div className="flex justify-center items-center py-20 text-app-text">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-2xl border border-app-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center gap-3">
            <BarChart3 className="text-primary" />
            Productivity & Timesheet Reports
          </h1>
          <p className="text-app-text-muted mt-1">Monitor employee working hours, productivity, and utilization across the company.</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-app-bg hover:bg-app-border/40 text-app-text rounded-lg transition-colors border border-app-border text-sm font-medium shadow-sm"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-app-card rounded-xl border border-app-border shadow-sm">
        <div className="flex items-center gap-2 text-app-text-muted">
          <Filter size={16} />
          <span className="text-sm font-bold uppercase tracking-wider">Filters:</span>
        </div>
        
        <select 
          className="bg-app-bg border border-app-border rounded-lg px-4 py-2 text-sm text-app-text outline-none focus:border-primary"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="Today">Today</option>
          <option value="Weekly">This Week</option>
          <option value="Monthly">This Month</option>
          <option value="All Time">All Time</option>
        </select>

        <select 
          className="bg-app-bg border border-app-border rounded-lg px-4 py-2 text-sm text-app-text outline-none focus:border-primary"
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
      <div className="bg-app-card rounded-2xl border border-app-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-app-bg border-b border-app-border text-xs text-app-text-muted uppercase tracking-wider">
                <th className="py-4 px-6 font-bold">Employee Name</th>
                <th className="py-4 px-6 font-bold">Total Worked</th>
                <th className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-500">Productive</th>
                <th className="py-4 px-6 font-bold text-orange-600 dark:text-orange-500">Non-Productive</th>
                <th className="py-4 px-6 font-bold text-blue-600 dark:text-blue-500">Billable</th>
                <th className="py-4 px-6 font-bold">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-sm">
              {stats.map((emp) => (
                <tr key={emp.id} className="hover:bg-app-bg/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-app-text">{emp.name}</div>
                    <div className="text-xs text-app-text-muted">{emp.department} • {emp.type}</div>
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-app-text">
                    {emp.totalWorkedHours} <span className="text-app-text-muted font-sans font-normal text-xs">hrs</span>
                  </td>
                  <td className="py-4 px-6 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {emp.productiveHours} <span className="text-app-text-muted font-sans text-xs">hrs</span>
                  </td>
                  <td className="py-4 px-6 font-mono text-orange-600 dark:text-orange-400 font-semibold">
                    {emp.nonProductiveHours} <span className="text-app-text-muted font-sans text-xs">hrs</span>
                  </td>
                  <td className="py-4 px-6 font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    {emp.billableHours} <span className="text-app-text-muted font-sans text-xs">hrs</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-app-border rounded-full h-2 max-w-[100px]">
                        <div 
                          className={`h-2 rounded-full ${emp.utilizationPercentage >= 70 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min(emp.utilizationPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <span className="font-mono text-xs font-bold w-10 text-right text-app-text">{emp.utilizationPercentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {stats.length === 0 && !isLoading && (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-app-text-muted">
                    <Users size={48} className="mx-auto text-app-text-muted/30 mb-4" />
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
