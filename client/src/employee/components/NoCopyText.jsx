/**
 * Wraps lead PII (name/phone/email) that a BD may see and act on (tap to
 * call/email) but should not be able to select, copy, or lift out of the
 * page — blocks selection at the CSS level (so it's excluded from any
 * selection range, including Ctrl+A) and belt-and-suspenders blocks the
 * copy/cut/context-menu/drag events too. Not a substitute for server-side
 * access control — a determined user can still read it via devtools — this
 * only stops the casual "select and paste elsewhere" path.
 */
export default function NoCopyText({ as: Component = 'span', className = '', children, ...rest }) {
  const block = (e) => e.preventDefault();
  return (
    <Component
      className={`select-none ${className}`}
      onCopy={block}
      onCut={block}
      onContextMenu={block}
      onDragStart={block}
      {...rest}
    >
      {children}
    </Component>
  );
}
