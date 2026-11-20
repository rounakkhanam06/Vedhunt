import { useEffect } from 'react';

// Popups across the panels are full-screen overlays ("fixed inset-0 …"). While any such overlay
// is showing, the page behind must not scroll. Rather than wiring a lock into every form, the
// layout watches the DOM and toggles a class on <html> (styled in index.css), so every popup —
// existing and future — gets it. A class is used (not inline overflow) so it never fights the
// per-dialog useBodyScrollLock, which saves and restores inline styles.
const CLASS = 'modal-scroll-locked';

function overlayShowing() {
  for (const el of document.querySelectorAll('.fixed.inset-0')) {
    const s = getComputedStyle(el);
    // Closed drawers' backdrops stay mounted but hidden (display none, lg:hidden, opacity 0)
    if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none' || Number(s.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
  }
  return false;
}

export default function useAutoModalScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.classList.toggle(CLASS, overlayShowing()));
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      cancelAnimationFrame(frame);
      root.classList.remove(CLASS);
    };
  }, []);
}
