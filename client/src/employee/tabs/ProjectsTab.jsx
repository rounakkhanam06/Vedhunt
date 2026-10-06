import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Users, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import EscalationLog from '../../components/projects/EscalationLog';
import { Spinner, EmptyCard, TabHeader } from '../components/PortalUI';
import { useEssProjects, essPut, essPost, apiError } from '../lib/ess';
import { fmtDate } from '../lib/datetime';

const STATUS_CLASS = {
  Active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'On Hold': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};
const MILESTONE_STATUSES = ['Pending', 'In Progress', 'Completed'];
const badge = 'px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider';
// A milestone still open after its target date
const milestoneLate = (m) => m.status !== 'Completed' && m.targetDate && new Date(m.targetDate).setHours(23, 59, 59, 999) < Date.now();
const person = (p) => (p ? `${p.firstName} ${p.lastName}` : '—');

function ProjectCard({ project, onChanged }) {
  const [open, setOpen] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState(null);
  const isPm = project.myRole === 'Project Manager';
  const openEscalations = (project.escalations || []).filter((e) => e.status === 'Open').length;
  const milestones = [...(project.milestones || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  const setMilestone = async (milestone, status) => {
    setSavingMilestone(milestone._id);
    try {
      await essPut(`/projects/${project._id}/milestones/${milestone._id}`, { status });
      onChanged();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the milestone.'));
    } finally {
      setSavingMilestone(null);
    }
  };

  return (
    <div className={`bg-app-card border rounded-xl p-5 ${project.overdue ? 'border-red-500/30' : 'border-app-border'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-primary">{project.projectId}</span>
            <h3 className="font-bold text-app-text">{project.projectName}</h3>
            <span className={`${badge} ${STATUS_CLASS[project.status]}`}>{project.status}</span>
            <span className={`${badge} border-app-border text-app-text`}>{project.myRole}</span>
            {project.overdue && <span className={`${badge} bg-red-500/10 text-red-400 border-red-500/20`}>Overdue</span>}
            {openEscalations > 0 && <span className={`${badge} bg-rose-500/10 text-rose-400 border-rose-500/20`}><AlertTriangle size={10} className="inline mr-0.5" />{openEscalations} open escalation{openEscalations > 1 ? 's' : ''}</span>}
          </div>
          <p className="text-xs text-app-text-muted mt-1">
            Client: {project.client_ref?.businessName || '—'} · PM: {person(project.projectManager)}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="p-1.5 text-app-text-muted hover:text-app-text cursor-pointer" aria-label="Details">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
        <div><div className="text-[10px] uppercase font-bold text-app-text-muted">Start</div><div className="font-semibold text-app-text">{fmtDate(project.startDate)}</div></div>
        <div><div className="text-[10px] uppercase font-bold text-app-text-muted">Expected end</div><div className={`font-semibold ${project.overdue ? 'text-red-400' : 'text-app-text'}`}>{fmtDate(project.expectedEndDate)}</div></div>
        <div><div className="text-[10px] uppercase font-bold text-app-text-muted">Completed</div><div className="font-semibold text-app-text">{fmtDate(project.completedAt)}</div></div>
        <div>
          <div className="text-[10px] uppercase font-bold text-app-text-muted">Progress</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-app-border/40 rounded-full"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${project.overallProgress || 0}%` }} /></div>
            <span className="font-semibold text-app-text">{project.overallProgress || 0}%</span>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-app-border grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-app-text-muted mb-2">Milestones</div>
              {milestones.length === 0 ? <p className="text-xs text-app-text-muted">No milestones defined.</p> : (
                <div className="space-y-2">
                  {milestones.map((m) => {
                    const late = milestoneLate(m);
                    return (
                      <div key={m._id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-form-input-bg/40 border border-app-border">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-app-text truncate">{m.title}</div>
                          <div className={`text-[11px] ${late ? 'text-red-400' : 'text-app-text-muted'}`}>
                            Target {fmtDate(m.targetDate)}{m.completedOn ? ` · done ${fmtDate(m.completedOn)}` : late ? ' · late' : ''}
                          </div>
                        </div>
                        {isPm ? (
                          <select value={m.status} disabled={savingMilestone === m._id} onChange={(e) => setMilestone(m, e.target.value)}
                            className="text-xs rounded-md border border-app-border bg-app-card px-2 py-1 text-app-text cursor-pointer" aria-label={`Status of ${m.title}`}>
                            {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : <span className="text-xs text-app-text-muted">{m.status}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-app-text-muted mb-2 flex items-center gap-1"><Users size={11} /> Team</div>
              <p className="text-sm text-app-text">{(project.teamMembers || []).map(person).join(', ') || 'No team members yet.'}</p>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-app-text-muted mb-2">Escalations</div>
            <EscalationLog
              escalations={project.escalations}
              canRaise
              canResolve={isPm}
              onRaise={(body) => essPost(`/projects/${project._id}/escalations`, body).then(onChanged)}
              onResolve={(id, resolution) => essPut(`/projects/${project._id}/escalations/${id}/resolve`, { resolution }).then(onChanged)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Projects I manage or am on — PMs update milestones and resolve escalations. */
export default function ProjectsTab() {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading } = useEssProjects();
  const refresh = () => ['projects', 'kpis'].forEach((k) => queryClient.invalidateQueries({ queryKey: ['ess', k] }));
  const active = projects.filter((p) => !['Completed', 'Cancelled'].includes(p.status));
  const closed = projects.filter((p) => ['Completed', 'Cancelled'].includes(p.status));

  return (
    <div className="space-y-6">
      <TabHeader title="My Projects" subtitle="Projects you manage or are part of. Assignments are made by admin in Projects." />
      {isLoading ? <Spinner /> : projects.length === 0 ? <EmptyCard>You are not assigned to any project yet.</EmptyCard> : (
        <>
          <div className="space-y-4">{active.map((p) => <ProjectCard key={p._id} project={p} onChanged={refresh} />)}</div>
          {closed.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-app-text-muted uppercase tracking-wider">Completed / Cancelled</h3>
              {closed.map((p) => <ProjectCard key={p._id} project={p} onChanged={refresh} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
