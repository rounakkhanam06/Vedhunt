import { useState } from 'react';
import { Phone, Mail, Eye, CalendarClock, StickyNote, Flame, TrendingUp, FileText, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import NoCopyText from './NoCopyText';
import WhatsAppAction from './WhatsAppAction';
import FollowUpForm from './FollowUpForm';
import { essPut, apiError } from '../lib/ess';
import { fmtDateTime, timeAgo } from '../lib/datetime';
import { INTEREST_LEVELS, NON_ACTIVE_FOLLOWUP_STATUSES } from '../../shared/leadConstants';

const STATUS_BADGE_CLASSES = {
  Won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Lost: 'bg-red-500/10 text-red-400 border-red-500/20',
  Dropped: 'bg-red-500/10 text-red-400 border-red-500/20',
  New: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const QuickActionButton = ({ icon: Icon, label, onClick, active }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
      active ? 'bg-primary text-white' : 'bg-form-input-bg text-app-text-muted hover:text-app-text hover:bg-app-border/40'
    }`}
  >
    <Icon size={13} /> {label}
  </button>
);

const InfoCell = ({ label, children, tone }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-wider font-bold text-app-text-muted">{label}</div>
    <div className={`text-xs font-semibold truncate mt-0.5 ${tone || 'text-app-text'}`}>{children}</div>
  </div>
);

/**
 * A single lead card for the Raw/Working Leads and Follow-ups lists. Shows the
 * working context (stage, interest, last activity, next action) at a glance.
 * Quick actions that touch one un-gated field (note, interest) save inline;
 * follow-ups go through FollowUpForm (outcome + next action); stage and
 * proposal work open the Lead Workspace.
 */
export default function LeadCard({ lead, onUpdated, navigate }) {
  const [openPanel, setOpenPanel] = useState(null); // 'followup' | 'note' | 'interest' | null
  const [noteDraft, setNoteDraft] = useState(lead.remark || '');
  const [saving, setSaving] = useState(false);

  const togglePanel = (panel) => {
    if (panel === 'note' && openPanel !== 'note') setNoteDraft(lead.remark || '');
    setOpenPanel(openPanel === panel ? null : panel);
  };

  const save = async (fields) => {
    try {
      setSaving(true);
      const res = await essPut(`/leads/${lead._id}`, fields);
      toast.success('Saved', { duration: 1000, position: 'bottom-right' });
      onUpdated?.(res.lead);
      setOpenPanel(null);
    } catch (err) {
      toast.error(apiError(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const active = !NON_ACTIVE_FOLLOWUP_STATUSES.includes(lead.status);
  const overdue = active && lead.nextFollowUpDate && new Date(lead.nextFollowUpDate) < new Date();
  const workspace = (suffix = '') => navigate(`/employee/leads/${lead._id}${suffix}`);

  return (
    <div id={`lead-card-${lead._id}`} className="bg-app-card border border-app-border rounded-xl p-5 sm:p-6 hover:border-primary/20 transition-all scroll-mt-4">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-primary" title="Vedhunt Lead ID">{lead.leadId}</span>
            <NoCopyText className="text-app-text font-bold">{lead.fullName}</NoCopyText>
            <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded border ${
              STATUS_BADGE_CLASSES[lead.status] || 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {lead.status}
            </span>
            {lead.interestLevel && (
              <span className="px-2.5 py-1 text-[10px] font-bold rounded border bg-primary/10 text-primary border-primary/20">
                {lead.interestLevel}
              </span>
            )}
          </div>
          <p className="text-xs text-app-text-muted mt-1">
            {lead.service} · {lead.platform}
            {lead.fbLeadId && <span className="font-mono"> · Meta Lead ID: {lead.fbLeadId}</span>}
          </p>
        </div>
        <button
          onClick={() => workspace()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-colors shrink-0"
        >
          <Eye size={14} /> View
        </button>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-app-text bg-form-input-bg p-4 rounded-lg mt-4">
        <NoCopyText className="flex items-center gap-1.5">
          <Phone size={14} /> {lead.phone}
        </NoCopyText>
        <NoCopyText className="flex items-center gap-1.5">
          <Mail size={14} /> {lead.email}
        </NoCopyText>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <InfoCell label="Stage">{lead.status}</InfoCell>
        <InfoCell label="Interest">{lead.interestLevel || '—'}</InfoCell>
        <InfoCell label="Last activity">
          {lead.lastActivity ? `${lead.lastActivity.status} · ${timeAgo(lead.lastActivity.date)}` : `Assigned · ${timeAgo(lead.assignedAt || lead.createdAt)}`}
        </InfoCell>
        <InfoCell label="Next action" tone={!lead.nextFollowUpDate && active ? 'text-amber-500' : overdue ? 'text-red-400' : undefined}>
          {lead.nextFollowUpDate && active
            ? `${lead.nextActionType || 'Follow-up'} · ${fmtDateTime(lead.nextFollowUpDate)}${overdue ? ' (overdue)' : ''}`
            : active ? 'None scheduled' : '—'}
        </InfoCell>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-app-border">
        <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-primary text-white">
          <Phone size={13} /> Call
        </a>
        <WhatsAppAction
          lead={lead}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
        />
        {active && <QuickActionButton icon={CalendarClock} label={lead.nextFollowUpDate ? 'Complete follow-up' : 'Follow-up'} active={openPanel === 'followup'} onClick={() => togglePanel('followup')} />}
        <QuickActionButton icon={StickyNote} label="Note" active={openPanel === 'note'} onClick={() => togglePanel('note')} />
        <QuickActionButton icon={Flame} label="Interest" active={openPanel === 'interest'} onClick={() => togglePanel('interest')} />
        <QuickActionButton icon={TrendingUp} label="Stage" onClick={() => workspace()} />
        <QuickActionButton icon={FileText} label="Proposal" onClick={() => workspace('?proposal=1')} />
        <QuickActionButton icon={MoreHorizontal} label="More" onClick={() => workspace()} />
      </div>

      {openPanel === 'followup' && (
        <div className="mt-3">
          <FollowUpForm lead={lead} onSaved={(updated) => { onUpdated?.(updated); setOpenPanel(null); }} onCancel={() => setOpenPanel(null)} />
        </div>
      )}

      {openPanel === 'note' && (
        <div className="mt-3 flex flex-col gap-2 bg-form-input-bg p-3 rounded-lg">
          <textarea
            rows={2}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add a note..."
            className="bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50 resize-none"
          />
          <button
            disabled={saving}
            onClick={() => save({ remark: noteDraft })}
            className="self-end px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      {openPanel === 'interest' && (
        <div className="mt-3 flex flex-wrap gap-2 bg-form-input-bg p-3 rounded-lg">
          {INTEREST_LEVELS.map((level) => (
            <button
              key={level}
              disabled={saving}
              onClick={() => save({ interestLevel: level })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                lead.interestLevel === level ? 'bg-primary text-white' : 'bg-app-card border border-app-border text-app-text hover:border-primary/50'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-app-text-muted mt-4 border-t border-app-border pt-4">
        <span>Source: <span className="text-app-text-muted font-medium">{lead.userSource || 'Direct'}</span></span>
        <span>Created: {new Date(lead.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
