/**
 * StatusBadge — reusable pill badge for invoice, project, ticket, retainer statuses
 */
const STATUS_STYLES = {
  // Invoice
  Paid:     'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/25',
  Unpaid:   'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/25',
  Overdue:  'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25',
  // Project
  Active:      'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/25',
  'On Hold':   'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/25',
  Completed:   'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/25',
  Cancelled:   'bg-[#6B7280]/15 text-[#6B7280] border-[#6B7280]/25',
  // Retainer
  Expired:   'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25',
  Paused:    'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/25',
  // Ticket Status
  Open:           'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/25',
  'In Progress':  'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/25',
  'Pending Client': 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/25',
  Resolved:       'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/25',
  Closed:         'bg-[#6B7280]/15 text-[#6B7280] border-[#6B7280]/25',
  // Milestone
  Pending:        'bg-[#6B7280]/15 text-[#6B7280] border-[#6B7280]/25',
  // Priority
  Low:      'bg-[#6B7280]/15 text-[#6B7280] border-[#6B7280]/25',
  Medium:   'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/25',
  High:     'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/25',
  Critical: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25',
};

const StatusBadge = ({ status, size = 'sm' }) => {
  const style = STATUS_STYLES[status] || 'bg-[#6B7280]/15 text-[#9CA3AF] border-[#6B7280]/20';
  const textSize = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center border rounded-full font-medium whitespace-nowrap ${style} ${textSize}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
