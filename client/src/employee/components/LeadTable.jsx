import { Phone, Eye } from 'lucide-react';
import NoCopyText from './NoCopyText';
import WhatsAppAction from './WhatsAppAction';
import { fmtDateTime } from '../lib/datetime';
import { NON_ACTIVE_FOLLOWUP_STATUSES } from '../../shared/leadConstants';

const STATUS_BADGE_CLASSES = {
  Won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Lost: 'bg-red-500/10 text-red-400 border-red-500/20',
  Dropped: 'bg-red-500/10 text-red-400 border-red-500/20',
  New: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

/**
 * Compact table for the Raw/Working Leads and Follow-ups lists — only what a
 * BD needs to pick the next lead to work. Everything else (notes, interest,
 * follow-up, stage, proposal) is on the lead page, opened by tapping the row
 * or View. On phones the detail columns fold under the name, leaving Lead,
 * Next follow-up and the actions.
 */
export default function LeadTable({ leads, onOpen }) {
  return (
    <div className="bg-app-card border border-app-border rounded-xl overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-form-input-bg text-app-text-muted text-[11px] uppercase tracking-wider border-b border-app-border">
          <tr>
            <th className="px-3 md:px-4 py-3 font-semibold">Lead</th>
            <th className="hidden md:table-cell px-4 py-3 font-semibold">Phone</th>
            <th className="hidden md:table-cell px-4 py-3 font-semibold">Service</th>
            <th className="hidden md:table-cell px-4 py-3 font-semibold">Stage</th>
            <th className="hidden md:table-cell px-4 py-3 font-semibold">Interest</th>
            <th className="hidden md:table-cell px-4 py-3 font-semibold">Assigned</th>
            <th className="px-3 md:px-4 py-3 font-semibold">Next follow-up</th>
            <th className="px-3 md:px-4 py-3 font-semibold text-right"><span className="sr-only md:not-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {leads.map((lead) => {
            const active = !NON_ACTIVE_FOLLOWUP_STATUSES.includes(lead.status);
            const overdue = active && lead.nextFollowUpDate && new Date(lead.nextFollowUpDate) < new Date();
            return (
              <tr key={lead._id} onClick={() => onOpen(lead)} className="hover:bg-form-input-bg/60 transition-colors cursor-pointer align-middle">
                <td className="px-3 md:px-4 py-3 max-w-[180px] md:max-w-[200px]">
                  <NoCopyText className="block font-semibold text-app-text truncate">{lead.fullName}</NoCopyText>
                  <span className="text-[11px] font-mono text-primary">{lead.leadId}</span>
                  {/* Phones: the hidden columns, folded under the name */}
                  <div className="md:hidden mt-1 space-y-0.5 text-[11px] text-app-text-muted">
                    <NoCopyText className="block text-app-text">{lead.phone}</NoCopyText>
                    <span className="block truncate">{lead.service || '—'}</span>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-px text-[9px] uppercase font-bold tracking-wider rounded border ${STATUS_BADGE_CLASSES[lead.status] || 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{lead.status}</span>
                      {lead.interestLevel && <span>{lead.interestLevel}</span>}
                    </span>
                    <span className="block">Assigned {fmtDateTime(lead.assignedAt)}</span>
                  </div>
                </td>
                <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                  <NoCopyText className="text-app-text">{lead.phone}</NoCopyText>
                </td>
                <td className="hidden md:table-cell px-4 py-3 max-w-[180px]">
                  <span className="block truncate text-app-text-muted" title={lead.service}>{lead.service || '—'}</span>
                </td>
                <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${STATUS_BADGE_CLASSES[lead.status] || 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-xs text-app-text-muted">{lead.interestLevel || '—'}</td>
                <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-xs text-app-text-muted">{fmtDateTime(lead.assignedAt)}</td>
                <td className={`px-3 md:px-4 py-3 md:whitespace-nowrap text-xs ${overdue ? 'text-red-400 font-semibold' : !lead.nextFollowUpDate && active ? 'text-amber-500' : 'text-app-text-muted'}`}>
                  {lead.nextFollowUpDate && active ? `${fmtDateTime(lead.nextFollowUpDate)}${overdue ? ' · overdue' : ''}` : active ? 'None' : '—'}
                </td>
                {/* Actions don't open the row */}
                <td className="px-3 md:px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col md:flex-row items-end md:items-center justify-end gap-1.5">
                    <a href={`tel:${lead.phone}`} title="Call" className="p-1.5 rounded-lg bg-primary text-white hover:opacity-90">
                      <Phone size={14} />
                    </a>
                    <WhatsAppAction lead={lead} label="" className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer flex items-center" />
                    <button type="button" onClick={() => onOpen(lead)} title="View lead" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold cursor-pointer">
                      <Eye size={14} /> <span className="hidden md:inline">View</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
