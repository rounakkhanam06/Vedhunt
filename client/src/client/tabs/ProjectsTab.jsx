import { useState, useEffect } from 'react';
import clientService from '../../services/clientService';
import StatusBadge from '../components/StatusBadge';
import MilestoneTracker from '../components/MilestoneTracker';
import { Rocket, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

const ProjectsTab = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    clientService
      .getProjects({ limit: 50 })
      .then((res) => {
        setProjects(res.data || []);
        // Auto-expand first active project
        const first = (res.data || []).find((p) => p.status === 'Active');
        if (first) setExpandedId(first._id);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold">Project Tracking</h2>
          <p className="text-[#D1D5DB] text-sm mt-1">Monitor your project milestones and progress</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            clientService.getProjects({ limit: 50 }).then((r) => setProjects(r.data || [])).finally(() => setLoading(false));
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white text-sm transition-all cursor-pointer"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Rocket size={40} className="text-[#2B2A2A]" />
          <p className="text-[#9CA3AF] text-sm">No active projects found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const isExpanded = expandedId === project._id;
            const completed = (project.milestones || []).filter((m) => m.status === 'Completed').length;
            const total = (project.milestones || []).length;
            const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div
                key={project._id}
                className="bg-bg-card border border-border-default rounded-2xl overflow-hidden transition-all"
              >
                {/* Project Header */}
                <button
                  onClick={() => toggleExpand(project._id)}
                  className="w-full flex items-start gap-4 p-5 hover:bg-bg-surface/30 transition-colors cursor-pointer text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold text-base truncate">{project.projectName}</h3>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="text-[#9CA3AF] text-xs mb-3">
                      {project.projectId} {project.startDate && `· Started ${new Date(project.startDate).toLocaleDateString('en-IN')}`}
                      {project.expectedEndDate && ` · Due ${new Date(project.expectedEndDate).toLocaleDateString('en-IN')}`}
                    </p>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#FF5A1F] to-[#FF7A47] rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-primary text-xs font-semibold shrink-0">
                        {progressPct}%
                      </span>
                    </div>
                    <p className="text-[#9CA3AF] text-xs mt-1">
                      {completed} of {total} milestone{total !== 1 ? 's' : ''} completed
                    </p>
                  </div>

                  <div className="text-[#9CA3AF] shrink-0 mt-1">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Milestone Detail */}
                {isExpanded && (
                  <div className="px-5 pb-6 border-t border-border-default/40 pt-4">
                    <p className="text-[#D1D5DB] text-xs font-medium uppercase tracking-wider mb-4">
                      Milestones
                    </p>
                    <MilestoneTracker milestones={project.milestones || []} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectsTab;
