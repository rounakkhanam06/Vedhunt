// Builds "send to this number with this message" links for each WhatsApp
// client. The employee picks (and can save) which one opens.

export const WHATSAPP_APPS = [
  { value: 'web', label: 'WhatsApp Web', hint: 'Opens web.whatsapp.com in your browser' },
  { value: 'desktop', label: 'WhatsApp Desktop', hint: 'Opens the installed desktop app' },
  { value: 'business', label: 'WhatsApp Business', hint: 'Opens the WhatsApp Business app (where installed)' },
];

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);
const isAndroid = () => /Android/i.test(ua());
const isIOS = () => /iPhone|iPad|iPod/i.test(ua());

/** Digits with country code — Indian 10-digit numbers get 91 prefixed. */
export function whatsappNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

export function buildWhatsAppUrl(app, phone, text = '') {
  const n = whatsappNumber(phone);
  const t = encodeURIComponent(text);
  if (app === 'web') return `https://web.whatsapp.com/send?phone=${n}&text=${t}`;
  if (app === 'business' && isAndroid()) {
    return `intent://send?phone=${n}&text=${t}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
  }
  // iOS has no per-app scheme for Business — wa.me hands off to whichever app is installed.
  if (isIOS()) return `https://wa.me/${n}?text=${t}`;
  return `whatsapp://send?phone=${n}&text=${t}`; // desktop apps (regular and Business) register this
}

/** Opens a WhatsApp link — web links in a new tab, app schemes in place. */
export function openWhatsApp(url) {
  if (url.startsWith('http')) window.open(url, '_blank', 'noopener');
  else window.location.href = url;
}
