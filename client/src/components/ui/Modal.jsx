import { useEffect } from 'react';
import { X } from 'lucide-react';

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/**
 * Shared dialog shell: dimmed overlay, themed card, title bar, Esc/overlay to
 * close, and background scroll lock (the same `modal-open` body class the
 * portals already use).
 */
export default function Modal({ title, subtitle, onClose, size = 'md', children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-app-card border border-app-border rounded-2xl w-full ${WIDTHS[size] || WIDTHS.md} max-h-[90vh] flex flex-col shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-app-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-app-text">{title}</h2>
            {subtitle && <p className="text-xs text-app-text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-app-text-muted hover:text-app-text cursor-pointer shrink-0" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="p-4 border-t border-app-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
