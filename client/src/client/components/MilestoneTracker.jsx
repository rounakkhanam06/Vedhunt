import { CheckCircle, Loader2, Clock } from 'lucide-react';

/**
 * MilestoneTracker — horizontal stepper showing project milestones in linear order.
 * Shows Completed / In Progress / Pending states with connecting line.
 */
const STATUS_CONFIG = {
  Completed: {
    icon: CheckCircle,
    color: 'text-[#22C55E]',
    bg: 'bg-[#22C55E]',
    ring: 'ring-[#22C55E]/30',
    label: 'Completed',
  },
  'In Progress': {
    icon: Loader2,
    color: 'text-primary',
    bg: 'bg-primary',
    ring: 'ring-[#FF5A1F]/30',
    label: 'In Progress',
    animate: true,
  },
  Pending: {
    icon: Clock,
    color: 'text-[#6B7280]',
    bg: 'bg-[#2B2A2A]',
    ring: 'ring-[#6B7280]/20',
    label: 'Pending',
  },
};

const MilestoneTracker = ({ milestones = [] }) => {
  if (!milestones.length) {
    return (
      <p className="text-[#6B7280] text-sm text-center py-4">
        No milestones defined yet.
      </p>
    );
  }

  const sorted = [...milestones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="w-full overflow-x-auto pb-2">
      {/* Horizontal stepper (desktop) */}
      <div className="hidden sm:flex items-start relative min-w-max gap-0">
        {sorted.map((milestone, idx) => {
          const cfg = STATUS_CONFIG[milestone.status] || STATUS_CONFIG.Pending;
          const Icon = cfg.icon;
          const isLast = idx === sorted.length - 1;

          return (
            <div key={milestone._id || idx} className="flex items-start">
              {/* Step */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center ring-4 ${cfg.bg} ${cfg.ring} z-10 relative`}
                >
                  <Icon
                    size={16}
                    className={`text-white ${cfg.animate ? 'animate-spin' : ''}`}
                  />
                </div>
                <div className="mt-2 max-w-[110px] text-center">
                  <p className="text-white text-xs font-medium leading-snug line-clamp-2">
                    {milestone.title}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${cfg.color}`}>{cfg.label}</p>
                  {milestone.targetDate && (
                    <p className="text-[10px] text-[#6B7280] mt-0.5">
                      {new Date(milestone.targetDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="mt-4 flex-1 min-w-[48px] h-0.5 bg-[#2B2A2A] relative">
                  <div
                    className={`absolute inset-0 transition-all duration-500 ${
                      milestone.status === 'Completed' ? 'bg-[#22C55E]' : ''
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vertical stepper (mobile) */}
      <div className="sm:hidden flex flex-col gap-0">
        {sorted.map((milestone, idx) => {
          const cfg = STATUS_CONFIG[milestone.status] || STATUS_CONFIG.Pending;
          const Icon = cfg.icon;
          const isLast = idx === sorted.length - 1;

          return (
            <div key={milestone._id || idx} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ${cfg.bg} ${cfg.ring} shrink-0`}>
                  <Icon size={14} className={`text-white ${cfg.animate ? 'animate-spin' : ''}`} />
                </div>
                {!isLast && <div className="w-0.5 flex-1 bg-[#2B2A2A] my-1 min-h-[24px]" />}
              </div>
              <div className="pb-4">
                <p className="text-white text-sm font-medium">{milestone.title}</p>
                <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
                {milestone.targetDate && (
                  <p className="text-xs text-[#6B7280]">
                    Target: {new Date(milestone.targetDate).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MilestoneTracker;
