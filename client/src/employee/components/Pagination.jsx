import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES, pageWindow } from '../lib/pagination';

const pageButton = 'min-w-8 h-8 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * Footer for a client-paginated list: "Showing 21–40 of 87", page buttons and
 * a page-size picker. Renders nothing when the whole list fits on the smallest page.
 */
export default function Pagination({ total, page, pageSize, onPage, onPageSize, label = 'leads' }) {
  if (total <= PAGE_SIZES[0]) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-app-card border border-app-border rounded-xl px-4 py-3">
      <p className="text-xs text-app-text-muted">
        Showing <span className="font-bold text-app-text">{from}–{to}</span> of <span className="font-bold text-app-text">{total}</span> {label}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={current === 1} onClick={() => onPage(current - 1)} aria-label="Previous page"
          className={`${pageButton} border-app-border text-app-text-muted hover:text-app-text hover:border-primary/50 inline-flex items-center justify-center`}>
          <ChevronLeft size={14} />
        </button>
        {pageWindow(current, totalPages).map((p, i) => (p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-app-text-muted">…</span>
        ) : (
          <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === current ? 'page' : undefined}
            className={`${pageButton} ${p === current ? 'bg-primary text-white border-primary' : 'border-app-border text-app-text-muted hover:text-app-text hover:border-primary/50'}`}>
            {p}
          </button>
        )))}
        <button type="button" disabled={current === totalPages} onClick={() => onPage(current + 1)} aria-label="Next page"
          className={`${pageButton} border-app-border text-app-text-muted hover:text-app-text hover:border-primary/50 inline-flex items-center justify-center`}>
          <ChevronRight size={14} />
        </button>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Leads per page"
          className="ml-1 bg-app-bg border border-app-border rounded-lg px-2 h-8 text-xs text-app-text focus:outline-none focus:border-primary/50 cursor-pointer">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>
    </div>
  );
}
