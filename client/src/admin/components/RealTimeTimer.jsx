import React, { useState, useEffect } from 'react';
import { Play, Square, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const RealTimeTimer = ({ activeTimer, tasks = [], onTimerStart, onTimerStop }) => {
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);

  // Start Form
  const [project, setProject] = useState('');
  const [task, setTask] = useState('');
  const [activityType, setActivityType] = useState('Client Work');

  // Stop Form
  const [remarks, setRemarks] = useState('');
  const [isProductive, setIsProductive] = useState(true);
  const [isBillable, setIsBillable] = useState(true);
  const [markTaskCompleted, setMarkTaskCompleted] = useState(true);

  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  useEffect(() => {
    let interval;
    if (activeTimer && activeTimer.startTime) {
      const startTime = new Date(activeTimer.startTime).getTime();
      
      interval = setInterval(() => {
        const now = new Date().getTime();
        const diff = now - startTime;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer]);

  const handleStart = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/employees/ess/timer/start', { project, task, activityType });
      if (res.data.success) {
        toast.success('Timer started');
        setIsStartModalOpen(false);
        if (onTimerStart) onTimerStart(res.data.activeTimer);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start timer');
    }
  };

  const handleStop = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/employees/ess/timer/stop', {
        remarks,
        isProductive,
        isBillable,
        markTaskCompleted
      });
      if (res.data.success) {
        toast.success('Work logged successfully');
        setIsStopModalOpen(false);
        setRemarks('');
        if (onTimerStop) onTimerStop();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to stop timer');
    }
  };

  const activityOptions = [
    'Client Work', 'Client Meeting', 'Internal Meeting', 'Vedhunt Task', 
    'Training', 'Research', 'Testing', 'Documentation', 'Bug Fixing', 'Development', 'Other'
  ];

  return (
    <>
      {/* Floating Timer Widget */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-3">
        {activeTimer && activeTimer.startTime ? (
          <div className="bg-[#FF6B00] text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 border border-orange-400">
            <div className="animate-pulse">
              <Clock size={24} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">Working on</div>
              <div className="font-medium text-sm truncate max-w-[150px]">{activeTimer.task}</div>
            </div>
            <div className="text-xl font-mono font-bold w-[90px]">{elapsedTime}</div>
            <button 
              onClick={() => setIsStopModalOpen(true)}
              className="bg-black/20 hover:bg-black/40 p-2 rounded-lg transition-colors cursor-pointer"
            >
              <Square size={18} className="fill-white" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsStartModalOpen(true)}
            className="bg-[#141416] hover:bg-[#1e1e21] border border-white/10 text-white p-4 rounded-xl shadow-xl flex items-center gap-3 transition-colors cursor-pointer group"
          >
            <div className="bg-emerald-500/20 text-emerald-500 p-2 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Play size={20} className="fill-current" />
            </div>
            <div className="font-bold">Start Timer</div>
          </button>
        )}
      </div>

      {/* Start Modal */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#141416] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">Start Work Timer</h2>
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Project</label>
                <input
                  type="text"
                  required
                  className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                  placeholder="e.g. Vedhunt ERP"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Task</label>
                {activityType === 'Vedhunt Task' ? (
                  <select
                    required
                    className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                  >
                    <option value="" disabled>Select assigned pending task...</option>
                    {tasks.filter(t => t.status !== 'Completed').map(t => (
                      <option key={t._id} value={t.title}>{t.title}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                    placeholder="e.g. API Integration"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Activity Type</label>
                <select 
                  className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                >
                  {activityOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsStartModalOpen(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors cursor-pointer text-sm font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer text-sm font-medium flex justify-center items-center gap-2">
                  <Play size={16} className="fill-current"/> Start Timer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stop Modal */}
      {isStopModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#141416] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-2">Stop Work Timer</h2>
            <p className="text-xs text-gray-400 mb-6 font-mono">Running time: {elapsedTime}</p>
            <form onSubmit={handleStop} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Summary / Remarks</label>
                <textarea
                  required
                  className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white h-24"
                  placeholder="What did you accomplish?"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input type="checkbox" checked={isProductive} onChange={(e) => setIsProductive(e.target.checked)} className="rounded border-white/20 bg-transparent text-orange-500 focus:ring-0 focus:ring-offset-0"/>
                  Productive
                </label>
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} className="rounded border-white/20 bg-transparent text-orange-500 focus:ring-0 focus:ring-offset-0"/>
                  Billable
                </label>
              </div>
              {activeTimer && activeTimer.activityType === 'Vedhunt Task' && (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input type="checkbox" checked={markTaskCompleted} onChange={(e) => setMarkTaskCompleted(e.target.checked)} className="rounded border-white/20 bg-transparent text-emerald-500 focus:ring-0 focus:ring-offset-0"/>
                    Mark assigned task as Completed
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsStopModalOpen(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors cursor-pointer text-sm font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors cursor-pointer text-sm font-medium flex justify-center items-center gap-2">
                  <Square size={16} className="fill-current"/> Stop & Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default RealTimeTimer;
