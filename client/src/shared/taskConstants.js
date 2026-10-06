/**
 * Task vocabulary shared by the Employee Portal (My Tasks) and the Admin
 * panel (Organization Tasks). Mirrors TASK_STATUSES / TASK_PRIORITIES in
 * server/models/Employee.js — 'Pending' is the stored value for "Not Started".
 */
export const TASK_STATUSES = ['Pending', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];
export const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

export const taskStatusLabel = (status) => (status === 'Pending' ? 'Not Started' : status || 'Not Started');

/** Short, stable display ID derived from the task's ObjectId. */
export const taskCode = (id) => `TSK-${String(id || '').slice(-6).toUpperCase()}`;

export const TASK_STATUS_CLASSES = {
  Pending: 'bg-primary/10 text-primary border-primary/20',
  'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Blocked: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Cancelled: 'bg-gray-500/10 text-app-text-muted border-gray-500/20',
};

export const TASK_PRIORITY_CLASSES = {
  Low: 'bg-gray-500/10 text-app-text-muted border-gray-500/20',
  Normal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  High: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Urgent: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};
