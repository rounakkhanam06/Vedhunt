import { useState } from 'react';
import toast from 'react-hot-toast';
import { essPost, essPut, apiError } from '../lib/ess';
import { toDateTimeInput, fromLocalInput, fmtDateTime } from '../lib/datetime';
import { INTEREST_LEVELS, NOT_CONNECTED_REASONS, NEXT_ACTION_TYPES, NON_ACTIVE_FOLLOWUP_STATUSES } from '../../shared/leadConstants';

// Outcomes after which the lead needs a stage decision, not another follow-up
const CLOSING_INTEREST = ['Not Interested', 'Wrong / Junk Lead'];

const chip = (active) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${active ? 'bg-primary text-white' : 'bg-app-card border border-app-border text-app-text hover:border-primary/50'}`;
const fieldClass = 'w-full bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50';
const labelClass = 'block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1';

/**
 * Schedule a lead's next action, or — when one is already scheduled —
 * complete it: an outcome and a result are required, and the next action
 * (type + date) too while the lead stays active. The server enforces the
 * same rules (services/leadLifecycle.js completeFollowUp).
 */
export default function FollowUpForm({ lead, onSaved, onCancel }) {
  const completing = Boolean(lead.nextFollowUpDate) && !NON_ACTIVE_FOLLOWUP_STATUSES.includes(lead.status);
  const [connected, setConnected] = useState('');
  const [interestLevel, setInterestLevel] = useState('');
  const [notConnectedReason, setNotConnectedReason] = useState('');
  const [result, setResult] = useState('');
  const [nextActionType, setNextActionType] = useState(completing ? '' : lead.nextActionType || 'Call');
  const [nextAt, setNextAt] = useState(completing ? '' : toDateTimeInput(lead.nextFollowUpDate));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const closingOutcome = connected === 'Yes' && CLOSING_INTEREST.includes(interestLevel);
  const needsNext = !completing || !closingOutcome;

  const submit = async (e) => {
    e.preventDefault();
    const missing = [];
    if (completing) {
      if (!connected) missing.push('whether you reached them');
      if (connected === 'Yes' && !interestLevel) missing.push('interest level');
      if (connected === 'No' && !notConnectedReason) missing.push('reason');
      if (!result.trim()) missing.push('result');
    }
    if (needsNext && !nextActionType) missing.push('next action');
    if (needsNext && !nextAt) missing.push('date & time');
    if (missing.length) { setError(`Please add: ${missing.join(', ')}.`); return; }
    if (nextAt && new Date(nextAt) < new Date()) { setError('The next action must be in the future.'); return; }

    setSaving(true);
    setError('');
    try {
      const res = completing
        ? await essPost(`/leads/${lead._id}/follow-up/complete`, {
          connected, interestLevel, notConnectedReason, result,
          nextActionType: needsNext ? nextActionType : '',
          nextFollowUpDate: needsNext ? fromLocalInput(nextAt) : '',
        })
        : await essPut(`/leads/${lead._id}`, { nextFollowUpDate: fromLocalInput(nextAt), nextActionType });
      toast.success(completing ? 'Follow-up completed' : 'Next action scheduled', { duration: 1500, position: 'bottom-right' });
      onSaved?.(res.lead);
    } catch (err) {
      setError(apiError(err, 'Could not save the follow-up.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 bg-form-input-bg p-3 rounded-lg">
      {completing && (
        <>
          <p className="text-xs text-app-text-muted">
            Completing <span className="font-semibold text-app-text">{lead.nextActionType || 'follow-up'}</span> due {fmtDateTime(lead.nextFollowUpDate)}
          </p>
          <div>
            <span className={labelClass}>Outcome</span>
            <div className="flex gap-2">
              <button type="button" className={chip(connected === 'Yes')} onClick={() => setConnected('Yes')}>Reached</button>
              <button type="button" className={chip(connected === 'No')} onClick={() => setConnected('No')}>Not reached</button>
            </div>
          </div>
          {connected === 'Yes' && (
            <div className="flex flex-wrap gap-2">
              {INTEREST_LEVELS.map((level) => <button key={level} type="button" className={chip(interestLevel === level)} onClick={() => setInterestLevel(level)}>{level}</button>)}
            </div>
          )}
          {connected === 'No' && (
            <div className="flex flex-wrap gap-2">
              {NOT_CONNECTED_REASONS.map((r) => <button key={r} type="button" className={chip(notConnectedReason === r)} onClick={() => setNotConnectedReason(r)}>{r}</button>)}
            </div>
          )}
          <div>
            <label className={labelClass}>Result</label>
            <textarea rows={2} value={result} onChange={(e) => setResult(e.target.value)} placeholder="What happened on this follow-up?" className={`${fieldClass} resize-none`} />
          </div>
        </>
      )}
      {needsNext ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Next action</label>
            <select value={nextActionType} onChange={(e) => setNextActionType(e.target.value)} className={fieldClass}>
              <option value="">Select…</option>
              {NEXT_ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Due</label>
            <input type="datetime-local" value={nextAt} min={toDateTimeInput(new Date())} onChange={(e) => setNextAt(e.target.value)} className={fieldClass} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-500">No next action needed — update the lead's stage (e.g. Lost / Dropped) from the workspace.</p>
      )}
      {error && <p className="text-xs text-rose-400" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-app-text-muted hover:text-app-text cursor-pointer">Cancel</button>}
        <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
          {saving ? 'Saving…' : completing ? 'Complete follow-up' : 'Schedule'}
        </button>
      </div>
    </form>
  );
}
