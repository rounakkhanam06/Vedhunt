import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import employeeApi from '../../services/employeeApi';
import toast from 'react-hot-toast';
import { ArrowLeft, Phone, Mail, MessageCircle, Play, Square, Clock, FileText } from 'lucide-react';
import { NOT_CONNECTED_REASONS, INTEREST_LEVELS, LOST_DROPPED_REASONS, FOLLOWUP_TRIGGER_INTEREST_LEVELS } from '../../shared/leadConstants';
import NoCopyText from '../components/NoCopyText';

const sectionClass = 'bg-app-card border border-app-border rounded-xl p-5';
const sectionLabelClass = 'text-xs font-bold text-app-text-muted uppercase tracking-wider mb-3 block';
const fieldLabelClass = 'block text-[10px] font-medium text-app-text-muted mb-1 uppercase tracking-wider';
const selectClass = 'w-full bg-form-input-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50';

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

  const buildDraft = (l) => ({
    connected: l.connected || '',
    interestLevel: l.interestLevel || '',
    notConnectedReason: l.notConnectedReason || '',
    remark: l.remark || '',
    nextFollowUpDate: l.nextFollowUpDate ? new Date(l.nextFollowUpDate).toISOString() : '',
    dealValue: l.dealValue || '',
    notConvertedReason: l.notConvertedReason || '',
    proposalValue: l.proposalValue || '',
    proposalSentDate: l.proposalSentDate ? new Date(l.proposalSentDate).toISOString() : '',
    holdReason: l.holdReason || '',
    holdUntil: l.holdUntil ? new Date(l.holdUntil).toISOString() : '',
    status: l.status
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
      navigate('/employee/dashboard?tab=leads');
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
    <div className="space-y-5 max-w-3xl mx-auto">
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
        <div className="grid grid-cols-3 gap-2 mt-4">
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <Phone size={16} /> Call
          </a>
          {toWhatsAppHref(lead.phone) ? (
            <a
              href={toWhatsAppHref(lead.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-sm hover:border-primary hover:text-primary transition-colors"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          ) : <div />}
          <a
            href={`mailto:${lead.email}`}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-app-border text-app-text font-bold text-sm hover:border-primary hover:text-primary transition-colors"
          >
            <Mail size={16} /> Email
          </a>
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
          {lead.businessName && (
            <div className="flex items-center justify-between py-2">
              <span className="text-app-text-muted">Business</span>
              <span className="font-medium text-app-text">{lead.businessName}</span>
            </div>
          )}
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
            <span className="text-app-text-muted">Estimated deal value</span>
            <span className="font-medium text-app-text">₹{(lead.dealValue || 0).toLocaleString('en-IN')}</span>
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

      {/* Call Outcome + Pipeline + Remark */}
      <div className={sectionClass}>
        <label className={sectionLabelClass}>Call Outcome &amp; Stage</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabelClass}>Status</label>
            <select
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
            <label className={fieldLabelClass}>Connected?</label>
            <select
              value={draft.connected || ''}
              onChange={(e) => updateDraft('connected', e.target.value)}
              className={selectClass}
            >
              <option value="">—</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          {draft.connected === 'No' && (
            <div>
              <label className={fieldLabelClass}>
                Not Connected Reason <span className="text-primary">*required</span>
              </label>
              <select
                value={draft.notConnectedReason || ''}
                onChange={(e) => updateDraft('notConnectedReason', e.target.value)}
                className={selectClass}
              >
                <option value="">—</option>
                {NOT_CONNECTED_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
          )}
          {draft.connected === 'Yes' && (
            <div>
              <label className={fieldLabelClass}>
                Interest Level <span className="text-primary">*required</span>
              </label>
              <select
                value={draft.interestLevel || ''}
                onChange={(e) => updateDraft('interestLevel', e.target.value)}
                className={selectClass}
              >
                <option value="">—</option>
                {INTEREST_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={fieldLabelClass}>
              Next Follow-Up Date &amp; Time
              {(FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(draft.interestLevel) || draft.notConnectedReason === 'Asked to Call Later') && (
                <span className="text-primary"> *required</span>
              )}
            </label>
            <input
              type="datetime-local"
              value={draft.nextFollowUpDate ? new Date(draft.nextFollowUpDate).toISOString().slice(0, 16) : ''}
              onChange={(e) => updateDraft('nextFollowUpDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
              className={selectClass}
              style={{ colorScheme: 'dark' }}
            />
          </div>
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
            </>
          )}
          {draft.status === 'Won' && (
            <div>
              <label className={fieldLabelClass}>Deal Value (₹) <span className="text-primary">*required</span></label>
              <input
                type="number"
                min="0"
                value={draft.dealValue || ''}
                onChange={(e) => updateDraft('dealValue', e.target.value)}
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
                <label className={fieldLabelClass}>Resume By (optional)</label>
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
    </div>
  );
}
