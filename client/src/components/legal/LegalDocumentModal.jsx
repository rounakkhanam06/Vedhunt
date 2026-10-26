import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getPortalLegal } from '../../services/portalLegalService';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

/**
 * Read-only viewer for a portal Terms / Privacy document. It follows the
 * portal's theme tokens (dark in the client portal, light/dark in the employee
 * portal, light on a light login page), so it never flashes a white sheet over
 * a dark screen. On phones it opens as a bottom sheet.
 */
const LegalDocumentModal = ({ doc, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    getPortalLegal(doc)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [doc]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus(); // keyboard / screen-reader users land inside the dialog
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-doc-title"
        className="w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col bg-app-card text-app-text border border-app-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden outline-none"
      >
        {/* Grab handle — phones only, signals this is a sheet you can dismiss */}
        <div className="sm:hidden pt-2.5 flex justify-center shrink-0" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-app-border" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-3 pb-3 sm:py-4 border-b border-app-border shrink-0">
          <div className="min-w-0">
            <h2 id="legal-doc-title" className="text-base sm:text-xl font-bold leading-snug text-app-text">
              {data?.hero?.heading || (error ? 'Document unavailable' : 'Loading…')}
            </h2>
            {data?.hero?.lastUpdated && <p className="text-xs text-app-text-muted mt-1">{data.hero.lastUpdated}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-app-text-muted hover:bg-app-border/40 hover:text-app-text cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 sm:py-5 text-[15px] sm:text-sm leading-relaxed">
          {error ? (
            <p className="text-app-text-muted">This document could not be loaded. Please check your connection and try again.</p>
          ) : !data ? (
            <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-app-border border-t-primary rounded-full animate-spin" /></div>
          ) : (
            <>
              {(data.hero?.introParagraphs || []).map((t, i) => <p key={i} className="mb-3 text-app-text/90">{t}</p>)}
              {(data.policyData || []).map((s) => (
                <section key={s.id} className="mt-6 first:mt-0">
                  {s.title && <h3 className="font-semibold text-app-text mb-2">{s.title}</h3>}
                  {/* Colours baked into the document by the editor are overridden so text always follows the theme */}
                  <div
                    className="legal-doc-content text-app-text/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1.5 [&_p]:mb-2 [&_a]:text-primary [&_a]:underline [&_a]:break-words [&_[style]]:text-inherit! [&_[style]]:bg-transparent! [&_strong]:text-app-text"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.content) }}
                  />
                </section>
              ))}
            </>
          )}
        </div>

        <div
          className="px-5 sm:px-6 pt-3 border-t border-app-border flex sm:justify-end shrink-0"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 sm:py-2 rounded-xl sm:rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalDocumentModal;
