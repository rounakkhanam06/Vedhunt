import useBodyScrollLock from '../hooks/useBodyScrollLock';

/**
 * Drop inside a popup that is rendered conditionally ({open && <div>…}):
 * while it is mounted the page behind can't scroll, and Escape calls onClose.
 * Pass a stable onClose (useCallback) so the lock isn't re-applied every render.
 */
export default function ModalScrollLock({ onClose }) {
  useBodyScrollLock(onClose);
  return null;
}
