import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Search, Filter, Calendar, CheckCircle, Clock, AlertCircle, PlayCircle } from 'lucide-react';

export default function AdminTasks() {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [employeeFilter, setEmployeeFilter] = useState('All');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/employees');
      if (res.data.success) {
        setEmployees(res.data.employees);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  // Aggregate all tasks from all employees
  const allTasks = useMemo(() => {
    let tasksList = [];
    employees.forEach(emp => {
      if (emp.tasks && emp.tasks.length > 0) {
        emp.tasks.forEach(task => {
          tasksList.push({
            ...task,
            employeeId: emp._id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            department: emp.roleDept
          });
        });
      }
    });
    // Sort by due date, nearest first
    return tasksList.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
  }, [employees]);

  // Apply Filters
  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      const matchSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          task.employeeName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchStatus = statusFilter === 'All' || task.status === statusFilter;
      const matchEmployee = employeeFilter === 'All' || task.employeeId === employeeFilter;

      return matchSearch && matchStatus && matchEmployee;
    });
  }, [allTasks, searchQuery, statusFilter, employeeFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed': return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded flex items-center gap-1.5"><CheckCircle size={14} /> {status}</span>;
      case 'In Progress': return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded flex items-center gap-1.5"><PlayCircle size={14} /> {status}</span>;
      case 'Pending': return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded flex items-center gap-1.5"><Clock size={14} /> {status}</span>;
      default: return <span className="bg-gray-500/10 text-gray-400 border border-gray-500/20 px-2.5 py-1 rounded flex items-center gap-1.5">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 text-white bg-[#0d0d0f] min-h-screen p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Organization Tasks</h1>
          <p className="text-gray-400 text-sm mt-1">View and monitor all assigned tasks across employees.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#141416] p-4 rounded-xl border border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by task title, description, or employee name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1e1e21] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#1e1e21] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="bg-[#1e1e21] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="All">All Employees</option>
          {employees.map(emp => (
            <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>
          ))}
        </select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Tasks</p>
            <p className="text-2xl font-bold mt-1 text-white">{allTasks.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center text-gray-400">
            <Filter size={20} />
          </div>
        </div>
        <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold mt-1 text-orange-500">{allTasks.filter(t => t.status === 'Pending').length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
            <Clock size={20} />
          </div>
        </div>
        <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">In Progress</p>
            <p className="text-2xl font-bold mt-1 text-blue-400">{allTasks.filter(t => t.status === 'In Progress').length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <PlayCircle size={20} />
          </div>
        </div>
        <div className="bg-[#141416] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{allTasks.filter(t => t.status === 'Completed').length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle size={20} />
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-[#141416] rounded-xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="mx-auto text-gray-500 mb-3" size={32} />
            <p className="text-gray-400">No tasks found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-400 uppercase tracking-wider bg-white/[0.02]">
                  <th className="px-6 py-4 font-semibold w-2/5">Task Details</th>
                  <th className="px-6 py-4 font-semibold">Assigned To</th>
                  <th className="px-6 py-4 font-semibold">Due Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredTasks.map(task => (
                  <tr key={task._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-base mb-1">{task.title}</div>
                      {task.description && (
                        <div className="text-gray-400 text-xs line-clamp-2">{task.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-200">{task.employeeName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{task.department || 'Employee'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                      {task.dueDate ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-gray-500" />
                          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">No deadline</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(task.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
