import { useState } from 'react';

// Roughly what fits in two lines of the remark column before it needs clamping.
const CLAMP_CHARS = 110;
const CLAMP_LINES = 2;

/** Trims each line and drops blank lines, so pasted notes don't leave stray indents or gaps. */
const tidy = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');

/**
 * A call remark for a table cell: two lines with "Show more" when it's
 * longer, so one long note doesn't stretch its row across the screen.
 */
export default function RemarkCell({ text }) {
  const [open, setOpen] = useState(false);
  const remark = tidy(text);
  if (!remark) return <span className="text-app-text-muted">—</span>;

  const long = remark.length > CLAMP_CHARS || remark.split('\n').length > CLAMP_LINES;
  return (
    <div className="text-xs leading-relaxed text-app-text-muted">
      <p className={`whitespace-pre-line break-words ${long && !open ? 'line-clamp-2' : ''}`} title={long && !open ? remark : undefined}>
        {remark}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
