const labelClass = 'text-xs text-app-text-muted font-semibold uppercase tracking-wider';

/**
 * Optional "Call note" for the call outcome — what was said on the call. It is saved on the
 * call record and shows in Lead Activity's "Remark / note" column. Never required: an outcome
 * saves with or without one.
 *
 * Three situations, one box:
 *   - an outcome is staged but not saved yet  → the note travels with it (no button needed)
 *   - a call is already logged                → shows that call's note; "Save note" edits it
 *   - nothing logged yet                      → text typed now is saved with the next outcome
 *
 * @param lastCall  the lead's latest call log (or null)
 * @param pending   a staged call outcome is waiting to be saved
 * @param value     the unsaved text, or null while the box shows what is already saved
 * @param onChange  (text) => void
 * @param onSave    (text) => Promise — edits the latest call's note
 */
export default function CallNoteField({ lastCall, pending, value, onChange, onSave, saving }) {
  const saved = (lastCall?.remark || '').trim();
  const shown = value ?? (pending ? '' : saved);
  const canSave = !pending && Boolean(lastCall) && value !== null && value.trim() !== saved;

  let hint = 'Optional. Saved with the next call outcome you log.';
  if (pending) hint = 'Optional. Saved together with this call outcome.';
  else if (lastCall) hint = `Optional. Shown on Touch #${lastCall.touchNumber} in Lead Activity.`;

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <label className={labelClass} htmlFor="call-note">Call note <span className="normal-case font-normal tracking-normal">(optional)</span></label>
        <span className="text-[11px] text-app-text-muted">{shown.length}/1000</span>
      </div>
      <textarea
        id="call-note"
        rows={2}
        maxLength={1000}
        value={shown}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What was said on this call…"
        className="mt-1.5 w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary resize-none"
      />
      <div className="flex items-center justify-between gap-3 mt-1.5">
        <p className="text-[11px] text-app-text-muted">{hint}</p>
        {canSave && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(value.trim())}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        )}
      </div>
    </div>
  );
}
