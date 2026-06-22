import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Clock, ShieldAlert } from 'lucide-react';
import employeeAvatar from '../../assets/employee_3d_avatar.png';

import RealTimeTimer from '../components/RealTimeTimer';

const ESSDashboard = () => {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Advanced Timesheet State
  const [dashboardStats, setDashboardStats] = useState(null);
  const [workLogs, setWorkLogs] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const LOGS_PER_PAGE = 10;

  // Bank profile form state
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/employees/ess/profile');
      if (res.data.success) {
        setEmployee(res.data.employee);
        const bank = res.data.employee.bankDetails || {};
        setBankName(bank.bankName || '');
        setAccountName(bank.accountName || '');
        setAccountNumber(bank.accountNumber || '');
        setIfscCode(bank.ifscCode || '');
      }
    } catch {
      toast.error('Failed to load employee self-service data.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStatsAndLogs = async (dateParam, pageParam) => {
    // Prevent event objects or activeTimer objects from overriding the date string
    const targetDate = typeof dateParam === 'string' ? dateParam : selectedDate;
    const targetPage = typeof pageParam === 'number' ? pageParam : logsPage;
    
    try {
      const statsRes = await api.get(`/employees/ess/dashboard-stats?date=${targetDate}`);
      if (statsRes.data.success) {
        setDashboardStats(statsRes.data.stats);
        setActiveTimer(statsRes.data.activeTimer);
      }

      if (activeTab === 'timesheet') {
        const logsRes = await api.get(`/employees/ess/worklogs?limit=${LOGS_PER_PAGE}&page=${targetPage}&date=${targetDate}`);
        if (logsRes.data.success) {
          setWorkLogs(logsRes.data.logs);
          setLogsTotalPages(logsRes.data.pagination?.pages || 1);
          setLogsTotal(logsRes.data.pagination?.total || 0);
        }
      }
    } catch (error) {
      console.error('Failed to load timer stats:', error);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setLogsPage(1);
    fetchStatsAndLogs(newDate, 1);
  };

  const handleLogsPageChange = (newPage) => {
    setLogsPage(newPage);
    fetchStatsAndLogs(selectedDate, newPage);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => {
    fetchProfile();
    fetchStatsAndLogs();
  }, [activeTab]);

  // (duplicate function removed)

  const handleUpdateBank = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/employees/ess/profile', {
        bankDetails: { bankName, accountName, accountNumber, ifscCode }
      });
      if (res.data.success) {
        toast.success('Bank details updated successfully!');
        fetchProfile();
      }
    } catch {
      toast.error('Failed to update bank details.');
    }
  };

  const handleClockInOut = async () => {
    try {
      const res = await api.post('/employees/ess/attendance/clock');
      if (res.data.success) {
        toast.success(res.data.message);
        fetchProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Attendance request failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 bg-[#0d0d0f] min-h-screen text-white">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-20 bg-[#0d0d0f] min-h-screen text-white flex flex-col justify-center items-center gap-4">
        <ShieldAlert size={48} className="text-orange-500" />
        <h2 className="text-xl font-bold">No Employee Link Found</h2>
        <p className="text-gray-400">Please contact HR to map your login account to your operational employee ID.</p>
      </div>
    );
  }

  // Calculate stats
  const totalTasks = employee.tasks?.length || 0;
  const pendingTasks = employee.tasks?.filter(t => t.status !== 'Completed').length || 0;
  const achievedGoals = employee.performance?.filter(g => g.status === 'Achieved').length || 0;
  const totalGoals = employee.performance?.length || 0;
  
  // Is clocked in today?
  const todayStr = new Date().toDateString();
  const todayLog = employee.attendance?.find(a => new Date(a.date).toDateString() === todayStr);
  const isClockedIn = todayLog && !todayLog.clockOut;
  const isClockedOut = todayLog && todayLog.clockOut;

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white p-2 sm:p-6 space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#FF6B00] to-[#E8470A] p-5 sm:p-6 rounded-2xl border-none shadow-lg mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        
        <div className="relative z-10 max-w-lg space-y-1.5">
          <p className="text-white/90 text-xs font-medium tracking-wide">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
            Welcome back, {employee.firstName}!
          </h1>
          <p className="text-white/90 text-xs sm:text-sm font-medium">
            Always stay updated in your employee portal
          </p>
          
          <div className="pt-3">
            <button
              onClick={handleClockInOut}
              disabled={isClockedOut}
              className={`px-5 py-2 rounded-full font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 ${
                isClockedOut
                  ? 'bg-white/20 text-white/50 cursor-not-allowed border border-white/10'
                  : isClockedIn
                  ? 'bg-white text-rose-600 hover:bg-rose-50'
                  : 'bg-white text-[#FF6B00] hover:bg-orange-50'
              }`}
            >
              <Clock size={16} />
              {isClockedOut ? 'Clocked Out Today' : isClockedIn ? 'Clock Out Now' : 'Clock In Now'}
            </button>
          </div>
        </div>

        {/* 3D Illustration */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 md:w-1/3 lg:w-1/4 hidden sm:flex justify-end items-end pointer-events-none">
          <img 
            src={employeeAvatar} 
            alt="Welcome Character" 
            className="object-contain h-[120%] max-h-[160px] object-right-bottom mix-blend-luminosity opacity-90"
            style={{ filter: 'drop-shadow(-5px 5px 10px rgba(0,0,0,0.2))' }}
          />
        </div>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        
        {/* DASHBOARD PANEL */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#141416] p-5 rounded-xl border border-white/5 space-y-1">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Pending Tasks</div>
                  <div className="text-3xl font-extrabold text-white">{pendingTasks} / {totalTasks}</div>
                </div>
                <div className="bg-[#141416] p-5 rounded-xl border border-white/5 space-y-1">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Performance Goals</div>
                  <div className="text-3xl font-extrabold text-white">{achievedGoals} / {totalGoals}</div>
                </div>
                <div className="bg-[#141416] p-5 rounded-xl border border-white/5 space-y-1">
                  <div className="text-gray-400 text-xs uppercase tracking-wider">Latest Attendance Status</div>
                  <div className="text-lg font-bold text-orange-500 mt-1">
                    {todayLog ? `${todayLog.status} (${todayLog.clockIn} - ${todayLog.clockOut || 'Now'})` : 'Not Logged Today'}
                  </div>
                </div>
              </div>

              {/* Tasks overview */}
              <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-4">
                <h3 className="text-lg font-bold">Assigned Tasks Summary</h3>
                <div className="divide-y divide-white/5">
                  {employee.tasks?.slice(0, 3).map(task => (
                    <div key={task._id} className="py-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm">{task.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        task.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                  {(!employee.tasks || employee.tasks.length === 0) && (
                    <div className="text-center py-4 text-gray-500 text-sm">No tasks assigned to you currently.</div>
                  )}
                </div>
              </div>

            </div>

            {/* Sidebar Cards */}
            <div className="space-y-6">
              {/* Profile Overview */}
              <div className="bg-[#141416] p-6 rounded-xl border border-white/5 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-orange-600/10 text-orange-500 flex items-center justify-center font-bold text-xl mx-auto border border-orange-500/15">
                  {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{employee.firstName} {employee.lastName}</h3>
                  <p className="text-xs text-gray-400">{employee.email}</p>
                </div>
                <div className="text-xs text-left bg-white/[0.02] p-3 rounded-lg border border-white/5 space-y-2 text-gray-300">
                  <div className="flex justify-between"><span>Joining Date:</span><span>{new Date(employee.joinDate).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span>Department/Role:</span><span>{employee.roleDept}</span></div>
                  <div className="flex justify-between"><span>Employment Status:</span><span>Active</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MY PROFILE PANEL */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#141416] p-6 rounded-xl border border-white/5 space-y-6">
              <h2 className="text-xl font-bold">Personal & Operational Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <div className="text-gray-400 text-xs">First Name</div>
                  <div className="font-bold text-white mt-1">{employee.firstName}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Last Name</div>
                  <div className="font-bold text-white mt-1">{employee.lastName}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Registered Email</div>
                  <div className="font-bold text-white mt-1">{employee.email}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Joining Date</div>
                  <div className="font-bold text-white mt-1">{new Date(employee.joinDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">PAN Document (Hashed Vault)</div>
                  <div className="font-mono text-orange-500 mt-1">{employee.panNumber || 'VAULT-SECURE'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Aadhaar Document (Hashed Vault)</div>
                  <div className="font-mono text-orange-500 mt-1">{employee.aadhaarNumber || 'VAULT-SECURE'}</div>
                </div>
              </div>
            </div>

            {/* Bank details update */}
            <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-4">
              <h2 className="text-xl font-bold">Bank Details Setup</h2>
              <form onSubmit={handleUpdateBank} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                    placeholder="Rahul Kumar"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Bank Name</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                    placeholder="HDFC Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Account Number</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                    placeholder="5010029384729"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                    placeholder="HDFC0000123"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Save Bank Details
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ATTENDANCE & LEAVE PANEL */}
        {activeTab === 'attendance' && (
          <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h2 className="text-xl font-bold">Attendance Log</h2>
              <div className="text-sm text-gray-400">Total days present: {employee.attendance?.length || 0}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-gray-400 uppercase">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Clock In</th>
                    <th className="py-3 px-4">Clock Out</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {employee.attendance?.map((log, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-4">{new Date(log.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-mono text-gray-300">{log.clockIn || '--'}</td>
                      <td className="py-3 px-4 font-mono text-gray-300">{log.clockOut || '--'}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-xs">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!employee.attendance || employee.attendance.length === 0) && (
                    <tr>
                      <td colSpan="4" className="text-center py-6 text-gray-500">No attendance entries recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MY TASKS PANEL */}
        {activeTab === 'tasks' && (
          <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-6">
            <h2 className="text-xl font-bold">Assigned Projects & Tasks</h2>
            <div className="divide-y divide-white/5">
              {employee.tasks?.map((task) => (
                <div key={task._id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-white text-base">{task.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">{task.description}</p>
                    <div className="text-xs text-orange-500 font-mono mt-1">Deadline: {new Date(task.dueDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded text-xs uppercase font-bold tracking-wider ${
                      task.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
              {(!employee.tasks || employee.tasks.length === 0) && (
                <div className="text-center py-10 text-gray-500">No tasks assigned yet.</div>
              )}
            </div>
          </div>
        )}

        {/* TIMESHEET PANEL */}
        {activeTab === 'timesheet' && (
          <div className="space-y-6">

            {/* Date Picker Header */}
            <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Viewing Productivity For</div>
                <div className="text-white font-bold text-lg">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    const prev = d.toISOString().split('T')[0];
                    setSelectedDate(prev);
                    fetchStatsAndLogs(prev);
                  }}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors cursor-pointer border border-white/10"
                >← Prev</button>
                <input
                  type="date"
                  value={selectedDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={handleDateChange}
                  className="bg-[#1e1e21] border border-white/10 text-white text-sm rounded-lg px-3 py-2 cursor-pointer"
                />
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    if (selectedDate < today) {
                      const d = new Date(selectedDate);
                      d.setDate(d.getDate() + 1);
                      const next = d.toISOString().split('T')[0];
                      setSelectedDate(next);
                      fetchStatsAndLogs(next);
                    }
                  }}
                  disabled={selectedDate >= new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors cursor-pointer border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >Next →</button>
              </div>
            </div>

            {/* Daily Dashboard Stats */}
            {dashboardStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#141416] p-4 rounded-xl border border-white/5">
                  <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Worked</div>
                  <div className="text-2xl font-bold text-white font-mono">{dashboardStats.totalWorkedHours} <span className="text-sm text-gray-500">hrs</span></div>
                </div>
                <div className="bg-[#141416] p-4 rounded-xl border border-white/5">
                  <div className="text-emerald-500 text-xs uppercase tracking-wider mb-1">Productive</div>
                  <div className="text-2xl font-bold text-white font-mono">{dashboardStats.productiveHours} <span className="text-sm text-gray-500">hrs</span></div>
                </div>
                <div className="bg-[#141416] p-4 rounded-xl border border-white/5">
                  <div className="text-orange-500 text-xs uppercase tracking-wider mb-1">Non-Productive</div>
                  <div className="text-2xl font-bold text-white font-mono">{dashboardStats.nonProductiveHours} <span className="text-sm text-gray-500">hrs</span></div>
                </div>
                <div className="bg-[#141416] p-4 rounded-xl border border-white/5">
                  <div className="text-blue-500 text-xs uppercase tracking-wider mb-1">Productivity %</div>
                  <div className="text-2xl font-bold text-white font-mono">{dashboardStats.productivityPercentage}%</div>
                </div>
              </div>
            )}

            <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-6">
              <h2 className="text-xl font-bold">Activity Timeline (Logs)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-xs text-gray-400 uppercase">
                      <th className="py-3 px-4 w-10">#</th>
                      <th className="py-3 px-4">Start Time</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Project / Task</th>
                      <th className="py-3 px-4">Activity</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {workLogs.map((log, idx) => (
                      <tr key={log._id} className="hover:bg-white/[0.01]">
                        <td className="py-3 px-4 text-gray-600 text-xs font-mono">
                          {(logsPage - 1) * LOGS_PER_PAGE + idx + 1}
                        </td>
                        <td className="py-3 px-4 text-gray-300 font-mono">
                          {new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {Math.floor(log.duration / 60)}h {log.duration % 60}m
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{log.task}</div>
                          <div className="text-xs text-gray-500">{log.project}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          <span className="px-2 py-1 bg-white/5 rounded text-xs">{log.activityType}</span>
                        </td>
                        <td className="py-3 px-4">
                          {log.isProductive ? (
                            <span className="text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded">PRODUCTIVE</span>
                          ) : (
                            <span className="text-orange-500 text-xs font-bold bg-orange-500/10 px-2 py-1 rounded">NON-PRODUCTIVE</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!workLogs || workLogs.length === 0) && (
                      <tr>
                        <td colSpan="6" className="text-center py-10 text-gray-500">No work logged for this date.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {logsTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-white/5 gap-3">
                  <div className="text-xs text-gray-500">
                    Showing <span className="text-white font-bold">{(logsPage - 1) * LOGS_PER_PAGE + 1}–{Math.min(logsPage * LOGS_PER_PAGE, logsTotal)}</span> of <span className="text-white font-bold">{logsTotal}</span> entries
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleLogsPageChange(logsPage - 1)}
                      disabled={logsPage === 1}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >← Prev</button>

                    {Array.from({ length: logsTotalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === logsTotalPages || Math.abs(p - logsPage) <= 1)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && arr[idx - 1] !== p - 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '...' ? (
                          <span key={`dots-${i}`} className="px-2 text-gray-600 text-xs">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => handleLogsPageChange(p)}
                            className={`w-8 h-8 text-xs rounded-lg border transition-colors cursor-pointer ${
                              logsPage === p
                                ? 'bg-orange-600 border-orange-500 text-white font-bold'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                            }`}
                          >{p}</button>
                        )
                      )
                    }

                    <button
                      onClick={() => handleLogsPageChange(logsPage + 1)}
                      disabled={logsPage === logsTotalPages}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >Next →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MY PAYSLIPS PANEL */}
        {activeTab === 'payslips' && (
          <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-6">
            <h2 className="text-xl font-bold">Earnings & Payslips</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-gray-400 uppercase">
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Basic Salary</th>
                    <th className="py-3 px-4">Allowance</th>
                    <th className="py-3 px-4">Deductions</th>
                    <th className="py-3 px-4">Net Payout</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {employee.payslips?.map((slip, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-4 font-bold text-white">{slip.month} {slip.year}</td>
                      <td className="py-3 px-4 text-gray-300">₹{slip.baseSalary.toLocaleString()}</td>
                      <td className="py-3 px-4 text-emerald-400">+₹{slip.allowance.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <div className="text-rose-400">-₹{slip.deduction.toLocaleString()}</div>
                        {slip.deduction > 0 && slip.deductionReason && (
                          <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{slip.deductionReason}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-orange-500">₹{slip.netPay.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-xs">
                          {slip.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!employee.payslips || employee.payslips.length === 0) && (
                    <tr>
                      <td colSpan="6" className="text-center py-6 text-gray-500">No payslips issued yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MY PERFORMANCE PANEL */}
        {activeTab === 'performance' && (
          <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-6">
            <h2 className="text-xl font-bold">Personal & Performance Goals</h2>
            <div className="divide-y divide-white/5">
              {employee.performance?.map((goal, idx) => (
                <div key={idx} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-white text-base">{goal.goal}</h3>
                    <div className="text-xs text-orange-500 font-mono mt-1">Target Date: {new Date(goal.targetDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded text-xs uppercase font-bold tracking-wider ${
                      goal.status === 'Achieved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'
                    }`}>
                      {goal.status}
                    </span>
                  </div>
                </div>
              ))}
              {(!employee.performance || employee.performance.length === 0) && (
                <div className="text-center py-10 text-gray-500">No goals assigned for this cycle.</div>
              )}
            </div>
          </div>
        )}

      </div>

      <RealTimeTimer 
        activeTimer={activeTimer} 
        tasks={employee?.tasks || []}
        onTimerStart={fetchStatsAndLogs} 
        onTimerStop={fetchStatsAndLogs} 
      />
    </div>
  );
};

export default ESSDashboard;
