import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * SLACountdown — live countdown timer showing remaining SLA time for a support ticket.
 * Auto-refreshes every 30 seconds.
 */
const SLACountdown = ({ slaDeadline, status }) => {
  const isResolved = ['Resolved', 'Closed'].includes(status);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (isResolved || !slaDeadline) return;

    const compute = () => {
      const diff = new Date(slaDeadline).getTime() - Date.now();
      setRemaining(diff);
    };

    compute();
    const interval = setInterval(compute, 30_000);
    return () => clearInterval(interval);
  }, [slaDeadline, isResolved]);

  if (isResolved) {
    return (
      <span className="inline-flex items-center gap-1 text-[#22C55E] text-xs font-medium">
        <CheckCircle size={12} />
        Resolved
      </span>
    );
  }

  if (remaining === null) return null;

  const isBreached = remaining < 0;
  const absMs = Math.abs(remaining);
  const totalMins = Math.floor(absMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;

  let label = '';
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${mins}m`;
  else label = `${mins}m`;

  if (isBreached) {
    return (
      <span className="inline-flex items-center gap-1 text-[#EF4444] text-xs font-semibold">
        <AlertTriangle size={12} />
        OVERDUE by {label}
      </span>
    );
  }

  const urgency = remaining < 4 * 3600 * 1000;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        urgency ? 'text-[#EF4444] animate-pulse' : 'text-[#F59E0B]'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label} left
    </span>
  );
};

export default SLACountdown;
