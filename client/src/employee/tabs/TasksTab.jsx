import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, MessageSquare, History, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { Spinner, EmptyCard, TabHeader } from '../components/PortalUI';
import { useEssTasks, essPut, essPost, apiError } from '../lib/ess';
import { fmtDate, fmtDateTime, fmtMinutes } from '../lib/datetime';
import { TASK_STATUSES, taskStatusLabel, taskCode, TASK_STATUS_CLASSES, TASK_PRIORITY_CLASSES } from '../../shared/taskConstants';

const OPEN = ['Pending', 'In Progress', 'Blocked'];
const isOverdue = (t) => OPEN.includes(t.status) && t.dueDate && new Date(t.dueDate).setHours(23, 59, 59, 999) < Date.now();
const badge = 'px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider';
const field = 'w-full bg-form-input-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50';

function Detail({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-app-text-muted">{label}</div>
      <div className="text-xs font-semibold text-app-text mt-0.5">{children}</div>
    </div>
  );
}

function TaskCard({ task, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const overdue = isOverdue(task);
  const estMinutes = (task.estimatedHours || 0) * 60;

  const setStatus = async (status, extra = {}) => {
    if (status === 'Completed' && !window.confirm(`Mark "${task.title}" as completed?`)) return;
    setBusy(true);
    try {
      const res = await essPut(`/tasks/${task._id}/status`, { status, ...extra });
      toast.success(res.timerStopped ? `${res.message} Your running timer was stopped and logged.` : res.message);
      setBlocking(false);
      setReason('');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the task.'));
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await essPost(`/tasks/${task._id}/comments`, { text: comment });
      setComment('');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, 'Could not add the comment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bg-app-card border rounded-xl p-5 ${overdue ? 'border-red-500/30' : 'border-app-border'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-primary">{taskCode(task._id)}</span>
            <h3 className="font-bold text-app-text">{task.title}</h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className={`${badge} ${TASK_STATUS_CLASSES[task.status] || TASK_STATUS_CLASSES.Pending}`}>{taskStatusLabel(task.status)}</span>
            <span className={`${badge} ${TASK_PRIORITY_CLASSES[task.priority || 'Normal']}`}>{task.priority || 'Normal'}</span>
            {overdue && <span className={`${badge} bg-red-500/10 text-red-400 border-red-500/20`}>Overdue</span>}
            {(task.project || task.client) && <span className="text-xs text-app-text-muted">{[task.project, task.client].filter(Boolean).join(' · ')}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {task.status === 'Pending' && (
            <button type="button" disabled={busy} onClick={() => setStatus('In Progress')}
              className="px-3 py-1 rounded-lg border border-app-border text-xs font-semibold text-app-text hover:border-primary/40 disabled:opacity-50 cursor-pointer">Start</button>
          )}
          {task.status === 'Blocked' && (
            <button type="button" disabled={busy} onClick={() => setStatus('In Progress')}
              className="px-3 py-1 rounded-lg border border-app-border text-xs font-semibold text-app-text hover:border-primary/40 disabled:opacity-50 cursor-pointer">Unblock</button>
          )}
          {['Pending', 'In Progress'].includes(task.status) && (
            <button type="button" disabled={busy} onClick={() => setBlocking((b) => !b)}
              className="px-3 py-1 rounded-lg border border-rose-500/30 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 cursor-pointer flex items-center gap-1">
              <Ban size={12} /> Blocked
            </button>
          )}
          {OPEN.includes(task.status) && (
            <button type="button" disabled={busy} onClick={() => setStatus('Completed')}
              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">Mark complete</button>
          )}
          <button type="button" onClick={() => setExpanded((x) => !x)} className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text cursor-pointer" aria-label="Details">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Detail label="Start date">{fmtDate(task.startDate || task.createdAt)}</Detail>
        <Detail label="Due date"><span className={overdue ? 'text-red-400' : ''}>{fmtDate(task.dueDate)}</span></Detail>
        <Detail label="Estimated">{task.estimatedHours ? `${task.estimatedHours}h` : '—'}</Detail>
        <Detail label="Actual (logged)">
          <span className={estMinutes && task.actualMinutes > estMinutes ? 'text-amber-500' : ''}>{fmtMinutes(task.actualMinutes)}</span>
        </Detail>
      </div>

      {task.status === 'Blocked' && task.blockerReason && (
        <p className="mt-3 text-xs rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 p-2.5"><strong>Blocked:</strong> {task.blockerReason}</p>
      )}

      {blocking && (
        <div className="mt-3 space-y-2">
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is blocking this task? (required)" className={`${field} resize-none`} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBlocking(false)} className="px-3 py-1.5 text-xs text-app-text-muted hover:text-app-text cursor-pointer">Cancel</button>
            <button type="button" disabled={busy || !reason.trim()} onClick={() => setStatus('Blocked', { reason })}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">Mark blocked</button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-4 pt-4 border-t border-app-border space-y-4">
          {task.description && <div><div className="text-[10px] uppercase tracking-wider font-bold text-app-text-muted mb-1">Description</div><p className="text-sm text-app-text whitespace-pre-wrap">{task.description}</p></div>}
          {task.acceptanceCriteria && <div><div className="text-[10px] uppercase tracking-wider font-bold text-app-text-muted mb-1">Acceptance criteria</div><p className="text-sm text-app-text whitespace-pre-wrap">{task.acceptanceCriteria}</p></div>}
          {task.assignedBy && <p className="text-xs text-app-text-muted">Assigned by {task.assignedBy.firstName} {task.assignedBy.lastName} · {fmtDateTime(task.createdAt)}</p>}

          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-app-text-muted mb-2 flex items-center gap-1"><MessageSquare size={11} /> Comments</div>
            <div className="space-y-2">
              {(task.comments || []).map((c) => (
                <div key={c._id} className="text-sm bg-form-input-bg rounded-lg px-3 py-2">
                  <div className="text-[11px] text-app-text-muted">{c.byName} · {fmtDateTime(c.at)}</div>
                  <div className="text-app-text whitespace-pre-wrap">{c.text}</div>
                </div>
              ))}
              {!task.comments?.length && <p className="text-xs text-app-text-muted">No comments yet.</p>}
            </div>
            <form onSubmit={addComment} className="flex gap-2 mt-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" className={field} maxLength={2000} />
              <button type="submit" disabled={busy || !comment.trim()} className="px-3 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50 cursor-pointer">Post</button>
            </form>
          </div>

          {task.history?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-app-text-muted mb-2 flex items-center gap-1"><History size={11} /> Activity</div>
              <ul className="space-y-1">
                {[...task.history].reverse().map((h) => (
                  <li key={h._id} className="text-xs text-app-text-muted"><span className="text-app-text">{h.text}</span> · {h.byName} · {fmtDateTime(h.at)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TasksTab() {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useEssTasks();
  const [filter, setFilter] = useState('Open');

  const refresh = () => ['tasks', 'profile', 'today', 'timer'].forEach((k) => queryClient.invalidateQueries({ queryKey: ['ess', k] }));
  const visible = tasks
    .filter((t) => filter === 'All' || (filter === 'Open' ? OPEN.includes(t.status) : t.status === filter))
    .sort((a, b) => (OPEN.includes(b.status) - OPEN.includes(a.status)) || new Date(a.dueDate || 8.64e15) - new Date(b.dueDate || 8.64e15));

  return (
    <div className="space-y-6">
      <TabHeader title="Assigned Projects & Tasks" subtitle="Time you log with the work timer on a task counts towards its actual effort">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-app-card border border-app-border rounded-lg px-3 py-1.5 text-sm text-app-text cursor-pointer" aria-label="Filter tasks">
          <option value="Open">Open</option>
          <option value="All">All</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{taskStatusLabel(s)}</option>)}
        </select>
      </TabHeader>
      {isLoading ? <Spinner /> : visible.length === 0
        ? <EmptyCard>{tasks.length ? 'No tasks match this filter.' : 'No tasks assigned yet.'}</EmptyCard>
        : <div className="space-y-4">{visible.map((t) => <TaskCard key={t._id} task={t} onChanged={refresh} />)}</div>}
    </div>
  );
}
