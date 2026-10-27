import { Eye, X } from 'lucide-react';
import { getPreview, endPreview } from '../shared/portalPreview';

/**
 * Shown on every page of a Super Admin's "View as client / employee" tab
 * (shared/portalPreview.js), so a preview can never be mistaken for a real login.
 */
export default function PreviewBanner() {
  const preview = getPreview();
  if (!preview) return null;
  const who = preview.kind === 'client' ? 'client' : 'employee';
  return (
    <div role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] max-w-[calc(100vw-32px)] flex items-center gap-3 px-4 py-2.5 rounded-full bg-amber-500 text-black shadow-2xl text-xs sm:text-sm font-semibold">
      <Eye size={16} className="shrink-0" />
      <span className="truncate">Preview: viewing as {who} <strong>{preview.name}</strong> · read-only</span>
      <button type="button" onClick={endPreview}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/15 hover:bg-black/25 cursor-pointer">
        <X size={14} /> End preview
      </button>
    </div>
  );
}
