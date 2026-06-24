import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Calendar, UserCheck, UserX, Clock, AlertTriangle, AlertCircle, FileText, List } from 'lucide-react';
import LeaveRequestsManager from './LeaveRequestsManager';

export default function AttendanceManager() {
  const [activeTab, setActiveTab] = useState('roster');
  const [date, setDate] = useState(null); // initialized to today
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    forgotCheckout: 0,
    onLeave: 0
  });

  const fetchRoster = async (selectedDate) => {
    try {
      setLoading(true);
      const res = await api.get(`/employees/admin/attendance/daily?date=${selectedDate}`);
      if (res.data.success) {
        setRoster(res.data.roster);
        
        let present = 0, absent = 0, late = 0, halfDay = 0, forgot = 0, leave = 0;
        res.data.roster.forEach(r => {
          if (r.status === 'Present') present++;
          if (r.status === 'Absent') absent++;
          if (r.status === 'Late') late++;
          if (r.status === 'Half Day') halfDay++;
          if (r.status === 'On Leave') leave++;
          if (['Present', 'Late', 'Half Day'].includes(r.status) && !r.checkOutTime) {
             // check if end of day passed. Just a rough stat
             forgot++;
          }
        });
        
        setStats({ present, absent, late, halfDay, forgotCheckout: forgot, onLeave: leave });
      }
    } catch (error) {
      toast.error('Failed to load attendance roster');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    fetchRoster(today);
  }, []);

  const handleDateChange = (e) => {
    setDate(e.target.value);
    fetchRoster(e.target.value);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present': return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold uppercase tracking-wider">Present</span>;
      case 'Absent': return <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-xs font-bold uppercase tracking-wider">Absent</span>;
      case 'Late': return <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-xs font-bold uppercase tracking-wider">Late</span>;
      case 'Half Day': return <span className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded text-xs font-bold uppercase tracking-wider">Half Day</span>;
      case 'On Leave': return <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-xs font-bold uppercase tracking-wider">On Leave</span>;
      case 'Holiday': return <span className="px-2 py-1 bg-purple-500/10 text-purple-500 rounded text-xs font-bold uppercase tracking-wider">Holiday</span>;
      case 'Weekend': return <span className="px-2 py-1 bg-gray-500/10 text-gray-400 rounded text-xs font-bold uppercase tracking-wider">Weekend</span>;
      default: return <span className="px-2 py-1 bg-gray-500/10 text-gray-400 rounded text-xs font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  if (!date) return null;

  const tabClasses = (tab) => `
    flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all border-b-2 
    ${activeTab === tab 
      ? 'border-[#FF6B00] text-[#FF6B00]' 
      : 'border-transparent text-gray-400 hover:text-white'}
  `;

  return (
    <div className="p-6">
      <div className="flex border-b border-[#2D2D33] mb-8 overflow-x-auto">
        <button className={tabClasses('roster')} onClick={() => setActiveTab('roster')}>
          <Calendar size={18} className="shrink-0" /> <span className="whitespace-nowrap">Daily Roster</span>
        </button>
        <button className={tabClasses('leave')} onClick={() => setActiveTab('leave')}>
          <List size={18} className="shrink-0" /> <span className="whitespace-nowrap">Leave Requests</span>
        </button>
      </div>

      {activeTab === 'roster' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Daily Attendance Roster</h1>
              <p className="text-gray-400 text-sm mt-1">View who is Present, Absent, Late, or on Half Day.</p>
            </div>
            <div className="w-full sm:w-auto">
              <input 
                type="date" 
                value={date} 
                onChange={handleDateChange} 
                className="bg-[#121215] border border-[#2D2D33] rounded-lg px-4 py-2 text-white outline-none w-full sm:w-auto"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <div className="bg-[#121215] border border-[#2D2D33] p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.present}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Present</div>
          </div>
        </div>
        <div className="bg-[#121215] border border-[#2D2D33] p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.late}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Late</div>
          </div>
        </div>
        <div className="bg-[#121215] border border-[#2D2D33] p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.halfDay}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Half Day</div>
          </div>
        </div>
        <div className="bg-[#121215] border border-[#2D2D33] p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <UserX size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.absent}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Absent</div>
          </div>
        </div>
        <div className="bg-[#121215] border border-[#2D2D33] p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.onLeave}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">On Leave</div>
          </div>
        </div>
        <div className="bg-[#121215] border border-[#2D2D33] p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.forgotCheckout}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Forgot Checkout</div>
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-[#121215] border border-[#2D2D33] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading roster...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300 min-w-[800px]">
              <thead className="bg-[#1A1A1E] text-xs uppercase text-gray-400 border-b border-[#2D2D33]">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4">Working Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D2D33]">
                {roster.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No employees found</td>
                  </tr>
                ) : (
                  roster.map(r => (
                    <tr key={r.employeeId} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white whitespace-nowrap">{r.name}</div>
                        <div className="text-xs text-gray-500">{r.email}</div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(r.status)}</td>
                      <td className="px-6 py-4 font-mono whitespace-nowrap">{r.checkInTime || '-'}</td>
                      <td className="px-6 py-4 font-mono whitespace-nowrap">
                        {r.checkOutTime || (!r.checkInTime ? '-' : <span className="text-yellow-500 text-xs">Missing</span>)}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-[#FF6B00] whitespace-nowrap">{r.workingHours || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
      )}

      {activeTab === 'leave' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <LeaveRequestsManager embedded={true} />
        </div>
      )}

    </div>
  );
}
