// Small presentational pieces repeated across the Employee Portal tabs.

export const Spinner = ({ className = 'py-12' }) => (
  <div className={`flex justify-center items-center ${className}`}>
    <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
);

export const EmptyCard = ({ children }) => (
  <div className="bg-app-card border border-app-border rounded-xl p-8 text-center text-app-text-muted text-sm">{children}</div>
);

export const TabHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
    <div>
      <h2 className="text-xl font-bold text-app-text">{title}</h2>
      {subtitle && <p className="text-app-text-muted text-xs mt-1">{subtitle}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </div>
);

const APPROVAL_CLASSES = {
  Approved: 'bg-emerald-500/10 text-emerald-400',
  Rejected: 'bg-rose-500/10 text-rose-400',
  Cancelled: 'bg-gray-500/10 text-app-text-muted',
  Pending: 'bg-primary/10 text-primary',
};
/** Pending / Approved / Rejected / Cancelled badge for approval-based requests. */
export const ApprovalBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-bold ${APPROVAL_CLASSES[status] || APPROVAL_CLASSES.Pending}`}>{status}</span>
);

const TONES = {
  danger: 'bg-red-500/10 text-red-400',
  success: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-500',
  default: 'bg-primary/10 text-primary',
};
/** Clickable KPI tile used on the dashboard. */
export const StatTile = ({ icon: Icon, label, value, sub, tone = 'default', onClick, loading }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-app-card border border-app-border hover:border-primary/40 rounded-xl p-4 text-left transition-colors group cursor-pointer"
  >
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${TONES[tone]}`}>
      <Icon size={16} />
    </div>
    <div className="text-2xl font-extrabold text-app-text group-hover:text-primary transition-colors">{loading ? '—' : value}</div>
    <div className="text-xs text-app-text-muted mt-0.5">{label}</div>
    {sub && !loading && <div className="text-[11px] font-semibold text-emerald-500 mt-1">{sub}</div>}
  </button>
);
