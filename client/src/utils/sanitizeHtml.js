// Minimal HTML sanitizer for admin-authored rich text (ReactQuill output)
// shown on login/portal pages: drops script-capable elements, inline event
// handlers and javascript:/data: URLs, keeps ordinary formatting.

const BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT']);
const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction'];

export function sanitizeHtml(html = '') {
  if (typeof window === 'undefined' || !window.DOMParser) return '';
  const doc = new window.DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  if (!root) return '';

  root.querySelectorAll('*').forEach((el) => {
    if (BLOCKED_TAGS.has(el.tagName)) { el.remove(); return; }
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') el.removeAttribute(attr.name);
      else if (URL_ATTRS.includes(name) && /^(javascript|vbscript|data):/.test(value)) el.removeAttribute(attr.name);
    });
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
  });
  return root.innerHTML;
}
