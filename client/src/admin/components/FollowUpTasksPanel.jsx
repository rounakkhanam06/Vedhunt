import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle2, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TYPE_BADGE = {
  Primary: 'bg-primary/10 text-primary border-primary/20',
  Parallel: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
};

const STATUS_BADGE = {
  Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Cancelled: 'bg-app-bg text-app-text-muted border-app-border'
};

/**
 * Every scheduled action on this lead — the Primary follow-up (auto-synced
 * with the call-outcome widget above, read-only history here) plus any
 * manager-created Parallel tasks (independently completable, always
 * requiring a result — server/services/followUpTasks.js enforces this).
 */
export default function FollowUpTasksPanel({ leadId, canManage, bds, myAdminId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);
  const [resultText, setResultText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({ assignedTo: '', dueDate: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/leads/${leadId}/tasks`);
      if (res.data?.success) setTasks(res.data.tasks || []);
    } catch {
      // panel just stays empty — not worth a toast on every lead load
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleComplete = async (taskId) => {
    if (!resultText.trim()) {
      toast.error('A result is required to complete a task');
      return;
    }
    try {
      await api.put(`/leads/${leadId}/tasks/${taskId}/complete`, { result: resultText.trim() });
      toast.success('Task completed');
      setCompletingId(null);
      setResultText('');
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete task');
    }
  };

  const handleCreate = async () => {
    if (!newTask.assignedTo || !newTask.dueDate) {
      toast.error('Assignee and due date are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/leads/${leadId}/tasks`, {
        assignedTo: newTask.assignedTo,
        dueDate: new Date(newTask.dueDate).toISOString(),
        note: newTask.note.trim()
      });
      toast.success('Task created');
      setShowAddForm(false);
      setNewTask({ assignedTo: '', dueDate: '', note: '' });
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const sectionClass = 'bg-app-card border border-app-border rounded-xl p-5';
  const selectClass = 'mt-1 w-full bg-app-bg border border-app-border px-3 py-2 rounded-lg text-app-text focus:outline-none focus:border-primary text-sm';

  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs text-primary font-bold uppercase tracking-wider">Follow-up Tasks</label>
        {canManage && (
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80"
          >
            <Plus size={14} /> Add Task
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-4 p-3 bg-app-bg border border-app-border rounded-lg space-y-2">
          <select value={newTask.assignedTo} onChange={(e) => setNewTask((t) => ({ ...t, assignedTo: e.target.value }))} className={selectClass}>
            <option value="">-Assign to-</option>
            {(bds || []).map((bd) => (
              <option key={bd._id} value={bd._id}>{bd.firstName} {bd.lastName}</option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={newTask.dueDate}
            onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))}
            className={selectClass}
            style={{ colorScheme: 'dark' }}
          />
          <input
            type="text"
            placeholder="What's this task about?"
            value={newTask.note}
            onChange={(e) => setNewTask((t) => ({ ...t, note: e.target.value }))}
            className={selectClass}
          />
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs font-medium text-app-text-muted hover:text-app-text">Cancel</button>
            <button onClick={handleCreate} disabled={submitting} className="px-3 py-1.5 text-xs font-bold text-black bg-primary rounded-lg disabled:opacity-50">
              {submitting ? 'Saving...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-app-text-muted">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-app-text-muted">No follow-up tasks yet.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const canComplete = task.status === 'Pending' && (canManage || String(task.assignedTo?._id) === String(myAdminId));
            return (
              <div key={task._id} className="p-3 bg-app-bg border border-app-border rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${TYPE_BADGE[task.type]}`}>{task.type}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_BADGE[task.status]}`}>{task.status}</span>
                  </div>
                  <span className="text-[11px] text-app-text-muted flex items-center gap-1">
                    <Clock size={11} /> {new Date(task.dueDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {task.note && <p className="text-xs text-app-text mt-1.5">{task.note}</p>}
                <p className="text-[11px] text-app-text-muted mt-1">
                  Assigned to {task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Unknown'}
                </p>
                {task.status === 'Completed' && task.result && (
                  <p className="text-xs text-emerald-400 mt-1.5"><strong>Result:</strong> {task.result}</p>
                )}

                {canComplete && (
                  completingId === task._id ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="What happened? (required)"
                        value={resultText}
                        onChange={(e) => setResultText(e.target.value)}
                        className={selectClass}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setCompletingId(null); setResultText(''); }} className="p-1.5 text-app-text-muted hover:text-app-text"><X size={14} /></button>
                        <button onClick={() => handleComplete(task._id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-black bg-primary rounded-lg">
                          <CheckCircle2 size={13} /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setCompletingId(task._id); setResultText(''); }}
                      className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80"
                    >
                      <CheckCircle2 size={13} /> Mark Complete
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
