import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import employeeApi from '../../services/employeeApi';

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
 * manager-created Parallel task assigned to this BD. Completing a task
 * always requires a result (server/services/followUpTasks.js enforces it).
 */
export default function FollowUpTasksPanel({ leadId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);
  const [resultText, setResultText] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeApi.get(`/employee-portal/ess/leads/${leadId}/tasks`);
      if (res.data?.success) setTasks(res.data.tasks || []);
    } catch {
      // panel just stays empty
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
      await employeeApi.put(`/employee-portal/ess/leads/${leadId}/tasks/${taskId}/complete`, { result: resultText.trim() });
      toast.success('Task completed');
      setCompletingId(null);
      setResultText('');
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete task');
    }
  };

  const sectionClass = 'bg-app-card border border-app-border rounded-xl p-5';
  const inputClass = 'mt-1 w-full bg-form-input-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50';

  if (loading || tasks.length === 0) {
    return loading ? null : (
      <div className={sectionClass}>
        <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2 block">Follow-up Tasks</label>
        <p className="text-xs text-app-text-muted">No follow-up tasks yet.</p>
      </div>
    );
  }

  return (
    <div className={sectionClass}>
      <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-3 block">Follow-up Tasks</label>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task._id} className="p-3 bg-form-input-bg border border-app-border rounded-lg">
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
            {task.status === 'Completed' && task.result && (
              <p className="text-xs text-emerald-400 mt-1.5"><strong>Result:</strong> {task.result}</p>
            )}

            {task.status === 'Pending' && (
              completingId === task._id ? (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="What happened? (required)"
                    value={resultText}
                    onChange={(e) => setResultText(e.target.value)}
                    className={inputClass}
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
        ))}
      </div>
    </div>
  );
}
