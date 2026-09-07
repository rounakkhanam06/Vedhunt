import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import employeeApi from '../../services/employeeApi';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, Mail, MessageCircle, Play, Square, Clock, FileText, Upload, Trash2, PhoneCall, CalendarClock, ListChecks } from 'lucide-react';
import { NOT_CONNECTED_REASONS, INTEREST_LEVELS, LOST_DROPPED_REASONS, FOLLOWUP_TRIGGER_INTEREST_LEVELS, PAYMENT_STATUS_OPTIONS } from '../../shared/leadConstants';
import {
  SERVICES_REQUIRED_OPTIONS, MARKETING_TYPE_SERVICES, TIMELINE_OPTIONS, DECISION_MAKER_OPTIONS,
  PROJECT_BUDGET_OPTIONS, MONTHLY_MARKETING_BUDGET_OPTIONS, LEAD_PRIORITY_BADGE_CLASSES
} from '../../shared/serviceQualification';
import NoCopyText from '../components/NoCopyText';
import FollowUpTasksPanel from '../components/FollowUpTasksPanel';

const sectionClass = 'bg-app-card border border-app-border rounded-xl p-4 sm:p-5 w-full min-w-0 overflow-hidden';
const sectionLabelClass = 'text-xs font-bold text-app-text-muted uppercase tracking-wider mb-3 block';
const fieldLabelClass = 'block text-[10px] font-medium text-app-text-muted mb-1 uppercase tracking-wider';
const selectClass = 'w-full min-w-0 max-w-full truncate bg-form-input-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50 box-border';

/** WhatsApp deep link straight to this lead's chat — Indian 10-digit numbers get the country code prefixed. */
function toWhatsAppHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

/** Merges pipelineHistory with a synthetic "captured" event, newest first. Assignment history isn't exposed to the employee portal — ownership changes stay an admin-only, audited action. */
function buildActivityTimeline(lead) {
  if (!lead) return [];
  const events = [{
    key: 'captured',
    title: `Lead captured via ${lead.platform || 'Website'}`,
    date: lead.createdAt
  }];
  (lead.pipelineHistory || []).forEach((h, idx) => {
    events.push({ key: `pipeline-${idx}`, title: h.status, date: h.date, note: h.note });
  });
  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export default function EmployeeLeadWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  // Call outcome (connected/notConnectedReason/interestLevel/nextFollowUpDate)
  // is staged locally and auto-commits the instant the state machine's
  // required combination is known — a one-tap flow, no separate Save click
  // needed for the common case. Mirrors admin/pages/LeadWorkspace.jsx.
  const [callOutcomeDraft, setCallOutcomeDraft] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('Attachment');
  // Quick-action targets: "Follow-up"/"Update Stage" scroll to (and focus)
  // these existing controls further down the page. Mirrors admin/pages/LeadWorkspace.jsx.
  const followUpInputRef = useRef(null);
  const statusSelectRef = useRef(null);
  const scrollToRef = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ref.current?.focus();
  };

  const buildDraft = (l) => ({
    remark: l.remark || '',
    dealValue: l.dealValue || '',
    dealCloseValue: l.dealCloseValue || '',
    notConvertedReason: l.notConvertedReason || '',
    proposalValue: l.proposalValue || '',
    proposalSentDate: l.proposalSentDate ? new Date(l.proposalSentDate).toISOString() : '',
    proposalReference: l.proposalReference || '',
    expectedCloseDate: l.expectedCloseDate ? new Date(l.expectedCloseDate).toISOString() : '',
    holdReason: l.holdReason || '',
    holdUntil: l.holdUntil ? new Date(l.holdUntil).toISOString() : '',
    status: l.status,
    paymentStatus: l.paymentStatus || 'Not Applicable',
    amountPaid: l.amountPaid || '',
    businessName: l.businessName || '',
    website: l.website || '',
    servicesRequired: l.servicesRequired || [],
    businessType: l.businessType || '',
    projectBudget: l.projectBudget || '',
    monthlyMarketingBudget: l.monthlyMarketingBudget || '',
    timeline: l.timeline || '',
    decisionMaker: l.decisionMaker || '',
    currentVendor: l.currentVendor || '',
    requirementSummary: l.requirementSummary || ''
  });

  const fetchLead = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeApi.get(`/employee-portal/ess/leads/${id}`);
      if (res.data?.success) {
        setLead(res.data.lead);
        setDraft(buildDraft(res.data.lead));
      }
    } catch {
      toast.error('That lead could not be found');
      navigate('/employee/dashboard?tab=working-leads');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const updateDraft = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await employeeApi.put(`/employee-portal/ess/leads/${id}`, draft);
      if (res.data.success) {
        toast.success('Lead updated');
        setLead(res.data.lead);
        setDraft(buildDraft(res.data.lead));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  // Combined-field version — anything that participates in stage gating
  // must travel in one request, since server/utils/leadStateMachine.js
  // validates the merged result of a single update, not a sequence of
  // partial ones.
  const handleFieldsChange = async (fields) => {
    const res = await employeeApi.put(`/employee-portal/ess/leads/${id}`, fields);
    setLead(res.data.lead);
    setDraft(buildDraft(res.data.lead));
    return res.data;
  };

  const getCallOutcomeValue = (field) => {
    if (callOutcomeDraft && field in callOutcomeDraft) return callOutcomeDraft[field];
    return lead?.[field] ?? '';
  };

  // One-tap outcome capture: a chip tap stages the field, and the instant the
  // state machine's required combination for that branch is known (e.g.
  // Not Connected + a reason, or Connected + interest level with no
  // follow-up required), it auto-commits — no separate Save press for the
  // common case. Mirrors admin/pages/LeadWorkspace.jsx's updateCallOutcomeField.
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
      toast.success('Call outcome saved', { duration: 1200, position: 'bottom-right' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save outcome');
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
      const res = await employeeApi.post(`/employee-portal/ess/leads/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('Document uploaded');
        setLead(res.data.lead);
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
      const res = await employeeApi.delete(`/employee-portal/ess/leads/${id}/documents/${docId}`);
      if (res.data.success) {
        toast.success('Document removed');
        setLead(res.data.lead);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove document');
    }
  };

  // Tapping Call hands off to the device's native dialer (tel: link) and
  // starts the timer in the same action, matching the admin table's behavior.
  const handleStartCall = async () => {
    try {
      const now = new Date();
      await employeeApi.put(`/employee-portal/ess/leads/${id}`, { callStartTime: now, callDate: now });
      window.location.href = `tel:${lead.phone}`;
      toast.success('Call started');
      fetchLead();
    } catch {
      toast.error('Failed to start call');
    }
  };

  const handleEndCall = async () => {
    if (!lead.callStartTime) {
      toast.error('Please start the call first');
      return;
    }
    try {
      const now = new Date();
      const diffMs = now.getTime() - new Date(lead.callStartTime).getTime();
      const durationMin = Math.max(1, Math.round(diffMs / 60000));
      await employeeApi.put(`/employee-portal/ess/leads/${id}`, { callEndTime: now, callDuration: durationMin });
      toast.success(`Call ended (${durationMin} min)`);
      fetchLead();
    } catch {
      toast.error('Failed to end call');
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
    <div className="space-y-5 max-w-3xl mx-auto w-full min-w-0 max-w-full">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-medium text-app-text-muted hover:text-app-text transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Identity — name/phone/email are view-and-act only: tap to call/email
          still works, but the text itself can't be selected or copied out. */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-primary">{lead.leadId}</span>
          <NoCopyText className="text-app-text font-bold text-lg">{lead.fullName}</NoCopyText>
          <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded border ${
            lead.status === 'Won' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            (lead.status === 'Lost' || lead.status === 'Dropped') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
            lead.status === 'New' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
            'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {lead.status}
          </span>
        </div>
        <p className="text-xs text-app-text-muted mt-1">{lead.service} · {lead.platform}</p>

        {/* Quick Actions — the labels are generic ("Call"/"WhatsApp"/"Email"),
            not the raw number/address, so no copy-protection needed here;
            each still deep-links straight to this lead's number/inbox. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-4 min-w-0">
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary text-white font-bold text-xs sm:text-sm hover:opacity-90 transition-opacity min-w-0"
          >
            <Phone size={14} className="shrink-0" /> <span className="truncate">Call</span>
          </a>
          {toWhatsAppHref(lead.phone) ? (
            // TODO: plain wa.me deep-link out of the CRM — swap for an
            // in-CRM WhatsApp conversation once a WhatsApp Business API
            // account (Meta Cloud API/Twilio/etc.) is available.
            <a
              href={toWhatsAppHref(lead.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors min-w-0"
            >
              <MessageCircle size={14} className="shrink-0" /> <span className="truncate">WhatsApp</span>
            </a>
          ) : <div />}
          <a
            href={`mailto:${lead.email}`}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors min-w-0"
          >
            <Mail size={14} className="shrink-0" /> <span className="truncate">Email</span>
          </a>
          <button onClick={() => scrollToRef(followUpInputRef)} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors min-w-0">
            <CalendarClock size={14} className="shrink-0" /> <span className="truncate">Follow-up</span>
          </button>
          <button onClick={() => scrollToRef(statusSelectRef)} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors min-w-0">
            <ListChecks size={14} className="shrink-0" /> <span className="truncate">Update Stage</span>
          </button>
        </div>

        {lead.message && (
          <div className="mt-4">
            <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText size={12} /> {lead.fbFormId ? 'Form Answers' : 'Message Attached'}
            </label>
            <p className="text-sm text-app-text bg-form-input-bg p-4 rounded-lg whitespace-pre-wrap">{lead.message}</p>
          </div>
        )}
      </div>

      {/* Lead Details — read-only; ownership/reassignment stays admin-only */}
      <div className={sectionClass}>
        <label className={sectionLabelClass}>Lead Details</label>
        <div className="divide-y divide-app-border text-sm">
          <div className="flex items-center justify-between py-2">
            <span className="text-app-text-muted">Phone</span>
            <NoCopyText as="span" className="font-medium text-app-text">{lead.phone}</NoCopyText>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-app-text-muted">Email</span>
            <NoCopyText as="span" className="font-medium text-app-text">{lead.email}</NoCopyText>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-app-text-muted">Service required</span>
            <span className="font-medium text-app-text">{lead.service}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-app-text-muted">Source platform</span>
            <span className="font-medium text-app-text">{lead.platform || 'Website'}</span>
          </div>
          {lead.city && (
            <div className="flex items-center justify-between py-2">
              <span className="text-app-text-muted">City</span>
              <span className="font-medium text-app-text">{lead.city}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2">
            <span className="text-app-text-muted">Assigned on</span>
            <span className="font-medium text-app-text">
              {lead.assignedAt ? new Date(lead.assignedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-app-text-muted">Created</span>
            <span className="font-medium text-app-text">{new Date(lead.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Call Handling */}
      <div className={sectionClass}>
        <label className={sectionLabelClass}>Call Handling</label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleStartCall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-medium transition-colors"
          >
            <Play size={12} /> Start Call
          </button>
          <button
            onClick={handleEndCall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-medium transition-colors"
          >
            <Square size={12} /> End Call
          </button>
          {lead.callStartTime && (
            <span className="text-xs text-app-text-muted">
              Started {new Date(lead.callStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {lead.callDuration && (
            <span className="text-xs text-app-text-muted">Duration: {lead.callDuration} min</span>
          )}
        </div>
      </div>

      {/* Call Outcome — one-tap chips, auto-commits the instant the state
          machine's required combination for the chosen branch is known. */}
      <div className={sectionClass}>
        <label className={sectionLabelClass}>Call Outcome</label>
        <div className="space-y-4">
          <div>
            <label className={fieldLabelClass}>Connected?</label>
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => updateCallOutcomeField('connected', 'Yes')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  getCallOutcomeValue('connected') === 'Yes' ? 'bg-emerald-500 text-white' : 'bg-form-input-bg text-app-text hover:bg-app-border/40'
                }`}
              >
                Connected
              </button>
              <button
                type="button"
                onClick={() => updateCallOutcomeField('connected', 'No')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  getCallOutcomeValue('connected') === 'No' ? 'bg-red-500 text-white' : 'bg-form-input-bg text-app-text hover:bg-app-border/40'
                }`}
              >
                Not Connected
              </button>
            </div>
          </div>

          {getCallOutcomeValue('connected') === 'No' && (
            <div>
              <label className={fieldLabelClass}>
                Reason <span className="text-primary">*required</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {NOT_CONNECTED_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => updateCallOutcomeField('notConnectedReason', reason)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      getCallOutcomeValue('notConnectedReason') === reason ? 'bg-primary text-white' : 'bg-form-input-bg text-app-text hover:bg-app-border/40'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}

          {getCallOutcomeValue('connected') === 'Yes' && (
            <div>
              <label className={fieldLabelClass}>
                Interest Level <span className="text-primary">*required</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {INTEREST_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => updateCallOutcomeField('interestLevel', level)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      getCallOutcomeValue('interestLevel') === level ? 'bg-primary text-white' : 'bg-form-input-bg text-app-text hover:bg-app-border/40'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(getCallOutcomeValue('interestLevel')) || getCallOutcomeValue('notConnectedReason') === 'Asked to Call Later') && (
            <div>
              <label className={fieldLabelClass}>
                Next Follow-Up Date &amp; Time <span className="text-primary">*required</span>
              </label>
              <input
                ref={followUpInputRef}
                type="datetime-local"
                value={getCallOutcomeValue('nextFollowUpDate') ? new Date(getCallOutcomeValue('nextFollowUpDate')).toISOString().slice(0, 16) : ''}
                onChange={(e) => updateCallOutcomeField('nextFollowUpDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                className={selectClass}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stage, Qualification & Deal Details — bundled into one request via
          the Save button below, since a status change plus its mandatory
          companion data must travel together. */}
      <div className={sectionClass}>
        <label className={sectionLabelClass}>Stage &amp; Deal Details</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          <div>
            <label className={fieldLabelClass}>Status</label>
            <select
              ref={statusSelectRef}
              value={draft.status ?? lead.status}
              onChange={(e) => updateDraft('status', e.target.value)}
              className={selectClass}
            >
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal Sent">Proposal Sent</option>
              <option value="Negotiation">Negotiation</option>
              <option value="Hold">Hold</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="Dropped">Dropped</option>
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>Estimated Deal Value (₹)</label>
            <input
              type="number"
              min="0"
              value={draft.dealValue || ''}
              onChange={(e) => updateDraft('dealValue', e.target.value)}
              className={selectClass}
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Payment Status</label>
            <select
              value={draft.paymentStatus || 'Not Applicable'}
              onChange={(e) => updateDraft('paymentStatus', e.target.value)}
              className={selectClass}
            >
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          {draft.paymentStatus && draft.paymentStatus !== 'Not Applicable' && (
            <>
              <div>
                <label className={fieldLabelClass}>Amount Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={draft.amountPaid || ''}
                  onChange={(e) => updateDraft('amountPaid', e.target.value)}
                  className={selectClass}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Pending Amount (₹)</label>
                <p className="mt-1 text-sm font-semibold text-app-text py-2">
                  ₹{Math.max(0, (Number(draft.dealCloseValue) || 0) - (Number(draft.amountPaid) || 0)).toLocaleString('en-IN')}
                </p>
              </div>
            </>
          )}
          {draft.status === 'Proposal Sent' && (
            <>
              <div>
                <label className={fieldLabelClass}>Proposal Value (₹) <span className="text-primary">*required</span></label>
                <input
                  type="number"
                  min="0"
                  value={draft.proposalValue || ''}
                  onChange={(e) => updateDraft('proposalValue', e.target.value)}
                  className={selectClass}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Proposal Sent Date <span className="text-primary">*required</span></label>
                <input
                  type="date"
                  value={draft.proposalSentDate ? new Date(draft.proposalSentDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) => updateDraft('proposalSentDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className={selectClass}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Proposal Reference <span className="text-primary">*required</span></label>
                <input
                  type="text"
                  placeholder="Quote #, document link, or filename"
                  value={draft.proposalReference || ''}
                  onChange={(e) => updateDraft('proposalReference', e.target.value)}
                  className={selectClass}
                />
              </div>
            </>
          )}
          {draft.status === 'Negotiation' && (
            <div>
              <label className={fieldLabelClass}>Expected Close Date <span className="text-primary">*required</span></label>
              <input
                type="date"
                value={draft.expectedCloseDate ? new Date(draft.expectedCloseDate).toISOString().slice(0, 10) : ''}
                onChange={(e) => updateDraft('expectedCloseDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                className={selectClass}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          )}
          {draft.status === 'Won' && (
            <div>
              <label className={fieldLabelClass}>Deal Close Value (₹) <span className="text-primary">*required</span></label>
              <input
                type="number"
                min="0"
                value={draft.dealCloseValue || ''}
                onChange={(e) => updateDraft('dealCloseValue', e.target.value)}
                className={selectClass}
              />
            </div>
          )}
          {(draft.status === 'Lost' || draft.status === 'Dropped') && (
            <div>
              <label className={fieldLabelClass}>Reason <span className="text-primary">*required</span></label>
              <select
                value={draft.notConvertedReason || ''}
                onChange={(e) => updateDraft('notConvertedReason', e.target.value)}
                className={selectClass}
              >
                <option value="">—</option>
                {LOST_DROPPED_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
          )}
          {draft.status === 'Hold' && (
            <>
              <div>
                <label className={fieldLabelClass}>Hold Reason <span className="text-primary">*required</span></label>
                <input
                  type="text"
                  value={draft.holdReason || ''}
                  onChange={(e) => updateDraft('holdReason', e.target.value)}
                  className={selectClass}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Review Date <span className="text-primary">*required</span></label>
                <input
                  type="date"
                  value={draft.holdUntil ? new Date(draft.holdUntil).toISOString().slice(0, 10) : ''}
                  onChange={(e) => updateDraft('holdUntil', e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className={selectClass}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-4">
          <label className={fieldLabelClass}>Remark</label>
          <textarea
            rows={3}
            value={draft.remark || ''}
            onChange={(e) => updateDraft('remark', e.target.value)}
            className={selectClass}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Updates'}
        </button>
      </div>

      <FollowUpTasksPanel leadId={lead._id} />

      {/* Qualification — service-aware discovery data, doesn't gate any
          stage transition; saved together with Stage & Deal Details via the
          Save button above. */}
      <div className={sectionClass}>
        <label className={sectionLabelClass}>Qualification</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          <div>
            <label className={fieldLabelClass}>Business Name</label>
            <input
              type="text"
              value={draft.businessName || ''}
              onChange={(e) => updateDraft('businessName', e.target.value)}
              className={selectClass}
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Website</label>
            <input
              type="text"
              placeholder="https://..."
              value={draft.website || ''}
              onChange={(e) => updateDraft('website', e.target.value)}
              className={selectClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={fieldLabelClass}>Service Required</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SERVICES_REQUIRED_OPTIONS.map((svc) => {
              const selected = (draft.servicesRequired || []).includes(svc);
              return (
                <button
                  key={svc}
                  type="button"
                  onClick={() => {
                    const current = draft.servicesRequired || [];
                    updateDraft('servicesRequired', selected ? current.filter((s) => s !== svc) : [...current, svc]);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                    selected ? 'bg-primary/10 text-primary border-primary/30' : 'bg-form-input-bg text-app-text-muted border-app-border'
                  }`}
                >
                  {svc}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0 mt-4">
          <div>
            <label className={fieldLabelClass}>Business Type / Industry</label>
            <input
              type="text"
              value={draft.businessType || ''}
              onChange={(e) => updateDraft('businessType', e.target.value)}
              className={selectClass}
            />
          </div>
          {(!draft.servicesRequired?.length || draft.servicesRequired.some((s) => MARKETING_TYPE_SERVICES.includes(s))) && (
            <div>
              <label className={fieldLabelClass}>Monthly Marketing Budget</label>
              <select
                value={draft.monthlyMarketingBudget || ''}
                onChange={(e) => updateDraft('monthlyMarketingBudget', e.target.value)}
                className={selectClass}
              >
                <option value="">-Select-</option>
                {MONTHLY_MARKETING_BUDGET_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          )}
          {(!draft.servicesRequired?.length || draft.servicesRequired.some((s) => !MARKETING_TYPE_SERVICES.includes(s))) && (
            <div>
              <label className={fieldLabelClass}>Project Budget</label>
              <select
                value={draft.projectBudget || ''}
                onChange={(e) => updateDraft('projectBudget', e.target.value)}
                className={selectClass}
              >
                <option value="">-Select-</option>
                {PROJECT_BUDGET_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={fieldLabelClass}>Timeline</label>
            <select
              value={draft.timeline || ''}
              onChange={(e) => updateDraft('timeline', e.target.value)}
              className={selectClass}
            >
              <option value="">-Select-</option>
              {TIMELINE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>Decision Maker</label>
            <select
              value={draft.decisionMaker || ''}
              onChange={(e) => updateDraft('decisionMaker', e.target.value)}
              className={selectClass}
            >
              <option value="">-Select-</option>
              {DECISION_MAKER_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>Current Vendor</label>
            <input
              type="text"
              value={draft.currentVendor || ''}
              onChange={(e) => updateDraft('currentVendor', e.target.value)}
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border bg-form-input-bg text-app-text border-app-border">
                {lead.leadScore ?? 0}<span className="text-app-text-muted font-normal">/100</span>
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className={fieldLabelClass}>Requirement Summary</label>
          <textarea
            rows={3}
            value={draft.requirementSummary || ''}
            onChange={(e) => updateDraft('requirementSummary', e.target.value)}
            className={selectClass}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Updates'}
        </button>
      </div>

      {/* Documents — proposal, quotation, scope, and other attachments */}
      <div className={sectionClass}>
        <label className={sectionLabelClass}>Documents</label>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className={`${selectClass} w-full sm:w-auto flex-1`}
          >
            <option value="Proposal">Proposal</option>
            <option value="Quotation">Quotation</option>
            <option value="Scope">Scope</option>
            <option value="Attachment">Other Attachment</option>
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
              <div key={doc._id} className="flex items-center justify-between gap-3 bg-form-input-bg px-3 py-2 rounded-lg">
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-app-text hover:text-primary min-w-0">
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate">{doc.name}</span>
                  <span className="text-[10px] text-app-text-muted shrink-0 uppercase font-bold">{doc.docType}</span>
                </a>
                <button onClick={() => handleDeleteDocument(doc._id)} className="text-red-400 hover:text-red-300 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {lead.nextFollowUpDate && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-2 text-sm text-app-text">
          <Clock size={14} className="text-primary shrink-0" />
          Next follow-up: {new Date(lead.nextFollowUpDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Campaign Attribution */}
      <div className={sectionClass}>
        <label className={sectionLabelClass}>Campaign Attribution</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">Source Link</label>
            {lead.source ? (
              <a href={lead.source} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-app-text hover:text-primary hover:underline truncate block">
                {lead.source}
              </a>
            ) : (
              <p className="text-sm font-medium text-app-text">-</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className={sectionClass}>
        <label className={`${sectionLabelClass} flex items-center gap-2`}>
          <Clock size={14} /> Activity Timeline
        </label>
        <div className="space-y-4">
          {buildActivityTimeline(lead).map((event) => (
            <div key={event.key} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-app-text">{event.title}</p>
                <p className="text-xs text-app-text-muted mt-0.5">
                  {new Date(event.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                {event.note && (
                  <p className="text-xs text-app-text-muted mt-1 italic border-l-2 border-primary/30 pl-2 py-0.5">{event.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Call History — every logged call attempt, richest-first. Each entry
          is written by server/services/leadLifecycle.js the moment a call
          outcome is saved above; callType/leadStage are auto-classified. */}
      {(lead.callLogs || []).length > 0 && (
        <div className={sectionClass}>
          <label className={`${sectionLabelClass} flex items-center gap-2`}>
            <PhoneCall size={14} /> Call History
          </label>
          <div className="space-y-3">
            {[...lead.callLogs].reverse().map((call) => (
              <div key={call._id || call.touchNumber} className="bg-form-input-bg rounded-lg p-3">
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
  );
}
