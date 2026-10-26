import { useEffect } from 'react';

/**
 * Stops the page behind a dialog from scrolling while it is open, and puts it back
 * exactly as it was when the dialog closes (also if it unmounts). Also closes the
 * dialog on Escape when `onEscape` is given.
 */
export default function useBodyScrollLock(onEscape) {
  useEffect(() => {
    const body = document.body.style.overflow;
    const root = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onEscape?.(); };
    if (onEscape) document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = body;
      document.documentElement.style.overflow = root;
      if (onEscape) document.removeEventListener('keydown', onKey);
    };
  }, [onEscape]);
}
