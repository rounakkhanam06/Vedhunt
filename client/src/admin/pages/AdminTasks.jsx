import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Search, Filter, Calendar, CheckCircle, Clock, AlertCircle, AlertTriangle, PlayCircle, Plus, X, ChevronDown, ChevronUp, User } from 'lucide-react';

const STATUSES = ['Pending', 'In Progress', 'Completed'];

export default function AdminTasks() {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [employeeFilter, setEmployeeFilter] = useState('All');

  // Assign Task modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({ employeeId: '', title: '', description: '', dueDate: '' });

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

  const statusSelectClass = (status) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'In Progress': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Pending': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default: return 'bg-surface-variant text-app-text-muted border-app-border';
    }
  };

  // Delay/on-time log — the whole point of tracking assignedOn (createdAt) and
  // completedAt is to be able to say whether a task landed on time or not.
  const getDelayInfo = (task) => {
    if (task.status === 'Completed') {
      if (!task.completedAt || !task.dueDate) return { label: 'Completed', tone: 'text-emerald-400' };
      const lateMs = new Date(task.completedAt) - new Date(task.dueDate);
      if (lateMs > 0) {
        const days = Math.ceil(lateMs / 86400000);
        return { label: `Completed ${days} day${days === 1 ? '' : 's'} late`, tone: 'text-rose-400' };
      }
      return { label: 'Completed on time', tone: 'text-emerald-400' };
    }
    if (!task.dueDate) return { label: 'No deadline set', tone: 'text-app-text-muted' };
    const diffMs = new Date(task.dueDate) - new Date();
    if (diffMs < 0) {
      const days = Math.ceil(Math.abs(diffMs) / 86400000);
      return { label: `Overdue by ${days} day${days === 1 ? '' : 's'}`, tone: 'text-rose-400' };
    }
    const days = Math.ceil(diffMs / 86400000);
    return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'text-app-text-muted' };
  };

  const openAssignModal = () => {
    setAssignForm({ employeeId: '', title: '', description: '', dueDate: '' });
    setShowAssignModal(true);
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!assignForm.employeeId) { toast.error('Select an employee.'); return; }
    if (!assignForm.title.trim()) { toast.error('Task title is required.'); return; }
    if (!assignForm.dueDate) { toast.error('Due date is required.'); return; }

    setIsAssigning(true);
    try {
      const res = await api.put(`/employees/${assignForm.employeeId}`, {
        newTask: {
          title: assignForm.title.trim(),
          description: assignForm.description.trim(),
          dueDate: assignForm.dueDate,
          status: 'Pending'
        }
      });
      if (res.data.success) {
        toast.success('Task assigned successfully!');
        setShowAssignModal(false);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign task.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    setUpdatingTaskId(task._id);
    try {
      const res = await api.put(`/employees/${task.employeeId}`, {
        taskStatusUpdate: { taskId: task._id, status: newStatus }
      });
      if (res.data.success) {
        toast.success(`Marked as ${newStatus}`);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task status.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="space-y-6 text-app-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Organization Tasks</h1>
          <p className="text-app-text-muted text-sm mt-1">Assign, track, and monitor tasks across employees.</p>
        </div>
        <button
          onClick={openAssignModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-all shadow-lg hover:shadow-primary/20 active:scale-[0.98] cursor-pointer"
        >
          <Plus size={18} /> Assign Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-app-card p-4 rounded-xl border border-app-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
          <input
            type="text"
            placeholder="Search by task title, description, or employee name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-form-input-bg border border-app-border rounded-lg pl-10 pr-4 py-2 text-sm text-app-text placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-form-input-bg border border-app-border rounded-lg px-4 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="bg-form-input-bg border border-app-border rounded-lg px-4 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="All">All Employees</option>
          {employees.map(emp => (
            <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>
          ))}
        </select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-app-card p-4 rounded-xl border border-app-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Total Tasks</p>
            <p className="text-2xl font-bold mt-1 text-app-text">{allTasks.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-app-text-muted">
            <Filter size={20} />
          </div>
        </div>
        <div className="bg-app-card p-4 rounded-xl border border-app-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold mt-1 text-orange-500">{allTasks.filter(t => t.status === 'Pending').length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
            <Clock size={20} />
          </div>
        </div>
        <div className="bg-app-card p-4 rounded-xl border border-app-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">In Progress</p>
            <p className="text-2xl font-bold mt-1 text-blue-400">{allTasks.filter(t => t.status === 'In Progress').length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <PlayCircle size={20} />
          </div>
        </div>
        <div className="bg-app-card p-4 rounded-xl border border-app-border flex items-center justify-between">
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
      <div className="bg-app-card rounded-xl border border-app-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="mx-auto text-app-text-muted mb-3" size={32} />
            <p className="text-app-text-muted">No tasks found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-app-border text-xs text-app-text-muted uppercase tracking-wider bg-app-bg">
                  <th className="px-6 py-4 font-semibold w-1/3">Task Details</th>
                  <th className="px-6 py-4 font-semibold">Assigned To</th>
                  <th className="px-6 py-4 font-semibold">Assigned On</th>
                  <th className="px-6 py-4 font-semibold">Due Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border text-sm">
                {filteredTasks.map(task => {
                  const isExpanded = expandedTaskId === task._id;
                  const delay = getDelayInfo(task);
                  return (
                    <>
                      <tr key={task._id} className="hover:bg-surface-variant transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-app-text text-base mb-1">{task.title}</div>
                          {task.description && (
                            <div className="text-app-text-muted text-xs line-clamp-2">{task.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-app-text">{task.employeeName}</div>
                          <div className="text-xs text-app-text-muted mt-0.5">{task.department || 'Employee'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-app-text-muted text-xs">
                          {task.createdAt ? new Date(task.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-app-text">
                          {task.dueDate ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} className="text-app-text-muted" />
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          ) : (
                            <span className="text-app-text-muted italic">No deadline</span>
                          )}
                          <div className={`text-[11px] mt-0.5 ${delay.tone}`}>{delay.label}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            disabled={updatingTaskId === task._id}
                            className={`px-2.5 py-1 rounded border text-xs font-semibold focus:outline-none cursor-pointer disabled:opacity-50 ${statusSelectClass(task.status)}`}
                          >
                            {STATUSES.map(s => <option key={s} value={s} className="bg-app-card text-app-text">{s}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setExpandedTaskId(isExpanded ? null : task._id)}
                            className="p-1.5 rounded-lg bg-surface-variant hover:bg-app-border text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
                            title="View assignment log"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${task._id}-detail`} className="bg-app-bg">
                          <td colSpan="6" className="px-6 pb-5 pt-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <div className="text-app-text-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><User size={11} /> Assigned By</div>
                                <div className="text-app-text font-medium">
                                  {task.assignedBy ? `${task.assignedBy.firstName || ''} ${task.assignedBy.lastName || ''}`.trim() || task.assignedBy.email : 'Unknown'}
                                </div>
                              </div>
                              <div>
                                <div className="text-app-text-muted uppercase tracking-wider font-bold mb-1">Due Date</div>
                                <div className="text-app-text font-medium">
                                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No deadline'}
                                </div>
                              </div>
                              <div>
                                <div className="text-app-text-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><AlertTriangle size={11} /> Delay Log</div>
                                <div className={`font-medium ${delay.tone}`}>{delay.label}</div>
                              </div>
                              {task.status === 'Completed' && task.completedAt && (
                                <div>
                                  <div className="text-app-text-muted uppercase tracking-wider font-bold mb-1">Completed On</div>
                                  <div className="text-app-text font-medium">
                                    {new Date(task.completedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              )}
                              {task.description && (
                                <div className="col-span-2 md:col-span-4">
                                  <div className="text-app-text-muted uppercase tracking-wider font-bold mb-1">Full Description</div>
                                  <div className="text-app-text bg-app-card border border-app-border rounded-lg p-3 whitespace-pre-wrap">{task.description}</div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Task Modal */}
      {showAssignModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAssignModal(false); }}
        >
          <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-app-border bg-app-bg">
              <div>
                <h2 className="text-lg font-bold text-app-text">Assign Task</h2>
                <p className="text-xs text-app-text-muted mt-0.5">Assign a new task to an employee.</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-app-text-muted hover:text-app-text cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignTask} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1.5">Employee <span className="text-primary">*</span></label>
                <select
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm(f => ({ ...f, employeeId: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select employee...</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} — {emp.roleDept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1.5">Task Title <span className="text-primary">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Design Homepage"
                  value={assignForm.title}
                  onChange={(e) => setAssignForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1.5">Description</label>
                <textarea
                  placeholder="Provide detailed instructions..."
                  value={assignForm.description}
                  onChange={(e) => setAssignForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1.5">Due Date <span className="text-primary">*</span></label>
                <input
                  type="date"
                  value={assignForm.dueDate}
                  onChange={(e) => setAssignForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-app-border text-app-text-muted hover:bg-surface-variant hover:text-app-text transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all cursor-pointer text-sm disabled:opacity-60"
                >
                  {isAssigning ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
