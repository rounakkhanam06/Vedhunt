import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Clock, ShieldAlert, Trophy, Star, Target, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import employeeAvatar from '../../assets/033a13e9af4efbb035a04c3777c4934d-removebg-preview.png';

import RealTimeTimer from '../components/RealTimeTimer';

const StarRating = ({ value }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={12} className={i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
    ))}
  </div>
);

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

  // Leave Request State
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({ CL: 0, SL: 0, PL: 0 });
  const [leavesUsed, setLeavesUsed] = useState({ CL: 0, SL: 0, PL: 0 });
  const [leaveBalancePeriod, setLeaveBalancePeriod] = useState('Year');
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Lock background scroll when leave modal is open
  useEffect(() => {
    if (showLeaveModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showLeaveModal]);
  const [leaveType, setLeaveType] = useState('PL');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // Bank profile form state
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankErrors, setBankErrors] = useState({});

  // Performance State
  const [activeCycle, setActiveCycle] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [kpiTargets, setKpiTargets] = useState([]);
  const [performanceHistory, setPerformanceHistory] = useState([]);
  const [selfReviewForm, setSelfReviewForm] = useState({
    achievements: '', challenges: '', learning: '', supportNeeded: '', selfRating: 0
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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

  const fetchLeaveRequests = async () => {
    try {
      const res = await api.get('/employees/ess/leave-requests');
      if (res.data.success) {
        setLeaveRequests(res.data.leaveRequests);
        setLeaveBalances(res.data.leaveBalances || { CL: 0, SL: 0, PL: 0 });
        setLeavesUsed(res.data.leavesUsed || { CL: 0, SL: 0, PL: 0 });
        setLeaveBalancePeriod(res.data.leaveBalancePeriod || 'Year');
      }
    } catch (error) {
      console.error('Failed to load leave requests:', error);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const activeRes = await api.get('/performance/active-cycle');
      if (activeRes.data.success && activeRes.data.cycle) {
        setActiveCycle(activeRes.data.cycle);
        const scRes = await api.get(`/performance/scorecard/me/${activeRes.data.cycle._id}`);
        if (scRes.data.success) {
          setScorecard(scRes.data.review);
          setKpiTargets(scRes.data.targets || []);
        }
      }
      const histRes = await api.get('/performance/history/me');
      if (histRes.data.success) {
        setPerformanceHistory(histRes.data.history || []);
      }
    } catch (err) {
      console.error('Failed to load performance data', err);
    }
  };

  const handleSelfReviewSubmit = async (e) => {
    e.preventDefault();
    if (selfReviewForm.selfRating < 1) { toast.error('Please select a rating (1-5 stars)'); return; }
    setIsSubmittingReview(true);
    try {
      const res = await api.post('/performance/review/self', {
        cycleId: activeCycle._id,
        ...selfReviewForm
      });
      if (res.data.success) {
        toast.success('Self-review submitted successfully!');
        setScorecard(res.data.review);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
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
    if (activeTab === 'attendance') {
      fetchLeaveRequests();
    }
    if (activeTab === 'performance') {
      fetchPerformanceData();
    }
  }, [activeTab]);

  // (duplicate function removed)

  const handleUpdateBank = async (e) => {
    e.preventDefault();
    setBankErrors({});
    
    const errors = {};
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(accountName)) errors.accountName = 'Must contain only letters and spaces.';
    if (!nameRegex.test(bankName)) errors.bankName = 'Must contain only letters and spaces.';
    
    const numberRegex = /^\d+$/;
    if (!numberRegex.test(accountNumber)) errors.accountNumber = 'Must contain only numbers.';
    
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode)) errors.ifscCode = 'Invalid IFSC Code format. Expected e.g. HDFC0000123';

    if (Object.keys(errors).length > 0) {
      setBankErrors(errors);
      return;
    }

    try {
      const res = await api.put('/employees/ess/profile', {
        bankDetails: { bankName, accountName, accountNumber, ifscCode }
      });
      if (res.data.success) {
        toast.success('Bank details updated successfully!');
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update bank details.');
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

  const handleRequestLeave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/employees/ess/leave-requests', {
        leaveType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setShowLeaveModal(false);
        setLeaveStartDate('');
        setLeaveEndDate('');
        setLeaveReason('');
        fetchLeaveRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit leave request.');
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
      <div className="relative overflow-hidden bg-gradient-to-r from-[#FF8533] to-[#FF6B00] p-5 sm:p-6 rounded-2xl border-none shadow-lg mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        
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
                  : 'bg-white text-[#FF8533] hover:bg-orange-50'
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
                    {todayLog ? (
                      <div className="flex flex-col gap-1 items-start">
                        <span>{todayLog.status} ({todayLog.clockIn} - {todayLog.clockOut || 'Now'})</span>
                        {todayLog.lateByMins > 0 && (
                          <span className="text-[10px] font-bold bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded tracking-wider">
                            LATE BY {todayLog.lateByMins} MINS
                          </span>
                        )}
                      </div>
                    ) : 'Not Logged Today'}
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
                  <div className="text-gray-400 text-xs">PAN Document</div>
                  <div className="font-mono text-orange-500 mt-1">{employee.panNumber || 'VAULT-SECURE'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Aadhaar Document</div>
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
                    className={`w-full text-sm rounded-lg border ${bankErrors.accountName ? 'border-rose-500' : 'border-white/10'} bg-[#1e1e21] px-4 py-2 text-white`}
                    placeholder="Rahul Kumar"
                    value={accountName}
                    onChange={(e) => {
                      setAccountName(e.target.value);
                      if (bankErrors.accountName) setBankErrors(prev => ({ ...prev, accountName: '' }));
                    }}
                  />
                  {bankErrors.accountName && <p className="text-rose-500 text-xs mt-1">{bankErrors.accountName}</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Bank Name</label>
                  <input
                    type="text"
                    required
                    className={`w-full text-sm rounded-lg border ${bankErrors.bankName ? 'border-rose-500' : 'border-white/10'} bg-[#1e1e21] px-4 py-2 text-white`}
                    placeholder="HDFC Bank"
                    value={bankName}
                    onChange={(e) => {
                      setBankName(e.target.value);
                      if (bankErrors.bankName) setBankErrors(prev => ({ ...prev, bankName: '' }));
                    }}
                  />
                  {bankErrors.bankName && <p className="text-rose-500 text-xs mt-1">{bankErrors.bankName}</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Account Number</label>
                  <input
                    type="text"
                    required
                    className={`w-full text-sm rounded-lg border ${bankErrors.accountNumber ? 'border-rose-500' : 'border-white/10'} bg-[#1e1e21] px-4 py-2 text-white`}
                    placeholder="5010029384729"
                    value={accountNumber}
                    onChange={(e) => {
                      setAccountNumber(e.target.value);
                      if (bankErrors.accountNumber) setBankErrors(prev => ({ ...prev, accountNumber: '' }));
                    }}
                  />
                  {bankErrors.accountNumber && <p className="text-rose-500 text-xs mt-1">{bankErrors.accountNumber}</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    required
                    className={`w-full text-sm rounded-lg border ${bankErrors.ifscCode ? 'border-rose-500' : 'border-white/10'} bg-[#1e1e21] px-4 py-2 text-white uppercase`}
                    placeholder="HDFC0000123"
                    value={ifscCode}
                    onChange={(e) => {
                      setIfscCode(e.target.value.toUpperCase());
                      if (bankErrors.ifscCode) setBankErrors(prev => ({ ...prev, ifscCode: '' }));
                    }}
                  />
                  {bankErrors.ifscCode && <p className="text-rose-500 text-xs mt-1">{bankErrors.ifscCode}</p>}
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
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-300">Leave Balances (Per {leaveBalancePeriod})</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex flex-col justify-between items-center text-center">
                <div className="text-gray-400 text-xs font-bold uppercase">Casual Leave (CL)</div>
                <div className="text-2xl font-black text-orange-500 font-mono mt-2">
                  {(leaveBalances.CL || 0) - (leavesUsed.CL || 0)} <span className="text-sm text-gray-400 font-normal">/ {leaveBalances.CL || 0}</span>
                </div>
              </div>
              <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex flex-col justify-between items-center text-center">
                <div className="text-gray-400 text-xs font-bold uppercase">Sick Leave (SL)</div>
                <div className="text-2xl font-black text-orange-500 font-mono mt-2">
                  {(leaveBalances.SL || 0) - (leavesUsed.SL || 0)} <span className="text-sm text-gray-400 font-normal">/ {leaveBalances.SL || 0}</span>
                </div>
              </div>
              <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex flex-col justify-between items-center text-center">
                <div className="text-gray-400 text-xs font-bold uppercase">Paid Leave (PL)</div>
                <div className="text-2xl font-black text-orange-500 font-mono mt-2">
                  {(leaveBalances.PL || 0) - (leavesUsed.PL || 0)} <span className="text-sm text-gray-400 font-normal">/ {leaveBalances.PL || 0}</span>
                </div>
              </div>
              <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex items-center justify-center">
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold transition-all cursor-pointer shadow-lg"
                >
                  Request Leave
                </button>
              </div>
            </div>

            <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold">My Leave Requests</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-xs text-gray-400 uppercase">
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Start Date</th>
                      <th className="py-3 px-4">End Date</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Vedhunt Comment</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {leaveRequests.map((req, idx) => (
                      <tr key={req._id || idx} className="hover:bg-white/[0.01]">
                        <td className="py-3 px-4 font-bold">{req.leaveType || 'PL'}</td>
                        <td className="py-3 px-4 font-mono">{new Date(req.startDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-mono">{new Date(req.endDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4 max-w-[200px] truncate" title={req.reason}>{req.reason}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs italic max-w-[200px] truncate">{req.adminComment || '--'}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                            req.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400' :
                            'bg-orange-500/10 text-orange-400'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {leaveRequests.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-6 text-gray-500">No leave requests submitted yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#141416] p-6 rounded-xl border border-white/5 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold">Attendance Log</h2>
                <div className="text-sm text-gray-400">Total days present: {employee.attendance?.filter(a => a.status === 'Present').length || 0}</div>
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
                        <td className="py-3 px-4 font-mono text-gray-300">
                          {log.clockIn || '--'}
                          {log.lateByMins > 0 && (
                            <span className="ml-2 text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider inline-flex items-center gap-1 border border-rose-500/20">
                              Late by {log.lateByMins} mins
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-300">{log.clockOut || '--'}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            log.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400' :
                            log.status === 'Leave' ? 'bg-blue-500/10 text-blue-400' :
                            log.status === 'Weekend' ? 'bg-purple-500/10 text-purple-400' :
                            'bg-rose-500/10 text-rose-400'
                          }`}>
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

            {/* Leave Request Modal */}
            {showLeaveModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-[#141416] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                  <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h2 className="text-lg font-bold">Submit Leave Request</h2>
                    <button onClick={() => setShowLeaveModal(false)} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
                  </div>
                  <form onSubmit={handleRequestLeave} className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Leave Type</label>
                      <select
                        value={leaveType}
                        onChange={(e) => setLeaveType(e.target.value)}
                        className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white outline-none focus:border-orange-500"
                      >
                        <option value="CL">Casual Leave (CL)</option>
                        <option value="SL">Sick Leave (SL)</option>
                        <option value="PL">Paid Leave (PL)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                        <input
                          type="date"
                          required
                          min={new Date().toISOString().split('T')[0]}
                          value={leaveStartDate}
                          onChange={(e) => setLeaveStartDate(e.target.value)}
                          className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">End Date</label>
                        <input
                          type="date"
                          required
                          min={leaveStartDate || new Date().toISOString().split('T')[0]}
                          value={leaveEndDate}
                          onChange={(e) => setLeaveEndDate(e.target.value)}
                          className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Reason for Leave</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Please provide a brief reason..."
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white resize-none"
                      />
                    </div>
                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold transition-all cursor-pointer"
                      >
                        Submit Request
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="text-orange-500" />
              My Performance Scorecard
            </h2>

            {/* Top Stats & Active Cycle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-[#141416] p-6 rounded-xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-1">Current Cycle</h3>
                <div className="text-2xl font-black text-white mb-4">
                  {activeCycle ? activeCycle.title : 'No Active Cycle'}
                </div>
                {activeCycle ? (
                  <div className="flex gap-6 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Start Date</div>
                      <div className="font-bold text-gray-300">{new Date(activeCycle.startDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">End Date</div>
                      <div className="font-bold text-gray-300">{new Date(activeCycle.endDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Status</div>
                      <div className="font-bold text-emerald-400">Active</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Wait for your manager to activate a new review cycle.</div>
                )}
              </div>

              {scorecard && (
                <div className="bg-[#141416] p-6 rounded-xl border border-white/5 flex flex-col justify-center items-center text-center relative overflow-hidden">
                  {scorecard.isTopPerformer && (
                    <div className="absolute top-3 right-3 text-yellow-400 animate-pulse" title="Top Performer!">
                      <Trophy size={20} />
                    </div>
                  )}
                  <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Final Weighted Score</h3>
                  <div className={`text-5xl font-black mb-2 ${scorecard.finalScore >= 100 ? 'text-yellow-400' : scorecard.finalScore >= 75 ? 'text-emerald-400' : scorecard.finalScore >= 60 ? 'text-blue-400' : 'text-orange-400'}`}>
                    {scorecard.finalScore.toFixed(1)}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${scorecard.finalScore >= 100 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' : scorecard.finalScore >= 75 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : scorecard.finalScore >= 60 ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : scorecard.finalScore >= 40 ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                    {scorecard.performanceBand}
                  </div>
                  {scorecard.companyRank && (
                    <div className="mt-3 text-xs text-gray-400">Company Rank: <span className="font-bold text-white">#{scorecard.companyRank}</span></div>
                  )}
                </div>
              )}
            </div>

            {/* KPI Gauges */}
            {kpiTargets.length > 0 && (
              <div className="bg-[#141416] p-6 rounded-xl border border-white/5">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Target className="text-orange-500" size={20} /> KPI Targets & Progress</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kpiTargets.map(t => (
                    <div key={t._id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-bold text-gray-300">{t.metricType}</div>
                        <div className="text-xs text-gray-500 px-2 py-0.5 bg-white/5 rounded font-bold">wt: {t.weightage}%</div>
                      </div>
                      
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <div className="text-xs text-gray-500">Target: <span className="text-white font-bold">{t.targetValue.toLocaleString()} {t.unit}</span></div>
                          <div className="text-xs text-gray-500">Actual: <span className={`font-bold ${t.actualValue >= t.targetValue ? 'text-emerald-400' : 'text-orange-400'}`}>{t.actualValue.toLocaleString()} {t.unit}</span></div>
                        </div>
                        <div className={`text-2xl font-black ${t.achievementPct >= 100 ? 'text-emerald-400' : t.achievementPct >= 60 ? 'text-orange-400' : 'text-rose-400'}`}>
                          {t.achievementPct}%
                        </div>
                      </div>
                      
                      <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                        <div
                          className={`h-1.5 rounded-full ${t.achievementPct >= 100 ? 'bg-emerald-500' : t.achievementPct >= 60 ? 'bg-orange-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(t.achievementPct, 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-600 mt-2 text-right">
                        Last updated: {t.lastSyncedAt ? new Date(t.lastSyncedAt).toLocaleString() : 'Never'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            {activeCycle && scorecard && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Self Review Form/View */}
                <div className="bg-[#141416] p-6 rounded-xl border border-white/5">
                  <h3 className="text-lg font-bold mb-4 text-white">Self Review</h3>
                  {scorecard.selfReview?.isSubmitted ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm text-gray-400">Your Rating:</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={16} className={i <= scorecard.selfReview.selfRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                          ))}
                        </div>
                        <span className="ml-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded uppercase font-bold tracking-wider">Submitted</span>
                      </div>
                      
                      <div className="space-y-3 text-sm">
                        {scorecard.selfReview.achievements && <div><span className="text-gray-500 block text-xs uppercase mb-0.5">Achievements</span><div className="text-gray-300 bg-white/[0.02] p-3 rounded-lg">{scorecard.selfReview.achievements}</div></div>}
                        {scorecard.selfReview.challenges && <div><span className="text-gray-500 block text-xs uppercase mb-0.5">Challenges</span><div className="text-gray-300 bg-white/[0.02] p-3 rounded-lg">{scorecard.selfReview.challenges}</div></div>}
                        {scorecard.selfReview.learning && <div><span className="text-gray-500 block text-xs uppercase mb-0.5">Learning</span><div className="text-gray-300 bg-white/[0.02] p-3 rounded-lg">{scorecard.selfReview.learning}</div></div>}
                        {scorecard.selfReview.supportNeeded && <div><span className="text-gray-500 block text-xs uppercase mb-0.5">Support Needed</span><div className="text-gray-300 bg-white/[0.02] p-3 rounded-lg">{scorecard.selfReview.supportNeeded}</div></div>}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSelfReviewSubmit} className="space-y-4">
                      <div className="text-sm text-gray-400 mb-4 bg-orange-500/5 border border-orange-500/10 p-3 rounded-lg">
                        Submit your self-review for the current cycle. Once submitted, it cannot be edited.
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Your Self Rating (1-5 Stars) <span className="text-orange-500">*</span></label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              type="button"
                              key={n}
                              onClick={() => setSelfReviewForm(f => ({ ...f, selfRating: n }))}
                              className="cursor-pointer transition-transform hover:scale-110"
                            >
                              <Star size={24} className={n <= selfReviewForm.selfRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 hover:text-gray-400'} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Key Achievements</label>
                        <textarea rows={2} className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500" value={selfReviewForm.achievements} onChange={e => setSelfReviewForm(f => ({ ...f, achievements: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Challenges Faced</label>
                        <textarea rows={2} className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500" value={selfReviewForm.challenges} onChange={e => setSelfReviewForm(f => ({ ...f, challenges: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">What did you learn?</label>
                        <textarea rows={2} className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500" value={selfReviewForm.learning} onChange={e => setSelfReviewForm(f => ({ ...f, learning: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Support Needed from Manager</label>
                        <textarea rows={2} className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500" value={selfReviewForm.supportNeeded} onChange={e => setSelfReviewForm(f => ({ ...f, supportNeeded: e.target.value }))} />
                      </div>
                      <button type="submit" disabled={isSubmittingReview || selfReviewForm.selfRating < 1} className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold transition-all cursor-pointer disabled:opacity-50 mt-2">
                        {isSubmittingReview ? 'Submitting...' : 'Submit Self Review'}
                      </button>
                    </form>
                  )}
                </div>

                {/* Manager Review Display */}
                <div className="bg-[#141416] p-6 rounded-xl border border-white/5 flex flex-col">
                  <h3 className="text-lg font-bold mb-4 text-white">Manager Review</h3>
                  {scorecard.managerReview?.isSubmitted ? (
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm text-gray-400">Manager Rating:</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={16} className={i <= scorecard.managerReview.managerRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                          ))}
                        </div>
                        <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded uppercase font-bold tracking-wider">Reviewed</span>
                      </div>
                      
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl text-sm text-emerald-100 flex-1">
                        <div className="font-bold text-emerald-400 text-xs uppercase mb-2">Feedback & Comments</div>
                        {scorecard.managerReview.managerFeedback}
                      </div>

                      <div className="text-xs text-gray-500 flex items-center justify-between border-t border-white/5 pt-4 mt-4">
                        <span>Reviewed by: <span className="text-gray-300 font-bold">{scorecard.managerReview.reviewedBy?.firstName} {scorecard.managerReview.reviewedBy?.lastName}</span></span>
                        <span>{new Date(scorecard.managerReview.reviewDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 space-y-3 py-10">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <Clock size={20} className="text-gray-400" />
                      </div>
                      <p className="text-sm">Manager review is pending.</p>
                      <p className="text-xs text-gray-600">Your manager will provide feedback and a final rating after the cycle ends.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Performance History */}
            {performanceHistory.length > 0 && (
              <div className="bg-[#141416] p-6 rounded-xl border border-white/5">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><TrendingUp className="text-orange-500" size={20} /> Past Performance History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-xs text-gray-400 uppercase">
                        <th className="py-3 px-4">Cycle</th>
                        <th className="py-3 px-4">Final Score</th>
                        <th className="py-3 px-4">Band</th>
                        <th className="py-3 px-4">Self Rating</th>
                        <th className="py-3 px-4">Mgr Rating</th>
                        <th className="py-3 px-4">Top Performer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {performanceHistory.map(hist => (
                        <tr key={hist._id} className="hover:bg-white/[0.01]">
                          <td className="py-4 px-4 font-bold text-white">{hist.cycleId?.title || 'Unknown Cycle'}</td>
                          <td className="py-4 px-4 font-black text-gray-300">{hist.finalScore}</td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-white/5 border-white/10 text-gray-300">{hist.performanceBand}</span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex"><StarRating value={hist.selfReview?.selfRating || 0} /></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex"><StarRating value={hist.managerReview?.managerRating || 0} /></div>
                          </td>
                          <td className="py-4 px-4">
                            {hist.isTopPerformer && <Trophy size={16} className="text-yellow-400" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Helper Component for Star Rating in History */}
            {false && <StarRating value={0} /> /* keep import active */}
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
