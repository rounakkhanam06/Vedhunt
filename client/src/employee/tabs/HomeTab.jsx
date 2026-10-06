import { useNavigate } from 'react-router-dom';
import {
  UserPlus, PhoneCall, CalendarClock, AlertCircle, Flame, FileText, Handshake, Trophy, Users, ListTodo, CircleDashed, ChevronRight,
} from 'lucide-react';
import { StatTile } from '../components/PortalUI';
import { useAccess, useEssLeads, useEssToday } from '../lib/ess';
import { fmtDateTime, fmtINR } from '../lib/datetime';
import { followUpBucket, isCallPending, needsNextAction, isWonThisMonth, PIPELINE_STAGES } from '../lib/leads';
import { taskStatusLabel } from '../../shared/taskConstants';
import { formatDuration } from '../../utils/formatDuration';

const go = (navigate, query) => () => navigate(`/employee/dashboard?${query}`);

function TodayAgenda({ today, isLoading, navigate }) {
  const items = today?.items || [];
  return (
    <div id="today-agenda" className="bg-app-card p-6 rounded-xl border border-app-border space-y-4 scroll-mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Today's Tasks</h3>
        {today && (
          <span className="text-xs text-app-text-muted">
            {today.dueToday} due today{today.overdue ? <span className="text-red-400"> · {today.overdue} overdue</span> : null}
          </span>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-app-text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-app-text-muted text-center py-4">Nothing due today. 🎯</p>
      ) : (
        <div className="divide-y divide-app-border">
          {items.slice(0, 12).map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => (item.kind === 'followup' ? navigate(`/employee/leads/${item.leadRef}`) : navigate('/employee/dashboard?tab=tasks'))}
              className="w-full py-3 flex items-center justify-between gap-3 text-left group cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-app-border/30 text-app-text-muted shrink-0">{item.actionType}</span>
                  <span className="text-sm font-semibold text-app-text truncate group-hover:text-primary">{item.title}</span>
                </div>
                <div className="text-xs text-app-text-muted mt-0.5">
                  {item.kind === 'followup' ? `${item.leadId}${item.note ? ` · ${item.note}` : ''}` : `${taskStatusLabel(item.status)} · ${item.priority} priority`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-mono ${item.overdue ? 'text-red-400' : 'text-app-text-muted'}`}>
                  {item.overdue ? 'Overdue · ' : ''}{item.kind === 'task' ? new Date(item.dueAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : fmtDateTime(item.dueAt)}
                </span>
                <ChevronRight size={14} className="text-app-text-muted" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MyPipeline({ leads, navigate }) {
  const stages = PIPELINE_STAGES.map((stage) => {
    const matched = leads.filter(stage.match);
    const value = matched.reduce((sum, l) => sum + (Number(l.dealCloseValue || l.proposalValue || l.dealValue) || 0), 0);
    return { ...stage, count: matched.length, value };
  });
  return (
    <div className="bg-app-card p-5 rounded-xl border border-app-border">
      <h3 className="text-sm font-bold text-app-text mb-3">My Pipeline</h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {stages.map((stage, i) => (
          <button
            key={stage.key}
            type="button"
            onClick={go(navigate, `tab=working-leads&${stage.param || `status=${encodeURIComponent(stage.key)}`}`)}
            className="relative text-left p-3 rounded-lg bg-form-input-bg border border-app-border hover:border-primary/40 transition-colors cursor-pointer"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-app-text-muted">{stage.label}</div>
            <div className="text-xl font-extrabold text-app-text mt-1">{stage.count}</div>
            <div className="text-[11px] text-app-text-muted">{fmtINR(stage.value)}</div>
            {i < stages.length - 1 && <ChevronRight size={14} className="hidden sm:block absolute -right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted z-10" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function LeadWidgets({ leads, isLoading, today, navigate }) {
  const wonThisMonth = leads.filter(isWonThisMonth);
  const wonValue = wonThisMonth.reduce((sum, l) => sum + (Number(l.dealCloseValue) || 0), 0);
  const tiles = [
    { key: 'total', label: 'Total Leads Assigned', icon: Users, value: leads.length, onClick: go(navigate, 'tab=working-leads&scope=all') },
    { key: 'next-action', label: 'No Next Action', icon: CircleDashed, tone: 'warning', value: leads.filter(needsNextAction).length, onClick: go(navigate, 'tab=working-leads&noNext=1') },
    {
      key: 'today', label: "Today's Tasks", icon: ListTodo, value: today ? today.dueToday + today.overdue : '—',
      sub: today?.overdue ? `${today.overdue} overdue` : undefined,
      onClick: () => document.getElementById('today-agenda')?.scrollIntoView({ behavior: 'smooth' }),
    },
    { key: 'new', label: 'New Leads', icon: UserPlus, value: leads.filter((l) => l.status === 'New').length, onClick: go(navigate, 'tab=raw-leads') },
    { key: 'call-pending', label: 'Call Pending', icon: PhoneCall, value: leads.filter(isCallPending).length, onClick: go(navigate, 'tab=raw-leads&urgent=1') },
    { key: 'followups-today', label: 'Follow-ups Today', icon: CalendarClock, value: leads.filter((l) => followUpBucket(l) === 'today').length, onClick: go(navigate, 'tab=followups&bucket=Today') },
    { key: 'followups-overdue', label: 'Overdue Follow-ups', icon: AlertCircle, tone: 'danger', value: leads.filter((l) => followUpBucket(l) === 'overdue').length, onClick: go(navigate, 'tab=followups&bucket=Overdue') },
    { key: 'hot', label: 'Hot Leads', icon: Flame, value: leads.filter((l) => l.interestLevel === 'Hot Lead').length, onClick: go(navigate, 'tab=working-leads&interest=Hot Lead') },
    { key: 'proposal', label: 'Proposal Sent', icon: FileText, value: leads.filter((l) => l.status === 'Proposal Sent').length, onClick: go(navigate, 'tab=working-leads&status=Proposal Sent') },
    { key: 'negotiation', label: 'Negotiation', icon: Handshake, value: leads.filter((l) => l.status === 'Negotiation').length, onClick: go(navigate, 'tab=working-leads&status=Negotiation') },
    {
      key: 'won', label: 'Won This Month', icon: Trophy, tone: 'success', value: wonThisMonth.length,
      sub: fmtINR(wonValue), onClick: go(navigate, 'tab=working-leads&status=Won&period=thisMonth'),
    },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-app-text">Lead Pipeline</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map(({ key, ...tile }) => <StatTile key={key} {...tile} loading={isLoading} />)}
      </div>
      {!isLoading && <MyPipeline leads={leads} navigate={navigate} />}
    </div>
  );
}

/** Dashboard tab: BD lead widgets (for lead roles), today's agenda, and the personal summary. */
export default function HomeTab({ employee }) {
  const navigate = useNavigate();
  const { can } = useAccess();
  const canViewLeads = can('leads.view');
  const { data: leads = [], isLoading: leadsLoading } = useEssLeads(canViewLeads);
  const { data: today, isLoading: todayLoading } = useEssToday();

  const tasks = employee.tasks || [];
  const openTasks = tasks.filter((t) => !['Completed', 'Cancelled'].includes(t.status)).length;
  const achievedGoals = employee.performance?.filter((g) => g.status === 'Achieved').length || 0;
  const todayLog = employee.attendance?.find((a) => new Date(a.date).toDateString() === new Date().toDateString());
  const onProbation = employee.employmentStatus === 'Probation' && employee.probation?.isApplicable;

  return (
    <div className="space-y-6">
      {canViewLeads && <LeadWidgets leads={leads} isLoading={leadsLoading} today={today} navigate={navigate} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-app-card p-5 rounded-xl border border-app-border space-y-1">
              <div className="text-app-text-muted text-xs uppercase tracking-wider">Open Tasks</div>
              <div className="text-3xl font-extrabold text-app-text">{openTasks} / {tasks.length}</div>
            </div>
            <div className="bg-app-card p-5 rounded-xl border border-app-border space-y-1">
              <div className="text-app-text-muted text-xs uppercase tracking-wider">Performance Goals</div>
              <div className="text-3xl font-extrabold text-app-text">{achievedGoals} / {employee.performance?.length || 0}</div>
            </div>
            <div className="bg-app-card p-5 rounded-xl border border-app-border space-y-1">
              <div className="text-app-text-muted text-xs uppercase tracking-wider">Latest Attendance Status</div>
              <div className="text-lg font-bold text-primary mt-1">
                {todayLog ? (
                  <div className="flex flex-col gap-1 items-start">
                    <span>{todayLog.status} ({todayLog.clockIn} - {todayLog.clockOut || 'Now'})</span>
                    {todayLog.lateByMins > 0 && (
                      <span className="text-[10px] font-bold bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded tracking-wider">LATE BY {formatDuration(todayLog.lateByMins).toUpperCase()}</span>
                    )}
                  </div>
                ) : 'Not Logged Today'}
              </div>
            </div>
          </div>

          <TodayAgenda today={today} isLoading={todayLoading} navigate={navigate} />

          <div className="bg-app-card p-6 rounded-xl border border-app-border space-y-4">
            <h3 className="text-lg font-bold">Assigned Tasks Summary</h3>
            <div className="divide-y divide-app-border">
              {tasks.slice(0, 3).map((task) => (
                <div key={task._id} className="py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{task.title}</div>
                    <div className="text-xs text-app-text-muted mt-0.5">{task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : 'No deadline'}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shrink-0 ${task.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                    {taskStatusLabel(task.status)}
                  </span>
                </div>
              ))}
              {tasks.length === 0 && <div className="text-center py-4 text-app-text-muted text-sm">No tasks assigned to you currently.</div>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-app-card p-6 rounded-xl border border-app-border text-center space-y-4">
            {employee.profilePhoto ? (
              <img src={employee.profilePhoto} alt="" className="w-16 h-16 rounded-full object-cover mx-auto border border-primary/15" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl mx-auto border border-primary/15">
                {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="font-bold text-lg">{employee.firstName} {employee.lastName}</h3>
              <p className="text-xs text-app-text-muted">{employee.designation || employee.roleDept}</p>
            </div>
            <div className="text-xs text-left bg-white/[0.02] p-3 rounded-lg border border-app-border space-y-2 text-app-text">
              <div className="flex justify-between gap-2"><span>Employee ID:</span><span className="font-mono">{employee.employeeId}</span></div>
              <div className="flex justify-between gap-2"><span>Joining Date:</span><span>{new Date(employee.joinDate).toLocaleDateString()}</span></div>
              <div className="flex justify-between gap-2"><span>Department/Role:</span><span className="text-right">{employee.department || employee.roleDept}</span></div>
              <div className="flex justify-between gap-2"><span>Employment Status:</span><span>{onProbation ? 'On Probation' : (employee.employmentStatus || 'Permanent')}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
