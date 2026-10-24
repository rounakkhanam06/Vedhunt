// Page-size choices and the page-number strip for client-paginated lists.
export const PAGE_SIZES = [10, 20, 50, 100];

/** 1 … 4 5 [6] 7 8 … 20 — first, last and the pages around the current one, with gaps shown as '…'. */
export function pageWindow(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => {
    const gap = i > 0 ? p - sorted[i - 1] : 1;
    if (gap === 2) return [p - 1, p]; // a lone hidden page is shown rather than replaced by '…'
    return gap > 2 ? ['…', p] : [p];
  });
}
