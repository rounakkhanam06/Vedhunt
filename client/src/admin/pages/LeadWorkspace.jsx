import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Mail, Phone, Clock, FileText, Play, Square, MessageCircle, Trash2, Upload, PhoneCall, CalendarClock, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';
import { useAdminStore } from '../../store/useAdminStore';
import StageDataModal from '../components/StageDataModal';
import FollowUpTasksPanel from '../components/FollowUpTasksPanel';
import { NOT_CONNECTED_REASONS, INTEREST_LEVELS, LOST_DROPPED_REASONS, FOLLOWUP_TRIGGER_INTEREST_LEVELS, PAYMENT_STATUS_OPTIONS } from '../../shared/leadConstants';
import {
  SERVICES_REQUIRED_OPTIONS, MARKETING_TYPE_SERVICES, TIMELINE_OPTIONS, DECISION_MAKER_OPTIONS,
  PROJECT_BUDGET_OPTIONS, MONTHLY_MARKETING_BUDGET_OPTIONS, LEAD_PRIORITY_BADGE_CLASSES
} from '../../shared/serviceQualification';

// Status values that require mandatory companion data beyond the status
// field itself — server/utils/leadStateMachine.js rejects a bare status
// change into any of these, so they're routed through StageDataModal instead
// of an instant single-field save.
const STATUSES_REQUIRING_MODAL = ['Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold'];

// firstName/lastName aren't guaranteed on every Admin account (the original
// legacy seed account predates those fields being required) — fall back
// gracefully instead of rendering "undefined undefined".
function displayName(person, fallback = 'Unknown') {
  if (!person) return null;
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || fallback;
}

/** Merges pipelineHistory + assignment history + a synthetic "captured" event into one sorted feed, newest first. */
function buildActivityTimeline(lead, assignmentHistory) {
  if (!lead) return [];
  const events = [];

  events.push({
    key: 'captured',
    title: `Lead captured via ${lead.platform || 'Website'}`,
    date: lead.createdAt,
    actor: null
  });

  (lead.pipelineHistory || []).forEach((h, idx) => {
    events.push({
      key: `pipeline-${idx}`,
      title: h.status,
      date: h.date,
      note: h.note,
      actor: null
    });
  });

  (assignmentHistory || []).forEach((entry) => {
    const toName = displayName(entry.toAdmin);
    events.push({
      key: entry._id,
      title: toName ? `Assigned to ${toName}` : 'Unassigned',
      date: entry.createdAt,
      note: entry.reason,
      actor: entry.mode === 'Auto-RoundRobin' ? 'Round-robin' : (displayName(entry.assignedBy) || 'Admin')
    });
  });

  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Mirrors the server's own lock-expiry check (services/leadLifecycle.js) —
// a lock older than this is stale and no longer blocks anyone.
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/** Whether `lead` is actively locked by someone other than `adminId` — a stale or self-held lock never disables anything. */
function isLockedByOther(lead, adminId) {
  if (!lead?.lockedBy || String(lead.lockedBy) === String(adminId)) return false;
  if (!lead.lockedAt) return false;
  return Date.now() - new Date(lead.lockedAt).getTime() < LOCK_TIMEOUT_MS;
}

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
  Hold: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

const sectionClass = 'bg-app-card border border-app-border rounded-xl p-4 sm:p-5 w-full min-w-0 overflow-hidden';
const sectionLabelClass = 'text-xs text-primary font-bold uppercase tracking-wider mb-3 block';
const selectClass = 'mt-1 w-full min-w-0 max-w-full truncate bg-app-bg border border-app-border px-3 py-2 rounded-lg text-app-text focus:outline-none focus:border-primary cursor-pointer text-sm disabled:opacity-50 box-border';
const fieldLabelClass = 'text-xs text-app-text-muted font-medium';

export default function LeadWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { admin } = useAdminStore();
  const isSuperAdmin = can('*');
  const canAssign = can('leads.assign');

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bds, setBds] = useState([]);
  // Quick-action targets: "Follow-up"/"Update Stage" scroll to (and focus)
  // these existing controls further down the page rather than duplicating
  // their logic in a separate widget.
  const followUpInputRef = useRef(null);
  const statusSelectRef = useRef(null);
  const scrollToRef = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ref.current?.focus();
  };
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [assignReason, setAssignReason] = useState('');
  // Stage transitions that need mandatory companion data (Proposal Sent,
  // Won, Lost, Dropped, Hold) open this instead of auto-saving instantly.
  const [stageModal, setStageModal] = useState(null); // { lead, targetStatus } | null
  // Call outcome (connected/notConnectedReason/interestLevel/nextFollowUpDate)
  // is staged locally until all fields the chosen branch requires are known,
  // then committed as one combined update — the state machine validates the
  // whole outcome together, not field-by-field.
  const [callOutcomeDraft, setCallOutcomeDraft] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('Attachment');

  const fetchLead = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/leads/${id}`);
      if (res.data?.success) setLead(res.data.data);
    } catch {
      toast.error('That lead could not be found');
      navigate('/admin/leads');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  useEffect(() => {
    api.get(`/leads/${id}/assignment-history`)
      .then((res) => setAssignmentHistory(res.data?.data || []))
      .catch(() => setAssignmentHistory([]));
  }, [id]);

  // BD roster for the assign control — only fetchable by users who can
  // actually assign (BDs get a 403, harmlessly skipped).
  useEffect(() => {
    if (!canAssign) return;
    api.get('/admin/assignment/bds')
      .then((res) => setBds(res.data?.data || []))
      .catch(() => { /* control just stays empty */ });
  }, [canAssign]);

  // Lock this lead for active handling while its workspace is open.
  useEffect(() => {
    api.post(`/leads/${id}/lock`).catch((err) => {
      if (err.response?.status === 409) {
        toast.error(err.response.data.message || 'Lead is locked by another user');
      }
    });
    return () => {
      api.post(`/leads/${id}/unlock`).catch(console.error);
    };
  }, [id]);

  // Combined-field version — anything that participates in stage gating
  // (connected+notConnectedReason+interestLevel, or a status change plus its
  // mandatory companion data) must travel in one request, since
  // server/utils/leadStateMachine.js validates the merged result of a single
  // update, not a sequence of partial ones.
  const handleFieldsChange = async (fields) => {
    try {
      await api.put(`/leads/${id}`, fields);
      setLead((prev) => ({ ...prev, ...fields }));
      toast.success('Saved', { duration: 1000, position: 'bottom-right' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update lead');
      throw error;
    }
  };

  const handleFieldChange = (field, value) => handleFieldsChange({ [field]: value });

  const handleAssign = async (assignedTo, reason = '') => {
    try {
      const response = await api.post(`/leads/${id}/assign`, { assignedTo: assignedTo || null, reason });
      setLead(response.data.data);
      setAssignReason('');
      toast.success(assignedTo ? 'Lead assigned' : 'Lead unassigned');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign lead');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api.post(`/leads/${id}/delete`);
      toast.success('Lead deleted successfully');
      navigate('/admin/leads');
    } catch (error) {
      toast.error(`Failed to delete lead: ${error.response?.data?.message || error.message}`);
    }
  };

  const startCall = async () => {
    try {
      const now = new Date();
      await api.put(`/leads/${id}`, { callStartTime: now, callDate: now });
      setLead((prev) => ({ ...prev, callStartTime: now, callDate: now }));
      toast.success('Call started', { position: 'bottom-right' });
    } catch {
      toast.error('Failed to start call');
    }
  };

  const endCall = async () => {
    if (!lead?.callStartTime) {
      toast.error('Please start the call first');
      return;
    }
    try {
      const now = new Date();
      const diffMs = now.getTime() - new Date(lead.callStartTime).getTime();
      const durationMin = Math.max(1, Math.round(diffMs / 60000));
      await api.put(`/leads/${id}`, { callEndTime: now, callDuration: durationMin });
      setLead((prev) => ({ ...prev, callEndTime: now, callDuration: durationMin }));
      toast.success(`Call ended (${durationMin} min)`, { position: 'bottom-right' });
    } catch {
      toast.error('Failed to end call');
    }
  };

  const getCallOutcomeValue = (field) => {
    if (callOutcomeDraft && field in callOutcomeDraft) return callOutcomeDraft[field];
    return lead?.[field] ?? '';
  };

  const updateCallOutcomeField = async (field, value) => {
    const merged = {
      connected: getCallOutcomeValue('connected'),
      notConnectedReason: getCallOutcomeValue('notConnectedReason'),
      interestLevel: getCallOutcomeValue('interestLevel'),
      nextFollowUpDate: getCallOutcomeValue('nextFollowUpDate'),
      [field]: value
    };

    const needsFollowUp =
      (merged.connected === 'Yes' && FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(merged.interestLevel)) ||
      (merged.connected === 'No' && merged.notConnectedReason === 'Asked to Call Later');

    const ready =
      merged.connected === 'Yes' ? !!merged.interestLevel && (!needsFollowUp || !!merged.nextFollowUpDate) :
      merged.connected === 'No' ? !!merged.notConnectedReason && (!needsFollowUp || !!merged.nextFollowUpDate) :
      false;

    if (!ready) {
      setCallOutcomeDraft(merged);
      return;
    }

    const fields = merged.connected === 'Yes'
      ? { connected: 'Yes', interestLevel: merged.interestLevel, ...(merged.nextFollowUpDate ? { nextFollowUpDate: merged.nextFollowUpDate } : {}) }
      : { connected: 'No', notConnectedReason: merged.notConnectedReason, ...(merged.nextFollowUpDate ? { nextFollowUpDate: merged.nextFollowUpDate } : {}) };

    try {
      await handleFieldsChange(fields);
      setCallOutcomeDraft(null);
    } catch {
      // Keep the draft so the admin doesn't lose what they picked — the
      // error toast from handleFieldsChange already explains what's missing.
      setCallOutcomeDraft(merged);
    }
  };

  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      const res = await api.post(`/leads/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('Document uploaded');
        setLead(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Remove this document?')) return;
    try {
      const res = await api.delete(`/leads/${id}/documents/${docId}`);
      if (res.data.success) {
        toast.success('Document removed');
        setLead(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove document');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="space-y-5 w-full min-w-0 max-w-full">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/admin/leads')}
          className="flex items-center gap-2 text-sm font-medium text-app-text-muted hover:text-app-text transition-colors"
        >
          <ArrowLeft size={16} /> Back to Leads
        </button>
        {isSuperAdmin && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={14} /> Delete Lead
          </button>
        )}
      </div>

      {/* Identity + quick actions */}
      <div className={sectionClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-app-text font-heading truncate">{lead.fullName}</h1>
            <p className="text-sm text-app-text-muted mt-1">
              {[lead.leadId, lead.phone].filter(Boolean).join(' · ')}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${STATUS_BADGE_CLASSES[lead.status] || 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                {lead.status}
              </span>
              {lead.interestLevel && (
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {lead.interestLevel}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-app-bg text-app-text-muted border border-app-border">
                {lead.platform || 'Website'}
              </span>
              {lead.lockedBy && (
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  🔒 Locked for active handling
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full sm:w-auto min-w-0">
            <a href={`tel:${lead.phone}`} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary text-black font-bold text-xs sm:text-sm hover:opacity-90 transition-opacity min-w-0">
              <Phone size={14} className="shrink-0" /> <span className="truncate">Call</span>
            </a>
            {toWhatsAppHref(lead.phone) ? (
              // TODO: plain wa.me deep-link out of the CRM — swap for an
              // in-CRM WhatsApp conversation once a WhatsApp Business API
              // account (Meta Cloud API/Twilio/etc.) is available.
              <a href={toWhatsAppHref(lead.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors min-w-0">
                <MessageCircle size={14} className="shrink-0" /> <span className="truncate">WhatsApp</span>
              </a>
            ) : <div />}
            <a href={`mailto:${lead.email}`} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors min-w-0">
              <Mail size={14} className="shrink-0" /> <span className="truncate">Email</span>
            </a>
            <button onClick={() => scrollToRef(followUpInputRef)} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors min-w-0">
              <CalendarClock size={14} className="shrink-0" /> <span className="truncate">Follow-up</span>
            </button>
            <button onClick={() => scrollToRef(statusSelectRef)} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors min-w-0">
              <ListChecks size={14} className="shrink-0" /> <span className="truncate">Update Stage</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0 max-w-full">
        {/* Main column: everything an admin actively works while handling this lead */}
        <div className="lg:col-span-2 space-y-5 min-w-0 max-w-full">
          {/* Call Handling */}
          <div className={sectionClass}>
            <label className={sectionLabelClass}>Call Handling</label>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button onClick={startCall} className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
                <Play size={14} /> Start Call
              </button>
              <button onClick={endCall} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
                <Square size={14} /> End Call
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 min-w-0">
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Start Time</label>
                <p className="text-sm font-medium text-app-text mt-1">{lead.callStartTime ? new Date(lead.callStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
              </div>
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">End Time</label>
                <p className="text-sm font-medium text-app-text mt-1">{lead.callEndTime ? new Date(lead.callEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
              </div>
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Duration (min)</label>
                <p className="text-sm font-medium text-app-text mt-1">{lead.callDuration || '-'}</p>
              </div>
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Call Date</label>
                <p className="text-sm font-medium text-app-text mt-1">{lead.callDate ? new Date(lead.callDate).toLocaleDateString() : '-'}</p>
              </div>
            </div>
          </div>

          {/* Call Outcome */}
          <div className={sectionClass}>
            <label className={sectionLabelClass}>Call Outcome</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
              <div>
                <label className={fieldLabelClass}>Connected?</label>
                <select
                  value={getCallOutcomeValue('connected')}
                  onChange={(e) => updateCallOutcomeField('connected', e.target.value)}
                  className={`${selectClass} ${lead.connected === 'Yes' ? 'text-green-500 font-bold' : lead.connected === 'No' ? 'text-red-500 font-bold' : ''}`}
                >
                  <option className="bg-app-bg text-app-text" value="">-Select-</option>
                  <option className="bg-app-bg text-app-text" value="Yes">Yes</option>
                  <option className="bg-app-bg text-app-text" value="No">No</option>
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Not Connected Reason</label>
                <select
                  value={getCallOutcomeValue('notConnectedReason')}
                  onChange={(e) => updateCallOutcomeField('notConnectedReason', e.target.value)}
                  disabled={getCallOutcomeValue('connected') === 'Yes'}
                  className={selectClass}
                >
                  <option className="bg-app-bg text-app-text" value="">-Select Reason-</option>
                  {NOT_CONNECTED_REASONS.map((reason) => (
                    <option key={reason} className="bg-app-bg text-app-text" value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Interest Level</label>
                <select
                  value={getCallOutcomeValue('interestLevel')}
                  onChange={(e) => updateCallOutcomeField('interestLevel', e.target.value)}
                  disabled={getCallOutcomeValue('connected') === 'No'}
                  className={`${selectClass} text-yellow-500 font-medium`}
                >
                  <option className="bg-app-bg text-app-text" value="">—</option>
                  {INTEREST_LEVELS.map((level) => (
                    <option key={level} className="bg-app-bg text-app-text" value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={fieldLabelClass}>Age @ Call</label>
                  <p className="mt-1 text-sm font-semibold text-app-text py-2 text-center" title="Days between the lead's creation and its most recent logged call — calculated automatically.">
                    {lead.leadAgeAtCall ?? '-'}{lead.leadAgeAtCall != null ? ' days' : ''}
                  </p>
                </div>
                <div>
                  <label className={fieldLabelClass}>Touch #</label>
                  <p className="mt-1 text-sm font-semibold text-app-text py-2 text-center" title="Number of logged call attempts — calculated automatically.">
                    {lead.touchNumber ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline & Stage */}
          <div className={sectionClass}>
            <label className={sectionLabelClass}>Pipeline & Stage</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelClass}>Status</label>
                <select
                  ref={statusSelectRef}
                  value={lead.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    if (STATUSES_REQUIRING_MODAL.includes(newStatus)) {
                      setStageModal({ lead, targetStatus: newStatus });
                    } else {
                      handleFieldChange('status', newStatus);
                    }
                  }}
                  disabled={(!isSuperAdmin && ['Won', 'Lost', 'Dropped'].includes(lead.status)) || isLockedByOther(lead, admin?._id)}
                  className={`${selectClass} font-medium`}
                >
                  <option className="bg-app-bg text-app-text" value="New">New</option>
                  <option className="bg-app-bg text-app-text" value="Contacted">Contacted</option>
                  <option className="bg-app-bg text-app-text" value="Qualified">Qualified</option>
                  <option className="bg-app-bg text-app-text" value="Proposal Sent">Proposal Sent</option>
                  <option className="bg-app-bg text-app-text" value="Negotiation">Negotiation</option>
                  <option className="bg-app-bg text-app-text" value="Hold">Hold</option>
                  <option className="bg-app-bg text-app-text" value="Won">Won</option>
                  <option className="bg-app-bg text-app-text" value="Lost">Lost</option>
                  <option className="bg-app-bg text-app-text" value="Dropped">Dropped</option>
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Not Converted Reason</label>
                <select
                  value={lead.notConvertedReason || ''}
                  onChange={(e) => handleFieldChange('notConvertedReason', e.target.value)}
                  disabled={!['Lost', 'Dropped'].includes(lead.status)}
                  className={selectClass}
                >
                  <option className="bg-app-bg text-app-text" value="">-Why not converted?-</option>
                  {LOST_DROPPED_REASONS.map((reason) => (
                    <option key={reason} className="bg-app-bg text-app-text" value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Estimated Deal Value (₹)</label>
                <input
                  type="number"
                  min="0"
                  defaultValue={lead.dealValue ?? ''}
                  onBlur={(e) => { if (Number(e.target.value) !== lead.dealValue) handleFieldChange('dealValue', Number(e.target.value)); }}
                  className={selectClass}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Deal Close Value (₹)</label>
                <input
                  type="number"
                  min="0"
                  defaultValue={lead.dealCloseValue ?? ''}
                  onBlur={(e) => { if (Number(e.target.value) !== lead.dealCloseValue) handleFieldChange('dealCloseValue', Number(e.target.value)); }}
                  className={selectClass}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Expected Close Date</label>
                <input
                  type="date"
                  defaultValue={lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().slice(0, 10) : ''}
                  onBlur={(e) => {
                    const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                    if (value !== lead.expectedCloseDate) handleFieldChange('expectedCloseDate', value);
                  }}
                  className={selectClass}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Payment Status</label>
                <select
                  value={lead.paymentStatus || 'Not Applicable'}
                  onChange={(e) => handleFieldChange('paymentStatus', e.target.value)}
                  className={selectClass}
                >
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} className="bg-app-bg text-app-text" value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              {lead.paymentStatus && lead.paymentStatus !== 'Not Applicable' && (
                <>
                  <div>
                    <label className={fieldLabelClass}>Amount Paid (₹)</label>
                    <input
                      type="number"
                      min="0"
                      defaultValue={lead.amountPaid ?? ''}
                      onBlur={(e) => { if (Number(e.target.value) !== lead.amountPaid) handleFieldChange('amountPaid', Number(e.target.value)); }}
                      className={selectClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>Pending Amount (₹)</label>
                    <p className="mt-1 text-sm font-semibold text-app-text py-2">
                      ₹{Math.max(0, (lead.dealCloseValue || 0) - (lead.amountPaid || 0)).toLocaleString('en-IN')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Follow-up */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
            <label className="text-xs text-primary font-bold uppercase tracking-wider">Next Follow-up</label>
            <p className="text-sm font-medium text-app-text mt-1">
              {lead.nextFollowUpDate
                ? new Date(lead.nextFollowUpDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Not scheduled'}
            </p>
            <input
              ref={followUpInputRef}
              type="datetime-local"
              value={(() => { const v = getCallOutcomeValue('nextFollowUpDate'); return v ? new Date(v).toISOString().slice(0, 16) : ''; })()}
              onChange={(e) => {
                const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                updateCallOutcomeField('nextFollowUpDate', value);
              }}
              className="mt-2 w-full bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          <FollowUpTasksPanel leadId={lead._id} canManage={canAssign} bds={bds} myAdminId={admin?._id} />

          {/* Remark */}
          <div className={sectionClass}>
            <label className={sectionLabelClass}>Remark</label>
            <textarea
              defaultValue={lead.remark || ''}
              placeholder="Add remark..."
              rows={3}
              onBlur={(e) => { if (e.target.value !== lead.remark) handleFieldChange('remark', e.target.value); }}
              className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Qualification — service-aware discovery data, doesn't gate any stage transition */}
          <div className={sectionClass}>
            <label className={sectionLabelClass}>Qualification</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelClass}>Business Name</label>
                <input
                  type="text"
                  defaultValue={lead.businessName || ''}
                  onBlur={(e) => { if (e.target.value !== lead.businessName) handleFieldChange('businessName', e.target.value); }}
                  className={selectClass}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Website</label>
                <input
                  type="text"
                  placeholder="https://..."
                  defaultValue={lead.website || ''}
                  onBlur={(e) => { if (e.target.value !== lead.website) handleFieldChange('website', e.target.value); }}
                  className={selectClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={fieldLabelClass}>Service Required</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SERVICES_REQUIRED_OPTIONS.map((svc) => {
                  const selected = (lead.servicesRequired || []).includes(svc);
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => {
                        const current = lead.servicesRequired || [];
                        const next = selected ? current.filter((s) => s !== svc) : [...current, svc];
                        handleFieldChange('servicesRequired', next);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                        selected ? 'bg-primary/10 text-primary border-primary/30' : 'bg-app-bg text-app-text-muted border-app-border hover:border-primary/40'
                      }`}
                    >
                      {svc}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={fieldLabelClass}>Business Type / Industry</label>
                <input
                  type="text"
                  defaultValue={lead.businessType || ''}
                  onBlur={(e) => { if (e.target.value !== lead.businessType) handleFieldChange('businessType', e.target.value); }}
                  className={selectClass}
                />
              </div>
              {(!lead.servicesRequired?.length || lead.servicesRequired.some((s) => MARKETING_TYPE_SERVICES.includes(s))) && (
                <div>
                  <label className={fieldLabelClass}>Monthly Marketing Budget</label>
                  <select
                    value={lead.monthlyMarketingBudget || ''}
                    onChange={(e) => handleFieldChange('monthlyMarketingBudget', e.target.value)}
                    className={selectClass}
                  >
                    <option className="bg-app-bg text-app-text" value="">-Select-</option>
                    {MONTHLY_MARKETING_BUDGET_OPTIONS.map((opt) => (
                      <option key={opt} className="bg-app-bg text-app-text" value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}
              {(!lead.servicesRequired?.length || lead.servicesRequired.some((s) => !MARKETING_TYPE_SERVICES.includes(s))) && (
                <div>
                  <label className={fieldLabelClass}>Project Budget</label>
                  <select
                    value={lead.projectBudget || ''}
                    onChange={(e) => handleFieldChange('projectBudget', e.target.value)}
                    className={selectClass}
                  >
                    <option className="bg-app-bg text-app-text" value="">-Select-</option>
                    {PROJECT_BUDGET_OPTIONS.map((opt) => (
                      <option key={opt} className="bg-app-bg text-app-text" value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={fieldLabelClass}>Timeline</label>
                <select
                  value={lead.timeline || ''}
                  onChange={(e) => handleFieldChange('timeline', e.target.value)}
                  className={selectClass}
                >
                  <option className="bg-app-bg text-app-text" value="">-Select-</option>
                  {TIMELINE_OPTIONS.map((opt) => (
                    <option key={opt} className="bg-app-bg text-app-text" value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Decision Maker</label>
                <select
                  value={lead.decisionMaker || ''}
                  onChange={(e) => handleFieldChange('decisionMaker', e.target.value)}
                  className={selectClass}
                >
                  <option className="bg-app-bg text-app-text" value="">-Select-</option>
                  {DECISION_MAKER_OPTIONS.map((opt) => (
                    <option key={opt} className="bg-app-bg text-app-text" value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Current Vendor</label>
                <input
                  type="text"
                  defaultValue={lead.currentVendor || ''}
                  onBlur={(e) => { if (e.target.value !== lead.currentVendor) handleFieldChange('currentVendor', e.target.value); }}
                  className={selectClass}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Lead Priority</label>
                <p className="mt-1.5" title="Auto-derived from Decision Maker, Timeline and Budget — calculated automatically.">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${LEAD_PRIORITY_BADGE_CLASSES[lead.leadPriority] || LEAD_PRIORITY_BADGE_CLASSES.Normal}`}>
                    {lead.leadPriority || 'Normal'}
                  </span>
                </p>
              </div>
              <div>
                <label className={fieldLabelClass}>Lead Score</label>
                <p className="mt-1.5" title="Configurable score (Admin Settings → Lead Scoring) — a supplementary signal, not the source of truth for Priority.">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-app-bg text-app-text border-app-border">
                    {lead.leadScore ?? 0}<span className="text-app-text-muted font-normal">/100</span>
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className={fieldLabelClass}>Requirement Summary</label>
              <textarea
                rows={3}
                defaultValue={lead.requirementSummary || ''}
                onBlur={(e) => { if (e.target.value !== lead.requirementSummary) handleFieldChange('requirementSummary', e.target.value); }}
                className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          {/* Documents — proposal, quotation, scope, and other attachments */}
          <div className={sectionClass}>
            <label className={sectionLabelClass}>Documents</label>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className={`${selectClass} w-full sm:w-auto flex-1`}>
                <option className="bg-app-bg text-app-text" value="Proposal">Proposal</option>
                <option className="bg-app-bg text-app-text" value="Quotation">Quotation</option>
                <option className="bg-app-bg text-app-text" value="Scope">Scope</option>
                <option className="bg-app-bg text-app-text" value="Attachment">Other Attachment</option>
              </select>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold cursor-pointer transition-colors">
                <Upload size={13} /> {uploading ? 'Uploading...' : 'Upload File'}
                <input type="file" className="hidden" disabled={uploading} onChange={handleUploadDocument} />
              </label>
            </div>
            {(lead.documents || []).length === 0 ? (
              <p className="text-sm text-app-text-muted">No documents attached yet.</p>
            ) : (
              <div className="space-y-2">
                {lead.documents.map((doc) => (
                  <div key={doc._id} className="flex items-center justify-between gap-3 bg-app-bg px-3 py-2 rounded-lg">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-app-text hover:text-primary min-w-0">
                      <FileText size={14} className="shrink-0" />
                      <span className="truncate">{doc.name}</span>
                      <span className="text-[10px] text-app-text-muted shrink-0 uppercase font-bold">{doc.docType}</span>
                    </a>
                    <button onClick={() => handleDeleteDocument(doc._id)} className="text-red-400 hover:text-red-300 shrink-0 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar column: lead identity, attribution, and history — reference data, not day-to-day inputs */}
        <div className="space-y-5">
          <div className={sectionClass}>
            <label className={sectionLabelClass}>Lead & Assignment</label>
            <div className="divide-y divide-app-border">
              <div className="flex items-center justify-between py-2.5 gap-4 flex-wrap">
                <span className="text-sm text-app-text-muted">Assigned to</span>
                {canAssign ? (
                  <select
                    value={lead.assignedTo?._id || ''}
                    onChange={(e) => handleAssign(e.target.value || null, assignReason)}
                    className="bg-app-bg border border-app-border text-sm px-3 py-1.5 rounded-lg text-app-text focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option className="bg-app-bg text-app-text" value="">Unassigned</option>
                    {bds.map((bd) => (
                      <option key={bd._id} className="bg-app-bg text-app-text" value={bd._id}>
                        {bd.firstName} {bd.lastName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-medium text-app-text">
                    {lead.assignedTo ? displayName(lead.assignedTo) : (lead.bd || 'Unassigned')}
                  </span>
                )}
              </div>
              {canAssign && (
                <div className="py-2.5">
                  <input
                    type="text"
                    value={assignReason}
                    onChange={(e) => setAssignReason(e.target.value)}
                    placeholder="Reason for (re)assignment (optional)"
                    className="bg-app-bg border border-app-border text-sm px-3 py-2 rounded-lg text-app-text focus:outline-none focus:border-primary w-full"
                  />
                </div>
              )}
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-app-text-muted">Assigned on</span>
                <span className="text-sm font-medium text-app-text">
                  {lead.assignedAt ? new Date(lead.assignedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-app-text-muted">Service required</span>
                <span className="text-sm font-medium text-app-text">{lead.service}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-app-text-muted">Source platform</span>
                <span className="text-sm font-medium text-app-text">{lead.platform || 'Website'}</span>
              </div>
              {lead.city && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-app-text-muted">City</span>
                  <span className="text-sm font-medium text-app-text">{lead.city}</span>
                </div>
              )}
            </div>
          </div>

          {lead.message && (
            <div className={sectionClass}>
              <label className="text-xs text-app-text-muted font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileText size={14} /> {lead.fbFormId ? 'Form Answers' : 'Message Attached'}
              </label>
              <div className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">{lead.message}</div>
            </div>
          )}

          <div className={sectionClass}>
            <label className={sectionLabelClass}>Campaign Attribution</label>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Attribution Source</label>
                <p className="text-sm font-medium text-primary truncate">{lead.userSource || 'Direct'}</p>
              </div>
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Campaign</label>
                <p className="text-sm font-medium text-app-text truncate">{lead.utmCampaign || lead.adCampaignId || '-'}</p>
              </div>
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Source/Medium</label>
                <p className="text-sm font-medium text-app-text truncate">
                  {lead.utmSource || '-'}{lead.utmMedium ? ` / ${lead.utmMedium}` : ''}
                </p>
              </div>
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Term/Content</label>
                <p className="text-sm font-medium text-app-text truncate">
                  {lead.utmTerm || '-'}{lead.utmContent ? ` / ${lead.utmContent}` : ''}
                </p>
              </div>
              <div>
                <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Source Link</label>
                <a href={lead.source} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-app-text hover:text-primary hover:underline truncate block">
                  {lead.source || '-'}
                </a>
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <label className="text-xs text-primary font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock size={14} /> Activity Timeline
            </label>
            <div className="space-y-4">
              {buildActivityTimeline(lead, assignmentHistory).map((event) => (
                <div key={event.key} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-app-text">{event.title}</p>
                    <p className="text-xs text-app-text-muted mt-0.5">
                      {new Date(event.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {event.actor ? ` · ${event.actor}` : ''}
                    </p>
                    {event.note && (
                      <p className="text-xs text-app-text-muted mt-1 italic border-l-2 border-primary/30 pl-2 py-0.5">{event.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Call History — every logged call attempt, richest-first. Written
              by server/services/leadLifecycle.js the moment a call outcome
              is saved; callType/leadStage are auto-classified. */}
          {(lead.callLogs || []).length > 0 && (
            <div className={sectionClass}>
              <label className="text-xs text-primary font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                <PhoneCall size={14} /> Call History
              </label>
              <div className="space-y-3">
                {[...lead.callLogs].reverse().map((call) => (
                  <div key={call._id || call.touchNumber} className="bg-app-bg rounded-lg p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-app-text">Touch #{call.touchNumber}</span>
                        {call.callType && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">{call.callType}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          call.connected === 'Yes' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {call.connected === 'Yes' ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>
                      <span className="text-xs text-app-text-muted">
                        {call.callDate ? new Date(call.callDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-app-text-muted">
                      {call.interestLevel && <span>Interest: <span className="text-app-text font-medium">{call.interestLevel}</span></span>}
                      {call.notConnectedReason && <span>Reason: <span className="text-app-text font-medium">{call.notConnectedReason}</span></span>}
                      {call.callDuration != null && <span>Duration: <span className="text-app-text font-medium">{call.callDuration} min</span></span>}
                      {call.leadStage && <span>Stage: <span className="text-app-text font-medium">{call.leadStage}</span></span>}
                    </div>
                    {call.remark && (
                      <p className="text-xs text-app-text-muted mt-2 italic border-l-2 border-primary/30 pl-2 py-0.5">{call.remark}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {stageModal && (
        <StageDataModal
          lead={stageModal.lead}
          targetStatus={stageModal.targetStatus}
          onClose={() => setStageModal(null)}
          onSubmit={async (fields) => {
            await handleFieldsChange(fields);
            setStageModal(null);
          }}
        />
      )}
    </div>
  );
}
