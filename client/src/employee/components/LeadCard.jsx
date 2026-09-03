import { useState } from 'react';
import { Phone, Mail, MessageCircle, Eye, CalendarClock, StickyNote, Flame, TrendingUp, FileText, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import employeeApi from '../../services/employeeApi';
import NoCopyText from './NoCopyText';
import { INTEREST_LEVELS } from '../../shared/leadConstants';

/** WhatsApp deep link — Indian 10-digit numbers get the country code prefixed. */
function toWhatsAppHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

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

/**
 * A single lead card for the mobile-first Raw/Working Leads and Follow-ups
 * lists. Quick actions that only ever touch one un-gated field (follow-up
 * date, remark, interest level) save inline, one tap, no navigation. Actions
 * that need server/utils/leadStateMachine.js's full validated form (Stage,
 * Proposal) route to the Lead Workspace page instead of risking a confusing
 * inline validation error on a compact card.
 */
export default function LeadCard({ lead, onUpdated, navigate }) {
  const [openPanel, setOpenPanel] = useState(null); // 'followup' | 'note' | 'interest' | null
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState(lead.remark || '');
  const [saving, setSaving] = useState(false);

  const togglePanel = (panel) => {
    if (openPanel === panel) {
      setOpenPanel(null);
      return;
    }
    if (panel === 'followup') setFollowUpDraft(lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().slice(0, 16) : '');
    if (panel === 'note') setNoteDraft(lead.remark || '');
    setOpenPanel(panel);
  };

  const save = async (fields) => {
    try {
      setSaving(true);
      const res = await employeeApi.put(`/employee-portal/ess/leads/${lead._id}`, fields);
      if (res.data.success) {
        toast.success('Saved', { duration: 1000, position: 'bottom-right' });
        onUpdated?.(res.data.lead);
        setOpenPanel(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id={`lead-card-${lead._id}`} className="bg-app-card border border-app-border rounded-xl p-6 hover:border-primary/20 transition-all scroll-mt-4">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-primary">{lead.leadId}</span>
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
          </p>
        </div>
        <button
          onClick={() => navigate(`/employee/leads/${lead._id}`)}
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

      {lead.nextFollowUpDate && (
        <p className="text-xs text-app-text-muted mt-3">
          Next follow-up: {new Date(lead.nextFollowUpDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-app-border">
        <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-primary text-white">
          <Phone size={13} /> Call
        </a>
        {toWhatsAppHref(lead.phone) && (
          <a href={toWhatsAppHref(lead.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
            <MessageCircle size={13} /> WhatsApp
          </a>
        )}
        <QuickActionButton icon={CalendarClock} label="Follow-up" active={openPanel === 'followup'} onClick={() => togglePanel('followup')} />
        <QuickActionButton icon={StickyNote} label="Note" active={openPanel === 'note'} onClick={() => togglePanel('note')} />
        <QuickActionButton icon={Flame} label="Interest" active={openPanel === 'interest'} onClick={() => togglePanel('interest')} />
        <QuickActionButton icon={TrendingUp} label="Stage" onClick={() => navigate(`/employee/leads/${lead._id}`)} />
        <QuickActionButton icon={FileText} label="Proposal" onClick={() => navigate(`/employee/leads/${lead._id}`)} />
        <QuickActionButton icon={MoreHorizontal} label="More" onClick={() => navigate(`/employee/leads/${lead._id}`)} />
      </div>

      {openPanel === 'followup' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 bg-form-input-bg p-3 rounded-lg">
          <input
            type="datetime-local"
            value={followUpDraft}
            onChange={(e) => setFollowUpDraft(e.target.value)}
            className="bg-app-card border border-app-border rounded-lg px-3 py-1.5 text-sm text-app-text focus:outline-none focus:border-primary/50"
            style={{ colorScheme: 'dark' }}
          />
          <button
            disabled={saving || !followUpDraft}
            onClick={() => save({ nextFollowUpDate: new Date(followUpDraft).toISOString() })}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"
          >
            Save
          </button>
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
