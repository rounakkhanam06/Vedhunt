import { useMemo, useState } from 'react';
import {
  ArrowLeft, Edit2, User, ShieldCheck, CalendarDays, Target, IndianRupee, Mail, Phone, MapPin,
  Briefcase, Building2, BadgeCheck, CreditCard, Cake, UserRound, ListTodo,
} from 'lucide-react';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const initials = (e) => `${e.firstName?.[0] || ''}${e.lastName?.[0] || ''}`.toUpperCase() || '?';

function Section({ title, icon: Icon, children, action }) {
  return (
    <section className="bg-app-card border border-app-border rounded-xl p-4 sm:p-5 space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
          {Icon && <Icon size={15} className="text-primary" />} {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// Label / value rows that wrap cleanly on small screens
function Fields({ rows }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.filter(Boolean).map(([label, value, icon]) => {
        const Icon = icon;
        return (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted flex items-center gap-1">
              {Icon && <Icon size={11} />} {label}
            </dt>
            <dd className="text-sm text-app-text mt-0.5 break-words">{value || '—'}</dd>
          </div>
        );
      })}
    </dl>
  );
}

const STATUS_PILL = {
  Present: 'bg-emerald-500/10 text-emerald-400', Leave: 'bg-blue-500/10 text-blue-400', Absent: 'bg-rose-500/10 text-rose-400',
  Weekend: 'bg-purple-500/10 text-purple-400', Holiday: 'bg-teal-500/10 text-teal-400',
};
const TASK_PILL = {
  Completed: 'bg-emerald-500/10 text-emerald-400', 'In Progress': 'bg-blue-500/10 text-blue-400', Blocked: 'bg-rose-500/10 text-rose-400',
};

/**
 * Full-page employee profile (Admin → Employees → eye icon, /admin/employees/:id).
 * Layout only: the actions keep living in EmployeeManager and arrive here as
 * ready-made blocks (access, probation, leaveForm, goalForm, salary), so
 * every permission check and API call stays where it was.
 */
export default function EmployeeProfile({
  emp, employees = [], canManage, canSalary, onBack, onEdit,
  access, probation, leaveForm, goalForm, salary,
}) {
  const tabs = [
    { key: 'info', label: 'Employee Information', icon: User },
    canManage && { key: 'access', label: 'Access & Permissions', icon: ShieldCheck },
    { key: 'leave', label: 'Leave & Attendance', icon: CalendarDays },
    { key: 'goals', label: 'Goals & Tasks', icon: Target },
    canSalary && { key: 'salary', label: 'Salary', icon: IndianRupee },
  ].filter(Boolean);
  const [tab, setTab] = useState('info');
  const current = tabs.some((t) => t.key === tab) ? tab : 'info';

  const manager = useMemo(
    () => employees.find((e) => String(e._id) === String(emp.reportingManager?._id || emp.reportingManager)),
    [employees, emp.reportingManager],
  );
  const active = Boolean(emp.adminId?.isActive);
  const tasks = emp.tasks || [];
  const openTasks = tasks.filter((t) => t.status !== 'Completed').length;
  const goals = emp.performance || [];
  const pendingGoals = goals.filter((g) => g.status !== 'Achieved').length;
  const used = emp.leavesUsed || {};
  const balance = emp.leaveBalances || {};
  const totalUsed = (used.CL || 0) + (used.SL || 0) + (used.PL || 0);
  const attendance = [...(emp.attendance || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  const bankDetails = emp.bankDetails || {};

  return (
    <div className="space-y-6 text-app-text">
      <button type="button" onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-app-text-muted hover:text-primary transition-colors cursor-pointer">
        <ArrowLeft size={16} /> All employees
      </button>

      {/* Header */}
      <div className="bg-app-card border border-app-border rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {emp.profilePhoto ? (
            <img src={emp.profilePhoto} alt="" className="w-16 h-16 rounded-2xl object-cover border border-app-border shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-extrabold shrink-0">{initials(emp)}</div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight break-words">{emp.firstName} {emp.lastName}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                {active ? 'Active' : 'Deactivated'}
              </span>
            </div>
            <p className="text-sm text-app-text-muted mt-0.5 break-words">
              {[emp.designation, emp.roleDept].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs font-mono text-primary mt-1">{emp.employeeId}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:w-auto">
          {[['Joined', fmtDate(emp.joinDate)], ['Open tasks', openTasks], ['Leaves used', totalUsed]].map(([label, value]) => (
            <div key={label} className="bg-app-bg border border-app-border rounded-xl px-3 py-2 text-center min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-app-text-muted">{label}</div>
              <div className="text-sm font-bold mt-0.5 truncate">{value}</div>
            </div>
          ))}
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors cursor-pointer shrink-0">
            <Edit2 size={14} /> Edit details
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-app-border overflow-x-auto">
        <div className="flex gap-1 min-w-max" role="tablist" aria-label="Employee sections">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" role="tab" aria-selected={current === key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap ${
                current === key ? 'border-primary text-primary' : 'border-transparent text-app-text-muted hover:text-app-text'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {current === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Personal & contact" icon={UserRound}>
            <Fields rows={[
              ['Full name', `${emp.firstName} ${emp.lastName}`],
              ['Email', emp.email, Mail],
              ['Phone', emp.phone, Phone],
              ['Date of birth', emp.dateOfBirth ? fmtDate(emp.dateOfBirth) : null, Cake],
              ['Work location', emp.workLocation, MapPin],
            ]} />
          </Section>
          <Section title="Employment" icon={Briefcase}>
            <Fields rows={[
              ['Employee ID', emp.employeeId],
              ['Role', emp.roleDept],
              ['Designation', emp.designation],
              ['Department', [emp.department, emp.subDepartment].filter(Boolean).join(' / ') || null, Building2],
              ['Employment type', emp.employmentType],
              ['Status', emp.employmentStatus, BadgeCheck],
              ['Joined', fmtDate(emp.joinDate)],
              ['Reporting manager', manager ? `${manager.firstName} ${manager.lastName}` : null],
            ]} />
          </Section>
          <Section title="Identity & bank" icon={CreditCard}>
            <Fields rows={[
              ['PAN', emp.panNumber],
              ['Aadhaar', emp.aadhaarNumber],
              ['Bank', bankDetails.bankName],
              ['Account number', bankDetails.accountNumber],
              ['IFSC', bankDetails.ifscCode],
              ['PF number', emp.pfNumber],
              ['Annual CTC', emp.salaryCTC != null ? `₹${Number(emp.salaryCTC).toLocaleString('en-IN')}` : 'Hidden'],
            ]} />
          </Section>
          <Section title="Skills & responsibilities" icon={ListTodo}>
            {emp.skills?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {emp.skills.map((s) => <span key={s} className="px-2 py-0.5 rounded-full bg-app-bg border border-app-border text-xs">{s}</span>)}
              </div>
            ) : <p className="text-sm text-app-text-muted">No skills recorded.</p>}
            <p className="text-sm text-app-text whitespace-pre-line break-words">{emp.responsibilities || <span className="text-app-text-muted">No responsibilities recorded.</span>}</p>
          </Section>
          {probation && <div className="lg:col-span-2">{probation}</div>}
        </div>
      )}

      {current === 'access' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4 min-w-0">{access?.account}</div>
          <div className="bg-app-card border border-app-border rounded-xl p-4 sm:p-5 min-w-0">{access?.pages}</div>
        </div>
      )}

      {current === 'leave' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[['CL', 'Casual leave'], ['SL', 'Sick leave'], ['PL', 'Paid leave']].map(([k, label]) => {
              const left = Math.max(0, (balance[k] || 0) - (used[k] || 0));
              return (
                <div key={k} className="bg-app-card border border-app-border rounded-xl p-4">
                  <div className="text-xs text-app-text-muted">{label}</div>
                  <div className="text-2xl font-extrabold mt-1">{left} <span className="text-sm font-normal text-app-text-muted">/ {balance[k] || 0} left</span></div>
                  <div className="text-[11px] text-app-text-muted mt-1">{used[k] || 0} used</div>
                </div>
              );
            })}
          </div>
          {leaveForm && <div className="bg-app-card border border-app-border rounded-xl p-4 sm:p-5">{leaveForm}</div>}
          <Section title="Recent attendance" icon={CalendarDays}>
            {attendance.length === 0 ? <p className="text-sm text-app-text-muted">No attendance recorded yet.</p> : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-app-text-muted text-left">
                      <th className="px-1 py-2 font-semibold">Date</th><th className="px-1 py-2 font-semibold">Status</th>
                      <th className="px-1 py-2 font-semibold">In</th><th className="px-1 py-2 font-semibold">Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {attendance.map((a) => (
                      <tr key={a._id || a.date}>
                        <td className="px-1 py-2 whitespace-nowrap">{fmtDate(a.date)}</td>
                        <td className="px-1 py-2"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_PILL[a.status] || 'bg-app-bg'}`}>{a.status}</span>{a.lateByMins > 0 && <span className="ml-1.5 text-[11px] text-rose-400">late {a.lateByMins}m</span>}</td>
                        <td className="px-1 py-2 font-mono text-xs">{a.clockIn || '—'}</td>
                        <td className="px-1 py-2 font-mono text-xs">{a.clockOut || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {current === 'goals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4 min-w-0">
            <Section title={`Goals (${pendingGoals} pending)`} icon={Target}>
              {goals.length === 0 ? <p className="text-sm text-app-text-muted">No goals assigned yet.</p> : (
                <ul className="divide-y divide-app-border">
                  {goals.map((g) => (
                    <li key={g._id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm break-words">{g.goal}</p>
                        <p className="text-[11px] text-app-text-muted mt-0.5">Target {fmtDate(g.targetDate)}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${g.status === 'Achieved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>{g.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            {goalForm && <div className="bg-app-card border border-app-border rounded-xl p-4 sm:p-5">{goalForm}</div>}
          </div>
          <Section title={`Tasks (${openTasks} open)`} icon={ListTodo}>
            {tasks.length === 0 ? <p className="text-sm text-app-text-muted">No tasks assigned yet.</p> : (
              <ul className="divide-y divide-app-border">
                {[...tasks].reverse().slice(0, 10).map((t) => (
                  <li key={t._id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm break-words">{t.title}</p>
                      <p className="text-[11px] text-app-text-muted mt-0.5">{t.dueDate ? `Due ${fmtDate(t.dueDate)}` : 'No due date'}{t.priority ? ` · ${t.priority}` : ''}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${TASK_PILL[t.status] || 'bg-app-bg text-app-text-muted'}`}>{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {current === 'salary' && <div className="max-w-2xl bg-app-card border border-app-border rounded-xl p-4 sm:p-5">{salary}</div>}
    </div>
  );
}
