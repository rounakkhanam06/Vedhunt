import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Square, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { essPost, essKeys, apiError, useEssTimer, useEssProfile, useActivityTypes } from '../lib/ess';

const WorkTimerContext = createContext(null);
const useWorkTimer = () => useContext(WorkTimerContext);

const inputClass = (invalid) =>
  `w-full text-sm rounded-lg border ${invalid ? 'border-rose-500' : 'border-form-input-border'} bg-form-input-bg px-4 py-2 text-app-text focus:outline-none focus:border-primary`;
const labelClass = 'block text-xs text-app-text-muted mb-1';

function useElapsed(startTime) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startTime) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  if (!startTime) return '00:00:00';
  const total = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

const OPEN_TASK_STATUSES = ['Pending', 'In Progress', 'Blocked'];

function StartTimerModal({ onClose, onStarted }) {
  const { data: profile } = useEssProfile();
  const { data: activityTypes = [] } = useActivityTypes();
  const openTasks = (profile?.tasks || []).filter((t) => OPEN_TASK_STATUSES.includes(t.status));
  const [source, setSource] = useState(openTasks.length ? 'task' : 'other');
  const [taskId, setTaskId] = useState('');
  const [project, setProject] = useState('');
  const [task, setTask] = useState('');
  const [activityType, setActivityType] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const todayLog = profile?.attendance?.find((a) => new Date(a.date).toDateString() === new Date().toDateString());
  const attendanceBlocker = !todayLog?.clockIn
    ? 'Clock in from the Dashboard before starting the work timer.'
    : todayLog.clockOut ? "You've already clocked out for today." : '';
  const projectSuggestions = [...new Set((profile?.tasks || []).flatMap((t) => [t.project, t.client]).filter(Boolean))];

  const pickTask = (id) => {
    setTaskId(id);
    const picked = openTasks.find((t) => t._id === id);
    if (!picked) return;
    setTask(picked.title);
    setProject(picked.project || picked.client || project || 'Vedhunt');
    if (!activityType && activityTypes.some((a) => a.name === 'Vedhunt Task')) setActivityType('Vedhunt Task');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {
      project: !project.trim(),
      task: source === 'task' ? !taskId : !task.trim(),
      activityType: !activityType,
    };
    setErrors(next);
    const missing = [next.project && 'Project', next.task && 'Task', next.activityType && 'Activity Type'].filter(Boolean);
    if (missing.length) {
      setMessage(`Please enter ${missing.join(', ')} to start the timer.`);
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await essPost('/timer/start', { project, task, activityType, taskId: source === 'task' ? taskId : undefined });
      toast.success('Timer started');
      onStarted();
    } catch (err) {
      setMessage(apiError(err, 'Could not start the timer.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Start Work Timer" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {attendanceBlocker && (
          <div className="flex items-start gap-2 text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 p-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" /> {attendanceBlocker}
          </div>
        )}
        {openTasks.length > 0 && (
          <div className="flex bg-form-input-bg border border-app-border p-1 rounded-lg text-xs font-bold">
            {[['task', 'From My Tasks'], ['other', 'Other work']].map(([value, label]) => (
              <button key={value} type="button" onClick={() => { setSource(value); setErrors({}); }}
                className={`flex-1 py-1.5 rounded-md transition-colors cursor-pointer ${source === value ? 'bg-primary text-white' : 'text-app-text-muted hover:text-app-text'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {source === 'task' ? (
          <div>
            <label className={labelClass}>Task <span className="text-primary">*</span></label>
            <select className={inputClass(errors.task)} value={taskId} onChange={(e) => pickTask(e.target.value)}>
              <option value="">Select an assigned task…</option>
              {openTasks.map((t) => <option key={t._id} value={t._id}>{t.title}{t.project ? ` — ${t.project}` : ''}</option>)}
            </select>
          </div>
        ) : null}
        <div>
          <label className={labelClass}>Project <span className="text-primary">*</span></label>
          <input className={inputClass(errors.project)} list="timer-projects" placeholder="e.g. Vedhunt ERP" value={project} onChange={(e) => setProject(e.target.value)} />
          <datalist id="timer-projects">{projectSuggestions.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        {source === 'other' && (
          <div>
            <label className={labelClass}>Task <span className="text-primary">*</span></label>
            <input className={inputClass(errors.task)} placeholder="e.g. API Integration" value={task} onChange={(e) => setTask(e.target.value)} />
          </div>
        )}
        <div>
          <label className={labelClass}>Activity Type <span className="text-primary">*</span></label>
          <select className={inputClass(errors.activityType)} value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            <option value="">Select activity type…</option>
            {activityTypes.map((a) => (
              <option key={a.name} value={a.name}>{a.name}{a.productive ? '' : ' (non-productive)'}</option>
            ))}
          </select>
        </div>
        {message && <p className="text-xs text-rose-400 font-medium" role="alert">{message}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg bg-app-border/20 text-app-text hover:bg-app-border/30 transition-colors cursor-pointer text-sm font-medium">Cancel</button>
          <button type="submit" disabled={submitting || Boolean(attendanceBlocker)}
            className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer text-sm font-medium flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Play size={16} className="fill-current" /> {submitting ? 'Starting…' : 'Start Timer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StopTimerModal({ timer, elapsed, onClose, onStopped }) {
  const { data: activityTypes = [] } = useActivityTypes();
  const master = activityTypes.find((a) => a.name === timer?.activityType);
  const [remarks, setRemarks] = useState('');
  const [isProductive, setIsProductive] = useState(master ? master.productive : true);
  const [isBillable, setIsBillable] = useState(master ? master.billable : false);
  const [markTaskCompleted, setMarkTaskCompleted] = useState(Boolean(timer?.taskId));
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStop = async (e) => {
    e.preventDefault();
    if (!remarks.trim()) { setMessage('Add a short summary of what you worked on.'); return; }
    setSubmitting(true);
    try {
      const res = await essPost('/timer/stop', { remarks, isProductive, isBillable, markTaskCompleted: Boolean(timer?.taskId) && markTaskCompleted });
      toast.success(res.message || 'Work logged');
      onStopped();
    } catch (err) {
      setMessage(apiError(err, 'Could not stop the timer.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Stop & log work" subtitle="Confirm the details below — this saves the session to your timesheet." onClose={onClose}>
      <form onSubmit={handleStop} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs bg-form-input-bg border border-app-border rounded-lg p-3">
          <div><div className="text-app-text-muted">Project</div><div className="font-semibold text-app-text truncate">{timer?.project}</div></div>
          <div><div className="text-app-text-muted">Task</div><div className="font-semibold text-app-text truncate">{timer?.task}</div></div>
          <div><div className="text-app-text-muted">Activity</div><div className="font-semibold text-app-text">{timer?.activityType}</div></div>
          <div><div className="text-app-text-muted">{timer?.startTime ? 'Running for' : 'Status'}</div><div className="font-mono font-semibold text-app-text">{timer?.startTime ? elapsed : 'Paused'}</div></div>
        </div>
        <div>
          <label className={labelClass}>Summary / Remarks <span className="text-primary">*</span></label>
          <textarea className={`${inputClass(!!message && !remarks.trim())} h-24 resize-none`} placeholder="What did you accomplish?" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-app-text">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isProductive} onChange={(e) => setIsProductive(e.target.checked)} /> Productive</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} /> Billable</label>
          {timer?.taskId && (
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={markTaskCompleted} onChange={(e) => setMarkTaskCompleted(e.target.checked)} /> Mark the task as Completed</label>
          )}
        </div>
        {master && <p className="text-[11px] text-app-text-muted">Defaults come from the activity master: “{master.name}” is {master.productive ? 'productive' : 'non-productive'}{master.billable ? ', billable' : ''}.</p>}
        {message && <p className="text-xs text-rose-400 font-medium" role="alert">{message}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg bg-app-border/20 text-app-text hover:bg-app-border/30 transition-colors cursor-pointer text-sm font-medium">Keep running</button>
          <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer text-sm font-medium flex justify-center items-center gap-2 disabled:opacity-50">
            <Square size={16} className="fill-current" /> {submitting ? 'Saving…' : 'Stop & Log'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Timer state + actions for the whole portal; renders the start/stop dialogs. */
export function WorkTimerProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: timer } = useEssTimer();
  useActivityTypes(); // warm the cache so the Stop dialog has its master defaults
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(timer?.startTime);
  const state = timer?.startTime ? 'running' : timer?.pausedAt ? 'paused' : 'idle';

  const refresh = () => {
    ['timer', 'day-stats', 'worklogs', 'tasks', 'profile', 'today'].forEach((k) => queryClient.invalidateQueries({ queryKey: ['ess', k] }));
  };

  const value = useMemo(() => {
    const run = async (path, fallback) => {
      setBusy(true);
      try {
        const res = await essPost(path);
        toast.success(res.message);
        refresh();
      } catch (err) {
        toast.error(apiError(err, fallback));
        queryClient.invalidateQueries({ queryKey: essKeys.timer });
      } finally {
        setBusy(false);
      }
    };
    return {
      timer, state, elapsed, busy,
      openStart: () => setModal('start'),
      openStop: () => setModal('stop'),
      pause: () => run('/timer/pause', 'Could not pause the timer.'),
      resume: () => run('/timer/resume', 'Could not resume the timer.'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, state, elapsed, busy]);

  const close = () => setModal(null);
  const done = () => { close(); refresh(); };

  return (
    <WorkTimerContext.Provider value={value}>
      {children}
      {modal === 'start' && <StartTimerModal onClose={close} onStarted={done} />}
      {modal === 'stop' && <StopTimerModal timer={timer} elapsed={elapsed} onClose={close} onStopped={done} />}
    </WorkTimerContext.Provider>
  );
}

const iconButton = 'p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50';

/** Compact live timer for the top header (hidden while idle). */
export function TimerHeaderChip() {
  const t = useWorkTimer();
  if (!t || t.state === 'idle') return null;
  return (
    <div className="hidden sm:flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
      <Clock size={14} className={t.state === 'running' ? 'animate-pulse' : ''} />
      <span className="font-mono text-sm font-bold w-[66px] text-center">{t.state === 'running' ? t.elapsed : 'Paused'}</span>
      {t.state === 'running'
        ? <button onClick={t.pause} disabled={t.busy} className={`${iconButton} hover:bg-primary/20`} title="Pause"><Pause size={14} /></button>
        : <button onClick={t.resume} disabled={t.busy} className={`${iconButton} hover:bg-primary/20`} title="Resume"><Play size={14} /></button>}
      <button onClick={t.openStop} disabled={t.busy} className={`${iconButton} hover:bg-primary/20`} title="Stop & log"><Square size={14} /></button>
    </div>
  );
}

/** The floating bottom-right timer (Start when idle; live controls otherwise). */
export function TimerFloatingWidget() {
  const t = useWorkTimer();
  if (!t) return null;
  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end">
      {t.state === 'idle' ? (
        <button onClick={t.openStart}
          className="bg-app-card hover:bg-app-border/10 border border-app-border text-app-text p-4 rounded-xl shadow-xl flex items-center gap-3 transition-colors cursor-pointer group">
          <div className="bg-emerald-500/20 text-emerald-500 p-2 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
            <Play size={20} className="fill-current" />
          </div>
          <div className="font-bold">Start Timer</div>
        </button>
      ) : (
        // Fixed brand-orange chip in both themes, so its text/icons stay white.
        <div className="bg-primary text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 border border-white/20">
          <Clock size={22} className={t.state === 'running' ? 'animate-pulse' : 'opacity-70'} />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t.state === 'running' ? 'Working on' : 'Paused'}</div>
            <div className="font-medium text-sm truncate max-w-[140px]">{t.timer?.task}</div>
          </div>
          <div className="text-lg font-mono font-bold w-[84px]">{t.state === 'running' ? t.elapsed : '--:--:--'}</div>
          {t.state === 'running'
            ? <button onClick={t.pause} disabled={t.busy} className="bg-black/20 hover:bg-black/40 p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50" title="Pause"><Pause size={16} /></button>
            : <button onClick={t.resume} disabled={t.busy} className="bg-black/20 hover:bg-black/40 p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50" title="Resume"><Play size={16} className="fill-white" /></button>}
          <button onClick={t.openStop} disabled={t.busy} className="bg-black/20 hover:bg-black/40 p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50" title="Stop & log">
            <Square size={16} className="fill-white" />
          </button>
        </div>
      )}
    </div>
  );
}
