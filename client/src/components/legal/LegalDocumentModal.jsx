import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getPortalLegal } from '../../services/portalLegalService';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

/**
 * Read-only viewer for a portal Terms / Privacy document. White "paper"
 * styling so it reads the same in the dark client portal, the themed
 * employee portal and on the login pages.
 */
const LegalDocumentModal = ({ doc, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

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
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="legal-doc-title" className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white text-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 id="legal-doc-title" className="text-lg sm:text-xl font-bold text-gray-900">
              {data?.hero?.heading || (error ? 'Document unavailable' : 'Loading…')}
            </h2>
            {data?.hero?.lastUpdated && <p className="text-xs text-gray-500 mt-0.5">{data.hero.lastUpdated}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 text-sm leading-relaxed">
          {error ? (
            <p className="text-gray-600">This document could not be loaded. Please check your connection and try again.</p>
          ) : !data ? (
            <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-gray-200 border-t-[#FF5A1F] rounded-full animate-spin" /></div>
          ) : (
            <>
              {(data.hero?.introParagraphs || []).map((t, i) => <p key={i} className="mb-3 text-gray-700">{t}</p>)}
              {(data.policyData || []).map((s) => (
                <section key={s.id} className="mt-5">
                  {s.title && <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>}
                  <div
                    className="legal-doc-content text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_a]:text-[#FF5A1F] [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.content) }}
                  />
                </section>
              ))}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  );
};

export default LegalDocumentModal;
