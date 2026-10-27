import { useState } from 'react';

const labelClass = 'text-xs text-app-text-muted font-semibold uppercase tracking-wider';

/**
 * Optional "Call note" for the call outcome — what was said on the call. It is saved on the
 * call record and shows in Lead Activity's "Remark / note" column. Never required: an outcome
 * saves with or without one.
 *
 * The box is always for the NEXT call: it starts empty again once an outcome is logged. The
 * latest call's saved note shows under it, and "Edit" loads that note into the box to change it.
 *   - an outcome is staged but not saved yet  → the note travels with it (no button needed)
 *   - otherwise                               → text typed now is saved with the next outcome
 *   - editing the latest call's note          → "Save note" edits it; logs no new call
 *
 * @param lastCall  the lead's latest call log (or null)
 * @param pending   a staged call outcome is waiting to be saved
 * @param value     the unsaved text (null = empty box)
 * @param onChange  (text | null) => void
 * @param onSave    (text) => Promise<boolean> — edits the latest call's note; true when saved
 */
export default function CallNoteField({ lastCall, pending, value, onChange, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const saved = (lastCall?.remark || '').trim();
  const isEditing = editing && !pending && Boolean(lastCall);
  const shown = value ?? '';
  const canSave = isEditing && value !== null && value.trim() !== saved;

  let hint = 'Optional. Saved with the next call outcome you log.';
  if (pending) hint = 'Optional. Saved together with this call outcome.';
  else if (isEditing) hint = `Editing the note on Touch #${lastCall.touchNumber}.`;

  const startEdit = () => { setEditing(true); onChange(saved); };
  const stopEdit = () => { setEditing(false); onChange(null); };
  const save = async () => {
    if (await onSave(value.trim())) setEditing(false);
  };

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
        {isEditing && (
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={stopEdit} className="text-xs text-app-text-muted hover:text-app-text cursor-pointer">Cancel</button>
            {canSave && (
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving…' : 'Save note'}
              </button>
            )}
          </div>
        )}
      </div>
      {lastCall && !isEditing && (
        <div className="mt-2 text-xs text-app-text-muted border-l-2 border-app-border pl-2">
          <span className="font-semibold">Touch #{lastCall.touchNumber} note:</span>{' '}
          {saved ? <span className="whitespace-pre-wrap break-words text-app-text">{saved}</span> : <span className="italic">none</span>}
          {!pending && (
            <button type="button" onClick={startEdit} className="ml-2 text-primary hover:underline cursor-pointer">{saved ? 'Edit' : 'Add'}</button>
          )}
        </div>
      )}
    </div>
  );
}
